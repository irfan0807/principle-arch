/**
 * Menu Service
 * Manages menu categories and items for restaurants
 * 
 * Patterns:
 * - Database per service (owns menu data)
 * - Event-driven updates
 * - Cache-aside for read optimization
 * - Polyglot persistence ready (MongoDB for flexible schema)
 */

import { BaseService, ServiceHealth, ServiceConfig } from "../core/BaseService";
import { storage } from "../../storage";
import { eventBus, EventTypes } from "../../infrastructure/eventBus";
import type { MenuItem, InsertMenuItem, MenuCategory, InsertMenuCategory } from "@shared/schema";

// Types
export interface MenuItemFilters {
  categoryId?: string;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  maxPrice?: number;
  minPrice?: number;
  isAvailable?: boolean;
  isPopular?: boolean;
  maxSpiceLevel?: number;
}

export interface MenuItemWithCategory extends MenuItem {
  categoryName?: string;
}

const serviceConfig: ServiceConfig = {
  name: "menu-service",
  version: "1.0.0",
  timeout: 5000,
  retryAttempts: 3,
  circuitBreakerEnabled: true,
};

class MenuService extends BaseService {
  constructor() {
    super(serviceConfig);
    this.initializeEventHandlers();
  }

  private initializeEventHandlers(): void {
    // Listen for restaurant updates
    eventBus.subscribe(EventTypes.RESTAURANT_UPDATED, async (data: any) => {
      if (data.action === "deleted") {
        // Could archive menu items if restaurant is deleted
        this.logger.info("Restaurant updated, checking menu impacts", { restaurantId: data.restaurantId });
      }
    });
  }

  // ===== Menu Categories =====

  /**
   * Get menu categories for a restaurant
   */
  async getCategories(restaurantId: string): Promise<MenuCategory[]> {
    return this.withCache(
      `restaurant:${restaurantId}:categories`,
      () => storage.getMenuCategories(restaurantId),
      600 // 10 minutes cache
    );
  }

  /**
   * Create menu category
   */
  async createCategory(
    restaurantId: string,
    data: Omit<InsertMenuCategory, "restaurantId">
  ): Promise<MenuCategory> {
    return this.executeWithResilience(async () => {
      const category = await storage.createMenuCategory({
        ...data,
        restaurantId,
      });

      await this.invalidateCache(`restaurant:${restaurantId}:categories`);
      
      await this.publishEvent(EventTypes.MENU_UPDATED, {
        type: "category_created",
        restaurantId,
        categoryId: category.id,
        timestamp: new Date(),
      });

      return category;
    }, "createCategory");
  }

  /**
   * Update menu category
   */
  async updateCategory(
    id: string,
    data: Partial<InsertMenuCategory>
  ): Promise<MenuCategory | undefined> {
    return this.executeWithResilience(async () => {
      const category = await storage.updateMenuCategory(id, data);

      if (category) {
        await this.invalidateCache(`restaurant:${category.restaurantId}:categories`);
      }

      return category;
    }, "updateCategory");
  }

  /**
   * Delete menu category
   */
  async deleteCategory(id: string): Promise<void> {
    return this.executeWithResilience(async () => {
      await storage.deleteMenuCategory(id);
    }, "deleteCategory");
  }

  // ===== Menu Items =====

  /**
   * Get all menu items for a restaurant
   */
  async getMenuItems(
    restaurantId: string,
    filters: MenuItemFilters = {}
  ): Promise<MenuItem[]> {
    const cacheKey = `restaurant:${restaurantId}:menu:${JSON.stringify(filters)}`;

    return this.withCache(
      cacheKey,
      async () => {
        let items = await storage.getMenuItems(restaurantId);

        // Apply filters
        if (filters.categoryId) {
          items = items.filter((item) => item.categoryId === filters.categoryId);
        }
        if (filters.isVegetarian !== undefined) {
          items = items.filter((item) => item.isVegetarian === filters.isVegetarian);
        }
        if (filters.isVegan !== undefined) {
          items = items.filter((item) => item.isVegan === filters.isVegan);
        }
        if (filters.isGlutenFree !== undefined) {
          items = items.filter((item) => item.isGlutenFree === filters.isGlutenFree);
        }
        if (filters.isAvailable !== undefined) {
          items = items.filter((item) => item.isAvailable === filters.isAvailable);
        }
        if (filters.isPopular !== undefined) {
          items = items.filter((item) => item.isPopular === filters.isPopular);
        }
        if (filters.maxPrice !== undefined) {
          items = items.filter(
            (item) => parseFloat(item.price) <= filters.maxPrice!
          );
        }
        if (filters.minPrice !== undefined) {
          items = items.filter(
            (item) => parseFloat(item.price) >= filters.minPrice!
          );
        }
        if (filters.maxSpiceLevel !== undefined) {
          items = items.filter(
            (item) => (item.spiceLevel || 0) <= filters.maxSpiceLevel!
          );
        }

        return items;
      },
      300 // 5 minutes cache
    );
  }

  /**
   * Get single menu item
   */
  async getMenuItem(id: string): Promise<MenuItem | undefined> {
    return this.withCache(
      `menuItem:${id}`,
      () => storage.getMenuItem(id),
      600
    );
  }

  /**
   * Create menu item
   */
  async createMenuItem(
    restaurantId: string,
    data: Omit<InsertMenuItem, "restaurantId">
  ): Promise<MenuItem> {
    return this.executeWithResilience(async () => {
      const item = await storage.createMenuItem({
        ...data,
        restaurantId,
      });

      await this.invalidateCache(`restaurant:${restaurantId}:menu:*`);

      await this.publishEvent(EventTypes.MENU_UPDATED, {
        type: "item_created",
        restaurantId,
        itemId: item.id,
        timestamp: new Date(),
      });

      this.logger.info("Menu item created", { itemId: item.id, restaurantId });

      return item;
    }, "createMenuItem");
  }

  /**
   * Update menu item
   */
  async updateMenuItem(
    id: string,
    data: Partial<InsertMenuItem>
  ): Promise<MenuItem | undefined> {
    return this.executeWithResilience(async () => {
      const item = await storage.updateMenuItem(id, data);

      if (item) {
        await this.invalidateCache(`menuItem:${id}`);
        await this.invalidateCache(`restaurant:${item.restaurantId}:menu:*`);

        await this.publishEvent(EventTypes.MENU_UPDATED, {
          type: "item_updated",
          restaurantId: item.restaurantId,
          itemId: id,
          changes: Object.keys(data),
          timestamp: new Date(),
        });
      }

      return item;
    }, "updateMenuItem");
  }

  /**
   * Update item availability
   */
  async updateItemAvailability(
    id: string,
    isAvailable: boolean
  ): Promise<MenuItem | undefined> {
    return this.updateMenuItem(id, { isAvailable });
  }

  /**
   * Bulk update item availability
   */
  async bulkUpdateAvailability(
    items: { id: string; isAvailable: boolean }[]
  ): Promise<void> {
    return this.executeWithResilience(async () => {
      for (const item of items) {
        await this.updateItemAvailability(item.id, item.isAvailable);
      }
    }, "bulkUpdateAvailability");
  }

  /**
   * Delete menu item
   */
  async deleteMenuItem(id: string): Promise<void> {
    return this.executeWithResilience(async () => {
      const item = await storage.getMenuItem(id);
      if (!item) return;

      await storage.deleteMenuItem(id);
      
      await this.invalidateCache(`menuItem:${id}`);
      await this.invalidateCache(`restaurant:${item.restaurantId}:menu:*`);

      await this.publishEvent(EventTypes.MENU_UPDATED, {
        type: "item_deleted",
        restaurantId: item.restaurantId,
        itemId: id,
        timestamp: new Date(),
      });
    }, "deleteMenuItem");
  }

  /**
   * Search menu items across all restaurants
   */
  async searchMenuItems(query: string): Promise<MenuItem[]> {
    return this.executeWithResilience(
      () => storage.searchMenuItems(query),
      "searchMenuItems"
    );
  }

  /**
   * Get popular items for a restaurant
   */
  async getPopularItems(restaurantId: string, limit: number = 5): Promise<MenuItem[]> {
    const items = await this.getMenuItems(restaurantId, { isPopular: true });
    return items.slice(0, limit);
  }

  /**
   * Get menu with categories (aggregated view)
   */
  async getMenuWithCategories(
    restaurantId: string
  ): Promise<{ category: MenuCategory; items: MenuItem[] }[]> {
    return this.withCache(
      `restaurant:${restaurantId}:fullMenu`,
      async () => {
        const [categories, items] = await Promise.all([
          this.getCategories(restaurantId),
          this.getMenuItems(restaurantId),
        ]);

        const itemsByCategory = new Map<string, MenuItem[]>();
        
        for (const item of items) {
          const categoryId = item.categoryId || "uncategorized";
          const categoryItems = itemsByCategory.get(categoryId) || [];
          categoryItems.push(item);
          itemsByCategory.set(categoryId, categoryItems);
        }

        return categories
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
          .map((category) => ({
            category,
            items: itemsByCategory.get(category.id) || [],
          }));
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
      await storage.searchMenuItems("health");
      checks.push({
        name: "database",
        status: "pass" as const,
        responseTime: Date.now() - startTime,
      });
    } catch {
      checks.push({
        name: "database",
        status: "fail" as const,
        message: "Failed to query menu items",
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

export const menuService = new MenuService();
