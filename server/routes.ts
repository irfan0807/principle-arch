import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { isAuthenticated, requireRole } from "./customAuth";
import { apiRateLimiter, authRateLimiter, orderRateLimiter } from "./gateway/rateLimiter";
import { correlationIdMiddleware } from "./gateway/correlationId";
import { logger } from "./infrastructure/logger";
import { eventBus, EventTypes } from "./infrastructure/eventBus";
import { cache } from "./infrastructure/cache";
import { circuitBreaker } from "./gateway/circuitBreaker";
import {
  insertRestaurantSchema,
  insertMenuCategorySchema,
  insertMenuItemSchema,
  insertDeliveryPartnerSchema,
  insertOrderSchema,
  insertOrderItemSchema,
  insertCouponSchema,
  insertReviewSchema,
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(correlationIdMiddleware);
  app.use("/api", apiRateLimiter.middleware());

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  const clients = new Map<string, Set<WebSocket>>();

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const userId = url.searchParams.get("userId");
    
    if (userId) {
      if (!clients.has(userId)) {
        clients.set(userId, new Set());
      }
      clients.get(userId)!.add(ws);
      
      ws.on("close", () => {
        clients.get(userId)?.delete(ws);
        if (clients.get(userId)?.size === 0) {
          clients.delete(userId);
        }
      });
    }
    
    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch (e) {
        logger.error("WebSocket message parse error", { error: String(e) });
      }
    });
  });

  const broadcastToUser = (userId: string, message: any) => {
    const userClients = clients.get(userId);
    if (userClients) {
      const data = JSON.stringify(message);
      userClients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });
    }
  };

  eventBus.subscribe(EventTypes.ORDER_STATUS_CHANGED, (data: any) => {
    if (data.customerId) {
      broadcastToUser(data.customerId, { type: "order_update", data });
    }
    if (data.restaurantOwnerId) {
      broadcastToUser(data.restaurantOwnerId, { type: "order_update", data });
    }
    if (data.deliveryPartnerId) {
      broadcastToUser(data.deliveryPartnerId, { type: "order_update", data });
    }
  });

  eventBus.subscribe(EventTypes.RIDER_LOCATION_UPDATE, (data: any) => {
    if (data.customerId) {
      broadcastToUser(data.customerId, { type: "location_update", data });
    }
  });

  app.get("/api/auth/user", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const dbUser = await storage.getUser(user.claims.sub);
      res.json(dbUser);
    } catch (error) {
      logger.error("Error fetching user", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/auth/user", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const { phone, address, city, latitude, longitude } = req.body;
      
      const dbUser = await storage.getUser(user.claims.sub);
      if (!dbUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const updated = await storage.upsertUser({
        ...dbUser,
        phone: phone ?? dbUser.phone,
        address: address ?? dbUser.address,
        city: city ?? dbUser.city,
        latitude: latitude ?? dbUser.latitude,
        longitude: longitude ?? dbUser.longitude,
      });

      res.json(updated);
    } catch (error) {
      logger.error("Error updating user", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/role", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const { role } = req.body;
      
      if (!["customer", "restaurant_owner", "delivery_partner"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const updated = await storage.updateUserRole(user.claims.sub, role);
      res.json(updated);
    } catch (error) {
      logger.error("Error updating role", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/restaurants", async (req: Request, res: Response) => {
    try {
      const cacheKey = "restaurants:all";
      const cached = await cache.get<any[]>(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const restaurants = await storage.getRestaurants();
      await cache.set(cacheKey, restaurants, 300);
      res.json(restaurants);
    } catch (error) {
      logger.error("Error fetching restaurants", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/restaurants/search", async (req: Request, res: Response) => {
    try {
      const { q, cuisine, minRating } = req.query;
      const restaurants = await storage.searchRestaurants(
        q as string || "",
        { cuisine: cuisine as string, minRating: minRating ? parseFloat(minRating as string) : undefined }
      );
      res.json(restaurants);
    } catch (error) {
      logger.error("Error searching restaurants", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/restaurants/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const cacheKey = `restaurant:${id}`;
      const cached = await cache.get<any>(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const restaurant = await storage.getRestaurant(id);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      
      await cache.set(cacheKey, restaurant, 300);
      res.json(restaurant);
    } catch (error) {
      logger.error("Error fetching restaurant", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/my-restaurants", isAuthenticated, requireRole("restaurant_owner", "admin"), async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const restaurants = await storage.getRestaurantsByOwner(user.claims.sub);
      res.json(restaurants);
    } catch (error) {
      logger.error("Error fetching owner restaurants", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/restaurants", isAuthenticated, requireRole("restaurant_owner", "admin"), async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const validated = insertRestaurantSchema.parse({ ...req.body, ownerId: user.claims.sub });
      const restaurant = await storage.createRestaurant(validated);
      cache.delete("restaurants:all");
      res.status(201).json(restaurant);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      logger.error("Error creating restaurant", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/restaurants/:id", isAuthenticated, requireRole("restaurant_owner", "admin"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = req.user as any;
      
      const restaurant = await storage.getRestaurant(id);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      
      const dbUser = await storage.getUser(user.claims.sub);
      if (restaurant.ownerId !== user.claims.sub && dbUser?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const updated = await storage.updateRestaurant(id, req.body);
      cache.delete("restaurants:all");
      cache.delete(`restaurant:${id}`);
      res.json(updated);
    } catch (error) {
      logger.error("Error updating restaurant", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/restaurants/:restaurantId/categories", async (req: Request, res: Response) => {
    try {
      const { restaurantId } = req.params;
      const categories = await storage.getMenuCategories(restaurantId);
      res.json(categories);
    } catch (error) {
      logger.error("Error fetching categories", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/restaurants/:restaurantId/categories", isAuthenticated, requireRole("restaurant_owner", "admin"), async (req: Request, res: Response) => {
    try {
      const { restaurantId } = req.params;
      const validated = insertMenuCategorySchema.parse({ ...req.body, restaurantId });
      const category = await storage.createMenuCategory(validated);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      logger.error("Error creating category", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/categories/:id", isAuthenticated, requireRole("restaurant_owner", "admin"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updated = await storage.updateMenuCategory(id, req.body);
      res.json(updated);
    } catch (error) {
      logger.error("Error updating category", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/categories/:id", isAuthenticated, requireRole("restaurant_owner", "admin"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteMenuCategory(id);
      res.status(204).send();
    } catch (error) {
      logger.error("Error deleting category", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/restaurants/:restaurantId/menu", async (req: Request, res: Response) => {
    try {
      const { restaurantId } = req.params;
      const cacheKey = `menu:${restaurantId}`;
      const cached = await cache.get<any[]>(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const items = await storage.getMenuItems(restaurantId);
      await cache.set(cacheKey, items, 300);
      res.json(items);
    } catch (error) {
      logger.error("Error fetching menu", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/menu/search", async (req: Request, res: Response) => {
    try {
      const { q } = req.query;
      const items = await storage.searchMenuItems(q as string || "");
      res.json(items);
    } catch (error) {
      logger.error("Error searching menu", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/menu/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await storage.getMenuItem(id);
      if (!item) {
        return res.status(404).json({ message: "Menu item not found" });
      }
      res.json(item);
    } catch (error) {
      logger.error("Error fetching menu item", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/restaurants/:restaurantId/menu", isAuthenticated, requireRole("restaurant_owner", "admin"), async (req: Request, res: Response) => {
    try {
      const { restaurantId } = req.params;
      const validated = insertMenuItemSchema.parse({ ...req.body, restaurantId });
      const item = await storage.createMenuItem(validated);
      cache.delete(`menu:${restaurantId}`);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      logger.error("Error creating menu item", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/menu/:id", isAuthenticated, requireRole("restaurant_owner", "admin"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await storage.getMenuItem(id);
      if (!item) {
        return res.status(404).json({ message: "Menu item not found" });
      }
      
      const updated = await storage.updateMenuItem(id, req.body);
      cache.delete(`menu:${item.restaurantId}`);
      res.json(updated);
    } catch (error) {
      logger.error("Error updating menu item", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/menu/:id", isAuthenticated, requireRole("restaurant_owner", "admin"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await storage.getMenuItem(id);
      if (!item) {
        return res.status(404).json({ message: "Menu item not found" });
      }
      
      await storage.deleteMenuItem(id);
      cache.delete(`menu:${item.restaurantId}`);
      res.status(204).send();
    } catch (error) {
      logger.error("Error deleting menu item", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/delivery-partner", isAuthenticated, requireRole("delivery_partner"), async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const partner = await storage.getDeliveryPartnerByUserId(user.claims.sub);
      res.json(partner);
    } catch (error) {
      logger.error("Error fetching delivery partner", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/delivery-partner", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const existing = await storage.getDeliveryPartnerByUserId(user.claims.sub);
      if (existing) {
        return res.status(400).json({ message: "Already registered as delivery partner" });
      }

      await storage.updateUserRole(user.claims.sub, "delivery_partner");
      const validated = insertDeliveryPartnerSchema.parse({ ...req.body, userId: user.claims.sub });
      const partner = await storage.createDeliveryPartner(validated);
      res.status(201).json(partner);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      logger.error("Error creating delivery partner", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/delivery-partner", isAuthenticated, requireRole("delivery_partner"), async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const partner = await storage.getDeliveryPartnerByUserId(user.claims.sub);
      if (!partner) {
        return res.status(404).json({ message: "Delivery partner not found" });
      }

      const updated = await storage.updateDeliveryPartner(partner.id, req.body);
      res.json(updated);
    } catch (error) {
      logger.error("Error updating delivery partner", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/delivery-partner/location", isAuthenticated, requireRole("delivery_partner"), async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const { latitude, longitude } = req.body;
      
      const partner = await storage.getDeliveryPartnerByUserId(user.claims.sub);
      if (!partner) {
        return res.status(404).json({ message: "Delivery partner not found" });
      }

      await storage.updateDeliveryPartnerLocation(partner.id, latitude, longitude);
      
      const activeOrders = await storage.getOrdersByDeliveryPartner(partner.id);
      const pendingOrder = activeOrders.find(o => o.status === "out_for_delivery");
      if (pendingOrder) {
        eventBus.publish(EventTypes.RIDER_LOCATION_UPDATE, {
          orderId: pendingOrder.id,
          customerId: pendingOrder.customerId,
          latitude,
          longitude,
        });
      }

      res.json({ success: true });
    } catch (error) {
      logger.error("Error updating location", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.use("/api/orders", orderRateLimiter.middleware());

  app.get("/api/orders", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const dbUser = await storage.getUser(user.claims.sub);
      
      let orders;
      if (dbUser?.role === "admin") {
        orders = await storage.getOrders();
      } else if (dbUser?.role === "restaurant_owner") {
        const restaurants = await storage.getRestaurantsByOwner(user.claims.sub);
        orders = [];
        for (const r of restaurants) {
          const restaurantOrders = await storage.getOrdersByRestaurant(r.id);
          orders.push(...restaurantOrders);
        }
      } else if (dbUser?.role === "delivery_partner") {
        const partner = await storage.getDeliveryPartnerByUserId(user.claims.sub);
        orders = partner ? await storage.getOrdersByDeliveryPartner(partner.id) : [];
      } else {
        orders = await storage.getOrdersByCustomer(user.claims.sub);
      }

      res.json(orders);
    } catch (error) {
      logger.error("Error fetching orders", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/orders/pending", isAuthenticated, requireRole("restaurant_owner", "delivery_partner", "admin"), async (req: Request, res: Response) => {
    try {
      const orders = await storage.getPendingOrders();
      res.json(orders);
    } catch (error) {
      logger.error("Error fetching pending orders", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/orders/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const items = await storage.getOrderItems(id);
      const events = await storage.getOrderEvents(id);
      const restaurant = await storage.getRestaurant(order.restaurantId);

      res.json({ ...order, items, events, restaurant });
    } catch (error) {
      logger.error("Error fetching order", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/orders", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const { items, restaurantId, deliveryAddress, deliveryLatitude, deliveryLongitude, specialInstructions, couponCode, idempotencyKey } = req.body;

      if (idempotencyKey) {
        const existing = await storage.getOrders();
        const duplicate = existing.find(o => o.idempotencyKey === idempotencyKey);
        if (duplicate) {
          return res.json(duplicate);
        }
      }

      const restaurant = await storage.getRestaurant(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }

      let subtotal = 0;
      const orderItems = [];
      for (const item of items) {
        const menuItem = await storage.getMenuItem(item.menuItemId);
        if (!menuItem || menuItem.restaurantId !== restaurantId) {
          return res.status(400).json({ message: `Invalid menu item: ${item.menuItemId}` });
        }
        subtotal += parseFloat(menuItem.price) * item.quantity;
        orderItems.push({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          price: menuItem.price,
          specialInstructions: item.specialInstructions,
        });
      }

      let discount = 0;
      let couponId = null;
      if (couponCode) {
        const coupon = await storage.getCouponByCode(couponCode);
        if (coupon && coupon.isActive) {
          const now = new Date();
          if ((!coupon.validFrom || coupon.validFrom <= now) && 
              (!coupon.validUntil || coupon.validUntil >= now) &&
              (!coupon.usageLimit || (coupon.usedCount ?? 0) < coupon.usageLimit) &&
              subtotal >= parseFloat(coupon.minimumOrder || "0")) {
            
            if (coupon.discountType === "percentage") {
              discount = subtotal * (parseFloat(coupon.discountValue) / 100);
              if (coupon.maxDiscount) {
                discount = Math.min(discount, parseFloat(coupon.maxDiscount));
              }
            } else {
              discount = parseFloat(coupon.discountValue);
            }
            couponId = coupon.id;
          }
        }
      }

      const deliveryFee = parseFloat(restaurant.deliveryFee || "0");
      const total = subtotal + deliveryFee - discount;

      const orderData = {
        customerId: user.claims.sub,
        restaurantId,
        subtotal: subtotal.toString(),
        deliveryFee: deliveryFee.toString(),
        discount: discount.toString(),
        total: total.toString(),
        deliveryAddress,
        deliveryLatitude,
        deliveryLongitude,
        specialInstructions,
        couponId,
        idempotencyKey,
        status: "pending" as const,
        paymentStatus: "pending" as const,
      };

      const order = await storage.createOrder(orderData);

      for (const item of orderItems) {
        await storage.createOrderItem({ ...item, orderId: order.id });
      }

      if (couponId) {
        await storage.incrementCouponUsage(couponId);
      }

      await storage.createOrderEvent({
        orderId: order.id,
        eventType: "order_created",
        data: { items: orderItems },
      });

      await storage.createNotification({
        userId: restaurant.ownerId,
        title: "New Order",
        message: `You have a new order #${order.id.slice(0, 8)}`,
        type: "order",
        data: { orderId: order.id },
      });

      eventBus.publish(EventTypes.ORDER_CREATED, {
        orderId: order.id,
        restaurantOwnerId: restaurant.ownerId,
        customerId: user.claims.sub,
      });

      res.status(201).json(order);
    } catch (error) {
      logger.error("Error creating order", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/orders/:id/status", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const user = req.user as any;

      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const dbUser = await storage.getUser(user.claims.sub);
      const restaurant = await storage.getRestaurant(order.restaurantId);

      const canUpdate = 
        dbUser?.role === "admin" ||
        (dbUser?.role === "restaurant_owner" && restaurant?.ownerId === user.claims.sub) ||
        (dbUser?.role === "delivery_partner" && order.deliveryPartnerId);

      if (!canUpdate) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const updated = await storage.updateOrder(id, { status });

      await storage.createOrderEvent({
        orderId: id,
        eventType: `status_${status}`,
        data: { previousStatus: order.status, newStatus: status },
      });

      await storage.createNotification({
        userId: order.customerId,
        title: "Order Update",
        message: `Your order status changed to: ${status.replace(/_/g, " ")}`,
        type: "order",
        data: { orderId: id, status },
      });

      eventBus.publish(EventTypes.ORDER_STATUS_CHANGED, {
        orderId: id,
        customerId: order.customerId,
        restaurantOwnerId: restaurant?.ownerId,
        deliveryPartnerId: order.deliveryPartnerId,
        status,
      });

      res.json(updated);
    } catch (error) {
      logger.error("Error updating order status", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/orders/:id/assign-delivery", isAuthenticated, requireRole("restaurant_owner", "admin"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const availablePartners = await storage.getAvailableDeliveryPartners();
      if (availablePartners.length === 0) {
        return res.status(400).json({ message: "No delivery partners available" });
      }

      const partner = availablePartners[0];
      
      await storage.updateOrder(id, { deliveryPartnerId: partner.id });
      await storage.updateDeliveryPartner(partner.id, { status: "busy" });

      const partnerUser = await storage.getUser(partner.userId);
      if (partnerUser) {
        await storage.createNotification({
          userId: partner.userId,
          title: "New Delivery Assignment",
          message: `You have been assigned a new delivery order #${id.slice(0, 8)}`,
          type: "delivery",
          data: { orderId: id },
        });

        eventBus.publish(EventTypes.RIDER_ASSIGNED, {
          orderId: id,
          deliveryPartnerId: partner.id,
          deliveryPartnerUserId: partner.userId,
        });
      }

      res.json({ success: true, partnerId: partner.id });
    } catch (error) {
      logger.error("Error assigning delivery", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/coupons", async (req: Request, res: Response) => {
    try {
      const coupons = await storage.getActiveCoupons();
      res.json(coupons);
    } catch (error) {
      logger.error("Error fetching coupons", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/coupons/validate", async (req: Request, res: Response) => {
    try {
      const { code, subtotal } = req.body;
      const coupon = await storage.getCouponByCode(code);
      
      if (!coupon || !coupon.isActive) {
        return res.status(400).json({ valid: false, message: "Invalid coupon code" });
      }

      const now = new Date();
      if (coupon.validFrom && coupon.validFrom > now) {
        return res.status(400).json({ valid: false, message: "Coupon not yet active" });
      }
      if (coupon.validUntil && coupon.validUntil < now) {
        return res.status(400).json({ valid: false, message: "Coupon expired" });
      }
      if (coupon.usageLimit && (coupon.usedCount ?? 0) >= coupon.usageLimit) {
        return res.status(400).json({ valid: false, message: "Coupon usage limit reached" });
      }
      if (subtotal < parseFloat(coupon.minimumOrder || "0")) {
        return res.status(400).json({ valid: false, message: `Minimum order of $${coupon.minimumOrder} required` });
      }

      let discount;
      if (coupon.discountType === "percentage") {
        discount = subtotal * (parseFloat(coupon.discountValue) / 100);
        if (coupon.maxDiscount) {
          discount = Math.min(discount, parseFloat(coupon.maxDiscount));
        }
      } else {
        discount = parseFloat(coupon.discountValue);
      }

      res.json({ valid: true, discount, coupon });
    } catch (error) {
      logger.error("Error validating coupon", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/coupons", isAuthenticated, requireRole("restaurant_owner", "admin"), async (req: Request, res: Response) => {
    try {
      const validated = insertCouponSchema.parse(req.body);
      const coupon = await storage.createCoupon(validated);
      res.status(201).json(coupon);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      logger.error("Error creating coupon", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/notifications", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const notifications = await storage.getNotifications(user.claims.sub);
      res.json(notifications);
    } catch (error) {
      logger.error("Error fetching notifications", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/notifications/unread", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const notifications = await storage.getUnreadNotifications(user.claims.sub);
      res.json(notifications);
    } catch (error) {
      logger.error("Error fetching unread notifications", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/notifications/:id/read", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.markNotificationRead(id);
      res.json({ success: true });
    } catch (error) {
      logger.error("Error marking notification read", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/notifications/read-all", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      await storage.markAllNotificationsRead(user.claims.sub);
      res.json({ success: true });
    } catch (error) {
      logger.error("Error marking all notifications read", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/restaurants/:restaurantId/reviews", async (req: Request, res: Response) => {
    try {
      const { restaurantId } = req.params;
      const reviews = await storage.getReviewsByRestaurant(restaurantId);
      res.json(reviews);
    } catch (error) {
      logger.error("Error fetching reviews", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/orders/:orderId/review", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { orderId } = req.params;
      const user = req.user as any;

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      if (order.customerId !== user.claims.sub) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (order.status !== "delivered") {
        return res.status(400).json({ message: "Can only review delivered orders" });
      }

      const validated = insertReviewSchema.parse({
        ...req.body,
        orderId,
        customerId: user.claims.sub,
        restaurantId: order.restaurantId,
        deliveryPartnerId: order.deliveryPartnerId,
      });

      const review = await storage.createReview(validated);

      if (validated.restaurantRating) {
        const restaurant = await storage.getRestaurant(order.restaurantId);
        if (restaurant) {
          const reviews = await storage.getReviewsByRestaurant(order.restaurantId);
          const avgRating = reviews.reduce((sum, r) => sum + (r.restaurantRating || 0), 0) / reviews.length;
          await storage.updateRestaurant(order.restaurantId, {
            rating: avgRating.toFixed(1),
            totalRatings: reviews.length,
          });
          cache.delete(`restaurant:${order.restaurantId}`);
          cache.delete("restaurants:all");
        }
      }

      res.status(201).json(review);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      logger.error("Error creating review", { error: String(error) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/health", (req: Request, res: Response) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  app.get("/api/health/ready", async (req: Request, res: Response) => {
    try {
      await storage.getRestaurants();
      res.json({ status: "ready", database: "connected" });
    } catch (error) {
      res.status(503).json({ status: "not ready", database: "disconnected" });
    }
  });

  return httpServer;
}
