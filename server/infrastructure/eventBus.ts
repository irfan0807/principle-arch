type EventHandler<T = unknown> = (data: T, metadata: EventMetadata) => void | Promise<void>;

interface EventMetadata {
  correlationId: string;
  timestamp: Date;
  source: string;
}

interface EventSubscription {
  eventType: string;
  handler: EventHandler;
  id: string;
}

export const EventTypes = {
  ORDER_CREATED: "order.created",
  ORDER_CONFIRMED: "order.confirmed",
  ORDER_PREPARING: "order.preparing",
  ORDER_READY: "order.ready",
  ORDER_PICKED_UP: "order.picked_up",
  ORDER_DELIVERED: "order.delivered",
  ORDER_CANCELLED: "order.cancelled",
  ORDER_STATUS_CHANGED: "order.status_changed",
  
  PAYMENT_INITIATED: "payment.initiated",
  PAYMENT_SUCCESS: "payment.success",
  PAYMENT_FAILED: "payment.failed",
  PAYMENT_REFUNDED: "payment.refunded",
  
  RIDER_ASSIGNED: "rider.assigned",
  RIDER_LOCATION_UPDATE: "rider.location_update",
  RIDER_STATUS_CHANGED: "rider.status_changed",
  
  NOTIFICATION_SEND: "notification.send",
  
  RESTAURANT_UPDATED: "restaurant.updated",
  MENU_UPDATED: "menu.updated",
  
  USER_UPDATED: "user.updated",
  USER_CREATED: "user.created",
  
  SERVICE_REGISTERED: "service.registered",
  SERVICE_DEREGISTERED: "service.deregistered",
  
  COUPON_APPLIED: "coupon.applied",
  COUPON_USED: "coupon.used",
} as const;

export type EventType = typeof EventTypes[keyof typeof EventTypes];

class EventBus {
  private subscriptions: Map<string, EventSubscription[]> = new Map();
  private eventLog: Array<{ type: string; data: unknown; metadata: EventMetadata }> = [];
  private maxLogSize = 1000;

  subscribe<T>(eventType: string, handler: EventHandler<T>): string {
    const id = `${eventType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const subscription: EventSubscription = {
      eventType,
      handler: handler as EventHandler,
      id,
    };

    const existing = this.subscriptions.get(eventType) || [];
    existing.push(subscription);
    this.subscriptions.set(eventType, existing);

    return id;
  }

  unsubscribe(subscriptionId: string): void {
    for (const [eventType, subs] of Array.from(this.subscriptions.entries())) {
      const filtered = subs.filter((s: EventSubscription) => s.id !== subscriptionId);
      if (filtered.length !== subs.length) {
        this.subscriptions.set(eventType, filtered);
        break;
      }
    }
  }

  async publish<T>(
    eventType: string,
    data: T,
    correlationId: string = "system",
    source: string = "unknown"
  ): Promise<void> {
    const metadata: EventMetadata = {
      correlationId,
      timestamp: new Date(),
      source,
    };

    this.eventLog.push({ type: eventType, data, metadata });
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.shift();
    }

    const handlers = this.subscriptions.get(eventType) || [];
    const wildcardHandlers = this.subscriptions.get("*") || [];

    const allHandlers = [...handlers, ...wildcardHandlers];

    await Promise.all(
      allHandlers.map(async (sub) => {
        try {
          await sub.handler(data, metadata);
        } catch (error) {
          console.error(`Event handler error for ${eventType}:`, error);
        }
      })
    );
  }

  getEventLog(eventType?: string, limit: number = 100) {
    let logs = this.eventLog;
    if (eventType) {
      logs = logs.filter((l) => l.type === eventType);
    }
    return logs.slice(-limit);
  }

  getSubscriptionCount(): number {
    let count = 0;
    for (const subs of Array.from(this.subscriptions.values())) {
      count += subs.length;
    }
    return count;
  }

  clear(): void {
    this.subscriptions.clear();
    this.eventLog = [];
  }
}

export const eventBus = new EventBus();
