/**
 * Analytics Service
 * Business intelligence and reporting for the platform
 * 
 * Patterns:
 * - CQRS read model for analytics
 * - Time-series data aggregation
 * - Real-time metrics
 * - Materialized views
 */

import { BaseService, ServiceHealth, ServiceConfig } from "../core/BaseService";
import { storage } from "../../storage";
import { eventBus, EventTypes } from "../../infrastructure/eventBus";
import { metrics } from "../../infrastructure/metrics";

// Types
export interface DateRange {
  start: Date;
  end: Date;
}

export interface PlatformStats {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  totalCustomers: number;
  totalRestaurants: number;
  totalDeliveryPartners: number;
  activeOrders: number;
}

export interface OrderAnalytics {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
  totalRevenue: number;
  ordersByStatus: Record<string, number>;
  ordersByHour: { hour: number; count: number }[];
  ordersByDay: { date: string; count: number; revenue: number }[];
  topItems: { itemId: string; name: string; count: number }[];
}

export interface RestaurantAnalytics {
  restaurantId: string;
  restaurantName: string;
  totalOrders: number;
  totalRevenue: number;
  averageRating: number;
  averagePreparationTime: number;
  peakHours: { hour: number; orderCount: number }[];
  topItems: { itemId: string; name: string; count: number; revenue: number }[];
  conversionRate: number;
}

export interface DeliveryAnalytics {
  totalDeliveries: number;
  averageDeliveryTime: number;
  onTimeDeliveryRate: number;
  averageRating: number;
  deliveriesByHour: { hour: number; count: number }[];
  topPerformers: { partnerId: string; name: string; deliveries: number; rating: number }[];
}

export interface CustomerAnalytics {
  totalCustomers: number;
  newCustomers: number;
  repeatCustomers: number;
  averageOrdersPerCustomer: number;
  customerLifetimeValue: number;
  retentionRate: number;
  customersByCity: { city: string; count: number }[];
}

export interface RevenueAnalytics {
  totalRevenue: number;
  revenueByDay: { date: string; revenue: number }[];
  revenueByRestaurant: { restaurantId: string; name: string; revenue: number }[];
  revenueByCuisine: { cuisine: string; revenue: number }[];
  averageOrderValue: number;
  growthRate: number;
}

const serviceConfig: ServiceConfig = {
  name: "analytics-service",
  version: "1.0.0",
  timeout: 30000,
  retryAttempts: 2,
  circuitBreakerEnabled: true,
};

// In-memory analytics cache (would use time-series DB in production)
const analyticsCache = {
  ordersByHour: new Map<number, number>(),
  revenueByDay: new Map<string, number>(),
  orderCountByDay: new Map<string, number>(),
  lastUpdated: new Date(),
};

class AnalyticsService extends BaseService {
  constructor() {
    super(serviceConfig);
    this.initializeEventHandlers();
    this.startPeriodicAggregation();
  }

  private initializeEventHandlers(): void {
    // Track order events for real-time analytics
    eventBus.subscribe(EventTypes.ORDER_CREATED, async (data: any) => {
      this.trackOrderCreated(data);
    });

    eventBus.subscribe(EventTypes.ORDER_DELIVERED, async (data: any) => {
      this.trackOrderDelivered(data);
    });

    eventBus.subscribe(EventTypes.PAYMENT_SUCCESS, async (data: any) => {
      this.trackRevenue(data);
    });
  }

  private startPeriodicAggregation(): void {
    // Aggregate analytics every 5 minutes
    setInterval(() => {
      this.aggregateAnalytics();
    }, 5 * 60 * 1000);
  }

  private trackOrderCreated(data: any): void {
    const hour = new Date().getHours();
    const count = analyticsCache.ordersByHour.get(hour) || 0;
    analyticsCache.ordersByHour.set(hour, count + 1);

    const today = new Date().toISOString().split("T")[0];
    const dayCount = analyticsCache.orderCountByDay.get(today) || 0;
    analyticsCache.orderCountByDay.set(today, dayCount + 1);

    metrics.increment("orders.created");
  }

  private trackOrderDelivered(data: any): void {
    metrics.increment("orders.delivered");
  }

  private trackRevenue(data: any): void {
    const today = new Date().toISOString().split("T")[0];
    const currentRevenue = analyticsCache.revenueByDay.get(today) || 0;
    analyticsCache.revenueByDay.set(today, currentRevenue + parseFloat(data.amount || 0));

    metrics.increment("revenue.total", parseFloat(data.amount || 0));
  }

  private async aggregateAnalytics(): Promise<void> {
    analyticsCache.lastUpdated = new Date();
    this.logger.debug("Analytics aggregated");
  }

  /**
   * Get platform-wide statistics
   */
  async getPlatformStats(): Promise<PlatformStats> {
    return this.withCache(
      "analytics:platform",
      async () => {
        const [orders, restaurants] = await Promise.all([
          storage.getOrders(),
          storage.getRestaurants(),
        ]);

        const completedOrders = orders.filter((o) => o.status === "delivered");
        const totalRevenue = completedOrders.reduce(
          (sum, o) => sum + parseFloat(o.total),
          0
        );

        const activeOrders = orders.filter((o) =>
          ["pending", "confirmed", "preparing", "ready_for_pickup", "out_for_delivery"].includes(
            o.status
          )
        );

        const uniqueCustomers = new Set(orders.map((o) => o.customerId));

        return {
          totalOrders: orders.length,
          totalRevenue,
          averageOrderValue: completedOrders.length > 0
            ? totalRevenue / completedOrders.length
            : 0,
          totalCustomers: uniqueCustomers.size,
          totalRestaurants: restaurants.length,
          totalDeliveryPartners: 0, // Would query delivery partners
          activeOrders: activeOrders.length,
        };
      },
      300
    );
  }

  /**
   * Get order analytics
   */
  async getOrderAnalytics(dateRange?: DateRange): Promise<OrderAnalytics> {
    return this.withCache(
      `analytics:orders:${dateRange?.start?.toISOString() || "all"}`,
      async () => {
        let orders = await storage.getOrders();

        // Apply date filter
        if (dateRange) {
          orders = orders.filter((o) => {
            const orderDate = o.createdAt ? new Date(o.createdAt) : new Date();
            return orderDate >= dateRange.start && orderDate <= dateRange.end;
          });
        }

        const completedOrders = orders.filter((o) => o.status === "delivered");
        const cancelledOrders = orders.filter((o) => o.status === "cancelled");

        const totalRevenue = completedOrders.reduce(
          (sum, o) => sum + parseFloat(o.total),
          0
        );

        // Orders by status
        const ordersByStatus: Record<string, number> = {};
        for (const order of orders) {
          ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;
        }

        // Orders by hour
        const ordersByHour = Array.from({ length: 24 }, (_, hour) => ({
          hour,
          count: analyticsCache.ordersByHour.get(hour) || 0,
        }));

        // Orders by day
        const ordersByDay = Array.from(analyticsCache.orderCountByDay.entries())
          .map(([date, count]) => ({
            date,
            count,
            revenue: analyticsCache.revenueByDay.get(date) || 0,
          }))
          .sort((a, b) => a.date.localeCompare(b.date));

        return {
          totalOrders: orders.length,
          completedOrders: completedOrders.length,
          cancelledOrders: cancelledOrders.length,
          averageOrderValue: completedOrders.length > 0
            ? totalRevenue / completedOrders.length
            : 0,
          totalRevenue,
          ordersByStatus,
          ordersByHour,
          ordersByDay,
          topItems: [], // Would require order items aggregation
        };
      },
      300
    );
  }

  /**
   * Get restaurant analytics
   */
  async getRestaurantAnalytics(restaurantId: string): Promise<RestaurantAnalytics> {
    return this.withCache(
      `analytics:restaurant:${restaurantId}`,
      async () => {
        const [restaurant, orders] = await Promise.all([
          storage.getRestaurant(restaurantId),
          storage.getOrdersByRestaurant(restaurantId),
        ]);

        if (!restaurant) {
          throw new Error("Restaurant not found");
        }

        const completedOrders = orders.filter((o: any) => o.status === "delivered");
        const totalRevenue = completedOrders.reduce(
          (sum: number, o: any) => sum + parseFloat(o.total),
          0
        );

        // Peak hours analysis
        const hourCounts = new Map<number, number>();
        for (const order of orders) {
          if (order.createdAt) {
            const hour = new Date(order.createdAt).getHours();
            hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
          }
        }

        const peakHours = Array.from(hourCounts.entries())
          .map(([hour, orderCount]) => ({ hour, orderCount }))
          .sort((a, b) => b.orderCount - a.orderCount);

        return {
          restaurantId,
          restaurantName: restaurant.name,
          totalOrders: orders.length,
          totalRevenue,
          averageRating: parseFloat(restaurant.rating || "0"),
          averagePreparationTime: restaurant.deliveryTime || 30,
          peakHours,
          topItems: [], // Would require order items aggregation
          conversionRate: 0, // Would require impression tracking
        };
      },
      600
    );
  }

  /**
   * Get delivery analytics
   */
  async getDeliveryAnalytics(dateRange?: DateRange): Promise<DeliveryAnalytics> {
    return this.withCache(
      `analytics:delivery:${dateRange?.start?.toISOString() || "all"}`,
      async () => {
        const partners = await storage.getAvailableDeliveryPartners();
        let orders = await storage.getOrders();

        if (dateRange) {
          orders = orders.filter((o) => {
            const orderDate = o.createdAt ? new Date(o.createdAt) : new Date();
            return orderDate >= dateRange.start && orderDate <= dateRange.end;
          });
        }

        const deliveredOrders = orders.filter((o) => o.status === "delivered");

        // On-time delivery calculation (simplified)
        const onTimeDeliveries = deliveredOrders.filter((o) => {
          if (!o.estimatedDeliveryTime || !o.actualDeliveryTime) return true;
          return new Date(o.actualDeliveryTime) <= new Date(o.estimatedDeliveryTime);
        });

        // Deliveries by hour
        const hourCounts = new Map<number, number>();
        for (const order of deliveredOrders) {
          if (order.actualDeliveryTime) {
            const hour = new Date(order.actualDeliveryTime).getHours();
            hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
          }
        }

        const deliveriesByHour = Array.from({ length: 24 }, (_, hour) => ({
          hour,
          count: hourCounts.get(hour) || 0,
        }));

        return {
          totalDeliveries: deliveredOrders.length,
          averageDeliveryTime: 30, // Would calculate from actual data
          onTimeDeliveryRate:
            deliveredOrders.length > 0
              ? (onTimeDeliveries.length / deliveredOrders.length) * 100
              : 100,
          averageRating: 4.5, // Would calculate from reviews
          deliveriesByHour,
          topPerformers: [], // Would aggregate by partner
        };
      },
      600
    );
  }

  /**
   * Get customer analytics
   */
  async getCustomerAnalytics(dateRange?: DateRange): Promise<CustomerAnalytics> {
    return this.withCache(
      `analytics:customers:${dateRange?.start?.toISOString() || "all"}`,
      async () => {
        const orders = await storage.getOrders();

        // Group orders by customer
        const customerOrders = new Map<string, number>();
        for (const order of orders) {
          const count = customerOrders.get(order.customerId) || 0;
          customerOrders.set(order.customerId, count + 1);
        }

        const totalCustomers = customerOrders.size;
        const repeatCustomers = Array.from(customerOrders.values()).filter(
          (count) => count > 1
        ).length;

        const totalOrdersCount = orders.length;
        const averageOrdersPerCustomer =
          totalCustomers > 0 ? totalOrdersCount / totalCustomers : 0;

        const completedOrders = orders.filter((o) => o.status === "delivered");
        const totalRevenue = completedOrders.reduce(
          (sum, o) => sum + parseFloat(o.total),
          0
        );
        const customerLifetimeValue =
          totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

        return {
          totalCustomers,
          newCustomers: 0, // Would need to track new vs returning
          repeatCustomers,
          averageOrdersPerCustomer,
          customerLifetimeValue,
          retentionRate: totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0,
          customersByCity: [], // Would aggregate from user data
        };
      },
      600
    );
  }

  /**
   * Get revenue analytics
   */
  async getRevenueAnalytics(dateRange?: DateRange): Promise<RevenueAnalytics> {
    return this.withCache(
      `analytics:revenue:${dateRange?.start?.toISOString() || "all"}`,
      async () => {
        let orders = await storage.getOrders();

        if (dateRange) {
          orders = orders.filter((o) => {
            const orderDate = o.createdAt ? new Date(o.createdAt) : new Date();
            return orderDate >= dateRange.start && orderDate <= dateRange.end;
          });
        }

        const completedOrders = orders.filter((o) => o.status === "delivered");
        const totalRevenue = completedOrders.reduce(
          (sum, o) => sum + parseFloat(o.total),
          0
        );

        // Revenue by day
        const revenueByDay = Array.from(analyticsCache.revenueByDay.entries())
          .map(([date, revenue]) => ({ date, revenue }))
          .sort((a, b) => a.date.localeCompare(b.date));

        // Revenue by restaurant
        const restaurantRevenue = new Map<string, number>();
        for (const order of completedOrders) {
          const current = restaurantRevenue.get(order.restaurantId) || 0;
          restaurantRevenue.set(order.restaurantId, current + parseFloat(order.total));
        }

        const restaurants = await storage.getRestaurants();
        const restaurantMap = new Map(restaurants.map((r) => [r.id, r]));

        const revenueByRestaurant = Array.from(restaurantRevenue.entries())
          .map(([restaurantId, revenue]) => ({
            restaurantId,
            name: restaurantMap.get(restaurantId)?.name || "Unknown",
            revenue,
          }))
          .sort((a, b) => b.revenue - a.revenue);

        return {
          totalRevenue,
          revenueByDay,
          revenueByRestaurant,
          revenueByCuisine: [], // Would aggregate by cuisine
          averageOrderValue:
            completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0,
          growthRate: 0, // Would compare with previous period
        };
      },
      600
    );
  }

  /**
   * Get real-time metrics
   */
  getRealTimeMetrics(): {
    activeOrders: number;
    ordersLastHour: number;
    revenueToday: number;
    activeDeliveries: number;
  } {
    const now = new Date();
    const currentHour = now.getHours();
    const today = now.toISOString().split("T")[0];

    return {
      activeOrders: 0, // Would query active orders
      ordersLastHour: analyticsCache.ordersByHour.get(currentHour) || 0,
      revenueToday: analyticsCache.revenueByDay.get(today) || 0,
      activeDeliveries: 0, // Would query active deliveries
    };
  }

  /**
   * Health check
   */
  async checkHealth(): Promise<ServiceHealth> {
    const checks = [];

    checks.push({
      name: "analytics_cache",
      status: "pass" as const,
      message: `Last updated: ${analyticsCache.lastUpdated.toISOString()}`,
    });

    try {
      const startTime = Date.now();
      await storage.getOrders();
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

    const allPassing = checks.every((c) => c.status === "pass");

    return {
      status: allPassing ? "healthy" : "degraded",
      checks,
      uptime: Date.now() - this.startTime.getTime(),
      timestamp: new Date(),
    };
  }
}

export const analyticsService = new AnalyticsService();
