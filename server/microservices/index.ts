/**
 * Microservices Index
 * Central export point for all microservices
 */

// Core
export { BaseService } from "./core/BaseService";
export type { ServiceHealth, ServiceConfig } from "./core/BaseService";

// Infrastructure
export { metrics, metricsEndpoint } from "../infrastructure/metrics";
export { eventBus, EventTypes } from "../infrastructure/eventBus";
export { cache } from "../infrastructure/cache";
export { logger } from "../infrastructure/logger";
export { distributedCache, RedisCacheKeys } from "../infrastructure/redisCache";
export type { RedisConfig, CacheStats } from "../infrastructure/redisCache";
export { messageQueue, QueueTopics, createPublisher, createSubscriber } from "../infrastructure/messageQueue";
export type { 
  MessageQueueConfig, 
  Message, 
  PublishOptions,
  ConsumeOptions 
} from "../infrastructure/messageQueue";
export { multiRegionManager } from "../infrastructure/multiRegion";
export type { 
  Region,
  RegionConfig, 
  RegionEndpoints
} from "../infrastructure/multiRegion";

// Gateway
export { circuitBreaker } from "../gateway/circuitBreaker";
export { rateLimiter } from "../gateway/rateLimiter";
export type { RateLimitConfig } from "../gateway/rateLimiter";
export { correlationIdMiddleware, getCorrelationId, setCorrelationId } from "../gateway/correlationId";

// Services
export { authIdentityService } from "./auth/AuthIdentityService";
export { restaurantService } from "./restaurant/RestaurantService";
export { menuService } from "./menu/MenuService";
export { orderService } from "./order/OrderService";
export { sagaOrchestrator } from "./saga/SagaOrchestrator";
export { deliveryPartnerService } from "./delivery/DeliveryPartnerService";
export { liveOrderTrackingService } from "./tracking/LiveOrderTrackingService";
export { paymentService } from "./payment/PaymentService";
export { offersCouponService } from "./offers/OffersCouponService";
export { notificationService } from "./notification/NotificationService";
export { searchDiscoveryService } from "./search/SearchDiscoveryService";
export { graphQLBFF } from "./graphql/GraphQLBFF";
export { analyticsService } from "./analytics/AnalyticsService";
export { adminService } from "./admin/AdminService";
export { sapIntegrationService } from "./sap/SAPIntegrationService";
export { mlService } from "./ml/MachineLearningService";
export type { 
  UserPreferences,
  RecommendationResult, 
  ETAPrediction,
  DemandForecast,
  FraudScore,
  PricingSuggestion
} from "./ml/MachineLearningService";

// Registry
export { 
  serviceRegistry, 
  healthAggregator, 
  initializeServiceRegistry 
} from "./registry/ServiceRegistry";

// Service Types
export type { ServiceInstance, ServiceDefinition, AggregatedHealth } from "./registry/ServiceRegistry";
export type { DateRange, PlatformStats, OrderAnalytics, RestaurantAnalytics } from "./analytics/AnalyticsService";
export type { AdminUser, AuditLog, SystemConfig, ModerationAction } from "./admin/AdminService";
