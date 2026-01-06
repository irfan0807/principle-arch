# Technical Architecture Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Patterns](#architecture-patterns)
3. [Microservices](#microservices)
4. [Database Design](#database-design)
5. [API Design](#api-design)
6. [Infrastructure Components](#infrastructure-components)
7. [Security](#security)
8. [Performance](#performance)
9. [Deployment](#deployment)

---

## System Overview

FoodDash is built on a **microservices architecture** with an **event-driven** communication pattern. The system is designed for high availability, scalability, and fault tolerance.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Customer │  │Restaurant│  │ Delivery │  │  Admin   │        │
│  │   App    │  │  Portal  │  │   App    │  │  Panel   │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
└───────┼─────────────┼─────────────┼─────────────┼───────────────┘
        │             │             │             │
        └─────────────┴──────┬──────┴─────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────┐
│                    API GATEWAY LAYER                             │
│  ┌─────────────────────────┴───────────────────────────────┐    │
│  │                    Express Server                        │    │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │    │
│  │  │ Rate Limiter │ │ Auth Middle. │ │ Correlation  │     │    │
│  │  └──────────────┘ └──────────────┘ └──────────────┘     │    │
│  └──────────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────┐
│                    MICROSERVICES LAYER                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │   Auth   │ │Restaurant│ │   Menu   │ │  Order   │           │
│  │ Service  │ │ Service  │ │ Service  │ │ Service  │           │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │
│       │            │            │            │                   │
│  ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐           │
│  │ Delivery │ │ Payment  │ │  Search  │ │Analytics │           │
│  │ Service  │ │ Service  │ │ Service  │ │ Service  │           │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │
│       │            │            │            │                   │
│  ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐           │
│  │Notificat.│ │  Offers  │ │  Admin   │ │   SAP    │           │
│  │ Service  │ │ Service  │ │ Service  │ │Integration│           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────┐
│                   INFRASTRUCTURE LAYER                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │Event Bus │ │  Cache   │ │  Logger  │ │ Metrics  │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │                    PostgreSQL Database                  │     │
│  └────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architecture Patterns

### 1. Microservices Architecture

Each service is independently deployable and responsible for a specific business domain:

| Service | Port | Responsibility |
|---------|------|----------------|
| Auth Identity | 3001 | User authentication, session management |
| Restaurant | 3002 | Restaurant CRUD, business hours |
| Menu | 3003 | Menu items, categories, pricing |
| Order | 3004 | Order lifecycle, status management |
| Delivery Partner | 3005 | Driver management, assignments |
| Payment | 3006 | Payment processing, refunds |
| Notification | 3007 | Push, email, SMS notifications |
| Search Discovery | 3008 | Full-text search, recommendations |
| Analytics | 3009 | Metrics, reporting, insights |
| Admin | 3010 | Platform administration |

### 2. Event-Driven Architecture

Services communicate asynchronously through an event bus:

```typescript
// Event Types
export const EventTypes = {
  // Order Events
  ORDER_CREATED: "order.created",
  ORDER_CONFIRMED: "order.confirmed",
  ORDER_PREPARING: "order.preparing",
  ORDER_READY: "order.ready",
  ORDER_PICKED_UP: "order.picked_up",
  ORDER_DELIVERED: "order.delivered",
  ORDER_CANCELLED: "order.cancelled",
  ORDER_STATUS_CHANGED: "order.status_changed",
  
  // Payment Events
  PAYMENT_INITIATED: "payment.initiated",
  PAYMENT_SUCCESS: "payment.success",
  PAYMENT_FAILED: "payment.failed",
  PAYMENT_REFUNDED: "payment.refunded",
  
  // Rider Events
  RIDER_ASSIGNED: "rider.assigned",
  RIDER_LOCATION_UPDATE: "rider.location_update",
  RIDER_STATUS_CHANGED: "rider.status_changed",
  
  // Other Events
  NOTIFICATION_SEND: "notification.send",
  RESTAURANT_UPDATED: "restaurant.updated",
  MENU_UPDATED: "menu.updated",
  COUPON_APPLIED: "coupon.applied",
};
```

**Event Flow Example - Order Placement:**

```
Customer → OrderService.createOrder()
              ↓
         EVENT: order.created
              ↓
    ┌─────────┴─────────┐
    ↓                   ↓
PaymentService    NotificationService
(process payment)  (notify restaurant)
    ↓
EVENT: payment.success
    ↓
OrderService (update status)
    ↓
EVENT: order.confirmed
```

### 3. Saga Pattern

For distributed transactions, we use the Saga Orchestrator pattern:

```typescript
// Saga Definition
sagaOrchestrator.registerSaga({
  name: "place_order",
  steps: [
    {
      name: "validate_order",
      execute: async (data) => await validateOrderData(data),
      compensate: async (data) => { /* no compensation needed */ }
    },
    {
      name: "create_order",
      execute: async (data) => await orderService.create(data),
      compensate: async (data) => await orderService.cancel(data.orderId)
    },
    {
      name: "process_payment",
      execute: async (data) => await paymentService.charge(data),
      compensate: async (data) => await paymentService.refund(data.paymentId)
    },
    {
      name: "notify_restaurant",
      execute: async (data) => await notificationService.notify(data),
      compensate: async (data) => { /* send cancellation */ }
    }
  ]
});
```

### 4. Circuit Breaker Pattern

Fault tolerance for external service calls:

```typescript
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,      // Open after 5 failures
  resetTimeout: 30000,      // Try again after 30s
  halfOpenRequests: 3       // Allow 3 test requests
});

// Usage
const result = await circuitBreaker.execute(
  () => externalService.call(),
  () => fallbackResponse()  // Fallback when circuit is open
);
```

**Circuit States:**
- **Closed**: Normal operation, requests pass through
- **Open**: Failures exceeded threshold, requests fail fast
- **Half-Open**: Testing if service recovered

---

## Microservices

### Base Service Class

All services extend a common base class:

```typescript
abstract class BaseService {
  protected name: string;
  protected version: string;
  protected config: ServiceConfig;

  abstract getHealth(): Promise<ServiceHealth>;
  
  getInfo() {
    return {
      name: this.name,
      version: this.version,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  }
}
```

### Service Registry

Dynamic service discovery and health monitoring:

```typescript
// Service Registration
serviceRegistry.register({
  serviceName: "order-service",
  instanceId: uuid(),
  host: "localhost",
  port: 3004,
  metadata: { version: "1.0.0" }
});

// Service Discovery
const instances = serviceRegistry.getInstances("payment-service");
const healthyInstance = instances.find(i => i.status === "healthy");

// Health Aggregation
const platformHealth = await healthAggregator.getAggregatedHealth();
// Returns: { status: "healthy", services: [...], uptime: ... }
```

### Detailed Service Descriptions

#### 1. Auth Identity Service
- **Purpose**: Handle user authentication and authorization
- **Features**:
  - Phone OTP authentication
  - Google OAuth integration
  - Session management with PostgreSQL store
  - Role-based access control (RBAC)
- **Key Endpoints**:
  - `POST /api/auth/send-otp` - Send OTP to phone
  - `POST /api/auth/verify-otp` - Verify OTP
  - `GET /api/auth/google` - Google OAuth
  - `GET /api/auth/me` - Get current user

#### 2. Restaurant Service
- **Purpose**: Manage restaurant information
- **Features**:
  - CRUD operations for restaurants
  - Business hours management
  - Location-based queries
  - Owner association
- **Key Endpoints**:
  - `GET /api/restaurants` - List restaurants
  - `GET /api/restaurants/:id` - Get restaurant details
  - `GET /api/my-restaurants` - Owner's restaurants

#### 3. Order Service
- **Purpose**: Handle order lifecycle
- **Features**:
  - Order creation with idempotency
  - Status transitions with validation
  - Real-time updates via WebSocket
  - Order history
- **Status Flow**:
  ```
  pending → confirmed → preparing → ready_for_pickup → out_for_delivery → delivered
                  ↓
              cancelled
  ```

#### 4. Payment Service
- **Purpose**: Process payments
- **Features**:
  - PayPal integration
  - Refund processing
  - Transaction history
- **Integrations**: PayPal Server SDK

#### 5. Live Order Tracking Service
- **Purpose**: Real-time order and delivery tracking
- **Features**:
  - WebSocket connections
  - GPS location updates
  - ETA calculations
  - Push notifications

---

## Database Design

### Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    users     │       │  restaurants │       │menu_categories│
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)      │───┐   │ id (PK)      │───┐   │ id (PK)      │
│ email        │   │   │ owner_id(FK) │←──┘   │restaurant_id │←─┐
│ first_name   │   │   │ name         │       │ name         │  │
│ last_name    │   │   │ cuisine      │       │ sort_order   │  │
│ role         │   │   │ address      │       └──────┬───────┘  │
│ phone        │   │   │ rating       │              │          │
│ address      │   │   └──────────────┘              │          │
└──────────────┘   │                                 │          │
                   │   ┌──────────────┐              │          │
                   │   │  menu_items  │              │          │
                   │   ├──────────────┤              │          │
                   │   │ id (PK)      │              │          │
                   │   │restaurant_id │←─────────────┼──────────┘
                   │   │ category_id  │←─────────────┘
                   │   │ name         │
                   │   │ price        │
                   │   │ is_available │
                   │   └──────────────┘
                   │
┌──────────────┐   │   ┌──────────────┐
│    orders    │   │   │ order_items  │
├──────────────┤   │   ├──────────────┤
│ id (PK)      │───┼──▶│ order_id(FK) │
│ customer_id  │←──┘   │menu_item_id  │
│restaurant_id │       │ quantity     │
│ status       │       │ unit_price   │
│ total        │       └──────────────┘
│delivery_addr │
└──────────────┘

┌──────────────┐       ┌──────────────┐
│delivery_partn│       │   coupons    │
├──────────────┤       ├──────────────┤
│ id (PK)      │       │ id (PK)      │
│ user_id (FK) │       │ code         │
│ vehicle_type │       │ discount_pct │
│ status       │       │ min_order    │
│ rating       │       │ max_discount │
│ total_deliv. │       │ valid_from   │
└──────────────┘       │ valid_until  │
                       └──────────────┘
```

### Key Tables

#### Users Table
```sql
CREATE TABLE users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR UNIQUE,
  first_name VARCHAR,
  last_name VARCHAR,
  profile_image_url VARCHAR,
  role user_role DEFAULT 'customer' NOT NULL,
  phone VARCHAR,
  address TEXT,
  city VARCHAR,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Orders Table
```sql
CREATE TABLE orders (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id VARCHAR REFERENCES users(id) NOT NULL,
  restaurant_id VARCHAR REFERENCES restaurants(id) NOT NULL,
  delivery_partner_id VARCHAR REFERENCES delivery_partners(id),
  status order_status DEFAULT 'pending' NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  delivery_fee DECIMAL(10, 2) NOT NULL,
  tax DECIMAL(10, 2) DEFAULT 0,
  discount DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  delivery_address TEXT NOT NULL,
  special_instructions TEXT,
  estimated_delivery_time TIMESTAMP,
  actual_delivery_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Indexes

```sql
-- Session expiry index
CREATE INDEX idx_session_expire ON sessions(expire);

-- Order lookups
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX idx_orders_status ON orders(status);

-- Restaurant search
CREATE INDEX idx_restaurants_cuisine ON restaurants(cuisine);
CREATE INDEX idx_restaurants_city ON restaurants(city);
CREATE INDEX idx_restaurants_active ON restaurants(is_active);
```

---

## API Design

### RESTful Endpoints

#### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/send-otp` | Send OTP to phone |
| POST | `/api/auth/verify-otp` | Verify OTP code |
| GET | `/api/auth/google` | Google OAuth redirect |
| GET | `/api/auth/google/callback` | OAuth callback |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/logout` | End session |

#### Restaurants
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/restaurants` | List all restaurants |
| GET | `/api/restaurants/search` | Search restaurants |
| GET | `/api/restaurants/:id` | Get restaurant details |
| GET | `/api/restaurants/:id/menu` | Get menu items |
| GET | `/api/restaurants/:id/categories` | Get categories |
| POST | `/api/restaurants` | Create restaurant (owner) |
| PATCH | `/api/restaurants/:id` | Update restaurant |

#### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/orders` | Get user's orders |
| GET | `/api/orders/:id` | Get order details |
| POST | `/api/orders` | Create new order |
| PATCH | `/api/orders/:id/status` | Update order status |
| POST | `/api/orders/:id/assign-delivery` | Assign delivery |

#### Delivery
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/delivery-partner` | Get partner profile |
| PATCH | `/api/delivery-partner` | Update status |
| POST | `/api/delivery-partner/location` | Update location |

### Request/Response Format

#### Create Order Request
```json
POST /api/orders
Content-Type: application/json

{
  "restaurantId": "abc123",
  "items": [
    {
      "menuItemId": "item1",
      "quantity": 2,
      "specialInstructions": "No onions"
    }
  ],
  "deliveryAddress": "123 Main St, City",
  "specialInstructions": "Ring doorbell",
  "couponCode": "SAVE10",
  "idempotencyKey": "order-1701936000-abc123"
}
```

#### Order Response
```json
{
  "id": "order123",
  "status": "pending",
  "restaurantId": "abc123",
  "customerId": "user456",
  "items": [...],
  "subtotal": "25.00",
  "deliveryFee": "2.99",
  "discount": "2.50",
  "total": "25.49",
  "deliveryAddress": "123 Main St, City",
  "estimatedDeliveryTime": "2024-12-07T14:30:00Z",
  "createdAt": "2024-12-07T14:00:00Z"
}
```

### WebSocket Events

```typescript
// Client connects
ws://localhost:5000/ws?userId=user123

// Server sends order updates
{
  "type": "order_update",
  "data": {
    "orderId": "order123",
    "status": "preparing",
    "timestamp": "2024-12-07T14:05:00Z"
  }
}

// Server sends location updates
{
  "type": "location_update",
  "data": {
    "orderId": "order123",
    "deliveryPartnerId": "driver456",
    "latitude": "40.7128",
    "longitude": "-74.0060",
    "eta": "10 minutes"
  }
}
```

---

## Infrastructure Components

### 1. Event Bus

In-memory publish/subscribe system for service communication:

```typescript
class EventBus {
  private subscriptions: Map<string, EventSubscription[]>;
  private eventLog: Array<EventRecord>;

  subscribe<T>(eventType: string, handler: EventHandler<T>): string;
  unsubscribe(subscriptionId: string): void;
  publish(eventType: string, data: unknown, source: string): void;
  getRecentEvents(count?: number): EventRecord[];
}

// Usage
eventBus.subscribe(EventTypes.ORDER_CREATED, async (data, metadata) => {
  console.log(`Order ${data.orderId} created at ${metadata.timestamp}`);
  await notificationService.notifyRestaurant(data);
});
```

### 2. Cache Layer

In-memory caching with TTL support:

```typescript
class InMemoryCache {
  async get<T>(key: string): Promise<T | null>;
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttl: number): Promise<T>;
  async invalidate(key: string): Promise<void>;
  async invalidatePattern(pattern: string): Promise<void>;
}

// Usage
const restaurants = await cache.getOrSet(
  "restaurants:all",
  () => storage.getRestaurants(),
  300  // 5 minutes TTL
);
```

### 3. Logger

Structured logging with correlation ID support:

```typescript
const logger = {
  info: (message: string, context?: object) => void;
  warn: (message: string, context?: object) => void;
  error: (message: string, context?: object) => void;
  debug: (message: string, context?: object) => void;
};

// Output format
// 2024-12-07T14:00:00.000Z INFO [order-service] Order created {"orderId":"123","correlationId":"abc"}
```

### 4. Metrics

Application performance monitoring:

```typescript
const metrics = {
  increment(name: string): void;
  gauge(name: string, value: number): void;
  timing(name: string, duration: number): void;
  getMetrics(): MetricsSummary;
};

// Tracked metrics
// - http_requests_total
// - http_request_duration_ms
// - order_created_total
// - cache_hit_rate
```

### 5. Rate Limiter

Request rate limiting per client:

```typescript
const rateLimiter = createRateLimiter({
  windowMs: 60000,     // 1 minute window
  maxRequests: 100,    // 100 requests per window
  keyGenerator: (req) => req.ip
});

// Different limits for different endpoints
const authRateLimiter = createRateLimiter({ maxRequests: 5 });    // Strict
const apiRateLimiter = createRateLimiter({ maxRequests: 100 });   // Normal
const orderRateLimiter = createRateLimiter({ maxRequests: 10 });  // Moderate
```

---

## Security

### Authentication Flow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Client  │───▶│ Gateway  │───▶│Auth Svc  │───▶│ Database │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │
     │  1. Login     │               │               │
     │──────────────▶│  2. Validate  │               │
     │               │──────────────▶│  3. Check    │
     │               │               │──────────────▶│
     │               │               │◀──────────────│
     │               │◀──────────────│  4. Create   │
     │  5. Session   │               │    Session   │
     │◀──────────────│               │               │
     │               │               │               │
     │  6. Request   │  7. Verify    │               │
     │  + Cookie     │    Session    │               │
     │──────────────▶│──────────────▶│               │
```

### Security Measures

1. **Session Security**
   - HTTP-only cookies
   - Secure flag in production
   - Session stored in PostgreSQL
   - 24-hour session expiry

2. **Input Validation**
   - Zod schemas for all inputs
   - SQL injection prevention via Drizzle ORM
   - XSS protection

3. **Rate Limiting**
   - Per-IP rate limiting
   - Stricter limits on auth endpoints
   - DDoS protection

4. **CORS Configuration**
   - Whitelist allowed origins
   - Credentials support

---

## Performance

### Caching Strategy

| Data | TTL | Invalidation |
|------|-----|--------------|
| Restaurant list | 5 min | On update |
| Menu items | 5 min | On update |
| Single restaurant | 5 min | On update |
| User session | 24 hr | On logout |

### Database Optimization

- **Connection Pooling**: Drizzle with postgres.js
- **Indexes**: On frequently queried columns
- **Query Optimization**: Select only needed fields

### Frontend Optimization

- **Code Splitting**: Vite dynamic imports
- **Lazy Loading**: Route-based splitting
- **State Management**: Zustand (lightweight)
- **Data Fetching**: TanStack Query with caching

---

## Deployment

### Environment Configuration

```bash
# Production
NODE_ENV=production
PORT=5000
DATABASE_URL=postgres://user:pass@host:5432/db
SESSION_SECRET=<secure-random-string>

# OAuth
GOOGLE_CLIENT_ID=<client-id>
GOOGLE_CLIENT_SECRET=<client-secret>
```

### Build Process

```bash
# Build frontend and backend
npm run build

# Output: dist/index.cjs (bundled server + static files)

# Run production
npm run start
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 5000
CMD ["node", "dist/index.cjs"]
```

### Health Checks

```bash
# Platform health
GET /api/health

# Response
{
  "status": "healthy",
  "services": [
    { "name": "auth-service", "status": "healthy" },
    { "name": "order-service", "status": "healthy" },
    ...
  ],
  "uptime": 86400,
  "timestamp": "2024-12-07T14:00:00Z"
}
```

---

## Monitoring & Observability

### Logging

- Structured JSON logs
- Correlation IDs for request tracing
- Log levels: DEBUG, INFO, WARN, ERROR

### Metrics Endpoint

```bash
GET /api/metrics

# Response
{
  "http_requests_total": 10000,
  "http_request_duration_avg_ms": 45,
  "cache_hit_rate": 0.85,
  "active_orders": 150,
  "uptime_seconds": 86400
}
```

### Alerting Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Error rate | > 1% | > 5% |
| Latency p99 | > 500ms | > 2s |
| CPU usage | > 70% | > 90% |
| Memory usage | > 80% | > 95% |

---

## Future Enhancements (Now Implemented)

The following advanced features have been implemented to support enterprise-scale operations:

### 1. Redis Cache - Distributed Caching

**Location**: `server/infrastructure/redisCache.ts`

A production-ready distributed caching layer with:

```typescript
// Features
- Redis connection with automatic reconnection
- Cluster mode support for multi-region
- Fallback to in-memory cache when Redis unavailable
- Pub/Sub for cache invalidation across nodes
- Distributed locking (prevent thundering herd)
- Hash, List, Sorted Set operations
- L1 (local) + L2 (Redis) cache hierarchy

// Usage
import { distributedCache, RedisCacheKeys } from "./infrastructure/redisCache";

// Get or set with automatic caching
const restaurants = await distributedCache.getOrSet(
  RedisCacheKeys.restaurants(),
  () => db.select().from(restaurantsTable),
  300 // TTL in seconds
);

// Distributed lock for critical sections
await distributedCache.withLock("order-123", async () => {
  await processOrder(orderId);
}, { ttlMs: 5000 });

// Global cache invalidation
await distributedCache.invalidatePattern("restaurants:*");
```

**Configuration (Environment Variables)**:
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=secret
REDIS_CLUSTER=true  # Enable cluster mode
REDIS_TLS=true      # Enable TLS
```

---

### 2. Message Queue - RabbitMQ/Kafka Support

**Location**: `server/infrastructure/messageQueue.ts`

Enterprise message queue abstraction supporting multiple backends:

```typescript
// Supported Backends
- RabbitMQ (AMQP)
- Apache Kafka
- Amazon SQS
- Azure Service Bus
- In-memory (development)

// Features
- Guaranteed message delivery
- Dead letter queues
- Automatic retries with exponential backoff
- Consumer groups
- Message acknowledgment
- Batch processing

// Usage
import { messageQueue, QueueTopics } from "./infrastructure/messageQueue";

// Publish a message
await messageQueue.publish(
  QueueTopics.ORDER_CREATED,
  "order.new",
  { orderId: "123", total: 45.99 },
  { priority: 1, persistent: true }
);

// Subscribe to messages
await messageQueue.subscribe(
  QueueTopics.ORDER_CREATED,
  async (message, ack, nack) => {
    try {
      await processOrder(message.payload);
      ack(); // Acknowledge successful processing
    } catch (error) {
      nack(true); // Requeue for retry
    }
  }
);

// Dead letter reprocessing
await messageQueue.reprocessDeadLetters("dlq.orders");
```

**Queue Topics**:
```typescript
QueueTopics = {
  ORDER_EVENTS, ORDER_CREATED, ORDER_UPDATED, ORDER_CANCELLED,
  PAYMENT_EVENTS, PAYMENT_COMPLETED, PAYMENT_FAILED,
  DELIVERY_EVENTS, DELIVERY_ASSIGNED, DELIVERY_COMPLETED,
  NOTIFICATION_EVENTS, NOTIFICATION_EMAIL, NOTIFICATION_SMS,
  ANALYTICS_EVENTS, USER_ACTION, SYSTEM_METRIC,
  DLQ_ORDERS, DLQ_PAYMENTS, DLQ_NOTIFICATIONS,
}
```

---

### 3. GraphQL Gateway (Enhanced)

**Location**: `server/microservices/graphql/GraphQLBFF.ts`

Full GraphQL BFF (Backend for Frontend) implementation:

```graphql
# Schema includes
type Query {
  # Restaurants
  restaurants(filter: RestaurantFilter): [Restaurant!]!
  restaurant(id: ID!): Restaurant
  searchRestaurants(query: String!): SearchResult!
  
  # Orders
  orders: [Order!]!
  order(id: ID!): Order
  
  # User
  me: User
  myOrders: [Order!]!
  
  # Recommendations (ML-powered)
  recommendedRestaurants(location: GeoInput!): [Restaurant!]!
  recommendedItems(restaurantId: ID!): [MenuItem!]!
}

type Mutation {
  createOrder(input: CreateOrderInput!): Order!
  updateOrderStatus(id: ID!, status: OrderStatus!): Order!
  addToCart(item: CartItemInput!): Cart!
  applyCoupon(code: String!): CouponResult!
}

type Subscription {
  orderStatusChanged(orderId: ID!): OrderUpdate!
  deliveryLocationUpdated(orderId: ID!): LocationUpdate!
}
```

---

### 4. Machine Learning Service

**Location**: `server/microservices/ml/MachineLearningService.ts`

Production ML service with multiple capabilities:

```typescript
import { mlService } from "./microservices/ml/MachineLearningService";

// 1. Restaurant Recommendations
const recommendations = await mlService.getRestaurantRecommendations(
  userId,
  { latitude: 40.7128, longitude: -74.0060 },
  10 // limit
);
// Returns: [{ id, name, score, reason, confidence, metadata }]

// 2. Menu Item Recommendations (Collaborative Filtering)
const items = await mlService.getMenuItemRecommendations(
  userId,
  restaurantId,
  5
);

// 3. ETA Prediction
const eta = await mlService.predictETA(
  restaurantId,
  customerLocation,
  orderItems
);
// Returns: { estimatedMinutes, confidence, factors, range: { min, max } }

// 4. Demand Forecasting
const forecast = await mlService.forecastDemand(
  restaurantId,
  ["12:00", "13:00", "14:00", "19:00", "20:00"]
);
// Returns: [{ timeSlot, predictedOrders, confidence, trend }]

// 5. Fraud Detection
const fraudScore = await mlService.calculateFraudScore({
  userId: "user-123",
  total: 150,
  paymentMethod: "card",
  deliveryAddress: "123 Main St",
});
// Returns: { score, risk, flags, recommendation }

// 6. Dynamic Pricing Suggestions
const pricing = await mlService.getPricingSuggestions(restaurantId);
// Returns: [{ itemId, currentPrice, suggestedPrice, reason, expectedImpact }]
```

**ML Algorithms Used**:
- Collaborative Filtering (Item-Item Similarity)
- Content-Based Filtering
- Cosine Similarity
- Haversine Distance Formula
- Time Series Forecasting

---

### 5. Multi-Region Distribution

**Location**: `server/infrastructure/multiRegion.ts`

Geographic distribution with automatic failover:

```typescript
import { multiRegionManager } from "./infrastructure/multiRegion";

// Regions Supported
// - us-east-1 (Primary - Virginia)
// - us-west-2 (Oregon)
// - eu-west-1 (Ireland)
// - ap-south-1 (Mumbai)
// - ap-northeast-1 (Tokyo)

// 1. Latency-Based Routing
const decision = await multiRegionManager.routeRequest({
  latitude: 51.5074,
  longitude: -0.1278, // London
});
// Returns: { selectedRegion: eu-west-1, latency: 25ms, fallbackRegions }

// 2. Get Current Region
const region = multiRegionManager.getCurrentRegion();

// 3. Read/Write Splitting
const writeEndpoint = multiRegionManager.getWriteEndpoint(); // Always primary
const readEndpoint = multiRegionManager.getReadEndpoint();   // Local replica

// 4. Automatic Failover
await multiRegionManager.failover("Primary region degraded");

// 5. Global Cache Invalidation
await multiRegionManager.invalidateCacheGlobally("restaurants:*");

// 6. Feature Flags per Region
const gdprEnabled = multiRegionManager.isFeatureEnabled("gdpr");

// 7. Replication Status
const status = multiRegionManager.getReplicationStatus();
// Returns: { sourceRegion, targetRegions: [{ id, lag, status }] }
```

**Region Configuration**:
```typescript
interface Region {
  id: string;               // "us-east-1"
  isPrimary: boolean;       // Write region
  endpoints: {
    api: string;            // Regional API endpoint
    websocket: string;      // WebSocket endpoint
    database: { read, write };
    cache: string;          // Redis cluster
    messageQueue: string;   // RabbitMQ/Kafka
  };
  config: {
    maxLatencyMs: number;
    failoverRegions: string[];
    replicationLag: number;
    features: string[];     // ["gdpr", "ml"]
    rateLimits: { requestsPerSecond, burstSize };
  };
}
```

---

### 6. Kubernetes Deployment (Ready)

Docker and Kubernetes configurations for deployment:

```yaml
# docker-compose.yml (Multi-service)
services:
  api:
    build: .
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - MQ_HOST=rabbitmq
    depends_on:
      - postgres
      - redis
      - rabbitmq

  postgres:
    image: postgres:15
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes

  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"
      - "15672:15672"
```

```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fooddash-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: fooddash-api
  template:
    spec:
      containers:
      - name: api
        image: fooddash/api:latest
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        readinessProbe:
          httpGet:
            path: /api/health
            port: 5000
        livenessProbe:
          httpGet:
            path: /api/health
            port: 5000
```

---

## Infrastructure Summary

| Component | Implementation | Status |
|-----------|---------------|--------|
| Distributed Cache | Redis with L1/L2 hierarchy | ✅ Implemented |
| Message Queue | RabbitMQ/Kafka abstraction | ✅ Implemented |
| GraphQL Gateway | Full BFF with subscriptions | ✅ Implemented |
| ML Service | Recommendations, ETA, Fraud | ✅ Implemented |
| Multi-Region | 5 regions, auto-failover | ✅ Implemented |
| Kubernetes | Deployment configs ready | ✅ Ready |

---

## Architecture Diagram (Updated)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           GLOBAL LAYER                                   │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    CDN / Edge Network                               │ │
│  │  (CloudFlare, CloudFront, Fastly)                                  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        MULTI-REGION LAYER                                │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐           │
│  │ US-East-1 │  │ US-West-2 │  │ EU-West-1 │  │ AP-South-1│           │
│  │ (Primary) │  │ (Replica) │  │ (Replica) │  │ (Replica) │           │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘           │
└────────┼──────────────┼──────────────┼──────────────┼───────────────────┘
         │              │              │              │
         └──────────────┴──────┬───────┴──────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────────┐
│                      API GATEWAY LAYER                                   │
│  ┌───────────────────────────┴────────────────────────────────────────┐ │
│  │                    Load Balancer (Kubernetes)                       │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │ │
│  │  │Rate Limit│ │   Auth   │ │Correlation│ │ GraphQL  │              │ │
│  │  │  (Redis) │ │Middleware│ │    ID    │ │  Gateway │              │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘              │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────────┐
│                    MICROSERVICES LAYER (K8s Pods)                        │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │
│  │  Auth  │ │Restaur.│ │  Menu  │ │ Order  │ │Delivery│ │Payment │    │
│  │Service │ │Service │ │Service │ │Service │ │Service │ │Service │    │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘    │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │
│  │Notific.│ │ Search │ │Analytic│ │  Admin │ │   ML   │ │  SAP   │    │
│  │Service │ │Service │ │Service │ │Service │ │Service │ │Service │    │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘    │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────────┐
│                    MESSAGE QUEUE LAYER                                   │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │              RabbitMQ / Apache Kafka Cluster                        │ │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐      │ │
│  │  │   Orders   │ │  Payments  │ │  Delivery  │ │   Events   │      │ │
│  │  │   Queue    │ │   Queue    │ │   Queue    │ │   Stream   │      │ │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘      │ │
│  │  ┌────────────────────────────────────────────────────────┐       │ │
│  │  │              Dead Letter Queues (DLQ)                   │       │ │
│  │  └────────────────────────────────────────────────────────┘       │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────────┐
│                     DATA LAYER                                           │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐   │
│  │  PostgreSQL       │  │  Redis Cluster    │  │  ML Models        │   │
│  │  (Primary + Read  │  │  (L2 Cache +      │  │  (Recommendations │   │
│  │   Replicas)       │  │   Session Store)  │  │   ETA, Fraud)     │   │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```
