/**
 * GraphQL BFF (Backend for Frontend) Layer
 * Aggregates data from multiple microservices for client applications
 * 
 * Patterns:
 * - Backend for Frontend (BFF)
 * - API Aggregation
 * - DataLoader for batching
 */

import { restaurantService } from "../restaurant/RestaurantService";
import { menuService } from "../menu/MenuService";
import { orderService } from "../order/OrderService";
import { deliveryPartnerService } from "../delivery/DeliveryPartnerService";
import { liveOrderTrackingService } from "../tracking/LiveOrderTrackingService";
import { paymentService } from "../payment/PaymentService";
import { offersCouponService } from "../offers/OffersCouponService";
import { notificationService } from "../notification/NotificationService";
import { searchDiscoveryService } from "../search/SearchDiscoveryService";
import { authIdentityService } from "../auth/AuthIdentityService";
import { storage } from "../../storage";

// Types for GraphQL resolvers
export interface Context {
  userId?: string;
  userRole?: string;
  correlationId: string;
}

export interface GraphQLResolvers {
  Query: Record<string, (parent: any, args: any, context: Context) => Promise<any>>;
  Mutation: Record<string, (parent: any, args: any, context: Context) => Promise<any>>;
  Subscription?: Record<string, any>;
  [typeName: string]: Record<string, any> | undefined;
}

/**
 * GraphQL Schema (SDL)
 */
export const typeDefs = `
  scalar DateTime
  scalar JSON

  # ==================== Types ====================
  
  type User {
    id: ID!
    email: String
    firstName: String
    lastName: String
    profileImageUrl: String
    role: UserRole!
    phone: String
    address: String
    city: String
    createdAt: DateTime
  }

  enum UserRole {
    customer
    restaurant_owner
    delivery_partner
    admin
  }

  type Restaurant {
    id: ID!
    name: String!
    description: String
    cuisine: String!
    imageUrl: String
    address: String!
    city: String!
    phone: String
    rating: Float
    totalRatings: Int
    deliveryTime: Int
    minimumOrder: Float
    deliveryFee: Float
    isActive: Boolean
    isOpen: Boolean
    openingTime: String
    closingTime: String
    distance: Float
    menu: [MenuItem!]
    categories: [MenuCategory!]
    reviews: [Review!]
  }

  type MenuCategory {
    id: ID!
    name: String!
    description: String
    sortOrder: Int
    items: [MenuItem!]
  }

  type MenuItem {
    id: ID!
    name: String!
    description: String
    price: Float!
    imageUrl: String
    isVegetarian: Boolean
    isVegan: Boolean
    isGlutenFree: Boolean
    spiceLevel: Int
    calories: Int
    preparationTime: Int
    isAvailable: Boolean
    isPopular: Boolean
    restaurant: Restaurant
  }

  type Order {
    id: ID!
    status: OrderStatus!
    subtotal: Float!
    deliveryFee: Float
    discount: Float
    total: Float!
    deliveryAddress: String!
    specialInstructions: String
    estimatedDeliveryTime: DateTime
    actualDeliveryTime: DateTime
    paymentStatus: PaymentStatus
    paymentMethod: String
    createdAt: DateTime
    items: [OrderItem!]
    restaurant: Restaurant
    deliveryPartner: DeliveryPartner
    tracking: OrderTracking
  }

  enum OrderStatus {
    pending
    confirmed
    preparing
    ready_for_pickup
    out_for_delivery
    delivered
    cancelled
  }

  enum PaymentStatus {
    pending
    completed
    failed
    refunded
  }

  type OrderItem {
    id: ID!
    quantity: Int!
    price: Float!
    specialInstructions: String
    menuItem: MenuItem
  }

  type OrderTracking {
    orderId: ID!
    status: String!
    currentStep: Int!
    totalSteps: Int!
    steps: [TrackingStep!]!
    estimatedDeliveryTime: DateTime
    deliveryPartner: DeliveryPartnerLocation
    timeline: [TimelineEvent!]!
  }

  type TrackingStep {
    name: String!
    status: String!
    completedAt: DateTime
  }

  type TimelineEvent {
    timestamp: DateTime!
    event: String!
    description: String!
  }

  type DeliveryPartner {
    id: ID!
    user: User
    vehicleType: String
    vehicleNumber: String
    status: DeliveryPartnerStatus
    rating: Float
    totalDeliveries: Int
    totalEarnings: Float
    isVerified: Boolean
  }

  type DeliveryPartnerLocation {
    id: ID!
    name: String
    phone: String
    vehicleType: String
    currentLocation: GeoLocation
  }

  type GeoLocation {
    latitude: Float!
    longitude: Float!
    lastUpdated: DateTime
  }

  enum DeliveryPartnerStatus {
    available
    busy
    offline
  }

  type Coupon {
    id: ID!
    code: String!
    description: String
    discountType: String
    discountValue: Float!
    minimumOrder: Float
    maxDiscount: Float
    usageLimit: Int
    usedCount: Int
    validFrom: DateTime
    validUntil: DateTime
    isActive: Boolean
  }

  type CouponValidation {
    isValid: Boolean!
    discountAmount: Float!
    message: String!
    coupon: Coupon
  }

  type Notification {
    id: ID!
    title: String!
    message: String!
    type: String
    isRead: Boolean
    data: JSON
    createdAt: DateTime
  }

  type Review {
    id: ID!
    restaurantRating: Int
    deliveryRating: Int
    foodRating: Int
    comment: String
    createdAt: DateTime
    customer: User
  }

  type SearchResult {
    restaurants: RestaurantSearchResult!
    menuItems: MenuItemSearchResult!
  }

  type RestaurantSearchResult {
    items: [Restaurant!]!
    total: Int!
    page: Int!
    totalPages: Int!
  }

  type MenuItemSearchResult {
    items: [MenuItem!]!
    total: Int!
    page: Int!
    totalPages: Int!
  }

  type Suggestion {
    type: String!
    text: String!
    id: ID
  }

  type AuthToken {
    accessToken: String!
    refreshToken: String!
    expiresIn: Int!
    tokenType: String!
  }

  type PaymentResult {
    success: Boolean!
    paymentId: ID!
    status: String!
    approvalUrl: String
    message: String
    transactionId: String
  }

  type ServiceHealth {
    status: String!
    uptime: Int!
    timestamp: DateTime!
    checks: [HealthCheck!]!
  }

  type HealthCheck {
    name: String!
    status: String!
    responseTime: Int
    message: String
  }

  # ==================== Inputs ====================

  input LocationInput {
    latitude: Float!
    longitude: Float!
    radiusKm: Float
  }

  input SearchFilterInput {
    cuisine: [String!]
    priceRange: PriceRangeInput
    rating: Float
    deliveryTime: Int
    isVegetarian: Boolean
    isVegan: Boolean
    isGlutenFree: Boolean
    isOpen: Boolean
  }

  input PriceRangeInput {
    min: Float!
    max: Float!
  }

  input PaginationInput {
    page: Int!
    limit: Int!
  }

  input SortInput {
    field: String!
    order: String!
  }

  input CreateOrderInput {
    restaurantId: ID!
    items: [OrderItemInput!]!
    deliveryAddress: String!
    deliveryLatitude: Float
    deliveryLongitude: Float
    specialInstructions: String
    couponCode: String
    paymentMethod: String
    idempotencyKey: String!
  }

  input OrderItemInput {
    menuItemId: ID!
    quantity: Int!
    price: Float!
    specialInstructions: String
  }

  input CreateRestaurantInput {
    name: String!
    description: String
    cuisine: String!
    imageUrl: String
    address: String!
    city: String!
    phone: String
    latitude: Float
    longitude: Float
    openingTime: String
    closingTime: String
    deliveryFee: Float
    minimumOrder: Float
  }

  input CreateMenuItemInput {
    name: String!
    description: String
    price: Float!
    imageUrl: String
    categoryId: ID
    isVegetarian: Boolean
    isVegan: Boolean
    isGlutenFree: Boolean
    spiceLevel: Int
    calories: Int
    preparationTime: Int
  }

  input UpdateLocationInput {
    latitude: Float!
    longitude: Float!
    heading: Float
    speed: Float
  }

  # ==================== Queries ====================

  type Query {
    # User
    me: User
    
    # Restaurants
    restaurants(location: LocationInput): [Restaurant!]!
    restaurant(id: ID!): Restaurant
    myRestaurants: [Restaurant!]!
    
    # Menu
    menuItems(restaurantId: ID!, categoryId: ID): [MenuItem!]!
    menuItem(id: ID!): MenuItem
    
    # Search
    search(
      query: String!
      filters: SearchFilterInput
      sort: SortInput
      pagination: PaginationInput
      location: LocationInput
    ): SearchResult!
    suggestions(prefix: String!, limit: Int): [Suggestion!]!
    trendingSearches: [String!]!
    popularRestaurants(limit: Int): [Restaurant!]!
    cuisines: [String!]!
    
    # Orders
    orders: [Order!]!
    order(id: ID!): Order
    activeOrders: [Order!]!
    
    # Tracking
    orderTracking(orderId: ID!): OrderTracking
    
    # Coupons
    availableCoupons(subtotal: Float!, restaurantId: ID): [Coupon!]!
    validateCoupon(code: String!, subtotal: Float!, restaurantId: ID): CouponValidation!
    
    # Notifications
    notifications: [Notification!]!
    unreadNotifications: [Notification!]!
    
    # Delivery Partner
    deliveryPartnerProfile: DeliveryPartner
    deliveryPartnerStats: JSON
    activeDeliveries: [Order!]!
    
    # Health
    health: [ServiceHealth!]!
  }

  # ==================== Mutations ====================

  type Mutation {
    # Auth
    refreshToken(refreshToken: String!): AuthToken!
    logout(refreshToken: String!): Boolean!
    updateProfile(phone: String, address: String, city: String): User!
    updateRole(role: UserRole!): User!
    
    # Restaurants
    createRestaurant(input: CreateRestaurantInput!): Restaurant!
    updateRestaurant(id: ID!, input: CreateRestaurantInput!): Restaurant
    toggleRestaurantStatus(id: ID!, isActive: Boolean!): Restaurant
    
    # Menu
    createMenuItem(restaurantId: ID!, input: CreateMenuItemInput!): MenuItem!
    updateMenuItem(id: ID!, input: CreateMenuItemInput!): MenuItem
    deleteMenuItem(id: ID!): Boolean!
    toggleMenuItemAvailability(id: ID!, isAvailable: Boolean!): MenuItem
    
    # Orders
    createOrder(input: CreateOrderInput!): Order!
    updateOrderStatus(id: ID!, status: OrderStatus!): Order
    cancelOrder(id: ID!, reason: String!): Order
    
    # Payment
    capturePayment(paymentId: ID!, paypalOrderId: String!): PaymentResult!
    
    # Delivery Partner
    registerAsDeliveryPartner(vehicleType: String!, vehicleNumber: String, licenseNumber: String): DeliveryPartner!
    updateDeliveryPartnerStatus(status: DeliveryPartnerStatus!): DeliveryPartner
    updateDeliveryPartnerLocation(input: UpdateLocationInput!): Boolean!
    completeDelivery(orderId: ID!): Boolean!
    
    # Notifications
    markNotificationRead(id: ID!): Boolean!
    markAllNotificationsRead: Boolean!
    
    # Reviews
    createReview(orderId: ID!, restaurantRating: Int, deliveryRating: Int, foodRating: Int, comment: String): Review!
  }

  # ==================== Subscriptions ====================

  type Subscription {
    orderUpdated(orderId: ID!): Order!
    locationUpdated(orderId: ID!): GeoLocation!
    newNotification: Notification!
  }
`;

/**
 * GraphQL Resolvers
 */
export const resolvers: GraphQLResolvers = {
  Query: {
    // User
    me: async (_parent, _args, context) => {
      if (!context.userId) return null;
      return authIdentityService.getUser(context.userId);
    },

    // Restaurants
    restaurants: async (_parent, { location }) => {
      if (location) {
        return searchDiscoveryService.getNearbyRestaurants(location);
      }
      return restaurantService.getAllRestaurants();
    },

    restaurant: async (_parent, { id }) => {
      return restaurantService.getRestaurant(id);
    },

    myRestaurants: async (_parent, _args, context) => {
      if (!context.userId) throw new Error("Authentication required");
      return restaurantService.getRestaurantsByOwner(context.userId);
    },

    // Menu
    menuItems: async (_parent, { restaurantId, categoryId }) => {
      return menuService.getMenuItems(restaurantId, { categoryId });
    },

    menuItem: async (_parent, { id }) => {
      return menuService.getMenuItem(id);
    },

    // Search
    search: async (_parent, { query, filters, sort, pagination, location }) => {
      return searchDiscoveryService.search({
        query,
        filters,
        sort,
        pagination,
        location,
      });
    },

    suggestions: async (_parent, { prefix, limit }) => {
      return searchDiscoveryService.getSuggestions(prefix, limit || 10);
    },

    trendingSearches: async () => {
      return searchDiscoveryService.getTrendingSearches();
    },

    popularRestaurants: async (_parent, { limit }) => {
      return searchDiscoveryService.getPopularRestaurants(limit || 10);
    },

    cuisines: async () => {
      const result = await searchDiscoveryService.getCuisines();
      return result.map((c) => c.cuisine);
    },

    // Orders
    orders: async (_parent, _args, context) => {
      if (!context.userId) throw new Error("Authentication required");
      return orderService.queryOrders({ customerId: context.userId });
    },

    order: async (_parent, { id }, context) => {
      if (!context.userId) throw new Error("Authentication required");
      return orderService.getOrderWithDetails(id);
    },

    activeOrders: async (_parent, _args, context) => {
      if (!context.userId) throw new Error("Authentication required");
      return orderService.queryOrders({
        customerId: context.userId,
        status: ["pending", "confirmed", "preparing", "ready_for_pickup", "out_for_delivery"],
      });
    },

    // Tracking
    orderTracking: async (_parent, { orderId }) => {
      return liveOrderTrackingService.getTrackingInfo(orderId);
    },

    // Coupons
    availableCoupons: async (_parent, { subtotal, restaurantId }, context) => {
      if (!context.userId) return [];
      return offersCouponService.getAvailableCouponsForCustomer(
        context.userId,
        subtotal,
        restaurantId
      );
    },

    validateCoupon: async (_parent, { code, subtotal, restaurantId }, context) => {
      if (!context.userId) throw new Error("Authentication required");
      return offersCouponService.validateCoupon({
        code,
        customerId: context.userId,
        orderId: "",
        subtotal,
        restaurantId,
      });
    },

    // Notifications
    notifications: async (_parent, _args, context) => {
      if (!context.userId) throw new Error("Authentication required");
      return notificationService.getNotifications(context.userId);
    },

    unreadNotifications: async (_parent, _args, context) => {
      if (!context.userId) throw new Error("Authentication required");
      return notificationService.getUnreadNotifications(context.userId);
    },

    // Delivery Partner
    deliveryPartnerProfile: async (_parent, _args, context) => {
      if (!context.userId) throw new Error("Authentication required");
      return deliveryPartnerService.getPartnerByUserId(context.userId);
    },

    deliveryPartnerStats: async (_parent, _args, context) => {
      if (!context.userId) throw new Error("Authentication required");
      const partner = await deliveryPartnerService.getPartnerByUserId(context.userId);
      if (!partner) throw new Error("Not a delivery partner");
      return deliveryPartnerService.getPartnerStats(partner.id);
    },

    activeDeliveries: async (_parent, _args, context) => {
      if (!context.userId) throw new Error("Authentication required");
      const partner = await deliveryPartnerService.getPartnerByUserId(context.userId);
      if (!partner) return [];
      return orderService.getActiveOrdersForDeliveryPartner(partner.id);
    },

    // Health
    health: async () => {
      // This would aggregate health from all services
      return [];
    },
  },

  Mutation: {
    // Auth
    refreshToken: async (_parent, { refreshToken }) => {
      return authIdentityService.refreshAccessToken(refreshToken);
    },

    logout: async (_parent, { refreshToken }) => {
      await authIdentityService.revokeTokens(refreshToken);
      return true;
    },

    updateProfile: async (_parent, args, context) => {
      if (!context.userId) throw new Error("Authentication required");
      return storage.upsertUser({ id: context.userId, ...args });
    },

    updateRole: async (_parent, { role }, context) => {
      if (!context.userId) throw new Error("Authentication required");
      const updated = await authIdentityService.updateUserRole(context.userId, role);
      if (!updated) throw new Error("Failed to update role");
      return updated;
    },

    // Restaurants
    createRestaurant: async (_parent, { input }, context) => {
      if (!context.userId) throw new Error("Authentication required");
      return restaurantService.createRestaurant(context.userId, input);
    },

    updateRestaurant: async (_parent, { id, input }) => {
      return restaurantService.updateRestaurant(id, input);
    },

    toggleRestaurantStatus: async (_parent, { id, isActive }) => {
      return restaurantService.updateRestaurantStatus(id, isActive);
    },

    // Menu
    createMenuItem: async (_parent, { restaurantId, input }) => {
      return menuService.createMenuItem(restaurantId, input);
    },

    updateMenuItem: async (_parent, { id, input }) => {
      return menuService.updateMenuItem(id, input);
    },

    deleteMenuItem: async (_parent, { id }) => {
      await menuService.deleteMenuItem(id);
      return true;
    },

    toggleMenuItemAvailability: async (_parent, { id, isAvailable }) => {
      return menuService.updateItemAvailability(id, isAvailable);
    },

    // Orders
    createOrder: async (_parent, { input }, context) => {
      if (!context.userId) throw new Error("Authentication required");
      return orderService.createOrder({
        ...input,
        customerId: context.userId,
      });
    },

    updateOrderStatus: async (_parent, { id, status }) => {
      return orderService.updateOrderStatus(id, status);
    },

    cancelOrder: async (_parent, { id, reason }) => {
      return orderService.cancelOrder(id, reason);
    },

    // Payment
    capturePayment: async (_parent, { paymentId, paypalOrderId }) => {
      return paymentService.capturePayPalPayment(paymentId, paypalOrderId);
    },

    // Delivery Partner
    registerAsDeliveryPartner: async (_parent, args, context) => {
      if (!context.userId) throw new Error("Authentication required");
      return deliveryPartnerService.registerPartner(context.userId, args);
    },

    updateDeliveryPartnerStatus: async (_parent, { status }, context) => {
      if (!context.userId) throw new Error("Authentication required");
      const partner = await deliveryPartnerService.getPartnerByUserId(context.userId);
      if (!partner) throw new Error("Not a delivery partner");
      return deliveryPartnerService.updateStatus(partner.id, status);
    },

    updateDeliveryPartnerLocation: async (_parent, { input }, context) => {
      if (!context.userId) throw new Error("Authentication required");
      const partner = await deliveryPartnerService.getPartnerByUserId(context.userId);
      if (!partner) throw new Error("Not a delivery partner");
      await deliveryPartnerService.updateLocation(partner.id, input);
      return true;
    },

    completeDelivery: async (_parent, { orderId }, context) => {
      if (!context.userId) throw new Error("Authentication required");
      const partner = await deliveryPartnerService.getPartnerByUserId(context.userId);
      if (!partner) throw new Error("Not a delivery partner");
      await deliveryPartnerService.completeDelivery(partner.id, orderId);
      await orderService.updateOrderStatus(orderId, "delivered");
      return true;
    },

    // Notifications
    markNotificationRead: async (_parent, { id }) => {
      await notificationService.markAsRead(id);
      return true;
    },

    markAllNotificationsRead: async (_parent, _args, context) => {
      if (!context.userId) throw new Error("Authentication required");
      await notificationService.markAllAsRead(context.userId);
      return true;
    },

    // Reviews
    createReview: async (_parent, args, context) => {
      if (!context.userId) throw new Error("Authentication required");
      const order = await storage.getOrder(args.orderId);
      if (!order) throw new Error("Order not found");
      
      return storage.createReview({
        orderId: args.orderId,
        customerId: context.userId,
        restaurantId: order.restaurantId,
        deliveryPartnerId: order.deliveryPartnerId,
        restaurantRating: args.restaurantRating,
        deliveryRating: args.deliveryRating,
        foodRating: args.foodRating,
        comment: args.comment,
      });
    },
  },

  // Field resolvers
  Restaurant: {
    isOpen: (restaurant: any) => {
      return restaurantService.isRestaurantOpen(restaurant);
    },
    menu: async (restaurant: any) => {
      return menuService.getMenuItems(restaurant.id);
    },
    categories: async (restaurant: any) => {
      return menuService.getCategories(restaurant.id);
    },
    reviews: async (restaurant: any) => {
      return storage.getReviewsByRestaurant(restaurant.id);
    },
  },

  MenuCategory: {
    items: async (category: any) => {
      return menuService.getMenuItems(category.restaurantId, { categoryId: category.id });
    },
  },

  MenuItem: {
    restaurant: async (item: any) => {
      return storage.getRestaurant(item.restaurantId);
    },
  },

  Order: {
    items: async (order: any) => {
      return storage.getOrderItems(order.id);
    },
    restaurant: async (order: any) => {
      return storage.getRestaurant(order.restaurantId);
    },
    deliveryPartner: async (order: any) => {
      if (!order.deliveryPartnerId) return null;
      return storage.getDeliveryPartner(order.deliveryPartnerId);
    },
    tracking: async (order: any) => {
      return liveOrderTrackingService.getTrackingInfo(order.id);
    },
  },

  OrderItem: {
    menuItem: async (item: any) => {
      return storage.getMenuItem(item.menuItemId);
    },
  },

  DeliveryPartner: {
    user: async (partner: any) => {
      return storage.getUser(partner.userId);
    },
  },

  Review: {
    customer: async (review: any) => {
      return storage.getUser(review.customerId);
    },
  },
};

// Export the GraphQL BFF service
export const graphQLBFF = {
  typeDefs,
  resolvers,
};
