/**
 * Live Order Tracking Service
 * Real-time order status and delivery partner location tracking
 * 
 * Patterns:
 * - WebSocket/SSE for real-time updates
 * - Event-driven updates
 * - Materialized views for order tracking
 */

import { BaseService, ServiceHealth, ServiceConfig } from "../core/BaseService";
import { storage } from "../../storage";
import { eventBus, EventTypes } from "../../infrastructure/eventBus";
import type { Order, OrderEvent } from "@shared/schema";

// Types
export interface TrackingInfo {
  orderId: string;
  status: string;
  currentStep: number;
  totalSteps: number;
  steps: TrackingStep[];
  estimatedDeliveryTime?: Date;
  deliveryPartner?: {
    id: string;
    name: string;
    phone?: string;
    vehicleType?: string;
    currentLocation?: {
      latitude: number;
      longitude: number;
      lastUpdated: Date;
    };
  };
  restaurant: {
    id: string;
    name: string;
    address: string;
  };
  deliveryAddress: string;
  timeline: TimelineEvent[];
}

export interface TrackingStep {
  name: string;
  status: "completed" | "current" | "pending";
  completedAt?: Date;
  estimatedAt?: Date;
}

export interface TimelineEvent {
  timestamp: Date;
  event: string;
  description: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface LocationUpdate {
  orderId: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
  heading?: number;
  speed?: number;
}

const ORDER_STEPS = [
  { key: "pending", name: "Order Placed", description: "Your order has been received" },
  { key: "confirmed", name: "Confirmed", description: "Restaurant has confirmed your order" },
  { key: "preparing", name: "Preparing", description: "Restaurant is preparing your food" },
  { key: "ready_for_pickup", name: "Ready", description: "Order is ready for pickup" },
  { key: "out_for_delivery", name: "On the Way", description: "Delivery partner is on the way" },
  { key: "delivered", name: "Delivered", description: "Order has been delivered" },
];

const serviceConfig: ServiceConfig = {
  name: "live-tracking-service",
  version: "1.0.0",
  timeout: 5000,
  retryAttempts: 2,
  circuitBreakerEnabled: true,
};

// WebSocket subscribers for real-time updates
const trackingSubscribers = new Map<string, Set<(data: any) => void>>();

// Latest location cache
const deliveryLocations = new Map<string, LocationUpdate>();

class LiveOrderTrackingService extends BaseService {
  constructor() {
    super(serviceConfig);
    this.initializeEventHandlers();
  }

  private initializeEventHandlers(): void {
    // Subscribe to order status changes
    eventBus.subscribe(EventTypes.ORDER_STATUS_CHANGED, async (data: any) => {
      await this.handleOrderStatusChange(data);
    });

    // Subscribe to delivery location updates
    eventBus.subscribe(EventTypes.RIDER_LOCATION_UPDATE, async (data: any) => {
      await this.handleLocationUpdate(data);
    });

    // Subscribe to rider assignment
    eventBus.subscribe(EventTypes.RIDER_ASSIGNED, async (data: any) => {
      await this.notifySubscribers(data.orderId, {
        type: "rider_assigned",
        riderId: data.riderId,
        estimatedDeliveryTime: data.estimatedDeliveryTime,
      });
    });
  }

  /**
   * Handle order status change event
   */
  private async handleOrderStatusChange(data: any): Promise<void> {
    const { orderId, newStatus, customerId } = data;

    // Get step info
    const stepIndex = ORDER_STEPS.findIndex((s) => s.key === newStatus);
    const step = ORDER_STEPS[stepIndex];

    // Notify subscribers
    await this.notifySubscribers(orderId, {
      type: "status_update",
      orderId,
      status: newStatus,
      stepIndex,
      stepName: step?.name,
      description: step?.description,
      timestamp: new Date(),
    });

    // Invalidate tracking cache
    await this.invalidateCache(`tracking:${orderId}`);
  }

  /**
   * Handle delivery location update
   */
  private async handleLocationUpdate(data: any): Promise<void> {
    const { orderId, latitude, longitude, partnerId } = data;

    // Cache latest location
    deliveryLocations.set(orderId, {
      orderId,
      latitude,
      longitude,
      timestamp: new Date(),
    });

    // Notify subscribers
    await this.notifySubscribers(orderId, {
      type: "location_update",
      orderId,
      location: {
        latitude,
        longitude,
        timestamp: new Date(),
      },
    });
  }

  /**
   * Get full tracking information for an order
   */
  async getTrackingInfo(orderId: string): Promise<TrackingInfo | undefined> {
    return this.withCache(
      `tracking:${orderId}`,
      async () => {
        const order = await storage.getOrder(orderId);
        if (!order) return undefined;

        const [events, restaurant] = await Promise.all([
          storage.getOrderEvents(orderId),
          storage.getRestaurant(order.restaurantId),
        ]);

        // Build steps
        const currentStepIndex = ORDER_STEPS.findIndex((s) => s.key === order.status);
        const steps: TrackingStep[] = ORDER_STEPS.map((step, index) => ({
          name: step.name,
          status: index < currentStepIndex ? "completed" : 
                  index === currentStepIndex ? "current" : "pending",
          completedAt: this.getStepCompletionTime(events, step.key),
        }));

        // Build timeline
        const timeline = this.buildTimeline(events);

        // Get delivery partner info
        let deliveryPartner;
        if (order.deliveryPartnerId) {
          const partner = await storage.getDeliveryPartner(order.deliveryPartnerId);
          const user = partner ? await storage.getUser(partner.userId) : undefined;
          const location = deliveryLocations.get(orderId);

          if (partner) {
            deliveryPartner = {
              id: partner.id,
              name: user ? `${user.firstName} ${user.lastName}` : "Delivery Partner",
              phone: user?.phone || undefined,
              vehicleType: partner.vehicleType || undefined,
              currentLocation: location ? {
                latitude: location.latitude,
                longitude: location.longitude,
                lastUpdated: location.timestamp,
              } : undefined,
            };
          }
        }

        return {
          orderId,
          status: order.status,
          currentStep: currentStepIndex + 1,
          totalSteps: ORDER_STEPS.length,
          steps,
          estimatedDeliveryTime: order.estimatedDeliveryTime || undefined,
          deliveryPartner,
          restaurant: restaurant ? {
            id: restaurant.id,
            name: restaurant.name,
            address: restaurant.address,
          } : { id: "", name: "", address: "" },
          deliveryAddress: order.deliveryAddress,
          timeline,
        };
      },
      30 // Short cache due to real-time nature
    );
  }

  /**
   * Get step completion time from events
   */
  private getStepCompletionTime(events: OrderEvent[], status: string): Date | undefined {
    const event = events.find((e) => 
      e.eventType.toLowerCase().includes(status) || 
      (e.data as any)?.newStatus === status
    );
    return event?.createdAt || undefined;
  }

  /**
   * Build timeline from events
   */
  private buildTimeline(events: OrderEvent[]): TimelineEvent[] {
    return events
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return aTime - bTime;
      })
      .map((event) => ({
        timestamp: event.createdAt || new Date(),
        event: event.eventType,
        description: this.getEventDescription(event.eventType, event.data as any),
        location: event.latitude && event.longitude ? {
          latitude: parseFloat(event.latitude),
          longitude: parseFloat(event.longitude),
        } : undefined,
      }));
  }

  /**
   * Get human-readable event description
   */
  private getEventDescription(eventType: string, data: any): string {
    const descriptions: Record<string, string> = {
      ORDER_CREATED: "Order was placed",
      ORDER_CONFIRMED: "Restaurant confirmed the order",
      ORDER_PREPARING: "Restaurant started preparing your food",
      ORDER_READY: "Food is ready for pickup",
      ORDER_PICKED_UP: "Delivery partner picked up the order",
      ORDER_OUT_FOR_DELIVERY: "Order is on the way",
      ORDER_DELIVERED: "Order has been delivered",
      ORDER_CANCELLED: `Order was cancelled${data?.reason ? `: ${data.reason}` : ""}`,
      RIDER_ASSIGNED: "Delivery partner has been assigned",
      PAYMENT_SUCCESS: "Payment was successful",
      PAYMENT_FAILED: "Payment failed",
    };

    return descriptions[eventType] || eventType.replace(/_/g, " ").toLowerCase();
  }

  /**
   * Subscribe to order tracking updates
   */
  subscribe(orderId: string, callback: (data: any) => void): () => void {
    if (!trackingSubscribers.has(orderId)) {
      trackingSubscribers.set(orderId, new Set());
    }
    
    trackingSubscribers.get(orderId)!.add(callback);
    
    this.logger.debug("Subscriber added for order", { orderId });

    // Return unsubscribe function
    return () => {
      const subscribers = trackingSubscribers.get(orderId);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          trackingSubscribers.delete(orderId);
        }
      }
    };
  }

  /**
   * Notify all subscribers for an order
   */
  private async notifySubscribers(orderId: string, data: any): Promise<void> {
    const subscribers = trackingSubscribers.get(orderId);
    if (!subscribers) return;

    for (const callback of Array.from(subscribers)) {
      try {
        callback(data);
      } catch (error) {
        this.logger.error("Error notifying subscriber", { orderId, error });
      }
    }
  }

  /**
   * Get current delivery location
   */
  getDeliveryLocation(orderId: string): LocationUpdate | undefined {
    return deliveryLocations.get(orderId);
  }

  /**
   * Get estimated arrival time
   */
  async getETA(orderId: string): Promise<{ eta: Date; remainingMinutes: number } | undefined> {
    const order = await storage.getOrder(orderId);
    if (!order || !order.estimatedDeliveryTime) return undefined;

    const eta = new Date(order.estimatedDeliveryTime);
    const now = new Date();
    const remainingMinutes = Math.max(0, Math.round((eta.getTime() - now.getTime()) / 60000));

    return { eta, remainingMinutes };
  }

  /**
   * Get order history with tracking events
   */
  async getOrderHistory(orderId: string): Promise<OrderEvent[]> {
    return this.withCache(
      `order:${orderId}:history`,
      () => storage.getOrderEvents(orderId),
      60
    );
  }

  /**
   * Health check
   */
  async checkHealth(): Promise<ServiceHealth> {
    const checks = [];

    checks.push({
      name: "tracking_subscribers",
      status: "pass" as const,
      message: `${trackingSubscribers.size} active order subscriptions`,
    });

    checks.push({
      name: "location_cache",
      status: "pass" as const,
      message: `${deliveryLocations.size} active delivery locations`,
    });

    try {
      const startTime = Date.now();
      await storage.getOrderEvents("health-check");
      checks.push({
        name: "database",
        status: "pass" as const,
        responseTime: Date.now() - startTime,
      });
    } catch {
      checks.push({
        name: "database",
        status: "fail" as const,
        message: "Failed to query order events",
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

export const liveOrderTrackingService = new LiveOrderTrackingService();
