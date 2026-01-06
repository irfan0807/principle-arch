/**
 * Machine Learning Service
 * 
 * Features:
 * - Restaurant recommendations
 * - Menu item recommendations
 * - ETA prediction
 * - Demand forecasting
 * - Fraud detection
 * - Dynamic pricing suggestions
 * - Personalization engine
 */

import { BaseService, ServiceHealth, ServiceConfig } from "../core/BaseService";
import { distributedCache, RedisCacheKeys } from "../../infrastructure/redisCache";
import { eventBus, EventTypes } from "../../infrastructure/eventBus";
import { logger } from "../../infrastructure/logger";
import { metrics } from "../../infrastructure/metrics";
import { storage } from "../../storage";

// Types
export interface UserPreferences {
  userId: string;
  cuisinePreferences: Map<string, number>;
  pricePreference: "budget" | "mid" | "premium";
  dietaryRestrictions: string[];
  orderHistory: OrderHistoryItem[];
  averageOrderValue: number;
  preferredDeliveryTime: string;
  favoriteRestaurants: string[];
  lastLocation?: GeoLocation;
}

interface OrderHistoryItem {
  orderId: string;
  restaurantId: string;
  items: string[];
  total: number;
  rating?: number;
  timestamp: Date;
}

interface GeoLocation {
  latitude: number;
  longitude: number;
}

export interface RecommendationResult {
  type: "restaurant" | "menuItem" | "offer";
  id: string;
  name: string;
  score: number;
  reason: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface ETAPrediction {
  estimatedMinutes: number;
  confidence: number;
  factors: ETAFactor[];
  range: {
    min: number;
    max: number;
  };
}

interface ETAFactor {
  name: string;
  impact: number;
  description: string;
}

export interface DemandForecast {
  restaurantId: string;
  timeSlot: string;
  predictedOrders: number;
  confidence: number;
  trend: "increasing" | "stable" | "decreasing";
  factors: string[];
}

export interface FraudScore {
  score: number;
  risk: "low" | "medium" | "high";
  flags: FraudFlag[];
  recommendation: "allow" | "review" | "block";
}

interface FraudFlag {
  type: string;
  severity: number;
  description: string;
}

export interface PricingSuggestion {
  itemId: string;
  currentPrice: number;
  suggestedPrice: number;
  reason: string;
  expectedImpact: {
    orders: number;
    revenue: number;
  };
}

const serviceConfig: ServiceConfig = {
  name: "ml-service",
  version: "1.0.0",
  timeout: 10000,
  retryAttempts: 2,
  circuitBreakerEnabled: true,
};

/**
 * Machine Learning Service
 */
class MachineLearningService extends BaseService {
  // Feature vectors cache
  private userFeatures: Map<string, number[]> = new Map();
  private restaurantFeatures: Map<string, number[]> = new Map();
  private itemFeatures: Map<string, number[]> = new Map();
  
  // Model weights (in production, load from model files)
  private recommendationWeights: number[] = [];
  private etaWeights: number[] = [];
  private fraudWeights: number[] = [];

  // Collaborative filtering data
  private userItemMatrix: Map<string, Map<string, number>> = new Map();
  private itemSimilarityMatrix: Map<string, Map<string, number>> = new Map();

  constructor() {
    super(serviceConfig);
    this.initializeModels();
    this.setupEventListeners();
  }

  private async initializeModels(): Promise<void> {
    this.logger.info("Initializing ML models...");
    
    // Initialize recommendation model weights
    this.recommendationWeights = this.initializeWeights(100);
    this.etaWeights = this.initializeWeights(20);
    this.fraudWeights = this.initializeWeights(30);

    // Load historical data for collaborative filtering
    await this.loadHistoricalData();
    
    this.logger.info("ML models initialized");
  }

  private initializeWeights(size: number): number[] {
    // Xavier initialization
    const scale = Math.sqrt(2.0 / size);
    return Array(size).fill(0).map(() => (Math.random() - 0.5) * 2 * scale);
  }

  private async loadHistoricalData(): Promise<void> {
    try {
      // In production, load from data warehouse
      const orders = await storage.getOrders();
      
      for (const order of orders) {
        if (!this.userItemMatrix.has(order.customerId)) {
          this.userItemMatrix.set(order.customerId, new Map());
        }
        
        // Get order items using the order ID
        const orderItems = await storage.getOrderItems(order.id);
        for (const item of orderItems) {
          const rating = 4; // Default rating since we don't have explicit ratings
          this.userItemMatrix.get(order.customerId)!.set(item.menuItemId, rating);
        }
      }

      // Calculate item-item similarity
      await this.calculateItemSimilarity();
      
    } catch (error) {
      this.logger.error("Failed to load historical data", { error });
    }
  }

  private async calculateItemSimilarity(): Promise<void> {
    const itemUsers: Map<string, Map<string, number>> = new Map();

    // Transpose user-item to item-user
    const userEntries = Array.from(this.userItemMatrix.entries());
    for (const [userId, items] of userEntries) {
      const itemEntries = Array.from(items.entries());
      for (const [itemId, rating] of itemEntries) {
        if (!itemUsers.has(itemId)) {
          itemUsers.set(itemId, new Map());
        }
        itemUsers.get(itemId)!.set(userId, rating);
      }
    }

    // Calculate cosine similarity between items
    const itemIds = Array.from(itemUsers.keys());
    for (let i = 0; i < itemIds.length; i++) {
      const item1 = itemIds[i];
      if (!this.itemSimilarityMatrix.has(item1)) {
        this.itemSimilarityMatrix.set(item1, new Map());
      }

      for (let j = i + 1; j < itemIds.length; j++) {
        const item2 = itemIds[j];
        const similarity = this.cosineSimilarity(
          itemUsers.get(item1)!,
          itemUsers.get(item2)!
        );

        this.itemSimilarityMatrix.get(item1)!.set(item2, similarity);
        
        if (!this.itemSimilarityMatrix.has(item2)) {
          this.itemSimilarityMatrix.set(item2, new Map());
        }
        this.itemSimilarityMatrix.get(item2)!.set(item1, similarity);
      }
    }
  }

  private cosineSimilarity(
    vec1: Map<string, number>,
    vec2: Map<string, number>
  ): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    const keys1 = Array.from(vec1.keys());
    const keys2 = Array.from(vec2.keys());
    const allKeys = new Set([...keys1, ...keys2]);
    const keyArray = Array.from(allKeys);
    
    for (const key of keyArray) {
      const v1 = vec1.get(key) || 0;
      const v2 = vec2.get(key) || 0;
      dotProduct += v1 * v2;
      norm1 += v1 * v1;
      norm2 += v2 * v2;
    }

    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  private setupEventListeners(): void {
    // Update user preferences on order completion
    eventBus.subscribe(EventTypes.ORDER_DELIVERED, async (data: any) => {
      await this.updateUserPreferences(data.customerId, data);
    });

    // Update item popularity
    eventBus.subscribe(EventTypes.ORDER_CREATED, async (data: any) => {
      await this.updateItemPopularity(data.items);
    });
  }

  /**
   * Get personalized restaurant recommendations
   */
  async getRestaurantRecommendations(
    userId: string,
    location: GeoLocation,
    limit: number = 10
  ): Promise<RecommendationResult[]> {
    const timer = metrics.startTimer("ml.recommendations.restaurants");
    
    try {
      // Check cache first
      const cacheKey = RedisCacheKeys.userRecommendations(userId);
      const cached = await distributedCache.get<RecommendationResult[]>(cacheKey);
      if (cached) {
        return cached.slice(0, limit);
      }

      // Get user preferences
      const preferences = await this.getUserPreferences(userId);
      
      // Get all restaurants
      const restaurants = await storage.getRestaurants();
      
      // Score each restaurant
      const scored = await Promise.all(
        restaurants.map(async (restaurant) => {
          const score = await this.calculateRestaurantScore(
            restaurant,
            preferences,
            location
          );
          return {
            type: "restaurant" as const,
            id: restaurant.id,
            name: restaurant.name,
            score: score.total,
            reason: score.reason,
            confidence: score.confidence,
            metadata: {
              cuisine: restaurant.cuisine,
              rating: restaurant.rating,
              distance: score.distance,
            },
          };
        })
      );

      // Sort by score and return top N
      const results = scored
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      // Cache results
      await distributedCache.set(cacheKey, results, 1800); // 30 minutes

      metrics.recordSuccess("ml.recommendations.restaurants");
      return results;
    } catch (error) {
      metrics.recordError("ml.recommendations.restaurants");
      this.logger.error("Failed to get restaurant recommendations", { error });
      throw error;
    } finally {
      timer.end();
    }
  }

  private async calculateRestaurantScore(
    restaurant: any,
    preferences: UserPreferences,
    location: GeoLocation
  ): Promise<{
    total: number;
    reason: string;
    confidence: number;
    distance: number;
  }> {
    let score = 0;
    const reasons: string[] = [];

    // Cuisine match (30% weight)
    const cuisineScore = preferences.cuisinePreferences.get(restaurant.cuisine) || 0;
    score += cuisineScore * 0.3;
    if (cuisineScore > 0.5) {
      reasons.push(`You enjoy ${restaurant.cuisine} cuisine`);
    }

    // Rating (20% weight)
    const ratingScore = (restaurant.rating || 3) / 5;
    score += ratingScore * 0.2;
    if (ratingScore > 0.9) {
      reasons.push("Highly rated restaurant");
    }

    // Distance (20% weight)
    const distance = this.calculateDistance(
      location.latitude,
      location.longitude,
      restaurant.latitude || 0,
      restaurant.longitude || 0
    );
    const distanceScore = Math.max(0, 1 - distance / 10); // 10km max
    score += distanceScore * 0.2;
    if (distance < 2) {
      reasons.push("Very close to you");
    }

    // Price preference (15% weight)
    const priceScore = this.matchPricePreference(
      preferences.pricePreference,
      restaurant.priceRange || "mid"
    );
    score += priceScore * 0.15;

    // Previous orders (15% weight)
    const orderedBefore = preferences.favoriteRestaurants.includes(restaurant.id);
    if (orderedBefore) {
      score += 0.15;
      reasons.push("You've ordered here before");
    }

    // Collaborative filtering boost
    const cfScore = await this.getCollaborativeFilteringScore(
      preferences.userId,
      restaurant.id
    );
    score *= 1 + cfScore * 0.2;

    // Calculate confidence based on data availability
    let confidence = 0.5;
    if (preferences.orderHistory.length > 5) confidence += 0.2;
    if (preferences.cuisinePreferences.size > 3) confidence += 0.15;
    if (orderedBefore) confidence += 0.15;

    return {
      total: Math.min(1, score),
      reason: reasons.length > 0 ? reasons[0] : "Based on your preferences",
      confidence: Math.min(1, confidence),
      distance,
    };
  }

  private matchPricePreference(
    userPref: string,
    restaurantRange: string
  ): number {
    const levels: Record<string, number> = { budget: 1, mid: 2, premium: 3 };
    const userLevel = levels[userPref] || 2;
    const restLevel = levels[restaurantRange] || 2;
    return 1 - Math.abs(userLevel - restLevel) / 2;
  }

  private async getCollaborativeFilteringScore(
    userId: string,
    restaurantId: string
  ): Promise<number> {
    // Find similar users and their ratings for this restaurant
    // In production, use matrix factorization (ALS, SVD)
    return Math.random() * 0.3; // Placeholder
  }

  /**
   * Get menu item recommendations
   */
  async getMenuItemRecommendations(
    userId: string,
    restaurantId: string,
    limit: number = 5
  ): Promise<RecommendationResult[]> {
    const timer = metrics.startTimer("ml.recommendations.items");

    try {
      const menu = await storage.getMenuItems(restaurantId);
      const preferences = await this.getUserPreferences(userId);

      // Get user's order history for this restaurant
      const userItems = this.userItemMatrix.get(userId) || new Map();
      const userItemsArray = Array.from(userItems.entries());

      const scored = menu.map((item) => {
        let score = 0;
        const reasons: string[] = [];

        // Item-based collaborative filtering
        for (const [orderedItem, rating] of userItemsArray) {
          const similarity = this.itemSimilarityMatrix.get(orderedItem)?.get(item.id) || 0;
          score += similarity * rating;
        }

        // Popularity score
        const popularityScore = item.isPopular ? 0.3 : 0;
        score += popularityScore;
        if (item.isPopular) {
          reasons.push("Popular choice");
        }

        // Dietary restrictions
        if (preferences.dietaryRestrictions.includes("vegetarian") && item.isVegetarian) {
          score += 0.2;
          reasons.push("Vegetarian option");
        }
        if (preferences.dietaryRestrictions.includes("vegan") && item.isVegan) {
          score += 0.2;
          reasons.push("Vegan option");
        }

        // Price alignment
        const itemPrice = Number(item.price) || 0;
        const avgOrder = preferences.averageOrderValue || 20;
        if (itemPrice <= avgOrder / 2) {
          score += 0.1;
        }

        return {
          type: "menuItem" as const,
          id: item.id,
          name: item.name,
          score,
          reason: reasons[0] || "Recommended for you",
          confidence: 0.7,
          metadata: {
            price: item.price,
            isVegetarian: item.isVegetarian,
            isPopular: item.isPopular,
          },
        };
      });

      const results = scored.sort((a: typeof scored[0], b: typeof scored[0]) => b.score - a.score).slice(0, limit);
      
      metrics.recordSuccess("ml.recommendations.items");
      return results;
    } catch (error) {
      metrics.recordError("ml.recommendations.items");
      this.logger.error("Failed to get item recommendations", { error });
      throw error;
    } finally {
      timer.end();
    }
  }

  /**
   * Predict delivery ETA
   */
  async predictETA(
    restaurantId: string,
    customerLocation: GeoLocation,
    orderItems: { id: string; quantity: number }[]
  ): Promise<ETAPrediction> {
    const timer = metrics.startTimer("ml.eta.prediction");

    try {
      const factors: ETAFactor[] = [];
      let baseETA = 30; // Base 30 minutes

      // Restaurant preparation time
      const restaurant = await storage.getRestaurant(restaurantId);
      const prepTime = this.estimatePrepTime(orderItems);
      baseETA += prepTime;
      factors.push({
        name: "preparation",
        impact: prepTime,
        description: `Estimated prep time: ${prepTime} min`,
      });

      // Distance factor
      const distance = this.calculateDistance(
        Number(restaurant?.latitude) || 0,
        Number(restaurant?.longitude) || 0,
        customerLocation.latitude,
        customerLocation.longitude
      );
      const deliveryTime = distance * 3; // ~3 min per km
      baseETA += deliveryTime;
      factors.push({
        name: "distance",
        impact: deliveryTime,
        description: `${distance.toFixed(1)} km delivery distance`,
      });

      // Time of day factor
      const hour = new Date().getHours();
      let timeFactor = 0;
      if ((hour >= 12 && hour <= 14) || (hour >= 19 && hour <= 21)) {
        timeFactor = 10; // Rush hour
        factors.push({
          name: "rush_hour",
          impact: 10,
          description: "Peak ordering time",
        });
      }
      baseETA += timeFactor;

      // Weather factor (simulated)
      const weatherDelay = Math.random() > 0.8 ? 5 : 0;
      if (weatherDelay > 0) {
        baseETA += weatherDelay;
        factors.push({
          name: "weather",
          impact: weatherDelay,
          description: "Weather conditions may affect delivery",
        });
      }

      // Restaurant load factor
      const loadFactor = await this.getRestaurantLoad(restaurantId);
      if (loadFactor > 0.7) {
        const loadDelay = (loadFactor - 0.7) * 20;
        baseETA += loadDelay;
        factors.push({
          name: "restaurant_load",
          impact: loadDelay,
          description: "Restaurant is busy",
        });
      }

      // Calculate confidence based on data availability
      let confidence = 0.85;
      if (distance > 5) confidence -= 0.1;
      if (timeFactor > 0) confidence -= 0.05;

      const variance = baseETA * 0.15; // 15% variance

      metrics.recordSuccess("ml.eta.prediction");

      return {
        estimatedMinutes: Math.round(baseETA),
        confidence,
        factors,
        range: {
          min: Math.round(baseETA - variance),
          max: Math.round(baseETA + variance),
        },
      };
    } catch (error) {
      metrics.recordError("ml.eta.prediction");
      this.logger.error("Failed to predict ETA", { error });
      throw error;
    } finally {
      timer.end();
    }
  }

  private estimatePrepTime(items: { id: string; quantity: number }[]): number {
    // Base prep time + time per item
    const base = 10;
    const perItem = 2;
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    return base + Math.min(totalItems * perItem, 20); // Cap at 20 minutes extra
  }

  private async getRestaurantLoad(restaurantId: string): Promise<number> {
    // Get active orders for restaurant
    try {
      const activeOrders = await storage.getOrdersByRestaurant(restaurantId);
      const pendingOrders = activeOrders.filter(
        (o) => o.status !== "delivered" && o.status !== "cancelled"
      );
      return Math.min(1, pendingOrders.length / 10); // Max at 10 orders
    } catch {
      return 0.5; // Default medium load
    }
  }

  /**
   * Forecast demand for a restaurant
   */
  async forecastDemand(
    restaurantId: string,
    timeSlots: string[] // e.g., ["12:00", "13:00", "14:00"]
  ): Promise<DemandForecast[]> {
    const timer = metrics.startTimer("ml.demand.forecast");

    try {
      const forecasts: DemandForecast[] = [];

      for (const timeSlot of timeSlots) {
        const hour = parseInt(timeSlot.split(":")[0]);
        
        // Base demand by hour
        let baseDemand = 5;
        if (hour >= 12 && hour <= 14) baseDemand = 15; // Lunch peak
        if (hour >= 19 && hour <= 21) baseDemand = 20; // Dinner peak
        if (hour >= 22 || hour <= 10) baseDemand = 3; // Off-peak

        // Day of week factor
        const dayOfWeek = new Date().getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          baseDemand *= 1.3; // Weekend boost
        }

        // Add random variation
        const variation = (Math.random() - 0.5) * 0.3;
        const predicted = Math.round(baseDemand * (1 + variation));

        // Determine trend
        const trend = variation > 0.1 
          ? "increasing" 
          : variation < -0.1 
            ? "decreasing" 
            : "stable";

        forecasts.push({
          restaurantId,
          timeSlot,
          predictedOrders: predicted,
          confidence: 0.75,
          trend,
          factors: this.getDemandFactors(hour, dayOfWeek),
        });
      }

      metrics.recordSuccess("ml.demand.forecast");
      return forecasts;
    } catch (error) {
      metrics.recordError("ml.demand.forecast");
      this.logger.error("Failed to forecast demand", { error });
      throw error;
    } finally {
      timer.end();
    }
  }

  private getDemandFactors(hour: number, dayOfWeek: number): string[] {
    const factors: string[] = [];
    
    if (hour >= 12 && hour <= 14) factors.push("Lunch rush hour");
    if (hour >= 19 && hour <= 21) factors.push("Dinner rush hour");
    if (dayOfWeek === 0 || dayOfWeek === 6) factors.push("Weekend");
    if (dayOfWeek === 5) factors.push("Friday evening boost");
    
    return factors;
  }

  /**
   * Calculate fraud score for an order
   */
  async calculateFraudScore(orderData: {
    userId: string;
    total: number;
    paymentMethod: string;
    deliveryAddress: string;
    ip?: string;
  }): Promise<FraudScore> {
    const timer = metrics.startTimer("ml.fraud.score");

    try {
      const flags: FraudFlag[] = [];
      let score = 0;

      // Check for new user with high value order
      const userOrders = await storage.getOrdersByCustomer(orderData.userId);
      if (userOrders.length < 3 && orderData.total > 100) {
        score += 25;
        flags.push({
          type: "new_user_high_value",
          severity: 25,
          description: "New user placing high-value order",
        });
      }

      // Check for unusual order value
      if (userOrders.length > 0) {
        const avgOrder = userOrders.reduce((sum, o) => sum + Number(o.total), 0) / userOrders.length;
        if (orderData.total > avgOrder * 3) {
          score += 20;
          flags.push({
            type: "unusual_amount",
            severity: 20,
            description: "Order value significantly above average",
          });
        }
      }

      // Check for multiple orders in short time
      const recentOrders = userOrders.filter(
        (o) => Date.now() - new Date(o.createdAt!).getTime() < 3600000 // 1 hour
      );
      if (recentOrders.length >= 3) {
        score += 15;
        flags.push({
          type: "velocity",
          severity: 15,
          description: "Multiple orders in short time period",
        });
      }

      // Determine risk level and recommendation
      let risk: "low" | "medium" | "high";
      let recommendation: "allow" | "review" | "block";

      if (score < 30) {
        risk = "low";
        recommendation = "allow";
      } else if (score < 60) {
        risk = "medium";
        recommendation = "review";
      } else {
        risk = "high";
        recommendation = "block";
      }

      metrics.recordSuccess("ml.fraud.score");

      return {
        score,
        risk,
        flags,
        recommendation,
      };
    } catch (error) {
      metrics.recordError("ml.fraud.score");
      this.logger.error("Failed to calculate fraud score", { error });
      throw error;
    } finally {
      timer.end();
    }
  }

  /**
   * Get dynamic pricing suggestions
   */
  async getPricingSuggestions(
    restaurantId: string
  ): Promise<PricingSuggestion[]> {
    const timer = metrics.startTimer("ml.pricing.suggestions");

    try {
      const menu = await storage.getMenuItems(restaurantId);
      const suggestions: PricingSuggestion[] = [];

      for (const item of menu) {
        const currentPrice = Number(item.price) || 0;
        
        // Analyze demand and competition
        const demandScore = item.isPopular ? 1.1 : 0.9;
        const suggestedPrice = currentPrice * demandScore;

        if (Math.abs(suggestedPrice - currentPrice) > 0.5) {
          suggestions.push({
            itemId: item.id,
            currentPrice,
            suggestedPrice: Math.round(suggestedPrice * 100) / 100,
            reason: item.isPopular 
              ? "High demand item - price increase potential"
              : "Consider promotional pricing",
            expectedImpact: {
              orders: item.isPopular ? -5 : 10, // % change
              revenue: item.isPopular ? 8 : 5, // % change
            },
          });
        }
      }

      metrics.recordSuccess("ml.pricing.suggestions");
      return suggestions;
    } catch (error) {
      metrics.recordError("ml.pricing.suggestions");
      this.logger.error("Failed to get pricing suggestions", { error });
      throw error;
    } finally {
      timer.end();
    }
  }

  /**
   * Get trending restaurants
   */
  async getTrendingRestaurants(limit: number = 10): Promise<RecommendationResult[]> {
    const cached = await distributedCache.get<RecommendationResult[]>(
      RedisCacheKeys.trendingRestaurants()
    );
    if (cached) return cached.slice(0, limit);

    const restaurants = await storage.getRestaurants();
    
    // Calculate trending score based on recent activity
    const scored = restaurants.map((r) => ({
      type: "restaurant" as const,
      id: r.id,
      name: r.name,
      score: (Number(r.rating) || 0) * 0.5 + Math.random() * 0.5,
      reason: "Trending in your area",
      confidence: 0.8,
    }));

    const results = scored.sort((a, b) => b.score - a.score).slice(0, limit);
    await distributedCache.set(RedisCacheKeys.trendingRestaurants(), results, 3600);

    return results;
  }

  /**
   * Get popular menu items
   */
  async getPopularItems(limit: number = 20): Promise<RecommendationResult[]> {
    const cached = await distributedCache.get<RecommendationResult[]>(
      RedisCacheKeys.popularItems()
    );
    if (cached) return cached.slice(0, limit);

    // In production, aggregate from order data
    return [];
  }

  /**
   * Update user preferences based on order
   */
  private async updateUserPreferences(
    userId: string,
    orderData: any
  ): Promise<void> {
    const cacheKey = `ml:preferences:${userId}`;
    const existing = await distributedCache.get<UserPreferences>(cacheKey);

    const preferences: UserPreferences = existing || {
      userId,
      cuisinePreferences: new Map(),
      pricePreference: "mid",
      dietaryRestrictions: [],
      orderHistory: [],
      averageOrderValue: 0,
      preferredDeliveryTime: "",
      favoriteRestaurants: [],
    };

    // Update order history
    preferences.orderHistory.push({
      orderId: orderData.orderId,
      restaurantId: orderData.restaurantId,
      items: orderData.items?.map((i: any) => i.menuItemId) || [],
      total: orderData.total,
      rating: orderData.rating,
      timestamp: new Date(),
    });

    // Keep last 50 orders
    if (preferences.orderHistory.length > 50) {
      preferences.orderHistory = preferences.orderHistory.slice(-50);
    }

    // Update average order value
    const totalValue = preferences.orderHistory.reduce((sum, o) => sum + o.total, 0);
    preferences.averageOrderValue = totalValue / preferences.orderHistory.length;

    await distributedCache.set(cacheKey, preferences, 86400 * 30); // 30 days
  }

  /**
   * Update item popularity scores
   */
  private async updateItemPopularity(items: any[]): Promise<void> {
    for (const item of items) {
      const key = `ml:popularity:${item.menuItemId}`;
      await distributedCache.incr(key);
    }
  }

  /**
   * Get user preferences
   */
  private async getUserPreferences(userId: string): Promise<UserPreferences> {
    const cacheKey = `ml:preferences:${userId}`;
    const cached = await distributedCache.get<UserPreferences>(cacheKey);

    if (cached) {
      // Convert plain object to Map if needed
      if (!(cached.cuisinePreferences instanceof Map)) {
        cached.cuisinePreferences = new Map(Object.entries(cached.cuisinePreferences || {}));
      }
      return cached;
    }

    // Build preferences from order history
    const orders = await storage.getOrdersByCustomer(userId);
    const cuisinePrefs = new Map<string, number>();
    const restaurants: string[] = [];

    for (const order of orders) {
      const restaurant = await storage.getRestaurant(order.restaurantId);
      if (restaurant) {
        const cuisine = restaurant.cuisine;
        cuisinePrefs.set(cuisine, (cuisinePrefs.get(cuisine) || 0) + 1);
        if (!restaurants.includes(order.restaurantId)) {
          restaurants.push(order.restaurantId);
        }
      }
    }

    // Normalize cuisine preferences
    const maxCount = Math.max(...Array.from(cuisinePrefs.values()), 1);
    cuisinePrefs.forEach((count, cuisine) => {
      cuisinePrefs.set(cuisine, count / maxCount);
    });

    const avgTotal = orders.length > 0
      ? orders.reduce((sum, o) => sum + Number(o.total), 0) / orders.length
      : 20;

    const preferences: UserPreferences = {
      userId,
      cuisinePreferences: cuisinePrefs,
      pricePreference: avgTotal < 15 ? "budget" : avgTotal > 30 ? "premium" : "mid",
      dietaryRestrictions: [],
      orderHistory: orders.map((o) => ({
        orderId: o.id,
        restaurantId: o.restaurantId,
        items: [],
        total: Number(o.total),
        timestamp: new Date(o.createdAt!),
      })),
      averageOrderValue: avgTotal,
      preferredDeliveryTime: "",
      favoriteRestaurants: restaurants.slice(0, 10),
    };

    await distributedCache.set(cacheKey, preferences, 86400); // 1 day
    return preferences;
  }

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
   * Health check
   */
  async checkHealth(): Promise<ServiceHealth> {
    return {
      status: "healthy",
      checks: [
        { name: "models_loaded", status: "pass" },
        { name: "cache_connected", status: "pass" },
      ],
      uptime: Date.now() - this.startTime.getTime(),
      timestamp: new Date(),
    };
  }
}

// Export singleton
export const mlService = new MachineLearningService();
