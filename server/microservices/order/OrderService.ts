/**
 * Order Service
 * Central service for order management with CQRS pattern
 * 
 * Patterns:
 * - CQRS (Command Query Responsibility Segregation)
 * - Event Sourcing for order history
 * - Saga orchestration for distributed transactions
 * - Idempotency for order creation
 */

import { BaseService, ServiceHealth, ServiceConfig } from "../core/BaseService";
import { storage } from "../../storage";
import { eventBus, EventTypes } from "../../infrastructure/eventBus";
import { sagaOrchestrator, SagaDefinition, SagaStep } from "../saga/SagaOrchestrator";
import type { Order, InsertOrder, OrderItem, InsertOrderItem, OrderEvent, InsertOrderEvent } from "@shared/schema";

// Types
export type OrderStatus = 
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready_for_pickup"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export interface CreateOrderCommand {
  customerId: string;
  restaurantId: string;
  items: {
    menuItemId: string;
    quantity: number;
    price: string;
    specialInstructions?: string;
  }[];
  deliveryAddress: string;
  deliveryLatitude?: string;
  deliveryLongitude?: string;
  specialInstructions?: string;
  couponCode?: string;
  paymentMethod?: string;
  idempotencyKey: string;
}

export interface OrderQuery {
  customerId?: string;
  restaurantId?: string;
  deliveryPartnerId?: string;
  status?: OrderStatus | OrderStatus[];
  startDate?: Date;
  endDate?: Date;
}

export interface OrderWithDetails extends Order {
  items: OrderItem[];
  events: OrderEvent[];
  restaurant?: { id: string; name: string };
  deliveryPartner?: { id: string; name: string };
}

const serviceConfig: ServiceConfig = {
  name: "order-service",
  version: "1.0.0",
  timeout: 10000,
  retryAttempts: 3,
  circuitBreakerEnabled: true,
};

// Idempotency store for order creation
const idempotencyStore = new Map<string, { orderId: string; createdAt: Date }>();

class OrderService extends BaseService {
  constructor() {
    super(serviceConfig);
    this.initializeEventHandlers();
    this.registerSaga();
  }

  private initializeEventHandlers(): void {
    // Handle payment success
    eventBus.subscribe(EventTypes.PAYMENT_SUCCESS, async (data: any) => {
      await this.updateOrderStatus(data.orderId, "confirmed", "Payment confirmed");
    });

    // Handle payment failure
    eventBus.subscribe(EventTypes.PAYMENT_FAILED, async (data: any) => {
      await this.updateOrderStatus(data.orderId, "cancelled", "Payment failed");
    });

    // Handle rider assignment
    eventBus.subscribe(EventTypes.RIDER_ASSIGNED, async (data: any) => {
      await this.assignDeliveryPartner(data.orderId, data.riderId);
    });
  }

  /**
   * Register order placement saga
   */
  private registerSaga(): void {
    const placeOrderSaga: SagaDefinition = {
      name: "place_order",
      steps: [
        {
          name: "validate_order",
          execute: async (ctx) => {
            // Validate restaurant is active
            const restaurant = await storage.getRestaurant(ctx.restaurantId);
            if (!restaurant || !restaurant.isActive) {
              throw new Error("Restaurant is not available");
            }
            return { restaurant };
          },
          compensate: async () => {
            // No compensation needed for validation
          },
        },
        {
          name: "create_order",
          execute: async (ctx) => {
            const order = await this.createOrderInternal(ctx);
            return { orderId: order.id };
          },
          compensate: async (ctx, result) => {
            if (result?.orderId) {
              await this.cancelOrderInternal(result.orderId, "Saga compensation");
            }
          },
        },
        {
          name: "process_payment",
          execute: async (ctx, prevResults) => {
            // Publish payment initiation event
            await eventBus.publish(
              EventTypes.PAYMENT_INITIATED,
              {
                orderId: prevResults.create_order.orderId,
                amount: ctx.total,
                customerId: ctx.customerId,
                paymentMethod: ctx.paymentMethod,
              },
              ctx.correlationId
            );
            return { paymentInitiated: true };
          },
          compensate: async (ctx, result, prevResults) => {
            // Request payment refund if order was paid
            await eventBus.publish(
              EventTypes.PAYMENT_REFUNDED,
              {
                orderId: prevResults.create_order?.orderId,
                reason: "Order cancelled",
              },
              ctx.correlationId
            );
          },
        },
        {
          name: "notify_restaurant",
          execute: async (ctx, prevResults) => {
            await eventBus.publish(
              EventTypes.ORDER_CREATED,
              {
                orderId: prevResults.create_order.orderId,
                restaurantId: ctx.restaurantId,
                items: ctx.items,
              },
              ctx.correlationId
            );
            return { notified: true };
          },
          compensate: async () => {
            // Notification can't be undone
          },
        },
      ],
    };

    sagaOrchestrator.register(placeOrderSaga);
  }

  // ===== COMMANDS =====

  /**
   * Create order (Command) - Uses Saga pattern
   */
  async createOrder(command: CreateOrderCommand): Promise<Order> {
    return this.executeWithResilience(async () => {
      // Check idempotency
      const existing = idempotencyStore.get(command.idempotencyKey);
      if (existing) {
        const order = await storage.getOrder(existing.orderId);
        if (order) {
          this.logger.info("Returning existing order (idempotent)", { orderId: order.id });
          return order;
        }
      }

      // Calculate totals
      const subtotal = command.items.reduce(
        (sum, item) => sum + parseFloat(item.price) * item.quantity,
        0
      );

      const restaurant = await storage.getRestaurant(command.restaurantId);
      const deliveryFee = parseFloat(restaurant?.deliveryFee || "0");
      
      // Apply coupon if provided
      let discount = 0;
      let couponId: string | undefined;
      if (command.couponCode) {
        const coupon = await storage.getCouponByCode(command.couponCode);
        if (coupon && coupon.isActive) {
          if (coupon.discountType === "percentage") {
            discount = (subtotal * parseFloat(coupon.discountValue)) / 100;
            if (coupon.maxDiscount) {
              discount = Math.min(discount, parseFloat(coupon.maxDiscount));
            }
          } else {
            discount = parseFloat(coupon.discountValue);
          }
          couponId = coupon.id;
        }
      }

      const total = subtotal + deliveryFee - discount;

      // Execute saga
      const result = await sagaOrchestrator.execute("place_order", {
        ...command,
        subtotal: subtotal.toFixed(2),
        deliveryFee: deliveryFee.toFixed(2),
        discount: discount.toFixed(2),
        total: total.toFixed(2),
        couponId,
        correlationId: command.idempotencyKey,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || "Order creation failed");
      }

      const order = await storage.getOrder(result.data.create_order.orderId);
      if (!order) {
        throw new Error("Order not found after creation");
      }

      // Store idempotency key
      idempotencyStore.set(command.idempotencyKey, {
        orderId: order.id,
        createdAt: new Date(),
      });

      this.logger.info("Order created", { orderId: order.id });

      return order;
    }, "createOrder");
  }

  /**
   * Internal order creation
   */
  private async createOrderInternal(ctx: any): Promise<Order> {
    const order = await storage.createOrder({
      customerId: ctx.customerId,
      restaurantId: ctx.restaurantId,
      status: "pending",
      subtotal: ctx.subtotal,
      deliveryFee: ctx.deliveryFee,
      discount: ctx.discount,
      total: ctx.total,
      deliveryAddress: ctx.deliveryAddress,
      deliveryLatitude: ctx.deliveryLatitude,
      deliveryLongitude: ctx.deliveryLongitude,
      specialInstructions: ctx.specialInstructions,
      couponId: ctx.couponId,
      paymentMethod: ctx.paymentMethod,
      idempotencyKey: ctx.idempotencyKey,
    });

    // Create order items
    for (const item of ctx.items) {
      await storage.createOrderItem({
        orderId: order.id,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: item.price,
        specialInstructions: item.specialInstructions,
      });
    }

    // Record event (event sourcing)
    await this.recordOrderEvent(order.id, "ORDER_CREATED", {
      customerId: ctx.customerId,
      restaurantId: ctx.restaurantId,
      items: ctx.items,
      total: ctx.total,
    });

    return order;
  }

  /**
   * Update order status (Command)
   */
  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    reason?: string
  ): Promise<Order | undefined> {
    return this.executeWithResilience(async () => {
      const order = await storage.getOrder(orderId);
      if (!order) {
        throw new Error("Order not found");
      }

      // Validate status transition
      if (!this.isValidStatusTransition(order.status as OrderStatus, status)) {
        throw new Error(`Invalid status transition: ${order.status} -> ${status}`);
      }

      const updated = await storage.updateOrder(orderId, { status });

      // Record event
      await this.recordOrderEvent(orderId, `ORDER_${status.toUpperCase()}`, {
        previousStatus: order.status,
        newStatus: status,
        reason,
      });

      // Publish event
      await this.publishEvent(EventTypes.ORDER_STATUS_CHANGED, {
        orderId,
        previousStatus: order.status,
        newStatus: status,
        customerId: order.customerId,
        restaurantId: order.restaurantId,
        deliveryPartnerId: order.deliveryPartnerId,
        timestamp: new Date(),
      });

      await this.invalidateCache(`order:${orderId}:*`);

      return updated;
    }, "updateOrderStatus");
  }

  /**
   * Cancel order (Command)
   */
  async cancelOrder(orderId: string, reason: string): Promise<Order | undefined> {
    return this.updateOrderStatus(orderId, "cancelled", reason);
  }

  /**
   * Internal cancel order (for saga compensation)
   */
  private async cancelOrderInternal(orderId: string, reason: string): Promise<void> {
    await storage.updateOrder(orderId, { status: "cancelled" });
    await this.recordOrderEvent(orderId, "ORDER_CANCELLED", { reason });
  }

  /**
   * Assign delivery partner (Command)
   */
  async assignDeliveryPartner(
    orderId: string,
    deliveryPartnerId: string
  ): Promise<Order | undefined> {
    return this.executeWithResilience(async () => {
      const updated = await storage.updateOrder(orderId, { deliveryPartnerId });

      if (updated) {
        await this.recordOrderEvent(orderId, "RIDER_ASSIGNED", {
          deliveryPartnerId,
        });

        await this.invalidateCache(`order:${orderId}:*`);
      }

      return updated;
    }, "assignDeliveryPartner");
  }

  // ===== QUERIES =====

  /**
   * Get order by ID (Query)
   */
  async getOrder(orderId: string): Promise<Order | undefined> {
    return this.withCache(
      `order:${orderId}`,
      () => storage.getOrder(orderId),
      60 // 1 minute cache (orders are frequently updated)
    );
  }

  /**
   * Get order with full details (Query)
   */
  async getOrderWithDetails(orderId: string): Promise<OrderWithDetails | undefined> {
    return this.withCache(
      `order:${orderId}:details`,
      async () => {
        const order = await storage.getOrder(orderId);
        if (!order) return undefined;

        const [items, events] = await Promise.all([
          storage.getOrderItems(orderId),
          storage.getOrderEvents(orderId),
        ]);

        let restaurant;
        if (order.restaurantId) {
          const r = await storage.getRestaurant(order.restaurantId);
          if (r) restaurant = { id: r.id, name: r.name };
        }

        return {
          ...order,
          items,
          events,
          restaurant,
        };
      },
      30
    );
  }

  /**
   * Query orders (Query - optimized for read)
   */
  async queryOrders(query: OrderQuery): Promise<Order[]> {
    return this.executeWithResilience(async () => {
      let orders: Order[] = [];

      if (query.customerId) {
        orders = await storage.getOrdersByCustomer(query.customerId);
      } else if (query.restaurantId) {
        orders = await storage.getOrdersByRestaurant(query.restaurantId);
      } else if (query.deliveryPartnerId) {
        orders = await storage.getOrdersByDeliveryPartner(query.deliveryPartnerId);
      } else {
        orders = await storage.getOrders();
      }

      // Apply filters
      if (query.status) {
        const statuses = Array.isArray(query.status) ? query.status : [query.status];
        orders = orders.filter((o) => statuses.includes(o.status as OrderStatus));
      }

      if (query.startDate) {
        orders = orders.filter(
          (o) => o.createdAt && new Date(o.createdAt) >= query.startDate!
        );
      }

      if (query.endDate) {
        orders = orders.filter(
          (o) => o.createdAt && new Date(o.createdAt) <= query.endDate!
        );
      }

      return orders;
    }, "queryOrders");
  }

  /**
   * Get pending orders for restaurant (Query)
   */
  async getPendingOrdersForRestaurant(restaurantId: string): Promise<Order[]> {
    return this.queryOrders({
      restaurantId,
      status: ["pending", "confirmed", "preparing", "ready_for_pickup"],
    });
  }

  /**
   * Get active orders for delivery partner (Query)
   */
  async getActiveOrdersForDeliveryPartner(deliveryPartnerId: string): Promise<Order[]> {
    return this.queryOrders({
      deliveryPartnerId,
      status: ["ready_for_pickup", "out_for_delivery"],
    });
  }

  /**
   * Get order events (Event Sourcing Query)
   */
  async getOrderEvents(orderId: string): Promise<OrderEvent[]> {
    return this.withCache(
      `order:${orderId}:events`,
      () => storage.getOrderEvents(orderId),
      30
    );
  }

  // ===== HELPERS =====

  /**
   * Record order event (Event Sourcing)
   */
  private async recordOrderEvent(
    orderId: string,
    eventType: string,
    data: any
  ): Promise<OrderEvent> {
    return storage.createOrderEvent({
      orderId,
      eventType,
      data,
    });
  }

  /**
   * Validate status transition
   */
  private isValidStatusTransition(current: OrderStatus, next: OrderStatus): boolean {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["preparing", "cancelled"],
      preparing: ["ready_for_pickup", "cancelled"],
      ready_for_pickup: ["out_for_delivery", "cancelled"],
      out_for_delivery: ["delivered", "cancelled"],
      delivered: [],
      cancelled: [],
    };

    return validTransitions[current]?.includes(next) || false;
  }

  /**
   * Health check
   */
  async checkHealth(): Promise<ServiceHealth> {
    const checks = [];

    try {
      const startTime = Date.now();
      await storage.getPendingOrders();
      checks.push({
        name: "database",
        status: "pass" as const,
        responseTime: Date.now() - startTime,
      });
    } catch {
      checks.push({
        name: "database",
        status: "fail" as const,
        message: "Failed to query orders",
      });
    }

    checks.push({
      name: "idempotency_store",
      status: "pass" as const,
      message: `${idempotencyStore.size} keys stored`,
    });

    const allPassing = checks.every((c) => c.status === "pass");

    return {
      status: allPassing ? "healthy" : "degraded",
      checks,
      uptime: Date.now() - this.startTime.getTime(),
      timestamp: new Date(),
    };
  }
}

export const orderService = new OrderService();
