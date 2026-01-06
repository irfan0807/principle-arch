/**
 * Delivery Partner (Rider) Service
 * Manages delivery partners, location tracking, and assignments
 * 
 * Patterns:
 * - Real-time location updates via WebSocket/SSE
 * - Geo-spatial queries for nearest rider
 * - Event-driven assignment notifications
 */

import { BaseService, ServiceHealth, ServiceConfig } from "../core/BaseService";
import { storage } from "../../storage";
import { eventBus, EventTypes } from "../../infrastructure/eventBus";
import type { DeliveryPartner, InsertDeliveryPartner, Order } from "@shared/schema";

// Types
export type DeliveryPartnerStatus = "available" | "busy" | "offline";

export interface DeliveryPartnerLocation {
  partnerId: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
  accuracy?: number;
  heading?: number;
  speed?: number;
}

export interface NearestPartnerQuery {
  latitude: number;
  longitude: number;
  maxDistanceKm?: number;
  vehicleType?: string;
}

export interface DeliveryPartnerWithDistance {
  id: string;
  userId: string;
  vehicleType: string | null;
  vehicleNumber: string | null;
  licenseNumber: string | null;
  status: "available" | "busy" | "offline" | null;
  currentLatitude: string | null;
  currentLongitude: string | null;
  rating: string | null;
  totalDeliveries: number | null;
  totalEarnings: string | null;
  isVerified: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  distance: number;
}

export interface DeliveryAssignment {
  orderId: string;
  partnerId: string;
  restaurantLocation: { latitude: number; longitude: number };
  deliveryLocation: { latitude: number; longitude: number };
  estimatedPickupTime: Date;
  estimatedDeliveryTime: Date;
}

const serviceConfig: ServiceConfig = {
  name: "delivery-partner-service",
  version: "1.0.0",
  timeout: 5000,
  retryAttempts: 3,
  circuitBreakerEnabled: true,
};

// In-memory location cache for real-time updates
const locationCache = new Map<string, DeliveryPartnerLocation>();

class DeliveryPartnerService extends BaseService {
  private assignmentQueue: Map<string, { orderId: string; attempts: number }> = new Map();

  constructor() {
    super(serviceConfig);
    this.initializeEventHandlers();
    this.startAssignmentProcessor();
  }

  private initializeEventHandlers(): void {
    // Listen for orders ready for pickup
    eventBus.subscribe(EventTypes.ORDER_READY, async (data: any) => {
      if (!data.deliveryPartnerId) {
        await this.autoAssignDeliveryPartner(data.orderId);
      }
    });

    // Listen for order confirmations to start looking for riders
    eventBus.subscribe(EventTypes.ORDER_CONFIRMED, async (data: any) => {
      // Add to assignment queue
      this.assignmentQueue.set(data.orderId, { orderId: data.orderId, attempts: 0 });
    });
  }

  /**
   * Start background processor for delivery assignments
   */
  private startAssignmentProcessor(): void {
    setInterval(async () => {
      for (const [orderId, { attempts }] of Array.from(this.assignmentQueue.entries())) {
        if (attempts >= 5) {
          this.assignmentQueue.delete(orderId);
          this.logger.warn("Failed to assign delivery partner after 5 attempts", { orderId });
          continue;
        }

        try {
          const assigned = await this.autoAssignDeliveryPartner(orderId);
          if (assigned) {
            this.assignmentQueue.delete(orderId);
          } else {
            this.assignmentQueue.set(orderId, { orderId, attempts: attempts + 1 });
          }
        } catch (error) {
          this.logger.error("Error in assignment processor", { orderId, error });
        }
      }
    }, 10000); // Run every 10 seconds
  }

  // ===== Partner Management =====

  /**
   * Register new delivery partner
   */
  async registerPartner(
    userId: string,
    data: Omit<InsertDeliveryPartner, "userId">
  ): Promise<DeliveryPartner> {
    return this.executeWithResilience(async () => {
      const partner = await storage.createDeliveryPartner({
        ...data,
        userId,
        status: "offline",
      });

      await this.publishEvent("rider.registered", {
        partnerId: partner.id,
        userId,
        timestamp: new Date(),
      });

      this.logger.info("Delivery partner registered", { partnerId: partner.id });

      return partner;
    }, "registerPartner");
  }

  /**
   * Get delivery partner by ID
   */
  async getPartner(id: string): Promise<DeliveryPartner | undefined> {
    return this.withCache(
      `partner:${id}`,
      () => storage.getDeliveryPartner(id),
      300
    );
  }

  /**
   * Get delivery partner by user ID
   */
  async getPartnerByUserId(userId: string): Promise<DeliveryPartner | undefined> {
    return this.executeWithResilience(
      () => storage.getDeliveryPartnerByUserId(userId),
      "getPartnerByUserId"
    );
  }

  /**
   * Update partner details
   */
  async updatePartner(
    id: string,
    data: Partial<InsertDeliveryPartner>
  ): Promise<DeliveryPartner | undefined> {
    return this.executeWithResilience(async () => {
      const updated = await storage.updateDeliveryPartner(id, data);
      await this.invalidateCache(`partner:${id}:*`);
      return updated;
    }, "updatePartner");
  }

  /**
   * Update partner status
   */
  async updateStatus(
    partnerId: string,
    status: DeliveryPartnerStatus
  ): Promise<DeliveryPartner | undefined> {
    return this.executeWithResilience(async () => {
      const updated = await storage.updateDeliveryPartner(partnerId, { status });

      if (updated) {
        await this.publishEvent(EventTypes.RIDER_STATUS_CHANGED, {
          partnerId,
          status,
          timestamp: new Date(),
        });

        await this.invalidateCache(`partner:${partnerId}:*`);
        await this.invalidateCache("partners:available");
      }

      return updated;
    }, "updateStatus");
  }

  // ===== Location Management =====

  /**
   * Update partner location (real-time)
   */
  async updateLocation(
    partnerId: string,
    location: Omit<DeliveryPartnerLocation, "partnerId" | "timestamp">
  ): Promise<void> {
    return this.executeWithResilience(async () => {
      // Update in-memory cache for real-time
      locationCache.set(partnerId, {
        partnerId,
        ...location,
        timestamp: new Date(),
      });

      // Update in database (less frequently for performance)
      await storage.updateDeliveryPartnerLocation(
        partnerId,
        location.latitude.toString(),
        location.longitude.toString()
      );

      // Check if partner has active delivery
      const partner = await storage.getDeliveryPartner(partnerId);
      if (partner) {
        const activeOrders = await storage.getOrdersByDeliveryPartner(partnerId);
        const activeOrder = activeOrders.find(
          (o) => o.status === "out_for_delivery"
        );

        if (activeOrder) {
          await this.publishEvent(EventTypes.RIDER_LOCATION_UPDATE, {
            partnerId,
            orderId: activeOrder.id,
            customerId: activeOrder.customerId,
            latitude: location.latitude,
            longitude: location.longitude,
            timestamp: new Date(),
          });
        }
      }
    }, "updateLocation");
  }

  /**
   * Get partner's current location
   */
  getLocation(partnerId: string): DeliveryPartnerLocation | undefined {
    return locationCache.get(partnerId);
  }

  /**
   * Get all available partners
   */
  async getAvailablePartners(): Promise<DeliveryPartner[]> {
    return this.withCache(
      "partners:available",
      () => storage.getAvailableDeliveryPartners(),
      30 // Short cache for availability
    );
  }

  /**
   * Find nearest available partner
   */
  async findNearestPartner(
    query: NearestPartnerQuery
  ): Promise<DeliveryPartnerWithDistance | undefined> {
    return this.executeWithResilience(async () => {
      const availablePartners = await this.getAvailablePartners();

      const partnersWithDistance: DeliveryPartnerWithDistance[] = [];

      for (const partner of availablePartners) {
        // Get real-time location if available
        const liveLocation = locationCache.get(partner.id);
        const lat = liveLocation?.latitude || parseFloat(partner.currentLatitude || "0");
        const lng = liveLocation?.longitude || parseFloat(partner.currentLongitude || "0");

        if (lat === 0 && lng === 0) continue;

        const distance = this.calculateDistance(
          query.latitude,
          query.longitude,
          lat,
          lng
        );

        // Filter by max distance
        if (query.maxDistanceKm && distance > query.maxDistanceKm) continue;

        // Filter by vehicle type
        if (query.vehicleType && partner.vehicleType !== query.vehicleType) continue;

        partnersWithDistance.push({
          ...partner,
          distance,
        });
      }

      // Sort by distance and return nearest
      partnersWithDistance.sort((a, b) => a.distance - b.distance);
      return partnersWithDistance[0];
    }, "findNearestPartner");
  }

  // ===== Order Assignment =====

  /**
   * Auto-assign delivery partner to order
   */
  async autoAssignDeliveryPartner(orderId: string): Promise<boolean> {
    return this.executeWithResilience(async () => {
      const order = await storage.getOrder(orderId);
      if (!order || order.deliveryPartnerId) return true;

      const restaurant = await storage.getRestaurant(order.restaurantId);
      if (!restaurant) return false;

      // Find nearest available partner
      const nearestPartner = await this.findNearestPartner({
        latitude: parseFloat(restaurant.latitude || "0"),
        longitude: parseFloat(restaurant.longitude || "0"),
        maxDistanceKm: 10,
      });

      if (!nearestPartner) {
        this.logger.info("No available delivery partners nearby", { orderId });
        return false;
      }

      const partnerId = nearestPartner.id;

      // Assign partner
      await storage.updateOrder(orderId, {
        deliveryPartnerId: partnerId,
      });

      // Update partner status
      await this.updateStatus(partnerId, "busy");

      // Calculate ETA
      const estimatedDeliveryTime = this.calculateETA(
        nearestPartner.distance,
        parseFloat(restaurant.latitude || "0"),
        parseFloat(restaurant.longitude || "0"),
        parseFloat(order.deliveryLatitude || "0"),
        parseFloat(order.deliveryLongitude || "0")
      );

      await storage.updateOrder(orderId, {
        estimatedDeliveryTime,
      });

      // Publish event
      await this.publishEvent(EventTypes.RIDER_ASSIGNED, {
        orderId,
        riderId: partnerId,
        restaurantId: order.restaurantId,
        estimatedDeliveryTime,
        timestamp: new Date(),
      });

      this.logger.info("Delivery partner assigned", {
        orderId,
        partnerId: partnerId,
        distance: nearestPartner.distance.toFixed(2),
      });

      return true;
    }, "autoAssignDeliveryPartner");
  }

  /**
   * Complete delivery
   */
  async completeDelivery(
    partnerId: string,
    orderId: string
  ): Promise<void> {
    return this.executeWithResilience(async () => {
      // Update partner status and stats
      const partner = await storage.getDeliveryPartner(partnerId);
      if (partner) {
        const order = await storage.getOrder(orderId);
        const deliveryEarning = parseFloat(order?.deliveryFee || "0") * 0.8; // Partner gets 80%

        await storage.updateDeliveryPartner(partnerId, {
          status: "available",
          totalDeliveries: (partner.totalDeliveries || 0) + 1,
          totalEarnings: (parseFloat(partner.totalEarnings || "0") + deliveryEarning).toFixed(2),
        } as any);
      }

      await this.invalidateCache(`partner:${partnerId}:*`);
      await this.invalidateCache("partners:available");
    }, "completeDelivery");
  }

  // ===== Statistics =====

  /**
   * Get partner statistics
   */
  async getPartnerStats(partnerId: string): Promise<{
    totalDeliveries: number;
    totalEarnings: number;
    rating: number;
    todayDeliveries: number;
    todayEarnings: number;
  }> {
    return this.withCache(
      `partner:${partnerId}:stats`,
      async () => {
        const partner = await storage.getDeliveryPartner(partnerId);
        const orders = await storage.getOrdersByDeliveryPartner(partnerId);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayOrders = orders.filter(
          (o) => o.createdAt && new Date(o.createdAt) >= today && o.status === "delivered"
        );

        return {
          totalDeliveries: partner?.totalDeliveries || 0,
          totalEarnings: parseFloat(partner?.totalEarnings || "0"),
          rating: parseFloat(partner?.rating || "5.0"),
          todayDeliveries: todayOrders.length,
          todayEarnings: todayOrders.reduce(
            (sum, o) => sum + parseFloat(o.deliveryFee || "0") * 0.8,
            0
          ),
        };
      },
      300
    );
  }

  // ===== Helpers =====

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Calculate ETA for delivery
   */
  private calculateETA(
    partnerToRestaurantKm: number,
    restLat: number,
    restLng: number,
    deliveryLat: number,
    deliveryLng: number
  ): Date {
    const restaurantToDeliveryKm = this.calculateDistance(
      restLat,
      restLng,
      deliveryLat,
      deliveryLng
    );

    // Assume average speed of 20 km/h in city
    const avgSpeedKmh = 20;
    const preparationTimeMin = 15; // Average restaurant prep time

    const totalDistanceKm = partnerToRestaurantKm + restaurantToDeliveryKm;
    const travelTimeMin = (totalDistanceKm / avgSpeedKmh) * 60;
    const totalTimeMin = preparationTimeMin + travelTimeMin;

    const eta = new Date();
    eta.setMinutes(eta.getMinutes() + Math.ceil(totalTimeMin));
    return eta;
  }

  /**
   * Health check
   */
  async checkHealth(): Promise<ServiceHealth> {
    const checks = [];

    try {
      const startTime = Date.now();
      await storage.getAvailableDeliveryPartners();
      checks.push({
        name: "database",
        status: "pass" as const,
        responseTime: Date.now() - startTime,
      });
    } catch {
      checks.push({
        name: "database",
        status: "fail" as const,
        message: "Failed to query delivery partners",
      });
    }

    checks.push({
      name: "location_cache",
      status: "pass" as const,
      message: `${locationCache.size} active locations tracked`,
    });

    checks.push({
      name: "assignment_queue",
      status: "pass" as const,
      message: `${this.assignmentQueue.size} orders pending assignment`,
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

export const deliveryPartnerService = new DeliveryPartnerService();
