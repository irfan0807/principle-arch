/**
 * Search & Discovery Service
 * Handles search functionality for restaurants and menu items
 * 
 * Patterns:
 * - Full-text search (ElasticSearch/OpenSearch ready)
 * - Materialized views for fast queries
 * - Cache-aside for popular searches
 * - Geo-spatial search
 */

import { BaseService, ServiceHealth, ServiceConfig } from "../core/BaseService";
import { storage } from "../../storage";
import { eventBus, EventTypes } from "../../infrastructure/eventBus";
import type { Restaurant, MenuItem } from "@shared/schema";

// Types
export interface SearchQuery {
  query: string;
  filters?: SearchFilters;
  sort?: SortOption;
  pagination?: Pagination;
  location?: GeoLocation;
}

export interface SearchFilters {
  cuisine?: string[];
  priceRange?: { min: number; max: number };
  rating?: number;
  deliveryTime?: number;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  isOpen?: boolean;
}

export interface SortOption {
  field: "rating" | "deliveryTime" | "distance" | "relevance" | "popularity";
  order: "asc" | "desc";
}

export interface Pagination {
  page: number;
  limit: number;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  radiusKm?: number;
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
  facets?: SearchFacets;
}

export interface SearchFacets {
  cuisines: { name: string; count: number }[];
  priceRanges: { range: string; count: number }[];
  ratings: { rating: number; count: number }[];
}

export interface RestaurantSearchResult extends Restaurant {
  distance?: number;
  matchScore?: number;
  highlightedName?: string;
}

export interface MenuItemSearchResult extends MenuItem {
  restaurantName: string;
  matchScore?: number;
}

export interface SuggestionResult {
  type: "restaurant" | "cuisine" | "dish" | "category";
  text: string;
  id?: string;
  metadata?: Record<string, any>;
}

const serviceConfig: ServiceConfig = {
  name: "search-service",
  version: "1.0.0",
  timeout: 5000,
  retryAttempts: 2,
  circuitBreakerEnabled: true,
};

// Search index cache (in production, use ElasticSearch)
const searchIndex = {
  restaurants: new Map<string, Restaurant>(),
  menuItems: new Map<string, MenuItem & { restaurantName: string }>(),
  lastUpdated: new Date(),
};

// Popular searches cache
const popularSearches = new Map<string, number>();

class SearchDiscoveryService extends BaseService {
  constructor() {
    super(serviceConfig);
    this.initializeEventHandlers();
    this.buildSearchIndex();
  }

  private initializeEventHandlers(): void {
    // Rebuild index when data changes
    eventBus.subscribe(EventTypes.RESTAURANT_UPDATED, async () => {
      await this.rebuildRestaurantIndex();
    });

    eventBus.subscribe(EventTypes.MENU_UPDATED, async () => {
      await this.rebuildMenuIndex();
    });
  }

  /**
   * Build initial search index
   */
  private async buildSearchIndex(): Promise<void> {
    try {
      await Promise.all([
        this.rebuildRestaurantIndex(),
        this.rebuildMenuIndex(),
      ]);
      this.logger.info("Search index built successfully");
    } catch (error) {
      this.logger.error("Failed to build search index", { error });
    }
  }

  /**
   * Rebuild restaurant index
   */
  private async rebuildRestaurantIndex(): Promise<void> {
    const restaurants = await storage.getRestaurants();
    searchIndex.restaurants.clear();
    
    for (const restaurant of restaurants) {
      searchIndex.restaurants.set(restaurant.id, restaurant);
    }
    
    searchIndex.lastUpdated = new Date();
  }

  /**
   * Rebuild menu index
   */
  private async rebuildMenuIndex(): Promise<void> {
    const restaurants = await storage.getRestaurants();
    searchIndex.menuItems.clear();

    for (const restaurant of restaurants) {
      const items = await storage.getMenuItems(restaurant.id);
      for (const item of items) {
        searchIndex.menuItems.set(item.id, {
          ...item,
          restaurantName: restaurant.name,
        });
      }
    }

    searchIndex.lastUpdated = new Date();
  }

  /**
   * Search restaurants
   */
  async searchRestaurants(query: SearchQuery): Promise<SearchResult<RestaurantSearchResult>> {
    return this.executeWithResilience(async () => {
      const cacheKey = `search:restaurants:${JSON.stringify(query)}`;
      
      return this.withCache(cacheKey, async () => {
        // Track popular searches
        this.trackSearch(query.query);

        let results = Array.from(searchIndex.restaurants.values());

        // Text search
        if (query.query) {
          const searchTerms = query.query.toLowerCase().split(" ");
          results = results.filter((restaurant) => {
            const searchableText = `${restaurant.name} ${restaurant.cuisine} ${restaurant.description || ""}`.toLowerCase();
            return searchTerms.some((term) => searchableText.includes(term));
          });
        }

        // Apply filters
        if (query.filters) {
          results = this.applyRestaurantFilters(results, query.filters);
        }

        // Geo filtering
        if (query.location) {
          results = this.applyGeoFilter(results, query.location) as Restaurant[];
        }

        // Calculate scores and add distance
        let scoredResults: RestaurantSearchResult[] = results.map((r) => ({
          ...r,
          matchScore: this.calculateMatchScore(r, query.query),
          distance: query.location
            ? this.calculateDistance(
                query.location.latitude,
                query.location.longitude,
                parseFloat(r.latitude || "0"),
                parseFloat(r.longitude || "0")
              )
            : undefined,
        }));

        // Apply sorting
        scoredResults = this.applySorting(scoredResults, query.sort) as RestaurantSearchResult[];

        // Get facets
        const facets = this.calculateFacets(results);

        // Apply pagination
        const pagination = query.pagination || { page: 1, limit: 20 };
        const startIndex = (pagination.page - 1) * pagination.limit;
        const paginatedResults = scoredResults.slice(startIndex, startIndex + pagination.limit);

        return {
          items: paginatedResults,
          total: scoredResults.length,
          page: pagination.page,
          totalPages: Math.ceil(scoredResults.length / pagination.limit),
          facets,
        };
      }, 60); // 1 minute cache
    }, "searchRestaurants");
  }

  /**
   * Search menu items
   */
  async searchMenuItems(query: SearchQuery): Promise<SearchResult<MenuItemSearchResult>> {
    return this.executeWithResilience(async () => {
      const cacheKey = `search:menu:${JSON.stringify(query)}`;

      return this.withCache(cacheKey, async () => {
        this.trackSearch(query.query);

        let results = Array.from(searchIndex.menuItems.values());

        // Text search
        if (query.query) {
          const searchTerms = query.query.toLowerCase().split(" ");
          results = results.filter((item) => {
            const searchableText = `${item.name} ${item.description || ""} ${item.restaurantName}`.toLowerCase();
            return searchTerms.some((term) => searchableText.includes(term));
          });
        }

        // Apply filters
        if (query.filters) {
          results = this.applyMenuFilters(results, query.filters);
        }

        // Calculate scores
        const scoredResults: MenuItemSearchResult[] = results.map((item) => ({
          ...item,
          matchScore: this.calculateMatchScore(item, query.query),
        }));

        // Apply sorting
        const sortedResults = this.applySorting(scoredResults, query.sort) as MenuItemSearchResult[];

        // Apply pagination
        const pagination = query.pagination || { page: 1, limit: 20 };
        const startIndex = (pagination.page - 1) * pagination.limit;
        const paginatedResults = sortedResults.slice(startIndex, startIndex + pagination.limit);

        return {
          items: paginatedResults,
          total: sortedResults.length,
          page: pagination.page,
          totalPages: Math.ceil(sortedResults.length / pagination.limit),
        };
      }, 60);
    }, "searchMenuItems");
  }

  /**
   * Universal search (restaurants + menu items)
   */
  async search(query: SearchQuery): Promise<{
    restaurants: SearchResult<RestaurantSearchResult>;
    menuItems: SearchResult<MenuItemSearchResult>;
  }> {
    const [restaurants, menuItems] = await Promise.all([
      this.searchRestaurants(query),
      this.searchMenuItems(query),
    ]);

    return { restaurants, menuItems };
  }

  /**
   * Get search suggestions (autocomplete)
   */
  async getSuggestions(prefix: string, limit: number = 10): Promise<SuggestionResult[]> {
    return this.withCache(
      `suggestions:${prefix.toLowerCase()}`,
      async () => {
        const suggestions: SuggestionResult[] = [];
        const prefixLower = prefix.toLowerCase();

        // Restaurant suggestions
        for (const restaurant of Array.from(searchIndex.restaurants.values())) {
          if (restaurant.name.toLowerCase().startsWith(prefixLower)) {
            suggestions.push({
              type: "restaurant",
              text: restaurant.name,
              id: restaurant.id,
              metadata: { cuisine: restaurant.cuisine, rating: restaurant.rating },
            });
          }
        }

        // Cuisine suggestions
        const cuisines = new Set<string>();
        for (const restaurant of Array.from(searchIndex.restaurants.values())) {
          if (restaurant.cuisine.toLowerCase().startsWith(prefixLower)) {
            cuisines.add(restaurant.cuisine);
          }
        }
        for (const cuisine of Array.from(cuisines)) {
          suggestions.push({
            type: "cuisine",
            text: cuisine,
          });
        }

        // Dish suggestions
        for (const item of Array.from(searchIndex.menuItems.values())) {
          if (item.name.toLowerCase().startsWith(prefixLower)) {
            suggestions.push({
              type: "dish",
              text: item.name,
              id: item.id,
              metadata: { restaurantName: item.restaurantName, price: item.price },
            });
          }
        }

        // Sort by relevance and limit
        return suggestions
          .sort((a, b) => {
            // Prioritize exact prefix matches
            const aExact = a.text.toLowerCase().startsWith(prefixLower) ? 0 : 1;
            const bExact = b.text.toLowerCase().startsWith(prefixLower) ? 0 : 1;
            return aExact - bExact;
          })
          .slice(0, limit);
      },
      300 // 5 minute cache
    );
  }

  /**
   * Get trending searches
   */
  getTrendingSearches(limit: number = 10): string[] {
    return Array.from(popularSearches.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([term]) => term);
  }

  /**
   * Get nearby restaurants
   */
  async getNearbyRestaurants(
    location: GeoLocation,
    limit: number = 20
  ): Promise<RestaurantSearchResult[]> {
    const result = await this.searchRestaurants({
      query: "",
      location,
      sort: { field: "distance", order: "asc" },
      pagination: { page: 1, limit },
    });
    return result.items;
  }

  /**
   * Get popular restaurants
   */
  async getPopularRestaurants(limit: number = 10): Promise<Restaurant[]> {
    return this.withCache(
      "popular:restaurants",
      async () => {
        const restaurants = Array.from(searchIndex.restaurants.values());
        return restaurants
          .sort((a, b) => {
            const aScore = (parseFloat(a.rating || "0") * (a.totalRatings || 0));
            const bScore = (parseFloat(b.rating || "0") * (b.totalRatings || 0));
            return bScore - aScore;
          })
          .slice(0, limit);
      },
      300
    );
  }

  /**
   * Get cuisines
   */
  async getCuisines(): Promise<{ cuisine: string; count: number }[]> {
    return this.withCache(
      "cuisines",
      async () => {
        const cuisineCount = new Map<string, number>();
        
        for (const restaurant of Array.from(searchIndex.restaurants.values())) {
          const count = cuisineCount.get(restaurant.cuisine) || 0;
          cuisineCount.set(restaurant.cuisine, count + 1);
        }

        return Array.from(cuisineCount.entries())
          .map(([cuisine, count]) => ({ cuisine, count }))
          .sort((a, b) => b.count - a.count);
      },
      600
    );
  }

  // ===== Helper Methods =====

  private applyRestaurantFilters(restaurants: Restaurant[], filters: SearchFilters): Restaurant[] {
    return restaurants.filter((r) => {
      if (filters.cuisine?.length && !filters.cuisine.includes(r.cuisine)) {
        return false;
      }
      if (filters.rating && parseFloat(r.rating || "0") < filters.rating) {
        return false;
      }
      if (filters.deliveryTime && (r.deliveryTime || 30) > filters.deliveryTime) {
        return false;
      }
      if (filters.isOpen !== undefined) {
        const isOpen = this.isRestaurantOpen(r);
        if (isOpen !== filters.isOpen) return false;
      }
      return true;
    });
  }

  private applyMenuFilters(items: (MenuItem & { restaurantName: string })[], filters: SearchFilters): (MenuItem & { restaurantName: string })[] {
    return items.filter((item) => {
      if (filters.priceRange) {
        const price = parseFloat(item.price);
        if (price < filters.priceRange.min || price > filters.priceRange.max) {
          return false;
        }
      }
      if (filters.isVegetarian && !item.isVegetarian) return false;
      if (filters.isVegan && !item.isVegan) return false;
      if (filters.isGlutenFree && !item.isGlutenFree) return false;
      return true;
    });
  }

  private applyGeoFilter(restaurants: Restaurant[], location: GeoLocation): Restaurant[] {
    const radiusKm = location.radiusKm || 10;
    
    return restaurants.filter((r) => {
      if (!r.latitude || !r.longitude) return false;
      
      const distance = this.calculateDistance(
        location.latitude,
        location.longitude,
        parseFloat(r.latitude),
        parseFloat(r.longitude)
      );
      
      return distance <= radiusKm;
    });
  }

  private applySorting<T extends { matchScore?: number; distance?: number; rating?: string | null }>(
    items: T[],
    sort?: SortOption
  ): T[] {
    if (!sort) {
      // Default: sort by relevance (matchScore)
      return items.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    }

    return items.sort((a, b) => {
      let aVal: number = 0;
      let bVal: number = 0;

      switch (sort.field) {
        case "rating":
          aVal = parseFloat((a as any).rating || "0");
          bVal = parseFloat((b as any).rating || "0");
          break;
        case "deliveryTime":
          aVal = (a as any).deliveryTime || 30;
          bVal = (b as any).deliveryTime || 30;
          break;
        case "distance":
          aVal = a.distance || Infinity;
          bVal = b.distance || Infinity;
          break;
        case "relevance":
        default:
          aVal = a.matchScore || 0;
          bVal = b.matchScore || 0;
      }

      return sort.order === "asc" ? aVal - bVal : bVal - aVal;
    });
  }

  private calculateMatchScore(item: { name: string; description?: string | null }, query?: string): number {
    if (!query) return 1;
    
    const queryLower = query.toLowerCase();
    const nameLower = item.name.toLowerCase();
    const descLower = (item.description || "").toLowerCase();

    let score = 0;
    
    // Exact name match
    if (nameLower === queryLower) score += 100;
    // Name starts with query
    else if (nameLower.startsWith(queryLower)) score += 80;
    // Name contains query
    else if (nameLower.includes(queryLower)) score += 50;
    
    // Description contains query
    if (descLower.includes(queryLower)) score += 20;

    return score;
  }

  private calculateFacets(restaurants: Restaurant[]): SearchFacets {
    const cuisineCount = new Map<string, number>();
    const ratingCount = new Map<number, number>();

    for (const r of restaurants) {
      // Cuisines
      const count = cuisineCount.get(r.cuisine) || 0;
      cuisineCount.set(r.cuisine, count + 1);

      // Ratings (rounded down)
      const rating = Math.floor(parseFloat(r.rating || "0"));
      const rCount = ratingCount.get(rating) || 0;
      ratingCount.set(rating, rCount + 1);
    }

    return {
      cuisines: Array.from(cuisineCount.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      priceRanges: [
        { range: "$", count: 0 },
        { range: "$$", count: 0 },
        { range: "$$$", count: 0 },
        { range: "$$$$", count: 0 },
      ],
      ratings: Array.from(ratingCount.entries())
        .map(([rating, count]) => ({ rating, count }))
        .sort((a, b) => b.rating - a.rating),
    };
  }

  private isRestaurantOpen(restaurant: Restaurant): boolean {
    if (!restaurant.isActive) return false;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

    const openingTime = restaurant.openingTime || "09:00";
    const closingTime = restaurant.closingTime || "22:00";

    return currentTime >= openingTime && currentTime <= closingTime;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private trackSearch(query: string): void {
    if (!query) return;
    const normalized = query.toLowerCase().trim();
    if (normalized.length < 2) return;
    
    const count = popularSearches.get(normalized) || 0;
    popularSearches.set(normalized, count + 1);
  }

  /**
   * Health check
   */
  async checkHealth(): Promise<ServiceHealth> {
    const checks = [];

    checks.push({
      name: "restaurant_index",
      status: "pass" as const,
      message: `${searchIndex.restaurants.size} restaurants indexed`,
    });

    checks.push({
      name: "menu_index",
      status: "pass" as const,
      message: `${searchIndex.menuItems.size} menu items indexed`,
    });

    checks.push({
      name: "index_freshness",
      status: Date.now() - searchIndex.lastUpdated.getTime() < 3600000 ? "pass" as const : "warn" as const,
      message: `Last updated: ${searchIndex.lastUpdated.toISOString()}`,
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

export const searchDiscoveryService = new SearchDiscoveryService();
