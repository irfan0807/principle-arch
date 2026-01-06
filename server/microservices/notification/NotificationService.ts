/**
 * Notification Service
 * Handles all notification channels (push, email, SMS, in-app)
 * 
 * Patterns:
 * - Event-driven notifications
 * - Multi-channel delivery
 * - Template-based messaging
 * - Priority queuing
 * - Dead letter queue for failed notifications
 */

import { BaseService, ServiceHealth, ServiceConfig } from "../core/BaseService";
import { storage } from "../../storage";
import { eventBus, EventTypes } from "../../infrastructure/eventBus";
import type { Notification, InsertNotification } from "@shared/schema";

// Types
export type NotificationChannel = "push" | "email" | "sms" | "in_app";
export type NotificationPriority = "low" | "normal" | "high" | "urgent";
export type NotificationType = 
  | "order_placed"
  | "order_confirmed"
  | "order_preparing"
  | "order_ready"
  | "order_picked_up"
  | "order_delivered"
  | "order_cancelled"
  | "payment_success"
  | "payment_failed"
  | "rider_assigned"
  | "promotion"
  | "system";

export interface NotificationRequest {
  userId: string;
  type: NotificationType;
  channels: NotificationChannel[];
  priority?: NotificationPriority;
  title: string;
  message: string;
  data?: Record<string, any>;
  scheduledFor?: Date;
}

export interface NotificationTemplate {
  type: NotificationType;
  channels: NotificationChannel[];
  title: string;
  body: string;
  data?: Record<string, any>;
}

export interface DeliveryStatus {
  channel: NotificationChannel;
  status: "pending" | "sent" | "delivered" | "failed";
  sentAt?: Date;
  deliveredAt?: Date;
  error?: string;
}

export interface NotificationWithStatus extends Notification {
  deliveryStatus: DeliveryStatus[];
}

const serviceConfig: ServiceConfig = {
  name: "notification-service",
  version: "1.0.0",
  timeout: 10000,
  retryAttempts: 3,
  circuitBreakerEnabled: true,
};

// Notification templates
const NOTIFICATION_TEMPLATES: Record<NotificationType, NotificationTemplate> = {
  order_placed: {
    type: "order_placed",
    channels: ["push", "in_app"],
    title: "Order Placed!",
    body: "Your order #{orderId} has been placed successfully.",
  },
  order_confirmed: {
    type: "order_confirmed",
    channels: ["push", "in_app"],
    title: "Order Confirmed!",
    body: "Good news! {restaurantName} has confirmed your order.",
  },
  order_preparing: {
    type: "order_preparing",
    channels: ["push", "in_app"],
    title: "Order Being Prepared",
    body: "Your food is being prepared at {restaurantName}.",
  },
  order_ready: {
    type: "order_ready",
    channels: ["push", "in_app"],
    title: "Order Ready for Pickup",
    body: "Your order is ready! Delivery partner will pick it up soon.",
  },
  order_picked_up: {
    type: "order_picked_up",
    channels: ["push", "in_app"],
    title: "On the Way!",
    body: "{riderName} has picked up your order and is on the way.",
  },
  order_delivered: {
    type: "order_delivered",
    channels: ["push", "email", "in_app"],
    title: "Order Delivered!",
    body: "Your order has been delivered. Enjoy your meal!",
  },
  order_cancelled: {
    type: "order_cancelled",
    channels: ["push", "email", "in_app"],
    title: "Order Cancelled",
    body: "Your order #{orderId} has been cancelled. {reason}",
  },
  payment_success: {
    type: "payment_success",
    channels: ["email", "in_app"],
    title: "Payment Successful",
    body: "Payment of {amount} for order #{orderId} was successful.",
  },
  payment_failed: {
    type: "payment_failed",
    channels: ["push", "email", "in_app"],
    title: "Payment Failed",
    body: "Payment for order #{orderId} failed. Please try again.",
  },
  rider_assigned: {
    type: "rider_assigned",
    channels: ["push", "in_app"],
    title: "Delivery Partner Assigned",
    body: "{riderName} will deliver your order. ETA: {eta}",
  },
  promotion: {
    type: "promotion",
    channels: ["push", "in_app"],
    title: "{title}",
    body: "{message}",
  },
  system: {
    type: "system",
    channels: ["in_app"],
    title: "{title}",
    body: "{message}",
  },
};

// Priority queues
const priorityQueues: Map<NotificationPriority, NotificationRequest[]> = new Map([
  ["urgent", []],
  ["high", []],
  ["normal", []],
  ["low", []],
]);

// Dead letter queue for failed notifications
const deadLetterQueue: Array<{ request: NotificationRequest; error: string; timestamp: Date }> = [];

// Delivery status tracking
const deliveryStatusMap = new Map<string, DeliveryStatus[]>();

class NotificationService extends BaseService {
  private isProcessing: boolean = false;

  constructor() {
    super(serviceConfig);
    this.initializeEventHandlers();
    this.startNotificationProcessor();
  }

  private initializeEventHandlers(): void {
    // Order lifecycle events
    eventBus.subscribe(EventTypes.ORDER_CREATED, async (data: any) => {
      await this.sendOrderNotification("order_placed", data);
    });

    eventBus.subscribe(EventTypes.ORDER_CONFIRMED, async (data: any) => {
      await this.sendOrderNotification("order_confirmed", data);
    });

    eventBus.subscribe(EventTypes.ORDER_PREPARING, async (data: any) => {
      await this.sendOrderNotification("order_preparing", data);
    });

    eventBus.subscribe(EventTypes.ORDER_READY, async (data: any) => {
      await this.sendOrderNotification("order_ready", data);
    });

    eventBus.subscribe(EventTypes.ORDER_PICKED_UP, async (data: any) => {
      await this.sendOrderNotification("order_picked_up", data);
    });

    eventBus.subscribe(EventTypes.ORDER_DELIVERED, async (data: any) => {
      await this.sendOrderNotification("order_delivered", data);
    });

    eventBus.subscribe(EventTypes.ORDER_CANCELLED, async (data: any) => {
      await this.sendOrderNotification("order_cancelled", data);
    });

    // Payment events
    eventBus.subscribe(EventTypes.PAYMENT_SUCCESS, async (data: any) => {
      await this.sendPaymentNotification("payment_success", data);
    });

    eventBus.subscribe(EventTypes.PAYMENT_FAILED, async (data: any) => {
      await this.sendPaymentNotification("payment_failed", data);
    });

    // Rider events
    eventBus.subscribe(EventTypes.RIDER_ASSIGNED, async (data: any) => {
      await this.sendRiderNotification(data);
    });
  }

  /**
   * Start background processor for notification queues
   */
  private startNotificationProcessor(): void {
    setInterval(async () => {
      if (this.isProcessing) return;
      
      this.isProcessing = true;
      try {
        await this.processQueues();
      } finally {
        this.isProcessing = false;
      }
    }, 1000); // Process every second
  }

  /**
   * Process notification queues by priority
   */
  private async processQueues(): Promise<void> {
    const priorities: NotificationPriority[] = ["urgent", "high", "normal", "low"];

    for (const priority of priorities) {
      const queue = priorityQueues.get(priority)!;
      
      while (queue.length > 0) {
        const request = queue.shift()!;
        
        // Skip if scheduled for later
        if (request.scheduledFor && request.scheduledFor > new Date()) {
          queue.push(request); // Put back in queue
          continue;
        }

        try {
          await this.deliverNotification(request);
        } catch (error) {
          this.logger.error("Failed to deliver notification", { 
            userId: request.userId, 
            type: request.type,
            error,
          });
          
          // Add to dead letter queue
          deadLetterQueue.push({
            request,
            error: (error as Error).message,
            timestamp: new Date(),
          });
        }
      }
    }
  }

  /**
   * Queue a notification
   */
  async queueNotification(request: NotificationRequest): Promise<string> {
    const notificationId = this.generateNotificationId();
    const priority = request.priority || "normal";
    
    priorityQueues.get(priority)!.push(request);
    
    // Initialize delivery status
    deliveryStatusMap.set(notificationId, 
      request.channels.map(channel => ({
        channel,
        status: "pending" as const,
      }))
    );

    this.logger.debug("Notification queued", { 
      notificationId, 
      userId: request.userId, 
      type: request.type,
      priority,
    });

    return notificationId;
  }

  /**
   * Send notification immediately
   */
  async sendNotification(request: NotificationRequest): Promise<Notification> {
    return this.executeWithResilience(async () => {
      const notification = await this.deliverNotification(request);
      return notification;
    }, "sendNotification");
  }

  /**
   * Deliver notification to all channels
   */
  private async deliverNotification(request: NotificationRequest): Promise<Notification> {
    const template = NOTIFICATION_TEMPLATES[request.type];
    
    // Apply template interpolation
    const title = this.interpolateTemplate(request.title || template.title, request.data || {});
    const message = this.interpolateTemplate(request.message || template.body, request.data || {});

    // Store in-app notification
    const notification = await storage.createNotification({
      userId: request.userId,
      title,
      message,
      type: request.type,
      data: request.data,
    });

    // Deliver to each channel
    for (const channel of request.channels) {
      try {
        await this.deliverToChannel(channel, request.userId, title, message, request.data);
      } catch (error) {
        this.logger.error(`Failed to deliver to ${channel}`, { error });
      }
    }

    return notification;
  }

  /**
   * Deliver to specific channel
   */
  private async deliverToChannel(
    channel: NotificationChannel,
    userId: string,
    title: string,
    message: string,
    data?: Record<string, any>
  ): Promise<void> {
    switch (channel) {
      case "push":
        await this.sendPushNotification(userId, title, message, data);
        break;
      case "email":
        await this.sendEmailNotification(userId, title, message, data);
        break;
      case "sms":
        await this.sendSMSNotification(userId, message);
        break;
      case "in_app":
        // Already stored in database
        break;
    }
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(
    userId: string,
    title: string,
    message: string,
    data?: Record<string, any>
  ): Promise<void> {
    // Integration with FCM, APNS, or other push service
    this.logger.info("Push notification sent", { userId, title });
    // Mock implementation - would integrate with actual push service
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    userId: string,
    subject: string,
    body: string,
    data?: Record<string, any>
  ): Promise<void> {
    const user = await storage.getUser(userId);
    if (!user?.email) {
      this.logger.warn("No email for user", { userId });
      return;
    }

    // Integration with email service (SendGrid, SES, etc.)
    this.logger.info("Email notification sent", { userId, email: user.email, subject });
    // Mock implementation - would integrate with actual email service
  }

  /**
   * Send SMS notification
   */
  private async sendSMSNotification(userId: string, message: string): Promise<void> {
    const user = await storage.getUser(userId);
    if (!user?.phone) {
      this.logger.warn("No phone for user", { userId });
      return;
    }

    // Integration with SMS service (Twilio, etc.)
    this.logger.info("SMS notification sent", { userId, phone: user.phone });
    // Mock implementation - would integrate with actual SMS service
  }

  /**
   * Interpolate template variables
   */
  private interpolateTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/{(\w+)}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });
  }

  /**
   * Send order notification to customer
   */
  private async sendOrderNotification(type: NotificationType, data: any): Promise<void> {
    if (!data.customerId) return;

    const template = NOTIFICATION_TEMPLATES[type];
    
    await this.queueNotification({
      userId: data.customerId,
      type,
      channels: template.channels,
      priority: type === "order_cancelled" ? "high" : "normal",
      title: template.title,
      message: template.body,
      data: {
        orderId: data.orderId,
        restaurantName: data.restaurantName,
        ...data,
      },
    });
  }

  /**
   * Send payment notification
   */
  private async sendPaymentNotification(type: NotificationType, data: any): Promise<void> {
    if (!data.customerId) return;

    const template = NOTIFICATION_TEMPLATES[type];

    await this.queueNotification({
      userId: data.customerId,
      type,
      channels: template.channels,
      priority: type === "payment_failed" ? "high" : "normal",
      title: template.title,
      message: template.body,
      data: {
        orderId: data.orderId,
        amount: data.amount,
        ...data,
      },
    });
  }

  /**
   * Send rider assigned notification
   */
  private async sendRiderNotification(data: any): Promise<void> {
    if (!data.customerId) {
      // Get customer ID from order
      const order = await storage.getOrder(data.orderId);
      if (!order) return;
      data.customerId = order.customerId;
    }

    const template = NOTIFICATION_TEMPLATES["rider_assigned"];

    await this.queueNotification({
      userId: data.customerId,
      type: "rider_assigned",
      channels: template.channels,
      priority: "normal",
      title: template.title,
      message: template.body,
      data: {
        orderId: data.orderId,
        riderName: data.riderName || "Delivery Partner",
        eta: data.estimatedDeliveryTime 
          ? new Date(data.estimatedDeliveryTime).toLocaleTimeString()
          : "30-45 min",
        ...data,
      },
    });
  }

  /**
   * Get notifications for user
   */
  async getNotifications(userId: string): Promise<Notification[]> {
    return this.withCache(
      `notifications:${userId}`,
      () => storage.getNotifications(userId),
      60
    );
  }

  /**
   * Get unread notifications
   */
  async getUnreadNotifications(userId: string): Promise<Notification[]> {
    return storage.getUnreadNotifications(userId);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    await storage.markNotificationRead(notificationId);
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    await storage.markAllNotificationsRead(userId);
    await this.invalidateCache(`notifications:${userId}`);
  }

  /**
   * Send promotional notification to multiple users
   */
  async sendPromotion(
    userIds: string[],
    title: string,
    message: string,
    data?: Record<string, any>
  ): Promise<void> {
    for (const userId of userIds) {
      await this.queueNotification({
        userId,
        type: "promotion",
        channels: ["push", "in_app"],
        priority: "low",
        title,
        message,
        data,
      });
    }

    this.logger.info("Promotional notifications queued", { count: userIds.length });
  }

  /**
   * Get dead letter queue items
   */
  getDeadLetterQueue(): typeof deadLetterQueue {
    return [...deadLetterQueue];
  }

  /**
   * Retry failed notifications
   */
  async retryFailedNotifications(): Promise<number> {
    let retried = 0;

    while (deadLetterQueue.length > 0) {
      const item = deadLetterQueue.shift()!;
      await this.queueNotification(item.request);
      retried++;
    }

    this.logger.info("Retried failed notifications", { count: retried });
    return retried;
  }

  /**
   * Generate notification ID
   */
  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Health check
   */
  async checkHealth(): Promise<ServiceHealth> {
    const checks = [];

    // Check queues
    let totalQueued = 0;
    for (const queue of Array.from(priorityQueues.values())) {
      totalQueued += queue.length;
    }

    checks.push({
      name: "notification_queue",
      status: totalQueued > 1000 ? "warn" as const : "pass" as const,
      message: `${totalQueued} notifications queued`,
    });

    checks.push({
      name: "dead_letter_queue",
      status: deadLetterQueue.length > 100 ? "warn" as const : "pass" as const,
      message: `${deadLetterQueue.length} failed notifications`,
    });

    try {
      const startTime = Date.now();
      await storage.getNotifications("health-check");
      checks.push({
        name: "database",
        status: "pass" as const,
        responseTime: Date.now() - startTime,
      });
    } catch {
      checks.push({
        name: "database",
        status: "fail" as const,
        message: "Failed to query notifications",
      });
    }

    const allPassing = checks.every((c) => c.status === "pass");

    return {
      status: allPassing ? "healthy" : checks.some(c => c.status === "fail") ? "unhealthy" : "degraded",
      checks,
      uptime: Date.now() - this.startTime.getTime(),
      timestamp: new Date(),
    };
  }
}

export const notificationService = new NotificationService();
