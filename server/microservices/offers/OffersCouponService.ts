/**
 * Offers & Coupon Service
 * Manages promotional offers, coupons, and discounts
 * 
 * Patterns:
 * - Cache-aside for offer validation
 * - Event-driven for usage tracking
 * - Eventually consistent for usage counts
 */

import { BaseService, ServiceHealth, ServiceConfig } from "../core/BaseService";
import { storage } from "../../storage";
import { eventBus, EventTypes } from "../../infrastructure/eventBus";
import type { Coupon, InsertCoupon } from "@shared/schema";

// Types
export type DiscountType = "percentage" | "fixed";

export interface CouponValidation {
  isValid: boolean;
  coupon?: Coupon;
  discountAmount: number;
  message: string;
}

export interface ApplyCouponRequest {
  code: string;
  customerId: string;
  orderId: string;
  subtotal: number;
  restaurantId?: string;
}

export interface CouponUsage {
  couponId: string;
  customerId: string;
  orderId: string;
  discountApplied: number;
  usedAt: Date;
}

const serviceConfig: ServiceConfig = {
  name: "offers-coupon-service",
  version: "1.0.0",
  timeout: 5000,
  retryAttempts: 3,
  circuitBreakerEnabled: true,
};

// Track usage per customer to prevent abuse
const customerUsageTracker = new Map<string, Map<string, number>>(); // customerId -> couponId -> usageCount

class OffersCouponService extends BaseService {
  constructor() {
    super(serviceConfig);
    this.initializeEventHandlers();
  }

  private initializeEventHandlers(): void {
    // Track coupon usage when order is confirmed
    eventBus.subscribe(EventTypes.ORDER_CONFIRMED, async (data: any) => {
      if (data.couponId) {
        await this.incrementCouponUsage(data.couponId, data.customerId);
      }
    });
  }

  /**
   * Get all active coupons
   */
  async getActiveCoupons(): Promise<Coupon[]> {
    return this.withCache(
      "coupons:active",
      async () => {
        const coupons = await storage.getActiveCoupons();
        return coupons.filter((c) => this.isCouponActive(c));
      },
      300 // 5 minutes cache
    );
  }

  /**
   * Get coupon by code
   */
  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    return this.withCache(
      `coupon:${code.toUpperCase()}`,
      () => storage.getCouponByCode(code.toUpperCase()),
      300
    );
  }

  /**
   * Validate and calculate coupon discount
   */
  async validateCoupon(request: ApplyCouponRequest): Promise<CouponValidation> {
    return this.executeWithResilience(async () => {
      const coupon = await this.getCouponByCode(request.code);

      if (!coupon) {
        return {
          isValid: false,
          discountAmount: 0,
          message: "Coupon not found",
        };
      }

      // Check if coupon is active
      if (!this.isCouponActive(coupon)) {
        return {
          isValid: false,
          discountAmount: 0,
          message: "Coupon has expired or is no longer active",
        };
      }

      // Check restaurant restriction
      if (coupon.restaurantId && coupon.restaurantId !== request.restaurantId) {
        return {
          isValid: false,
          discountAmount: 0,
          message: "This coupon is not valid for this restaurant",
        };
      }

      // Check minimum order
      if (coupon.minimumOrder && request.subtotal < parseFloat(coupon.minimumOrder)) {
        return {
          isValid: false,
          discountAmount: 0,
          message: `Minimum order amount is ${coupon.minimumOrder}`,
        };
      }

      // Check usage limit
      if (coupon.usageLimit && (coupon.usedCount || 0) >= coupon.usageLimit) {
        return {
          isValid: false,
          discountAmount: 0,
          message: "Coupon usage limit has been reached",
        };
      }

      // Check customer usage (prevent same customer using multiple times)
      const customerUsage = this.getCustomerUsage(request.customerId, coupon.id);
      if (customerUsage > 0) {
        return {
          isValid: false,
          discountAmount: 0,
          message: "You have already used this coupon",
        };
      }

      // Calculate discount
      let discountAmount = 0;
      if (coupon.discountType === "percentage") {
        discountAmount = (request.subtotal * parseFloat(coupon.discountValue)) / 100;
        if (coupon.maxDiscount) {
          discountAmount = Math.min(discountAmount, parseFloat(coupon.maxDiscount));
        }
      } else {
        discountAmount = parseFloat(coupon.discountValue);
      }

      // Don't let discount exceed subtotal
      discountAmount = Math.min(discountAmount, request.subtotal);

      return {
        isValid: true,
        coupon,
        discountAmount,
        message: `Discount of ${discountAmount.toFixed(2)} applied`,
      };
    }, "validateCoupon");
  }

  /**
   * Create new coupon
   */
  async createCoupon(data: InsertCoupon): Promise<Coupon> {
    return this.executeWithResilience(async () => {
      const coupon = await storage.createCoupon({
        ...data,
        code: data.code.toUpperCase(),
      });

      await this.invalidateCache("coupons:*");

      this.logger.info("Coupon created", { couponId: coupon.id, code: coupon.code });

      return coupon;
    }, "createCoupon");
  }

  /**
   * Update coupon
   */
  async updateCoupon(id: string, data: Partial<InsertCoupon>): Promise<Coupon | undefined> {
    return this.executeWithResilience(async () => {
      const existing = await storage.getCoupon(id);
      if (!existing) return undefined;

      const updated = await storage.updateCoupon(id, data);

      await this.invalidateCache("coupons:*");
      await this.invalidateCache(`coupon:${existing.code}`);

      return updated;
    }, "updateCoupon");
  }

  /**
   * Deactivate coupon
   */
  async deactivateCoupon(id: string): Promise<Coupon | undefined> {
    return this.updateCoupon(id, { isActive: false });
  }

  /**
   * Increment coupon usage
   */
  async incrementCouponUsage(couponId: string, customerId: string): Promise<void> {
    return this.executeWithResilience(async () => {
      await storage.incrementCouponUsage(couponId);

      // Track customer usage
      if (!customerUsageTracker.has(customerId)) {
        customerUsageTracker.set(customerId, new Map());
      }
      const customerCoupons = customerUsageTracker.get(customerId)!;
      customerCoupons.set(couponId, (customerCoupons.get(couponId) || 0) + 1);

      await this.invalidateCache("coupons:*");

      await this.publishEvent(EventTypes.COUPON_USED, {
        couponId,
        customerId,
        timestamp: new Date(),
      });
    }, "incrementCouponUsage");
  }

  /**
   * Check if coupon is currently active
   */
  private isCouponActive(coupon: Coupon): boolean {
    if (!coupon.isActive) return false;

    const now = new Date();

    if (coupon.validFrom && new Date(coupon.validFrom) > now) {
      return false;
    }

    if (coupon.validUntil && new Date(coupon.validUntil) < now) {
      return false;
    }

    return true;
  }

  /**
   * Get customer usage count for a coupon
   */
  private getCustomerUsage(customerId: string, couponId: string): number {
    return customerUsageTracker.get(customerId)?.get(couponId) || 0;
  }

  /**
   * Get available coupons for customer
   */
  async getAvailableCouponsForCustomer(
    customerId: string,
    subtotal: number,
    restaurantId?: string
  ): Promise<Coupon[]> {
    return this.executeWithResilience(async () => {
      const activeCoupons = await this.getActiveCoupons();

      return activeCoupons.filter((coupon) => {
        // Check restaurant restriction
        if (coupon.restaurantId && coupon.restaurantId !== restaurantId) {
          return false;
        }

        // Check minimum order
        if (coupon.minimumOrder && subtotal < parseFloat(coupon.minimumOrder)) {
          return false;
        }

        // Check usage limit
        if (coupon.usageLimit && (coupon.usedCount || 0) >= coupon.usageLimit) {
          return false;
        }

        // Check customer usage
        if (this.getCustomerUsage(customerId, coupon.id) > 0) {
          return false;
        }

        return true;
      });
    }, "getAvailableCouponsForCustomer");
  }

  /**
   * Generate unique coupon code
   */
  generateCouponCode(prefix: string = "FOOD"): string {
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}${random}`;
  }

  /**
   * Create bulk coupons
   */
  async createBulkCoupons(
    template: Omit<InsertCoupon, "code">,
    count: number,
    prefix: string = "BULK"
  ): Promise<Coupon[]> {
    return this.executeWithResilience(async () => {
      const coupons: Coupon[] = [];

      for (let i = 0; i < count; i++) {
        const code = `${prefix}${i.toString().padStart(4, "0")}`;
        const coupon = await storage.createCoupon({
          ...template,
          code,
        });
        coupons.push(coupon);
      }

      await this.invalidateCache("coupons:*");

      this.logger.info("Bulk coupons created", { count, prefix });

      return coupons;
    }, "createBulkCoupons");
  }

  /**
   * Get coupon statistics
   */
  async getCouponStats(couponId: string): Promise<{
    totalUses: number;
    totalDiscount: number;
    remainingUses: number | null;
    conversionRate: number;
  }> {
    return this.withCache(
      `coupon:${couponId}:stats`,
      async () => {
        const coupon = await storage.getCoupon(couponId);
        if (!coupon) {
          throw new Error("Coupon not found");
        }

        const totalUses = coupon.usedCount || 0;
        const discountValue = parseFloat(coupon.discountValue);
        
        // Rough estimate of total discount given
        const totalDiscount = coupon.discountType === "percentage"
          ? totalUses * discountValue // Would need actual order data for accuracy
          : totalUses * discountValue;

        const remainingUses = coupon.usageLimit 
          ? coupon.usageLimit - totalUses 
          : null;

        return {
          totalUses,
          totalDiscount,
          remainingUses,
          conversionRate: 0, // Would need impression tracking
        };
      },
      300
    );
  }

  /**
   * Health check
   */
  async checkHealth(): Promise<ServiceHealth> {
    const checks = [];

    try {
      const startTime = Date.now();
      await storage.getActiveCoupons();
      checks.push({
        name: "database",
        status: "pass" as const,
        responseTime: Date.now() - startTime,
      });
    } catch {
      checks.push({
        name: "database",
        status: "fail" as const,
        message: "Failed to query coupons",
      });
    }

    checks.push({
      name: "usage_tracker",
      status: "pass" as const,
      message: `${customerUsageTracker.size} customers tracked`,
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

export const offersCouponService = new OffersCouponService();
