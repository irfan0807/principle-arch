import {
  users,
  restaurants,
  menuCategories,
  menuItems,
  deliveryPartners,
  orders,
  orderItems,
  coupons,
  notifications,
  orderEvents,
  reviews,
  type User,
  type UpsertUser,
  type Restaurant,
  type InsertRestaurant,
  type MenuCategory,
  type InsertMenuCategory,
  type MenuItem,
  type InsertMenuItem,
  type DeliveryPartner,
  type InsertDeliveryPartner,
  type Order,
  type InsertOrder,
  type OrderItem,
  type InsertOrderItem,
  type Coupon,
  type InsertCoupon,
  type Notification,
  type InsertNotification,
  type OrderEvent,
  type InsertOrderEvent,
  type Review,
  type InsertReview,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, ilike, or, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserRole(id: string, role: string): Promise<User | undefined>;
  updateUser(id: string, updates: Partial<UpsertUser>): Promise<User | undefined>;
  
  // Restaurants
  getRestaurants(): Promise<Restaurant[]>;
  getRestaurant(id: string): Promise<Restaurant | undefined>;
  getRestaurantsByOwner(ownerId: string): Promise<Restaurant[]>;
  createRestaurant(restaurant: InsertRestaurant): Promise<Restaurant>;
  updateRestaurant(id: string, restaurant: Partial<InsertRestaurant>): Promise<Restaurant | undefined>;
  searchRestaurants(query: string, filters?: { cuisine?: string; minRating?: number }): Promise<Restaurant[]>;
  
  // Menu Categories
  getMenuCategories(restaurantId: string): Promise<MenuCategory[]>;
  createMenuCategory(category: InsertMenuCategory): Promise<MenuCategory>;
  updateMenuCategory(id: string, category: Partial<InsertMenuCategory>): Promise<MenuCategory | undefined>;
  deleteMenuCategory(id: string): Promise<void>;
  
  // Menu Items
  getMenuItems(restaurantId: string): Promise<MenuItem[]>;
  getMenuItem(id: string): Promise<MenuItem | undefined>;
  createMenuItem(item: InsertMenuItem): Promise<MenuItem>;
  updateMenuItem(id: string, item: Partial<InsertMenuItem>): Promise<MenuItem | undefined>;
  deleteMenuItem(id: string): Promise<void>;
  searchMenuItems(query: string): Promise<MenuItem[]>;
  
  // Delivery Partners
  getDeliveryPartner(id: string): Promise<DeliveryPartner | undefined>;
  getDeliveryPartnerByUserId(userId: string): Promise<DeliveryPartner | undefined>;
  getAvailableDeliveryPartners(): Promise<DeliveryPartner[]>;
  createDeliveryPartner(partner: InsertDeliveryPartner): Promise<DeliveryPartner>;
  updateDeliveryPartner(id: string, partner: Partial<InsertDeliveryPartner>): Promise<DeliveryPartner | undefined>;
  updateDeliveryPartnerLocation(id: string, lat: string, lng: string): Promise<void>;
  
  // Orders
  getOrders(): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  getOrdersByCustomer(customerId: string): Promise<Order[]>;
  getOrdersByRestaurant(restaurantId: string): Promise<Order[]>;
  getOrdersByDeliveryPartner(partnerId: string): Promise<Order[]>;
  getPendingOrders(): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: string, order: Partial<InsertOrder>): Promise<Order | undefined>;
  
  // Order Items
  getOrderItems(orderId: string): Promise<OrderItem[]>;
  createOrderItem(item: InsertOrderItem): Promise<OrderItem>;
  
  // Coupons
  getCoupons(): Promise<Coupon[]>;
  getActiveCoupons(): Promise<Coupon[]>;
  getCoupon(id: string): Promise<Coupon | undefined>;
  getCouponByCode(code: string): Promise<Coupon | undefined>;
  createCoupon(coupon: InsertCoupon): Promise<Coupon>;
  updateCoupon(id: string, coupon: Partial<InsertCoupon>): Promise<Coupon | undefined>;
  incrementCouponUsage(id: string): Promise<void>;
  
  // Notifications
  getNotifications(userId: string): Promise<Notification[]>;
  getUnreadNotifications(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;
  
  // Order Events
  getOrderEvents(orderId: string): Promise<OrderEvent[]>;
  createOrderEvent(event: InsertOrderEvent): Promise<OrderEvent>;
  
  // Reviews
  getReviewsByRestaurant(restaurantId: string): Promise<Review[]>;
  createReview(review: InsertReview): Promise<Review>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserRole(id: string, role: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ role: role as any, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<UpsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Restaurants
  async getRestaurants(): Promise<Restaurant[]> {
    return db.select().from(restaurants).where(eq(restaurants.isActive, true));
  }

  async getRestaurant(id: string): Promise<Restaurant | undefined> {
    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, id));
    return restaurant;
  }

  async getRestaurantsByOwner(ownerId: string): Promise<Restaurant[]> {
    return db.select().from(restaurants).where(eq(restaurants.ownerId, ownerId));
  }

  async createRestaurant(restaurant: InsertRestaurant): Promise<Restaurant> {
    const [created] = await db.insert(restaurants).values(restaurant).returning();
    return created;
  }

  async updateRestaurant(id: string, restaurant: Partial<InsertRestaurant>): Promise<Restaurant | undefined> {
    const [updated] = await db
      .update(restaurants)
      .set({ ...restaurant, updatedAt: new Date() })
      .where(eq(restaurants.id, id))
      .returning();
    return updated;
  }

  async searchRestaurants(query: string, filters?: { cuisine?: string; minRating?: number }): Promise<Restaurant[]> {
    let conditions = [eq(restaurants.isActive, true)];
    
    if (query) {
      conditions.push(
        or(
          ilike(restaurants.name, `%${query}%`),
          ilike(restaurants.cuisine, `%${query}%`),
          ilike(restaurants.description, `%${query}%`)
        )!
      );
    }
    
    if (filters?.cuisine) {
      conditions.push(ilike(restaurants.cuisine, `%${filters.cuisine}%`));
    }
    
    if (filters?.minRating) {
      conditions.push(gte(restaurants.rating, filters.minRating.toString()));
    }
    
    return db.select().from(restaurants).where(and(...conditions));
  }

  // Menu Categories
  async getMenuCategories(restaurantId: string): Promise<MenuCategory[]> {
    return db
      .select()
      .from(menuCategories)
      .where(and(eq(menuCategories.restaurantId, restaurantId), eq(menuCategories.isActive, true)))
      .orderBy(menuCategories.sortOrder);
  }

  async createMenuCategory(category: InsertMenuCategory): Promise<MenuCategory> {
    const [created] = await db.insert(menuCategories).values(category).returning();
    return created;
  }

  async updateMenuCategory(id: string, category: Partial<InsertMenuCategory>): Promise<MenuCategory | undefined> {
    const [updated] = await db
      .update(menuCategories)
      .set(category)
      .where(eq(menuCategories.id, id))
      .returning();
    return updated;
  }

  async deleteMenuCategory(id: string): Promise<void> {
    await db.update(menuCategories).set({ isActive: false }).where(eq(menuCategories.id, id));
  }

  // Menu Items
  async getMenuItems(restaurantId: string): Promise<MenuItem[]> {
    return db.select().from(menuItems).where(eq(menuItems.restaurantId, restaurantId));
  }

  async getMenuItem(id: string): Promise<MenuItem | undefined> {
    const [item] = await db.select().from(menuItems).where(eq(menuItems.id, id));
    return item;
  }

  async createMenuItem(item: InsertMenuItem): Promise<MenuItem> {
    const [created] = await db.insert(menuItems).values(item).returning();
    return created;
  }

  async updateMenuItem(id: string, item: Partial<InsertMenuItem>): Promise<MenuItem | undefined> {
    const [updated] = await db
      .update(menuItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(menuItems.id, id))
      .returning();
    return updated;
  }

  async deleteMenuItem(id: string): Promise<void> {
    await db.update(menuItems).set({ isAvailable: false }).where(eq(menuItems.id, id));
  }

  async searchMenuItems(query: string): Promise<MenuItem[]> {
    return db
      .select()
      .from(menuItems)
      .where(
        and(
          eq(menuItems.isAvailable, true),
          or(ilike(menuItems.name, `%${query}%`), ilike(menuItems.description, `%${query}%`))
        )
      );
  }

  // Delivery Partners
  async getDeliveryPartner(id: string): Promise<DeliveryPartner | undefined> {
    const [partner] = await db.select().from(deliveryPartners).where(eq(deliveryPartners.id, id));
    return partner;
  }

  async getDeliveryPartnerByUserId(userId: string): Promise<DeliveryPartner | undefined> {
    const [partner] = await db.select().from(deliveryPartners).where(eq(deliveryPartners.userId, userId));
    return partner;
  }

  async getAvailableDeliveryPartners(): Promise<DeliveryPartner[]> {
    return db.select().from(deliveryPartners).where(eq(deliveryPartners.status, "available"));
  }

  async createDeliveryPartner(partner: InsertDeliveryPartner): Promise<DeliveryPartner> {
    const [created] = await db.insert(deliveryPartners).values(partner).returning();
    return created;
  }

  async updateDeliveryPartner(id: string, partner: Partial<InsertDeliveryPartner>): Promise<DeliveryPartner | undefined> {
    const [updated] = await db
      .update(deliveryPartners)
      .set({ ...partner, updatedAt: new Date() })
      .where(eq(deliveryPartners.id, id))
      .returning();
    return updated;
  }

  async updateDeliveryPartnerLocation(id: string, lat: string, lng: string): Promise<void> {
    await db
      .update(deliveryPartners)
      .set({ currentLatitude: lat, currentLongitude: lng, updatedAt: new Date() })
      .where(eq(deliveryPartners.id, id));
  }

  // Orders
  async getOrders(): Promise<Order[]> {
    return db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getOrdersByCustomer(customerId: string): Promise<Order[]> {
    return db.select().from(orders).where(eq(orders.customerId, customerId)).orderBy(desc(orders.createdAt));
  }

  async getOrdersByRestaurant(restaurantId: string): Promise<Order[]> {
    return db.select().from(orders).where(eq(orders.restaurantId, restaurantId)).orderBy(desc(orders.createdAt));
  }

  async getOrdersByDeliveryPartner(partnerId: string): Promise<Order[]> {
    return db.select().from(orders).where(eq(orders.deliveryPartnerId, partnerId)).orderBy(desc(orders.createdAt));
  }

  async getPendingOrders(): Promise<Order[]> {
    return db
      .select()
      .from(orders)
      .where(
        or(
          eq(orders.status, "pending"),
          eq(orders.status, "confirmed"),
          eq(orders.status, "preparing"),
          eq(orders.status, "ready_for_pickup")
        )
      )
      .orderBy(desc(orders.createdAt));
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [created] = await db.insert(orders).values(order).returning();
    return created;
  }

  async updateOrder(id: string, order: Partial<InsertOrder>): Promise<Order | undefined> {
    const [updated] = await db
      .update(orders)
      .set({ ...order, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return updated;
  }

  // Order Items
  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }

  async createOrderItem(item: InsertOrderItem): Promise<OrderItem> {
    const [created] = await db.insert(orderItems).values(item).returning();
    return created;
  }

  // Coupons
  async getCoupons(): Promise<Coupon[]> {
    return db.select().from(coupons);
  }

  async getActiveCoupons(): Promise<Coupon[]> {
    const now = new Date();
    return db
      .select()
      .from(coupons)
      .where(
        and(
          eq(coupons.isActive, true),
          lte(coupons.validFrom, now),
          or(gte(coupons.validUntil, now), sql`${coupons.validUntil} IS NULL`)
        )
      );
  }

  async getCoupon(id: string): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.id, id));
    return coupon;
  }

  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code.toUpperCase()));
    return coupon;
  }

  async createCoupon(coupon: InsertCoupon): Promise<Coupon> {
    const [created] = await db.insert(coupons).values({ ...coupon, code: coupon.code.toUpperCase() }).returning();
    return created;
  }

  async updateCoupon(id: string, coupon: Partial<InsertCoupon>): Promise<Coupon | undefined> {
    const [updated] = await db
      .update(coupons)
      .set(coupon)
      .where(eq(coupons.id, id))
      .returning();
    return updated;
  }

  async incrementCouponUsage(id: string): Promise<void> {
    await db
      .update(coupons)
      .set({ usedCount: sql`${coupons.usedCount} + 1` })
      .where(eq(coupons.id, id));
  }

  // Notifications
  async getNotifications(userId: string): Promise<Notification[]> {
    return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
  }

  async getUnreadNotifications(userId: string): Promise<Notification[]> {
    return db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
      .orderBy(desc(notifications.createdAt));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async markNotificationRead(id: string): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
  }

  // Order Events
  async getOrderEvents(orderId: string): Promise<OrderEvent[]> {
    return db.select().from(orderEvents).where(eq(orderEvents.orderId, orderId)).orderBy(orderEvents.createdAt);
  }

  async createOrderEvent(event: InsertOrderEvent): Promise<OrderEvent> {
    const [created] = await db.insert(orderEvents).values(event).returning();
    return created;
  }

  // Reviews
  async getReviewsByRestaurant(restaurantId: string): Promise<Review[]> {
    return db.select().from(reviews).where(eq(reviews.restaurantId, restaurantId)).orderBy(desc(reviews.createdAt));
  }

  async createReview(review: InsertReview): Promise<Review> {
    const [created] = await db.insert(reviews).values(review).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
