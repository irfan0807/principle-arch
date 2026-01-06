/**
 * Admin Service
 * Administrative operations for platform management
 * 
 * Features:
 * - User management
 * - Restaurant management
 * - Content moderation
 * - System configuration
 * - Audit logging
 */

import { BaseService, ServiceHealth, ServiceConfig } from "../core/BaseService";
import { storage } from "../../storage";
import { eventBus, EventTypes } from "../../infrastructure/eventBus";
import { cache } from "../../infrastructure/cache";
import { User, Restaurant, DeliveryPartner } from "../../../shared/schema";

// Types
export interface AdminUser {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  createdAt: Date;
  lastLogin?: Date;
}

export interface AuditLog {
  id: string;
  adminId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface SystemConfig {
  key: string;
  value: any;
  category: string;
  description: string;
  updatedAt: Date;
  updatedBy: string;
}

export interface ModerationAction {
  id: string;
  targetType: "restaurant" | "user" | "review" | "menu_item";
  targetId: string;
  action: "warn" | "suspend" | "ban" | "remove_content" | "restore";
  reason: string;
  adminId: string;
  createdAt: Date;
  expiresAt?: Date;
}

export interface BulkOperation {
  id: string;
  type: string;
  status: "pending" | "processing" | "completed" | "failed";
  targetIds: string[];
  processedCount: number;
  failedCount: number;
  errors: { id: string; error: string }[];
  createdAt: Date;
  completedAt?: Date;
}

const serviceConfig: ServiceConfig = {
  name: "admin-service",
  version: "1.0.0",
  timeout: 30000,
  retryAttempts: 2,
  circuitBreakerEnabled: true,
};

// In-memory stores (would use database in production)
const auditLogs: AuditLog[] = [];
const systemConfigs = new Map<string, SystemConfig>();
const moderationActions: ModerationAction[] = [];
const bulkOperations = new Map<string, BulkOperation>();

// Default configurations
const defaultConfigs: Omit<SystemConfig, "updatedAt" | "updatedBy">[] = [
  {
    key: "platform.maintenance_mode",
    value: false,
    category: "platform",
    description: "Enable maintenance mode",
  },
  {
    key: "orders.max_per_user_per_day",
    value: 10,
    category: "orders",
    description: "Maximum orders per user per day",
  },
  {
    key: "delivery.max_distance_km",
    value: 20,
    category: "delivery",
    description: "Maximum delivery distance in kilometers",
  },
  {
    key: "restaurants.auto_close_after_hours",
    value: 2,
    category: "restaurants",
    description: "Auto-close restaurants after hours of inactivity",
  },
  {
    key: "notifications.enabled_channels",
    value: ["push", "email", "sms", "in_app"],
    category: "notifications",
    description: "Enabled notification channels",
  },
  {
    key: "payments.retry_attempts",
    value: 3,
    category: "payments",
    description: "Number of payment retry attempts",
  },
];

class AdminService extends BaseService {
  constructor() {
    super(serviceConfig);
    this.initializeDefaultConfigs();
  }

  private initializeDefaultConfigs(): void {
    for (const config of defaultConfigs) {
      if (!systemConfigs.has(config.key)) {
        systemConfigs.set(config.key, {
          ...config,
          updatedAt: new Date(),
          updatedBy: "system",
        });
      }
    }
  }

  /**
   * Audit logging
   */
  async logAudit(
    adminId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    changes: Record<string, any>,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<AuditLog> {
    const log: AuditLog = {
      id: crypto.randomUUID(),
      adminId,
      action,
      resourceType,
      resourceId,
      changes,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      timestamp: new Date(),
    };

    auditLogs.push(log);
    this.logger.info("Audit log created", { action, resourceType, resourceId });

    return log;
  }

  async getAuditLogs(options?: {
    adminId?: string;
    resourceType?: string;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AuditLog[]; total: number }> {
    let filtered = [...auditLogs];

    if (options?.adminId) {
      filtered = filtered.filter((l) => l.adminId === options.adminId);
    }

    if (options?.resourceType) {
      filtered = filtered.filter((l) => l.resourceType === options.resourceType);
    }

    if (options?.resourceId) {
      filtered = filtered.filter((l) => l.resourceId === options.resourceId);
    }

    if (options?.startDate) {
      filtered = filtered.filter((l) => l.timestamp >= options.startDate!);
    }

    if (options?.endDate) {
      filtered = filtered.filter((l) => l.timestamp <= options.endDate!);
    }

    const total = filtered.length;
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    filtered = filtered
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(offset, offset + limit);

    return { logs: filtered, total };
  }

  /**
   * User management
   */
  async getUsers(options?: {
    role?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ users: User[]; total: number }> {
    // In production, would use proper pagination from database
    const users: User[] = []; // Would fetch from storage
    return { users, total: users.length };
  }

  async updateUserRole(
    adminId: string,
    userId: string,
    newRole: string
  ): Promise<User | null> {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const oldRole = user.role;
    type UserRole = "customer" | "restaurant_owner" | "delivery_partner" | "admin";
    const updatedUser = await storage.updateUser(userId, { role: newRole as UserRole });

    await this.logAudit(adminId, "update_role", "user", userId, {
      oldRole,
      newRole,
    });

    eventBus.publish(EventTypes.USER_UPDATED, {
      userId,
      changes: { role: newRole },
    });

    // Invalidate user cache
    cache.delete(`user:${userId}`);

    return updatedUser || null;
  }

  async suspendUser(
    adminId: string,
    userId: string,
    reason: string,
    duration?: number
  ): Promise<void> {
    const expiresAt = duration
      ? new Date(Date.now() + duration * 60 * 60 * 1000)
      : undefined;

    const moderation: ModerationAction = {
      id: crypto.randomUUID(),
      targetType: "user",
      targetId: userId,
      action: "suspend",
      reason,
      adminId,
      createdAt: new Date(),
      expiresAt,
    };

    moderationActions.push(moderation);

    await this.logAudit(adminId, "suspend_user", "user", userId, {
      reason,
      expiresAt,
    });

    eventBus.publish(EventTypes.NOTIFICATION_SEND, {
      userId,
      type: "account_suspended",
      message: `Your account has been suspended. Reason: ${reason}`,
    });
  }

  async unsuspendUser(adminId: string, userId: string): Promise<void> {
    const moderation: ModerationAction = {
      id: crypto.randomUUID(),
      targetType: "user",
      targetId: userId,
      action: "restore",
      reason: "Suspension lifted",
      adminId,
      createdAt: new Date(),
    };

    moderationActions.push(moderation);

    await this.logAudit(adminId, "unsuspend_user", "user", userId, {});

    eventBus.publish(EventTypes.NOTIFICATION_SEND, {
      userId,
      type: "account_restored",
      message: "Your account has been restored.",
    });
  }

  /**
   * Restaurant management
   */
  async getRestaurants(options?: {
    status?: string;
    isActive?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ restaurants: Restaurant[]; total: number }> {
    let restaurants = await storage.getRestaurants();

    if (options?.isActive !== undefined) {
      restaurants = restaurants.filter((r) => r.isActive === options.isActive);
    }

    if (options?.search) {
      const searchLower = options.search.toLowerCase();
      restaurants = restaurants.filter(
        (r) =>
          r.name.toLowerCase().includes(searchLower) ||
          r.cuisine?.toLowerCase().includes(searchLower)
      );
    }

    const total = restaurants.length;
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    return {
      restaurants: restaurants.slice(offset, offset + limit),
      total,
    };
  }

  async approveRestaurant(adminId: string, restaurantId: string): Promise<Restaurant | null> {
    const restaurant = await storage.updateRestaurant(restaurantId, { isActive: true });

    if (restaurant) {
      await this.logAudit(adminId, "approve_restaurant", "restaurant", restaurantId, {
        isActive: true,
      });

      eventBus.publish(EventTypes.NOTIFICATION_SEND, {
        userId: restaurant.ownerId,
        type: "restaurant_approved",
        message: `Your restaurant "${restaurant.name}" has been approved!`,
      });
    }

    return restaurant || null;
  }

  async suspendRestaurant(
    adminId: string,
    restaurantId: string,
    reason: string
  ): Promise<void> {
    const restaurant = await storage.updateRestaurant(restaurantId, { isActive: false });

    if (restaurant) {
      const moderation: ModerationAction = {
        id: crypto.randomUUID(),
        targetType: "restaurant",
        targetId: restaurantId,
        action: "suspend",
        reason,
        adminId,
        createdAt: new Date(),
      };

      moderationActions.push(moderation);

      await this.logAudit(adminId, "suspend_restaurant", "restaurant", restaurantId, {
        reason,
      });

      eventBus.publish(EventTypes.NOTIFICATION_SEND, {
        userId: restaurant.ownerId,
        type: "restaurant_suspended",
        message: `Your restaurant "${restaurant.name}" has been suspended. Reason: ${reason}`,
      });
    }
  }

  /**
   * Delivery partner management
   */
  async getDeliveryPartners(options?: {
    status?: string;
    isVerified?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ partners: DeliveryPartner[]; total: number }> {
    let partners = await storage.getAvailableDeliveryPartners();

    if (options?.isVerified !== undefined) {
      partners = partners.filter((p) => p.isVerified === options.isVerified);
    }

    if (options?.status) {
      partners = partners.filter((p) => p.status === options.status);
    }

    if (options?.search) {
      const searchLower = options.search.toLowerCase();
      partners = partners.filter(
        (p) =>
          p.vehicleNumber?.toLowerCase().includes(searchLower) ||
          p.licenseNumber?.toLowerCase().includes(searchLower)
      );
    }

    const total = partners.length;
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    return {
      partners: partners.slice(offset, offset + limit),
      total,
    };
  }

  async verifyDeliveryPartner(
    adminId: string,
    partnerId: string
  ): Promise<DeliveryPartner | null> {
    const partner = await storage.updateDeliveryPartner(partnerId, { isVerified: true });

    if (partner) {
      await this.logAudit(adminId, "verify_partner", "delivery_partner", partnerId, {
        isVerified: true,
      });

      eventBus.publish(EventTypes.NOTIFICATION_SEND, {
        userId: partnerId,
        type: "verification_approved",
        message: "Your verification has been approved! You can now accept delivery orders.",
      });
    }

    return partner || null;
  }

  /**
   * System configuration
   */
  async getConfig(key: string): Promise<SystemConfig | undefined> {
    return systemConfigs.get(key);
  }

  async getAllConfigs(category?: string): Promise<SystemConfig[]> {
    const configs = Array.from(systemConfigs.values());
    if (category) {
      return configs.filter((c) => c.category === category);
    }
    return configs;
  }

  async updateConfig(
    adminId: string,
    key: string,
    value: any
  ): Promise<SystemConfig> {
    const existing = systemConfigs.get(key);
    if (!existing) {
      throw new Error(`Config key ${key} not found`);
    }

    const oldValue = existing.value;
    const updated: SystemConfig = {
      ...existing,
      value,
      updatedAt: new Date(),
      updatedBy: adminId,
    };

    systemConfigs.set(key, updated);

    await this.logAudit(adminId, "update_config", "system_config", key, {
      oldValue,
      newValue: value,
    });

    // Clear config cache
    cache.delete(`config:${key}`);

    return updated;
  }

  /**
   * Bulk operations
   */
  async startBulkOperation(
    adminId: string,
    type: string,
    targetIds: string[]
  ): Promise<BulkOperation> {
    const operation: BulkOperation = {
      id: crypto.randomUUID(),
      type,
      status: "pending",
      targetIds,
      processedCount: 0,
      failedCount: 0,
      errors: [],
      createdAt: new Date(),
    };

    bulkOperations.set(operation.id, operation);

    await this.logAudit(adminId, "start_bulk_operation", "bulk_operation", operation.id, {
      type,
      targetCount: targetIds.length,
    });

    // Process asynchronously
    this.processBulkOperation(operation.id, type, targetIds);

    return operation;
  }

  private async processBulkOperation(
    operationId: string,
    type: string,
    targetIds: string[]
  ): Promise<void> {
    const operation = bulkOperations.get(operationId);
    if (!operation) return;

    operation.status = "processing";

    for (const targetId of targetIds) {
      try {
        switch (type) {
          case "activate_restaurants":
            await storage.updateRestaurant(targetId, { isActive: true });
            break;
          case "deactivate_restaurants":
            await storage.updateRestaurant(targetId, { isActive: false });
            break;
          case "verify_partners":
            await storage.updateDeliveryPartner(targetId, { isVerified: true });
            break;
          default:
            throw new Error(`Unknown operation type: ${type}`);
        }
        operation.processedCount++;
      } catch (error: any) {
        operation.failedCount++;
        operation.errors.push({
          id: targetId,
          error: error.message,
        });
      }
    }

    operation.status = operation.failedCount === 0 ? "completed" : "failed";
    operation.completedAt = new Date();
  }

  async getBulkOperation(operationId: string): Promise<BulkOperation | undefined> {
    return bulkOperations.get(operationId);
  }

  /**
   * Moderation
   */
  async getModerationActions(options?: {
    targetType?: string;
    targetId?: string;
    adminId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ actions: ModerationAction[]; total: number }> {
    let filtered = [...moderationActions];

    if (options?.targetType) {
      filtered = filtered.filter((a) => a.targetType === options.targetType);
    }

    if (options?.targetId) {
      filtered = filtered.filter((a) => a.targetId === options.targetId);
    }

    if (options?.adminId) {
      filtered = filtered.filter((a) => a.adminId === options.adminId);
    }

    const total = filtered.length;
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    return {
      actions: filtered.slice(offset, offset + limit),
      total,
    };
  }

  /**
   * Dashboard stats
   */
  async getDashboardStats(): Promise<{
    pendingApprovals: {
      restaurants: number;
      deliveryPartners: number;
    };
    activeUsers: number;
    activeOrders: number;
    systemHealth: string;
  }> {
    const [restaurants, partners, orders] = await Promise.all([
      storage.getRestaurants(),
      storage.getAvailableDeliveryPartners(),
      storage.getOrders(),
    ]);

    const pendingRestaurants = restaurants.filter((r) => !r.isActive).length;
    const pendingPartners = partners.filter((p) => !p.isVerified).length;
    const activeOrders = orders.filter((o) =>
      ["pending", "confirmed", "preparing", "ready_for_pickup", "out_for_delivery"].includes(
        o.status
      )
    ).length;

    return {
      pendingApprovals: {
        restaurants: pendingRestaurants,
        deliveryPartners: pendingPartners,
      },
      activeUsers: 0, // Would query active sessions
      activeOrders,
      systemHealth: "healthy",
    };
  }

  /**
   * Health check
   */
  async checkHealth(): Promise<ServiceHealth> {
    const checks = [];

    checks.push({
      name: "audit_logs",
      status: "pass" as const,
      message: `${auditLogs.length} logs stored`,
    });

    checks.push({
      name: "config_store",
      status: "pass" as const,
      message: `${systemConfigs.size} configs loaded`,
    });

    try {
      const startTime = Date.now();
      await storage.getRestaurants();
      checks.push({
        name: "database",
        status: "pass" as const,
        responseTime: Date.now() - startTime,
      });
    } catch {
      checks.push({
        name: "database",
        status: "fail" as const,
        message: "Database connection failed",
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

export const adminService = new AdminService();
