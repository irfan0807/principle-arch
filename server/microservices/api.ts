/**
 * Microservices API Router
 * Unified API gateway routing to microservices
 * 
 * Patterns:
 * - API Gateway
 * - Backend for Frontend (BFF)
 * - Rate Limiting
 * - Circuit Breaker
 * - Correlation ID tracking
 */

import { Router, Request, Response, NextFunction } from "express";
import { 
  authIdentityService,
  restaurantService,
  menuService,
  orderService,
  sagaOrchestrator,
  deliveryPartnerService,
  liveOrderTrackingService,
  paymentService,
  offersCouponService,
  notificationService,
  searchDiscoveryService,
  analyticsService,
  adminService,
  healthAggregator,
  initializeServiceRegistry,
  correlationIdMiddleware,
  rateLimiter,
  logger,
  metrics,
  metricsEndpoint,
} from "./index";

const router = Router();

// Initialize service registry
initializeServiceRegistry();

// Global middleware
router.use(correlationIdMiddleware);
router.use((req: Request, _res: Response, next: NextFunction) => {
  metrics.increment("api.requests");
  const start = Date.now();
  
  _res.on("finish", () => {
    metrics.histogram("api.response_time", Date.now() - start);
    metrics.increment(`api.status.${_res.statusCode}`);
  });
  
  next();
});

// Helper for async route handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// ==================== HEALTH ENDPOINTS ====================

router.get("/health", asyncHandler(async (_req, res) => {
  const health = await healthAggregator.getAggregatedHealth();
  const statusCode = health.overall === "healthy" ? 200 : 
                     health.overall === "degraded" ? 200 : 503;
  res.status(statusCode).json(health);
}));

router.get("/health/live", asyncHandler(async (_req, res) => {
  const liveness = await healthAggregator.getLiveness();
  res.status(liveness.status === "ok" ? 200 : 503).json(liveness);
}));

router.get("/health/ready", asyncHandler(async (_req, res) => {
  const readiness = await healthAggregator.getReadiness();
  res.status(readiness.status === "ok" ? 200 : 503).json(readiness);
}));

router.get("/metrics", (_req, res) => {
  res.set("Content-Type", "text/plain");
  res.send(metricsEndpoint());
});

// ==================== AUTH ENDPOINTS ====================

router.post("/v1/auth/register", rateLimiter.strict, asyncHandler(async (req, res) => {
  // Use authenticateWithProvider for user registration
  const result = await authIdentityService.authenticateWithProvider(
    "local",
    req.body.id || `user_${Date.now()}`,
    {
      email: req.body.email,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
    }
  );
  res.status(201).json(result);
}));

router.post("/v1/auth/login", rateLimiter.strict, asyncHandler(async (req, res) => {
  const { email, id } = req.body;
  // Use authenticateWithProvider for login
  const result = await authIdentityService.authenticateWithProvider(
    "local",
    id || email,
    { email }
  );
  if (!result) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  res.json(result);
}));

router.post("/v1/auth/logout", asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) {
    await authIdentityService.revokeTokens(token);
  }
  res.json({ success: true });
}));

router.post("/v1/auth/refresh", asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const result = await authIdentityService.refreshAccessToken(refreshToken);
  if (!result) {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
  res.json(result);
}));

// ==================== RESTAURANT ENDPOINTS ====================

router.get("/v1/restaurants", asyncHandler(async (_req, res) => {
  const result = await restaurantService.getAllRestaurants();
  res.json(result);
}));

router.get("/v1/restaurants/:id", asyncHandler(async (req, res) => {
  const restaurant = await restaurantService.getRestaurant(req.params.id);
  if (!restaurant) {
    return res.status(404).json({ error: "Restaurant not found" });
  }
  res.json(restaurant);
}));

router.post("/v1/restaurants", asyncHandler(async (req, res) => {
  const { ownerId, ...data } = req.body;
  const restaurant = await restaurantService.createRestaurant(ownerId, data);
  res.status(201).json(restaurant);
}));

router.put("/v1/restaurants/:id", asyncHandler(async (req, res) => {
  const restaurant = await restaurantService.updateRestaurant(req.params.id, req.body);
  if (!restaurant) {
    return res.status(404).json({ error: "Restaurant not found" });
  }
  res.json(restaurant);
}));

// ==================== MENU ENDPOINTS ====================

router.get("/v1/restaurants/:restaurantId/menu", asyncHandler(async (req, res) => {
  const menu = await menuService.getMenuWithCategories(req.params.restaurantId);
  res.json(menu);
}));

router.get("/v1/restaurants/:restaurantId/menu/categories", asyncHandler(async (req, res) => {
  const categories = await menuService.getCategories(req.params.restaurantId);
  res.json(categories);
}));

router.post("/v1/restaurants/:restaurantId/menu/categories", asyncHandler(async (req, res) => {
  const category = await menuService.createCategory(req.params.restaurantId, req.body);
  res.status(201).json(category);
}));

router.post("/v1/restaurants/:restaurantId/menu/items", asyncHandler(async (req, res) => {
  const item = await menuService.createMenuItem(req.params.restaurantId, req.body);
  res.status(201).json(item);
}));

router.put("/v1/menu/items/:itemId", asyncHandler(async (req, res) => {
  const item = await menuService.updateMenuItem(req.params.itemId, req.body);
  if (!item) {
    return res.status(404).json({ error: "Menu item not found" });
  }
  res.json(item);
}));

router.delete("/v1/menu/items/:itemId", asyncHandler(async (req, res) => {
  await menuService.deleteMenuItem(req.params.itemId);
  res.status(204).send();
}));

// ==================== ORDER ENDPOINTS ====================

router.post("/v1/orders", asyncHandler(async (req, res) => {
  // Use saga orchestrator for order placement
  const result = await sagaOrchestrator.execute("place-order", {
    customerId: req.body.customerId,
    restaurantId: req.body.restaurantId,
    items: req.body.items,
    deliveryAddress: req.body.deliveryAddress,
    paymentMethod: req.body.paymentMethod,
    couponCode: req.body.couponCode,
  });

  if (!result.success) {
    return res.status(400).json({ 
      error: "Order placement failed", 
      details: result.error,
      compensatedSteps: result.compensatedSteps,
    });
  }

  res.status(201).json(result.data);
}));

router.get("/v1/orders/:id", asyncHandler(async (req, res) => {
  const order = await orderService.getOrder(req.params.id);
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }
  res.json(order);
}));

router.get("/v1/orders/:id/history", asyncHandler(async (req, res) => {
  const history = await orderService.getOrderEvents(req.params.id);
  res.json(history);
}));

router.put("/v1/orders/:id/status", asyncHandler(async (req, res) => {
  const { status, updatedBy } = req.body;
  const order = await orderService.updateOrderStatus(req.params.id, status, updatedBy);
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }
  res.json(order);
}));

router.get("/v1/users/:userId/orders", asyncHandler(async (req, res) => {
  const result = await orderService.queryOrders({
    customerId: req.params.userId,
  });
  res.json(result);
}));

router.get("/v1/restaurants/:restaurantId/orders", asyncHandler(async (req, res) => {
  const { status } = req.query;
  type OrderStatus = "pending" | "confirmed" | "preparing" | "ready_for_pickup" | "out_for_delivery" | "delivered" | "cancelled";
  const result = await orderService.queryOrders({
    restaurantId: req.params.restaurantId,
    status: status ? [status as OrderStatus] : undefined,
  });
  res.json(result);
}));

// ==================== TRACKING ENDPOINTS ====================

router.get("/v1/orders/:orderId/tracking", asyncHandler(async (req, res) => {
  const tracking = await liveOrderTrackingService.getTrackingInfo(req.params.orderId);
  if (!tracking) {
    return res.status(404).json({ error: "Tracking not found" });
  }
  res.json(tracking);
}));

router.put("/v1/tracking/:orderId/location", asyncHandler(async (req, res) => {
  const { latitude, longitude, heading, speed } = req.body;
  // Publish location update event - tracking service will handle it
  const { eventBus, EventTypes } = await import("../infrastructure/eventBus");
  eventBus.publish(EventTypes.RIDER_LOCATION_UPDATE, {
    orderId: req.params.orderId,
    latitude,
    longitude,
    heading,
    speed,
    timestamp: new Date(),
  });
  res.json({ success: true });
}));

// ==================== DELIVERY PARTNER ENDPOINTS ====================

router.get("/v1/delivery-partners/available", asyncHandler(async (req, res) => {
  const { latitude, longitude, radius } = req.query;
  const partner = await deliveryPartnerService.findNearestPartner({
    latitude: parseFloat(latitude as string),
    longitude: parseFloat(longitude as string),
    maxDistanceKm: radius ? parseFloat(radius as string) : undefined,
  });
  res.json(partner ? [partner] : []);
}));

router.post("/v1/delivery-partners/:partnerId/status", asyncHandler(async (req, res) => {
  const { status } = req.body;
  const partner = await deliveryPartnerService.updateStatus(
    req.params.partnerId,
    status
  );
  if (!partner) {
    return res.status(404).json({ error: "Partner not found" });
  }
  res.json(partner);
}));

router.put("/v1/delivery-partners/:partnerId/location", asyncHandler(async (req, res) => {
  const { latitude, longitude, heading, speed, accuracy } = req.body;
  await deliveryPartnerService.updateLocation(req.params.partnerId, {
    latitude,
    longitude,
    heading,
    speed,
    accuracy,
  });
  res.json({ success: true });
}));

router.post("/v1/orders/:orderId/assign-partner", asyncHandler(async (req, res) => {
  const assigned = await deliveryPartnerService.autoAssignDeliveryPartner(req.params.orderId);
  res.json({ success: assigned });
}));

// ==================== PAYMENT ENDPOINTS ====================

router.post("/v1/payments/process", rateLimiter.strict, asyncHandler(async (req, res) => {
  const { orderId, customerId, amount, currency, method, idempotencyKey, returnUrl, cancelUrl } = req.body;
  
  const result = await paymentService.createPayment({
    orderId,
    customerId,
    amount: parseFloat(amount),
    currency: currency || "USD",
    method: method || "card",
    idempotencyKey,
    returnUrl,
    cancelUrl,
  });
  
  res.json(result);
}));

router.post("/v1/payments/:paymentId/refund", asyncHandler(async (req, res) => {
  const { amount, reason, idempotencyKey } = req.body;
  
  const result = await paymentService.refund({
    paymentId: req.params.paymentId,
    amount: amount ? parseFloat(amount) : undefined,
    reason,
    idempotencyKey,
  });
  
  if (!result) {
    return res.status(404).json({ error: "Payment not found" });
  }
  
  res.json(result);
}));

router.get("/v1/payments/:paymentId", asyncHandler(async (req, res) => {
  const payment = await paymentService.getPayment(req.params.paymentId);
  if (!payment) {
    return res.status(404).json({ error: "Payment not found" });
  }
  res.json(payment);
}));

// ==================== COUPON ENDPOINTS ====================

router.post("/v1/coupons/validate", asyncHandler(async (req, res) => {
  const { code, customerId, orderId, orderValue, restaurantId } = req.body;
  
  const result = await offersCouponService.validateCoupon({
    code,
    customerId,
    orderId,
    subtotal: parseFloat(orderValue),
    restaurantId,
  });
  
  res.json(result);
}));

router.post("/v1/coupons", asyncHandler(async (req, res) => {
  const coupon = await offersCouponService.createCoupon(req.body);
  res.status(201).json(coupon);
}));

router.get("/v1/coupons/available", asyncHandler(async (req, res) => {
  const { userId, restaurantId, orderValue } = req.query;
  const coupons = await offersCouponService.getAvailableCouponsForCustomer(
    userId as string,
    orderValue ? parseFloat(orderValue as string) : 0,
    restaurantId as string | undefined
  );
  res.json(coupons);
}));

// ==================== NOTIFICATION ENDPOINTS ====================

router.post("/v1/notifications/send", asyncHandler(async (req, res) => {
  const { userId, type, title, message, data, channels } = req.body;
  
  await notificationService.sendNotification({
    userId,
    type,
    title,
    message,
    data,
    channels: channels || ["in_app"],
  });
  
  res.json({ success: true });
}));

router.get("/v1/users/:userId/notifications", asyncHandler(async (req, res) => {
  const { unreadOnly } = req.query;
  
  let result;
  if (unreadOnly === "true") {
    result = await notificationService.getUnreadNotifications(req.params.userId);
  } else {
    result = await notificationService.getNotifications(req.params.userId);
  }
  
  res.json(result);
}));

router.put("/v1/notifications/:notificationId/read", asyncHandler(async (req, res) => {
  await notificationService.markAsRead(req.params.notificationId);
  res.json({ success: true });
}));

router.put("/v1/users/:userId/notifications/read-all", asyncHandler(async (req, res) => {
  await notificationService.markAllAsRead(req.params.userId);
  res.json({ success: true });
}));

// ==================== SEARCH ENDPOINTS ====================

router.get("/v1/search", asyncHandler(async (req, res) => {
  const { q, cuisine, minRating, maxDeliveryTime, minPrice, maxPrice, sortBy, limit, page } = req.query;
  
  const results = await searchDiscoveryService.search({
    query: q as string,
    filters: {
      cuisine: cuisine ? [cuisine as string] : undefined,
      rating: minRating ? parseFloat(minRating as string) : undefined,
      deliveryTime: maxDeliveryTime ? parseInt(maxDeliveryTime as string) : undefined,
      priceRange: minPrice && maxPrice ? { 
        min: parseFloat(minPrice as string), 
        max: parseFloat(maxPrice as string) 
      } : undefined,
    },
    sort: sortBy ? { 
      field: sortBy as "relevance" | "rating" | "deliveryTime" | "distance", 
      order: "desc" 
    } : undefined,
    pagination: {
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    },
  });
  
  res.json(results);
}));

router.get("/v1/search/suggestions", asyncHandler(async (req, res) => {
  const { q, limit } = req.query;
  const suggestions = await searchDiscoveryService.getSuggestions(
    q as string,
    limit ? parseInt(limit as string) : undefined
  );
  res.json(suggestions);
}));

router.get("/v1/discovery/trending", asyncHandler(async (req, res) => {
  const { limit } = req.query;
  const trending = searchDiscoveryService.getTrendingSearches(
    limit ? parseInt(limit as string) : undefined
  );
  res.json(trending);
}));

router.get("/v1/discovery/recommended", asyncHandler(async (req, res) => {
  const { limit } = req.query;
  // Use popular restaurants as recommendations
  const recommended = await searchDiscoveryService.getPopularRestaurants(
    limit ? parseInt(limit as string) : undefined
  );
  res.json(recommended);
}));

// ==================== ANALYTICS ENDPOINTS ====================

router.get("/v1/analytics/platform", asyncHandler(async (_req, res) => {
  const stats = await analyticsService.getPlatformStats();
  res.json(stats);
}));

router.get("/v1/analytics/orders", asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const dateRange = startDate && endDate ? {
    start: new Date(startDate as string),
    end: new Date(endDate as string),
  } : undefined;
  
  const analytics = await analyticsService.getOrderAnalytics(dateRange);
  res.json(analytics);
}));

router.get("/v1/analytics/restaurants/:restaurantId", asyncHandler(async (req, res) => {
  const analytics = await analyticsService.getRestaurantAnalytics(req.params.restaurantId);
  res.json(analytics);
}));

router.get("/v1/analytics/delivery", asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const dateRange = startDate && endDate ? {
    start: new Date(startDate as string),
    end: new Date(endDate as string),
  } : undefined;
  
  const analytics = await analyticsService.getDeliveryAnalytics(dateRange);
  res.json(analytics);
}));

router.get("/v1/analytics/customers", asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const dateRange = startDate && endDate ? {
    start: new Date(startDate as string),
    end: new Date(endDate as string),
  } : undefined;
  
  const analytics = await analyticsService.getCustomerAnalytics(dateRange);
  res.json(analytics);
}));

router.get("/v1/analytics/revenue", asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const dateRange = startDate && endDate ? {
    start: new Date(startDate as string),
    end: new Date(endDate as string),
  } : undefined;
  
  const analytics = await analyticsService.getRevenueAnalytics(dateRange);
  res.json(analytics);
}));

router.get("/v1/analytics/realtime", asyncHandler(async (_req, res) => {
  const metrics = analyticsService.getRealTimeMetrics();
  res.json(metrics);
}));

// ==================== ADMIN ENDPOINTS ====================

router.get("/v1/admin/dashboard", asyncHandler(async (_req, res) => {
  const stats = await adminService.getDashboardStats();
  res.json(stats);
}));

router.get("/v1/admin/audit-logs", asyncHandler(async (req, res) => {
  const { adminId, resourceType, resourceId, startDate, endDate, limit, offset } = req.query;
  
  const result = await adminService.getAuditLogs({
    adminId: adminId as string,
    resourceType: resourceType as string,
    resourceId: resourceId as string,
    startDate: startDate ? new Date(startDate as string) : undefined,
    endDate: endDate ? new Date(endDate as string) : undefined,
    limit: limit ? parseInt(limit as string) : undefined,
    offset: offset ? parseInt(offset as string) : undefined,
  });
  
  res.json(result);
}));

router.get("/v1/admin/users", asyncHandler(async (req, res) => {
  const { role, status, search, limit, offset } = req.query;
  
  const result = await adminService.getUsers({
    role: role as string,
    status: status as string,
    search: search as string,
    limit: limit ? parseInt(limit as string) : undefined,
    offset: offset ? parseInt(offset as string) : undefined,
  });
  
  res.json(result);
}));

router.put("/v1/admin/users/:userId/role", asyncHandler(async (req, res) => {
  const { role, adminId } = req.body;
  const user = await adminService.updateUserRole(adminId, req.params.userId, role);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json(user);
}));

router.post("/v1/admin/users/:userId/suspend", asyncHandler(async (req, res) => {
  const { reason, duration, adminId } = req.body;
  await adminService.suspendUser(adminId, req.params.userId, reason, duration);
  res.json({ success: true });
}));

router.post("/v1/admin/restaurants/:restaurantId/approve", asyncHandler(async (req, res) => {
  const { adminId } = req.body;
  const restaurant = await adminService.approveRestaurant(adminId, req.params.restaurantId);
  if (!restaurant) {
    return res.status(404).json({ error: "Restaurant not found" });
  }
  res.json(restaurant);
}));

router.post("/v1/admin/restaurants/:restaurantId/suspend", asyncHandler(async (req, res) => {
  const { reason, adminId } = req.body;
  await adminService.suspendRestaurant(adminId, req.params.restaurantId, reason);
  res.json({ success: true });
}));

router.get("/v1/admin/config", asyncHandler(async (req, res) => {
  const { category } = req.query;
  const configs = await adminService.getAllConfigs(category as string);
  res.json(configs);
}));

router.put("/v1/admin/config/:key", asyncHandler(async (req, res) => {
  const { value, adminId } = req.body;
  const config = await adminService.updateConfig(adminId, req.params.key, value);
  res.json(config);
}));

// ==================== ERROR HANDLING ====================

router.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  logger.error("API error", {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  metrics.increment("api.errors");

  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    error: err.message || "Internal Server Error",
    code: err.code,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

export default router;
