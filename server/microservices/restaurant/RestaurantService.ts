/**
 * Restaurant Service
 * Manages restaurant information, operating hours, and settings
 * 
 * Patterns:
 * - CQRS for read/write separation
 * - Event sourcing for audit trail
 * - Cache-aside for read optimization
 */

import { BaseService, ServiceHealth, ServiceConfig } from "../core/BaseService";
import { storage } from "../../storage";
import { eventBus, EventTypes } from "../../infrastructure/eventBus";
import type { Restaurant, InsertRestaurant } from "@shared/schema";

// Types
export interface RestaurantSearchFilters {
  cuisine?: string;
  minRating?: number;
  maxDeliveryTime?: number;
  city?: string;
  isOpen?: boolean;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
}

export interface RestaurantWithDistance extends Restaurant {
  distance?: number;
}

const serviceConfig: ServiceConfig = {
  name: "restaurant-service",
  version: "1.0.0",
  timeout: 5000,
  retryAttempts: 3,
  circuitBreakerEnabled: true,
};

class RestaurantService extends BaseService {
  constructor() {
    super(serviceConfig);
    this.initializeEventHandlers();
  }

  private initializeEventHandlers(): void {
    // Listen for menu updates to update restaurant popularity
    eventBus.subscribe(EventTypes.MENU_UPDATED, async (data: any) => {
      await this.invalidateCache(`restaurant:${data.restaurantId}:*`);
    });

    // Listen for order completion to update ratings
    eventBus.subscribe(EventTypes.ORDER_DELIVERED, async (data: any) => {
      await this.updateRestaurantStats(data.restaurantId);
    });
  }

  /**
   * Get all active restaurants
   */
  async getAllRestaurants(): Promise<Restaurant[]> {
    return this.withCache(
      "restaurants:all",
      () => storage.getRestaurants(),
      300 // 5 minutes cache
    );
  }

  /**
   * Get restaurant by ID
   */
  async getRestaurant(id: string): Promise<Restaurant | undefined> {
    return this.withCache(
      `restaurant:${id}`,
      () => storage.getRestaurant(id),
      600 // 10 minutes cache
    );
  }

  /**
   * Get restaurants by owner
   */
  async getRestaurantsByOwner(ownerId: string): Promise<Restaurant[]> {
    return this.executeWithResilience(
      () => storage.getRestaurantsByOwner(ownerId),
      "getRestaurantsByOwner"
    );
  }

  /**
   * Search restaurants with filters
   */
  async searchRestaurants(
    query: string,
    filters: RestaurantSearchFilters = {}
  ): Promise<RestaurantWithDistance[]> {
    return this.executeWithResilience(async () => {
      let results = await storage.searchRestaurants(query, {
        cuisine: filters.cuisine,
        minRating: filters.minRating,
      });

      // Apply additional filters
      if (filters.maxDeliveryTime) {
        results = results.filter(
          (r) => (r.deliveryTime || 30) <= filters.maxDeliveryTime!
        );
      }

      if (filters.city) {
        results = results.filter(
          (r) => r.city?.toLowerCase() === filters.city!.toLowerCase()
        );
      }

      if (filters.isOpen !== undefined) {
        results = results.filter((r) => this.isRestaurantOpen(r) === filters.isOpen);
      }

      // Calculate distance if coordinates provided
      if (filters.latitude && filters.longitude) {
        const resultsWithDistance = results.map((r) => ({
          ...r,
          distance: this.calculateDistance(
            filters.latitude!,
            filters.longitude!,
            parseFloat(r.latitude || "0"),
            parseFloat(r.longitude || "0")
          ),
        }));

        // Filter by radius if specified
        if (filters.radiusKm) {
          return resultsWithDistance
            .filter((r) => (r.distance || 0) <= filters.radiusKm!)
            .sort((a, b) => (a.distance || 0) - (b.distance || 0));
        }

        return resultsWithDistance.sort((a, b) => (a.distance || 0) - (b.distance || 0));
      }

      return results;
    }, "searchRestaurants");
  }

  /**
   * Create new restaurant
   */
  async createRestaurant(
    ownerId: string,
    data: Omit<InsertRestaurant, "ownerId">
  ): Promise<Restaurant> {
    return this.executeWithResilience(async () => {
      const restaurant = await storage.createRestaurant({
        ...data,
        ownerId,
      });

      // Invalidate caches
      await this.invalidateCache("restaurants:*");

      // Publish event
      await this.publishEvent(EventTypes.RESTAURANT_UPDATED, {
        action: "created",
        restaurantId: restaurant.id,
        ownerId,
        timestamp: new Date(),
      });

      this.logger.info("Restaurant created", { restaurantId: restaurant.id });

      return restaurant;
    }, "createRestaurant");
  }

  /**
   * Update restaurant
   */
  async updateRestaurant(
    id: string,
    data: Partial<InsertRestaurant>
  ): Promise<Restaurant | undefined> {
    return this.executeWithResilience(async () => {
      const restaurant = await storage.updateRestaurant(id, data);

      if (restaurant) {
        // Invalidate caches
        await this.invalidateCache(`restaurant:${id}:*`);
        await this.invalidateCache("restaurants:*");

        // Publish event
        await this.publishEvent(EventTypes.RESTAURANT_UPDATED, {
          action: "updated",
          restaurantId: id,
          changes: Object.keys(data),
          timestamp: new Date(),
        });
      }

      return restaurant;
    }, "updateRestaurant");
  }

  /**
   * Update restaurant status (open/closed)
   */
  async updateRestaurantStatus(id: string, isActive: boolean): Promise<Restaurant | undefined> {
    return this.updateRestaurant(id, { isActive });
  }

  /**
   * Update restaurant rating based on new review
   */
  async updateRestaurantRating(
    restaurantId: string,
    newRating: number
  ): Promise<void> {
    return this.executeWithResilience(async () => {
      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) return;

      const currentRating = parseFloat(restaurant.rating || "0");
      const totalRatings = restaurant.totalRatings || 0;

      // Calculate new average
      const newAverage =
        (currentRating * totalRatings + newRating) / (totalRatings + 1);

      await storage.updateRestaurant(restaurantId, {
        rating: newAverage.toFixed(1),
        totalRatings: totalRatings + 1,
      } as any);

      await this.invalidateCache(`restaurant:${restaurantId}:*`);
    }, "updateRestaurantRating");
  }

  /**
   * Get restaurant statistics
   */
  async getRestaurantStats(restaurantId: string): Promise<{
    totalOrders: number;
    averageRating: number;
    totalRevenue: number;
    popularItems: string[];
  }> {
    return this.withCache(
      `restaurant:${restaurantId}:stats`,
      async () => {
        const restaurant = await storage.getRestaurant(restaurantId);
        const orders = await storage.getOrdersByRestaurant(restaurantId);

        const completedOrders = orders.filter((o) => o.status === "delivered");
        const totalRevenue = completedOrders.reduce(
          (sum, o) => sum + parseFloat(o.total),
          0
        );

        return {
          totalOrders: completedOrders.length,
          averageRating: parseFloat(restaurant?.rating || "0"),
          totalRevenue,
          popularItems: [], // Would need order items aggregation
        };
      },
      1800 // 30 minutes cache
    );
  }

  /**
   * Check if restaurant is currently open
   */
  isRestaurantOpen(restaurant: Restaurant): boolean {
    if (!restaurant.isActive) return false;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;

    const openingTime = restaurant.openingTime || "09:00";
    const closingTime = restaurant.closingTime || "22:00";

    return currentTime >= openingTime && currentTime <= closingTime;
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
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
   * Update restaurant stats after order completion
   */
  private async updateRestaurantStats(restaurantId: string): Promise<void> {
    await this.invalidateCache(`restaurant:${restaurantId}:stats`);
  }

  /**
   * Health check
   */
  async checkHealth(): Promise<ServiceHealth> {
    const checks = [];

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
        message: "Failed to query restaurants",
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

export const restaurantService = new RestaurantService();
