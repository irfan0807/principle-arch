# FoodDash — System Design Interview Q&A (50 Questions)

## For 6+ Years Fullstack Engineer | HLD · LLD · Scalability · Distributed Systems

> **Project**: FoodDash — Production-Grade Food Delivery Platform  
> **Architecture**: Microservices + Event-Driven + CQRS + Saga + Hexagonal Architecture  
> **Infrastructure**: Event Bus, L1/L2 Cache, Circuit Breaker, Rate Limiter, Message Queue, Service Registry, Multi-Region  
> **Last Updated**: February 2026

---

## Q1: How would you design a food delivery system like FoodDash from scratch? Walk through the High-Level Design (HLD).

**Answer:**

**Step 1 — Requirements Gathering:**

*Functional:*
- Customers browse restaurants, view menus, place orders, track delivery in real-time
- Restaurant owners manage menus, accept/reject orders, view analytics
- Delivery partners go online/offline, accept deliveries, share live location
- Admin manages users, restaurants, coupons, disputes

*Non-Functional:*
- **Latency**: Order placement < 500ms, search < 200ms
- **Availability**: 99.9% uptime (< 8.7 hours downtime/year)
- **Scalability**: Handle 10K concurrent orders, 100K daily users
- **Consistency**: Order state must be strongly consistent. Restaurant catalog can be eventually consistent.

**Step 2 — Capacity Estimation:**
```
Daily Active Users:     100,000
Orders per day:         50,000
Peak orders per minute: ~500 (lunch/dinner rush)
Average order size:     3 items
Storage per order:      ~2KB
Daily storage:          100MB
Annual storage:         ~36GB
```

**Step 3 — High-Level Architecture:**
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Mobile /   │────▶│  API Gateway │────▶│  Load        │
│   Web Client │     │  (Rate Limit,│     │  Balancer    │
└──────────────┘     │  Auth, CORS) │     └──────┬───────┘
                     └──────────────┘            │
                                                 ▼
┌────────────────────────────────────────────────────────────┐
│                   MICROSERVICES LAYER                       │
│  ┌─────┐ ┌──────┐ ┌──────┐ ┌────────┐ ┌────────┐         │
│  │Auth │ │Restau│ │Order │ │Payment │ │Delivery│         │
│  │Svc  │ │Svc   │ │Svc   │ │Svc     │ │Svc     │  ...   │
│  └─────┘ └──────┘ └──────┘ └────────┘ └────────┘         │
└────────────────────────┬───────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   ┌───────────┐  ┌───────────┐  ┌───────────┐
   │ Event Bus │  │   Cache   │  │  Message   │
   │ (Pub/Sub) │  │ (L1/L2)  │  │   Queue    │
   └───────────┘  └───────────┘  └───────────┘
          │              │              │
          ▼              ▼              ▼
   ┌─────────────────────────────────────────┐
   │         DATA LAYER                       │
   │  PostgreSQL (Primary + Read Replicas)    │
   │  Redis Cluster (Cache + Sessions)        │
   │  Elasticsearch (Search)                  │
   └─────────────────────────────────────────┘
```

**Step 4 — Key Design Decisions:**
- **Microservices** — Each domain (auth, order, payment, delivery) is a separate service with independent database
- **Event-Driven** — Services communicate via events for loose coupling
- **CQRS** — Separate read/write models for order service (high read, complex writes)
- **Saga Pattern** — Distributed transactions across order-payment-delivery
- **WebSocket** — Real-time order tracking without polling

---

## Q2: Explain the Microservices architecture of FoodDash. Why microservices over monolith?

**Answer:**

FoodDash has **16 microservices**, each owning a bounded context:

| # | Service | Responsibility | Key Pattern |
|---|---------|---------------|-------------|
| 1 | AuthIdentityService | Authentication, JWT, RBAC/ABAC | OAuth 2.0, Multi-provider |
| 2 | RestaurantService | Restaurant CRUD, search, geo-queries | CQRS, Cache-Aside, Haversine |
| 3 | MenuService | Menu categories & items CRUD, filters | Database-per-Service |
| 4 | OrderService | Order lifecycle, status FSM, audit trail | CQRS, Event Sourcing, Saga |
| 5 | SagaOrchestrator | Distributed transaction coordination | Saga, Compensation |
| 6 | DeliveryPartnerService | Partner management, auto-assignment | Geo-Spatial, Real-Time |
| 7 | PaymentService | Multi-provider payments, refunds | Strategy, Idempotency |
| 8 | NotificationService | Push/Email/SMS/In-App notifications | Template, Priority Queue, DLQ |
| 9 | SearchDiscoveryService | Full-text search, autocomplete, trending | Faceted Search, Geo-Spatial |
| 10 | OffersCouponService | Coupon validation, usage tracking | Abuse Prevention |
| 11 | AnalyticsService | Platform/order/revenue analytics | CQRS Read Model, Time-Series |
| 12 | AdminService | User/restaurant moderation, config | Audit Logging, RBAC |
| 13 | GraphQLBFF | API aggregation for frontend | BFF Pattern |
| 14 | MachineLearningService | Recommendations, ETA, fraud, pricing | Collaborative Filtering |
| 15 | SAPIntegrationService | ERP integration for vendors/finance | Anti-Corruption Layer |
| 16 | LiveOrderTrackingService | Real-time tracking, ETA, timeline | Observer, Materialized View |

**Why microservices over monolith:**

| Concern | Monolith | Microservices (FoodDash) |
|---------|----------|-------------------------|
| **Deployment** | One deploy affects everything | Deploy payment fix without touching order service |
| **Scaling** | Scale entire app | Scale only the order service during peak hours |
| **Technology** | One tech stack | ML service could use Python, others use Node.js |
| **Fault isolation** | One bug crashes everything | Payment service failure doesn't break restaurant browsing |
| **Team ownership** | Everyone touches everything | Team A owns orders, Team B owns payments |

**FoodDash's pragmatic approach — Modular Monolith:**
FoodDash actually starts as a **modular monolith** — all services run in-process but follow microservice boundaries. Each service:
- Communicates via the in-memory Event Bus (extractable to Kafka)
- Has independent health checks
- Can be extracted to a separate process without code changes

This avoids the operational complexity of distributed systems (service mesh, distributed tracing infra, container orchestration) while maintaining clean boundaries.

---

## Q3: What is CQRS (Command Query Responsibility Segregation) and how does FoodDash implement it?

**Answer:**

CQRS separates read and write models into different paths:

```
COMMAND SIDE (Writes)                    QUERY SIDE (Reads)
─────────────────────                    ────────────────────
createOrder()                            getOrder()
updateOrderStatus()                      getOrderWithDetails()
cancelOrder()                            queryOrders()
        │                                        │
        ▼                                        ▼
   Write Model                              Read Model
   (Normalized DB)                          (Cache + Denormalized Views)
        │                                        ▲
        └────── Events ──────────────────────────┘
```

**FoodDash OrderService implementation:**

**Command Side:**
```typescript
createOrder() → Idempotency Check → Saga Orchestrator
  ├── Step 1: validate_order (check restaurant active)
  ├── Step 2: create_order (persist to DB + event log)
  ├── Step 3: process_payment (publish payment event)
  └── Step 4: notify_restaurant (publish order event)
  
On failure → Compensate in reverse:
  ├── Refund payment
  └── Cancel order record
```

**Query Side:**
```
getOrder()            → Cache (1 min TTL) → Database
getOrderWithDetails() → Cache (30s TTL) → Aggregate from 3 tables
queryOrders()         → Filter + Sort in memory
```

**Why CQRS for orders:**
1. **Reads vastly outnumber writes** — Customers check order status 10x more than creating orders.
2. **Different optimization needs** — Writes need strong consistency + event sourcing. Reads need speed + denormalization.
3. **Independent scaling** — Read replicas handle query load without affecting write performance.
4. **Cache optimization** — Read model served from cache with TTL; write model always hits the database.

**When NOT to use CQRS:** Restaurant CRUD — simple read/write ratio doesn't justify the complexity.

---

## Q4: Explain the Saga Pattern. How does FoodDash handle distributed transactions?

**Answer:**

The Saga pattern breaks a distributed transaction into a sequence of local transactions, each with a compensating action for rollback:

```
┌─────────────────────────────────────────────────────┐
│              SAGA: Place Order                        │
│                                                       │
│  Step 1: Validate Order                              │
│    Execute: Check restaurant active, items available │
│    Compensate: (nothing to undo)                     │
│                                                       │
│  Step 2: Create Order                                │
│    Execute: Insert order + items into DB             │
│    Compensate: Cancel order, set status=cancelled    │
│                                                       │
│  Step 3: Process Payment                             │
│    Execute: Charge customer via PayPal               │
│    Compensate: Issue refund                          │
│                                                       │
│  Step 4: Notify Restaurant                           │
│    Execute: Send order notification                  │
│    Compensate: Send cancellation notification        │
└─────────────────────────────────────────────────────┘
```

**FoodDash SagaOrchestrator implementation:**

```typescript
class SagaOrchestrator {
  async execute(sagaName: string, context: any): Promise<SagaResult> {
    const saga = this.sagas.get(sagaName);
    const completedSteps: CompletedStep[] = [];

    for (const step of saga.steps) {
      try {
        const result = await this.withTimeout(
          this.withRetry(
            () => step.execute(context),
            step.retries || 3
          ),
          step.timeout || 30000
        );
        completedSteps.push({ step, result });
      } catch (error) {
        // COMPENSATE in reverse order
        for (const completed of completedSteps.reverse()) {
          try {
            await completed.step.compensate(context, completed.result);
          } catch (compError) {
            // Log but continue — best-effort compensation
            this.logger.error("Compensation failed", { step, error: compError });
          }
        }
        return { success: false, error, compensatedSteps: completedSteps.length };
      }
    }
    return { success: true, data: context };
  }
}
```

**Key design decisions:**
1. **Orchestration-based** (not Choreography) — A central orchestrator controls the flow, making it easier to monitor and debug.
2. **Per-step timeout** — Payment gets 30s, validation gets 10s.
3. **Per-step retries** — 3 retries with exponential backoff.
4. **Best-effort compensation** — If compensation fails, log and continue (don't let one failed rollback block others).
5. **Idempotent operations** — Each step is idempotent to handle retry safety.

**Saga vs 2PC (Two-Phase Commit):**
- 2PC requires all participants to lock resources simultaneously — doesn't scale in microservices.
- Saga uses eventual consistency — each step commits independently, compensation handles failures.
- Tradeoff: Saga allows intermediate inconsistent states (order exists but payment not yet processed).

---

## Q5: How does the Event-Driven Architecture work in FoodDash?

**Answer:**

FoodDash uses an **Event Bus** (Pub/Sub backbone) with **42 event types** across 8 domains:

```
ORDER_CREATED → NotificationService → sends notification to restaurant
              → AnalyticsService    → records order metric
              → DeliveryService     → initiates partner assignment
              → SAPService          → creates SAP sales order

ORDER_STATUS_CHANGED → WebSocket handler → broadcasts to customer, restaurant, driver
                     → LiveTrackingService → updates materialized tracking view
                     → AnalyticsService    → updates order funnel metrics

PAYMENT_SUCCESS → OrderService → advances order to "confirmed"
               → SAPService   → creates finance document
```

**Event Bus implementation:**
```typescript
class EventBus {
  subscribe(eventType: string, handler: EventHandler): string;    // Returns subscription ID
  publish(eventType: string, data: any, correlationId: string): Promise<void>;
  unsubscribe(subscriptionId: string): void;
  getEventLog(eventType?: string, limit?: number): EventLog[];
}
```

**Production features:**
- **Wildcard subscriptions**: `subscribe("*", handler)` captures all events for monitoring.
- **Event log**: Last 1000 events stored in memory for debugging.
- **Correlation ID propagation**: Every event carries its correlation context for distributed tracing.
- **Error isolation**: A failed handler doesn't block other subscribers.

**Why Event-Driven:**
1. **Loose coupling** — OrderService doesn't know or care about NotificationService.
2. **Extensibility** — Add a new analytics consumer without modifying the producer.
3. **Resilience** — Temporary service outages don't block the main flow. Events are queued.
4. **Scalability** — Consumers can be scaled independently based on their workload.

**Current vs At-Scale:**
| Current | At Scale |
|---------|----------|
| In-process pub/sub | Apache Kafka (persistent, distributed) |
| In-memory event log | Kafka topic retention (7 days) |
| Single-node | Multi-partition, consumer groups |

---

## Q6: How would you design the real-time order tracking system?

**Answer:**

**Requirements:**
- Customer sees live order status: Pending → Confirmed → Preparing → Ready → Out for Delivery → Delivered
- Customer sees delivery partner's live GPS location on a map
- ETA updates dynamically based on driver location
- Low latency (< 1s for status updates, < 3s for location updates)

**Architecture:**

```
┌──────────────┐    WebSocket    ┌──────────────────┐
│   Customer   │◄───────────────│  WebSocket Server │
│   (Browser)  │                │  (ws library)     │
└──────────────┘                └────────┬──────────┘
                                         │
                                         │ subscribes to
                                         ▼
┌──────────────┐    HTTP POST   ┌──────────────────┐
│   Delivery   │───────────────▶│  Tracking Service │
│   Partner    │  GPS location  │  (Event Bus sub) │
│   (App)      │  every 5-10s  └────────┬──────────┘
└──────────────┘                         │
                                         │ publishes
                                         ▼
                                ┌──────────────────┐
                                │    Event Bus     │
                                │  RIDER_LOCATION  │
                                │  ORDER_STATUS    │
                                └──────────────────┘
```

**FoodDash LiveOrderTrackingService:**

```typescript
interface TrackingInfo {
  orderId: string;
  currentStatus: string;
  steps: TrackingStep[];              // 6 ordered steps with completion status
  timeline: TimelineEntry[];          // Historical events (Event Sourcing)
  estimatedDelivery: { time: Date; remainingMinutes: number };
  deliveryPartner?: { name, phone, vehicle, rating };
  currentLocation?: { latitude, longitude, heading, speed, updatedAt };
}
```

**WebSocket connection management:**
```typescript
const clients = new Map<string, Set<WebSocket>>();  // userId → Set<WebSocket>

// Supports multiple tabs/devices per user
broadcastToUser(userId, { type: "order_update", data });
broadcastToUser(userId, { type: "location_update", data });

// Automatic cleanup on disconnect
ws.on("close", () => clients.get(userId)?.delete(ws));
```

**ETA Prediction:**
```
ETA = basePrepTime + travelTime + adjustments
  travelTime = distance / avgSpeed (20 km/h)
  adjustments = rushHourFactor (+20%) + weatherFactor (+15%) + restaurantLoadFactor (+5-15%)
```

**Scaling considerations:**
- WebSocket connections are stateful — need sticky sessions or a shared WebSocket gateway.
- At scale, use Redis Pub/Sub for cross-node message distribution.
- Location updates stored in Redis (fast writes, TTL expiry) not PostgreSQL.

---

## Q7: How does the caching strategy work? Explain the L1/L2 cache hierarchy.

**Answer:**

FoodDash uses a two-layer cache hierarchy:

```
Read Request Flow:
─────────────────
Client → L1 Cache (In-Memory) → L2 Cache (Redis) → Database
           Hit? Return              Hit? Populate L1, Return    Populate L1+L2, Return

Write Request Flow:
──────────────────
Client → Database → Invalidate L1 → Invalidate L2 → Pub/Sub to other nodes
```

**L1 Cache (In-Memory):**
```typescript
class InMemoryCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  getOrSet<T>(key: string, fetcher: () => Promise<T>, ttl: number): Promise<T>;  // Cache-aside
  invalidatePattern(pattern: string): Promise<void>;  // Regex-based invalidation
}
```
- Sub-millisecond reads (in-process memory)
- Automatic cleanup every 60 seconds
- Pattern-based invalidation (e.g., `restaurant:*`)

**L2 Cache (Redis):**
```typescript
class DistributedCache {
  get<T>(key: string): Promise<T | null>;                    // L1 → L2 fallback
  set<T>(key: string, value: T, options: CacheOptions): Promise<void>;  // Write L1 + L2
  getOrSetWithLock<T>(key: string, fetcher, options): Promise<T>;  // Distributed lock
  invalidateAcrossNodes(pattern: string): Promise<void>;  // Pub/Sub invalidation
}
```

**Thundering Herd Prevention:**
When cache expires for a popular key (e.g., "all restaurants"), 1000 concurrent requests might all try to fetch from DB simultaneously. Solution:
```typescript
getOrSetWithLock() uses Redis SETNX (distributed lock):
  1. Try to acquire lock: SET key:lock NX EX 5
  2. If acquired → fetch from DB → populate cache → release lock
  3. If not acquired → wait 50ms → retry reading cache (another process is fetching)
```

**TTL Configuration:**

| Resource | Cache TTL | Why |
|----------|----------|-----|
| All restaurants | 5 min | Changes rarely, high read volume |
| Single restaurant | 5-10 min | Moderate change frequency |
| Restaurant menu | 5 min | Items/prices may update |
| Active coupons | 5 min | New coupons added periodically |
| Single order | 1 min | Status changes frequently |
| Order details | 30 sec | Real-time updates needed |
| Restaurant stats | 30 min | Analytics, not time-critical |
| Search index | On change | Must reflect current data |

**Typed Cache Keys:**
```typescript
const CacheKeys = {
  restaurants: () => "restaurants:all",
  restaurant: (id: string) => `restaurant:${id}`,
  restaurantMenu: (id: string) => `restaurant:${id}:menu`,
  userOrders: (userId: string) => `user:${userId}:orders`,
};
```
Typed keys prevent typos and enable consistent invalidation patterns.

---

## Q8: How does the Circuit Breaker pattern work? Why is it essential for microservices?

**Answer:**

A Circuit Breaker prevents cascade failures by stopping calls to a failing downstream service:

```
        ┌─────────┐
        │ CLOSED  │ ◄── Normal operation (requests pass through)
        └────┬────┘
             │ 5 failures within window
        ┌────▼────┐
        │  OPEN   │ ◄── Fail-fast mode (requests rejected immediately)
        │         │     Fallback executed if provided
        └────┬────┘
             │ After 30s timeout
        ┌────▼────┐
        │HALF-OPEN│ ◄── Testing mode (limited requests allowed)
        └────┬────┘
             │ 3 successes → CLOSED
             │ 1 failure  → OPEN
```

**FoodDash implementation:**
```typescript
class CircuitBreaker<T> {
  private state: "closed" | "open" | "half-open" = "closed";
  private failures = 0;
  private options: {
    failureThreshold: 5,
    resetTimeout: 30000,     // 30s before testing
    halfOpenRequests: 3,     // 3 successes to close
  };

  async execute(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() >= this.nextAttempt) {
        this.state = "half-open";
      } else {
        if (fallback) return fallback();
        throw new Error("Circuit breaker is open");
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (fallback) return fallback();
      throw error;
    }
  }
}
```

**FoodDash has multiple circuit breakers with different configurations:**
- `paymentCircuitBreaker`: Threshold 3, reset 60s — More cautious for payments (money involved).
- `externalServiceCircuitBreaker`: Threshold 5, reset 30s — Default for external APIs.

**Why essential:**
Without a circuit breaker, if the Payment service is down:
1. Order service keeps calling it → requests pile up
2. Thread pool exhausted → Order service becomes unresponsive
3. Restaurant service calls Order service → also hangs
4. **Cascade failure** — entire platform goes down

With circuit breaker:
1. After 5 failures, circuit opens
2. Order service returns fallback ("Payment temporarily unavailable") in <1ms
3. Other services continue working normally
4. After 30s, circuit tests if payment is back

---

## Q9: How does the Rate Limiter work? What algorithms exist and which does FoodDash use?

**Answer:**

**Common Rate Limiting Algorithms:**

| Algorithm | How It Works | Pros | Cons |
|-----------|-------------|------|------|
| **Fixed Window** | Count requests per time window | Simple | Burst at window boundary |
| **Sliding Window Log** | Track timestamp of each request | Accurate | Memory-heavy |
| **Sliding Window Counter** | Combine fixed windows with weight | Good balance | Approximate |
| **Token Bucket** | Tokens added at fixed rate, consumed per request | Allows bursts | Complex |
| **Leaky Bucket** | Fixed-rate output queue | Smooth output | Inflexible |

**FoodDash uses Sliding Window Counter:**

```typescript
class RateLimiter {
  private store = new Map<string, { count: number; resetAt: number }>();

  middleware(req, res, next) {
    const key = req.ip;  // Per-IP limiting
    const now = Date.now();
    let entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + this.windowMs };
    }

    entry.count++;
    this.store.set(key, entry);

    // Set rate limit headers (RFC 6585)
    res.setHeader("X-RateLimit-Limit", this.maxRequests);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, this.maxRequests - entry.count));
    res.setHeader("X-RateLimit-Reset", Math.ceil((entry.resetAt - now) / 1000));

    if (entry.count > this.maxRequests) {
      return res.status(429).json({
        error: "Too Many Requests",
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      });
    }
    next();
  }
}
```

**Three tiers in FoodDash:**

| Tier | Limit | Window | Purpose |
|------|-------|--------|---------|
| **API (standard)** | 100 requests | 1 minute | General API protection |
| **Auth (strict)** | 10 requests | 15 minutes | Brute-force prevention |
| **Orders** | 10 requests | 1 minute | Prevent order abuse |

**At scale:** Replace in-memory store with Redis (`INCR` + `EXPIRE`) for distributed rate limiting across multiple API server instances.

---

## Q10: What is the API Gateway pattern and how does FoodDash implement it?

**Answer:**

The API Gateway is a single entry point for all client requests that handles cross-cutting concerns:

```
Client Request
    │
    ├─► Correlation ID Middleware   → Assigns unique tracing ID via AsyncLocalStorage
    │
    ├─► Metrics Middleware          → Records request count, response time, status codes
    │
    ├─► Rate Limiter               → Enforces per-IP request limits
    │
    ├─► Authentication             → Validates JWT/session, attaches user to request
    │
    ├─► Route to Service           → Dispatches to the correct microservice
    │
    └─► Error Handler              → Structured error response with correlation ID
```

**FoodDash's Unified API Router (657 lines):**
```
/api/health              → Health aggregation (all 10+ services)
/api/health/live         → Kubernetes liveness probe
/api/health/ready        → Kubernetes readiness probe
/api/metrics             → Prometheus metrics endpoint
/api/v1/auth/*           → AuthIdentityService
/api/v1/restaurants/*    → RestaurantService
/api/v1/orders/*         → OrderService + SagaOrchestrator
/api/v1/tracking/*       → LiveOrderTrackingService
/api/v1/payments/*       → PaymentService
/api/v1/coupons/*        → OffersCouponService
/api/v1/notifications/*  → NotificationService
/api/v1/search/*         → SearchDiscoveryService
/api/v1/analytics/*      → AnalyticsService
/api/v1/admin/*          → AdminService
/api/v1/delivery-partners/* → DeliveryPartnerService
```

**Benefits:**
1. **Single endpoint** — Clients don't need to know individual service URLs.
2. **Cross-cutting concerns** — Auth, rate limiting, logging applied once, not in every service.
3. **Protocol translation** — REST externally, events internally.
4. **Request aggregation** — GraphQL BFF combines data from multiple services in one response.

---

## Q11: How would you design the database schema for a food delivery platform?

**Answer:**

**Entity-Relationship Model:**
```
users ──┬──< restaurants ──┬──< menu_categories ──< menu_items
        │                  ├──< orders ──┬──< order_items
        │                  │             ├──< order_events (Event Sourcing)
        │                  │             └──── reviews
        │                  └──< coupons
        ├──< delivery_partners ──< orders (via deliveryPartnerId)
        ├──< notifications
        └──── sessions
```

**11 tables with key design decisions:**

| Decision | Implementation | Why |
|----------|---------------|-----|
| **UUID primary keys** | `gen_random_uuid()` | No sequence contention, globally unique across shards |
| **Enums** | `user_role`, `order_status`, `payment_status` | Database-enforced valid values |
| **JSONB** | `session.sess`, `notification.data`, `order_events.data` | Flexible schema for varying payloads |
| **Decimal precision** | `decimal(10,2)` for money, `decimal(10,7)` for geo | No floating-point rounding errors for currency |
| **Soft deletes** | `isActive: false` | Preserves referential integrity, avoids index fragmentation |
| **Idempotency key** | `orders.idempotencyKey UNIQUE` | Prevents duplicate orders from retries |
| **Event sourcing table** | `order_events(orderId, type, data, createdAt)` | Full audit trail, time-travel debugging |

**Indexing Strategy:**
```sql
-- Session cleanup (expires frequently)
CREATE INDEX idx_session_expire ON sessions(expire);

-- Order lookups (most frequent queries)
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX idx_orders_status ON orders(status);

-- Restaurant search
CREATE INDEX idx_restaurants_cuisine ON restaurants(cuisine);
CREATE INDEX idx_restaurants_city ON restaurants(city);
CREATE INDEX idx_restaurants_active ON restaurants(is_active);

-- Full-text search (for restaurant name + cuisine + description)
CREATE INDEX idx_restaurants_search ON restaurants
  USING gin(to_tsvector('english', name || ' ' || cuisine || ' ' || description));

-- Geospatial (for "restaurants near me")
CREATE INDEX idx_restaurants_location ON restaurants
  USING gist(point(longitude, latitude));
```

---

## Q12: How does FoodDash handle idempotency? Why is it critical?

**Answer:**

**Idempotency** means executing the same operation multiple times produces the same result as executing it once.

**Why critical in food delivery:**
- User double-clicks "Place Order" → Should NOT create two orders.
- Network timeout on payment → Client retries → Should NOT charge twice.
- Message queue delivers duplicate event → Should NOT send two notifications.

**FoodDash idempotency implementations:**

| Service | Method | Mechanism |
|---------|--------|-----------|
| OrderService | Idempotency key | In-memory Map keyed by `idempotencyKey` |
| PaymentService | Idempotency key | In-memory Map keyed by `paymentIdempotencyKey` |
| User creation | Upsert | `ON CONFLICT (email) DO UPDATE` |
| Coupon usage | Usage tracking | Check if customer already used coupon |
| Event handlers | Event ID dedup | Check if event ID already processed |

**Order idempotency flow:**
```typescript
async createOrder(command: CreateOrderCommand) {
  // 1. Check idempotency key
  const existing = this.idempotencyStore.get(command.idempotencyKey);
  if (existing) return existing;  // Return previous result

  // 2. Execute order creation
  const order = await this.saga.execute("place_order", command);

  // 3. Store result for future duplicates
  this.idempotencyStore.set(command.idempotencyKey, order);

  return order;
}
```

**Client-side key generation:**
```typescript
const idempotencyKey = `order-${Date.now()}-${userId}-${restaurantId}`;
```

**At scale:** Replace in-memory store with Redis `SETNX` with TTL (e.g., 24 hours) for distributed idempotency.

---

## Q13: Explain Event Sourcing. How does FoodDash use it for orders?

**Answer:**

Event Sourcing stores every state change as an immutable event, rather than just the current state:

```
Traditional:  order.status = "delivered"  (only current state)

Event Sourcing:
  Event 1: ORDER_CREATED      { orderId, items, total }      at 14:00
  Event 2: ORDER_CONFIRMED    { restaurantId, estimatedTime } at 14:02
  Event 3: ORDER_PREPARING    { prepStartTime }              at 14:05
  Event 4: ORDER_READY        { readyTime }                  at 14:25
  Event 5: ORDER_PICKED_UP    { driverId, pickupTime }       at 14:30
  Event 6: ORDER_DELIVERED     { deliveryTime, signature }    at 14:45
```

**FoodDash `order_events` table:**
```sql
CREATE TABLE order_events (
  id VARCHAR PRIMARY KEY,
  orderId VARCHAR REFERENCES orders(id) NOT NULL,
  eventType VARCHAR NOT NULL,
  data JSONB NOT NULL,          -- Event payload (flexible schema)
  createdAt TIMESTAMP NOT NULL
);
```

**Benefits:**
1. **Complete audit trail** — Reconstruct the full history of any order. "Who confirmed this order and when?"
2. **Time-travel debugging** — Replay events to reproduce bugs. "What happened between 2:05 and 2:25?"
3. **Analytics** — Compute average time per state transition. "How long do orders spend in 'preparing'?"
4. **Dispute resolution** — Irrefutable log of what happened. Customer claims food was never delivered → check delivery event with GPS coordinates.
5. **Event replay** — Rebuild read models or feed new consumers by replaying the event log.

**State reconstruction:**
```typescript
function reconstructOrderState(events: OrderEvent[]): Order {
  return events.reduce((order, event) => {
    switch (event.type) {
      case "ORDER_CREATED": return { ...order, ...event.data, status: "pending" };
      case "ORDER_CONFIRMED": return { ...order, status: "confirmed" };
      case "ORDER_PREPARING": return { ...order, status: "preparing" };
      // ...
    }
  }, {} as Order);
}
```

---

## Q14: How does the Order Status State Machine (FSM) work?

**Answer:**

FoodDash enforces strict state transitions to prevent invalid order flows:

```
                ┌─────────┐
        ┌──────▶│ pending │──────────────┐
        │       └────┬────┘              │
        │            │ confirm            │ cancel
        │       ┌────▼─────┐             │
        │       │ confirmed│─────────────┤
        │       └────┬─────┘             │
        │            │ prepare            │
        │       ┌────▼──────┐            │
        │       │ preparing │────────────┤
        │       └────┬──────┘            │
        │            │ ready              │
        │       ┌────▼──────────┐        │
        │       │ready_for_pickup│───────┤
        │       └────┬──────────┘        │
        │            │ pickup             │
        │       ┌────▼───────────┐       │
        │       │out_for_delivery│───────┤
        │       └────┬───────────┘       │
        │            │ deliver            │
        │       ┌────▼─────┐        ┌────▼────┐
        │       │ delivered│        │cancelled│
        │       └──────────┘        └─────────┘
        │       (terminal)          (terminal)
```

**Implementation:**
```typescript
const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending:           ["confirmed", "cancelled"],
  confirmed:         ["preparing", "cancelled"],
  preparing:         ["ready_for_pickup", "cancelled"],
  ready_for_pickup:  ["out_for_delivery", "cancelled"],
  out_for_delivery:  ["delivered", "cancelled"],
  delivered:         [],   // Terminal
  cancelled:         [],   // Terminal
};

function validateTransition(currentStatus: string, newStatus: string): boolean {
  const allowed = ORDER_STATUS_TRANSITIONS[currentStatus];
  return allowed.includes(newStatus);
}
```

**Why this matters:**
- Prevents "pending → delivered" (skipping all intermediate steps).
- Ensures "delivered" and "cancelled" are terminal — no accidental reactivation.
- Each transition triggers events → WebSocket updates → notifications.
- Every transition is recorded in `order_events` (Event Sourcing).

**Role-based transition permissions:**
- Customer: Can only cancel (pending, confirmed states only).
- Restaurant owner: Can confirm, prepare, mark ready.
- Delivery partner: Can mark picked up, delivered.
- Admin: Can force any transition (override).

---

## Q15: How would you design the search and discovery feature?

**Answer:**

**Requirements:**
- Full-text search across restaurant names, cuisines, menu items
- Geo-spatial search ("restaurants near me" within 5km)
- Faceted filtering (cuisine, rating, price range, delivery time)
- Autocomplete/type-ahead suggestions
- Trending/popular restaurants
- Relevance scoring

**FoodDash SearchDiscoveryService architecture:**

```
User Query: "pizza near me"
        │
        ▼
┌──────────────────────────────────┐
│     Search Service (647 lines)    │
│                                    │
│  1. Parse query → extract intent  │
│  2. Geo-filter → within 5km      │
│  3. Full-text → match "pizza"    │
│  4. Score → relevance ranking    │
│  5. Facets → cuisine, rating     │
│  6. Cache → 5 min TTL            │
└──────────────────────────────────┘
```

**Relevance Scoring (Multi-factor):**
```
Score = (0.30 × textRelevance)
      + (0.25 × ratingScore)     // rating / 5.0
      + (0.20 × distanceScore)   // 1 - (distance / maxRadius)
      + (0.15 × popularityScore) // orderCount / maxOrders
      + (0.10 × freshnessScore)  // recently updated bonus
```

**Geo-spatial search (Haversine formula):**
```typescript
function haversineDistance(lat1, lon1, lat2, lon2): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)² + Math.cos(lat1) × Math.cos(lat2) × Math.sin(dLon/2)²;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

**At scale:** Replace in-memory search with Elasticsearch:
- Inverted index for full-text search
- `geo_distance` query for proximity
- `terms` aggregation for faceted counts
- `completion` suggester for autocomplete

---

## Q16: How does the notification system work? How do you handle different channels?

**Answer:**

**FoodDash NotificationService (640 lines) supports 4 channels:**

| Channel | Use Case | Delivery Guarantee |
|---------|----------|-------------------|
| **In-App** | Order updates, promotions | At-least-once |
| **Push** | New order for restaurant, delivery assigned | Best-effort |
| **Email** | Order confirmation, receipts | At-least-once |
| **SMS** | OTP codes, delivery alerts | At-least-once |

**Architecture:**
```
Event Bus → NotificationService → Priority Queue → Channel Router
                                                       │
                                        ┌──────────────┼───────────────┐
                                        ▼              ▼               ▼
                                   In-App DB      Email SMTP      SMS API
                                                       │
                                                  Dead Letter Queue
                                                  (failed messages)
```

**Template-based notifications:**
```typescript
const templates = {
  ORDER_CONFIRMED: {
    title: "Order Confirmed! 🎉",
    body: "{{restaurantName}} is preparing your order. ETA: {{eta}} mins",
    channels: ["push", "in_app"],
    priority: "high",
  },
  DELIVERY_ASSIGNED: {
    title: "Rider Assigned 🏍️",
    body: "{{driverName}} is on the way to {{restaurantName}}",
    channels: ["push", "in_app"],
    priority: "high",
  },
  PROMO_OFFER: {
    title: "Special Offer! 🎁",
    body: "Use code {{code}} for {{discount}}% off",
    channels: ["push", "email"],
    priority: "low",
  },
};
```

**Priority Queue:**
- **High priority**: Order status changes, payment confirmations — processed immediately.
- **Medium**: Delivery updates, reviews — processed within seconds.
- **Low**: Promotions, newsletters — batched and processed during off-peak.

**Dead Letter Queue (DLQ):**
Failed notifications are retried 3 times with exponential backoff. After 3 failures, they're moved to the DLQ for manual inspection.

---

## Q17: How does FoodDash handle authentication across multiple providers?

**Answer:**

FoodDash supports 3 authentication providers that converge into a unified flow:

```
┌──────────┐  ┌──────────┐  ┌──────────────┐
│ Google   │  │ Phone    │  │ Keycloak     │
│ OAuth2.0 │  │ OTP      │  │ SSO (OIDC)   │
└────┬─────┘  └────┬─────┘  └──────┬───────┘
     │              │               │
     └──────────────┼───────────────┘
                    ▼
          ┌──────────────────┐
          │  Passport.js     │
          │  Session Store   │
          │  (PostgreSQL)    │
          └────────┬─────────┘
                   ▼
          ┌──────────────────┐
          │  User Upsert     │  ← findOrCreate pattern
          │  (DB)            │
          └──────────────────┘
```

**Google OAuth flow:**
1. Client redirects to `/api/auth/google`
2. Passport.js redirects to Google consent screen
3. Google calls back to `/api/auth/google/callback`
4. Passport's verify callback calls `findOrCreateUser(googleProfile)`
5. Session created in PostgreSQL, session cookie set

**Phone OTP flow:**
1. Client sends `POST /api/auth/send-otp` with phone number
2. Server generates 6-digit OTP, stores with 5-minute expiry
3. SMS sent via SMS service
4. Client sends `POST /api/auth/verify-otp` with phone + OTP
5. Server validates → `findOrCreateUser(phone)` → session created

**Keycloak SSO (Enterprise):**
1. Client redirects to Keycloak authorization endpoint
2. User authenticates via Keycloak (supports LDAP, AD, SAML)
3. Keycloak issues authorization code
4. Server exchanges code for tokens (OIDC flow)
5. `findOrCreateUser(keycloakProfile)` → session created

**Key design: Provider-agnostic user model.** All three providers converge to the same `users` table. A user who first logged in via Google can later use Phone OTP — both link to the same user record via email/phone matching.

---

## Q18: How does the authorization model (RBAC + ABAC) work?

**Answer:**

**RBAC — Role-Based Access Control (4 roles):**
```typescript
const ROLE_PERMISSIONS = {
  customer: [
    { resource: "order", actions: ["create", "read"] },
    { resource: "profile", actions: ["read", "update"] },
  ],
  restaurant_owner: [
    { resource: "restaurant", actions: ["create", "read", "update"] },
    { resource: "menu", actions: ["create", "read", "update", "delete"] },
    { resource: "order", actions: ["read", "update"] },
  ],
  delivery_partner: [
    { resource: "delivery", actions: ["read", "update"] },
    { resource: "order", actions: ["read", "update"] },
  ],
  admin: [
    { resource: "*", actions: ["*"] },  // Full access
  ],
};
```

**ABAC — Attribute-Based Access Control (fine-grained):**
RBAC alone isn't enough. A restaurant owner can update restaurants — but only THEIR restaurants:

```typescript
evaluateABAC(permission, context) {
  if (resource === "restaurant" && action === "update") {
    return context.resourceOwnerId === context.userId;
  }
  if (resource === "order" && action === "update") {
    return context.assignedPartnerId === context.userId;
  }
}
```

**Authorization middleware:**
```typescript
function authorize(resource: string, action: string) {
  return (req, res, next) => {
    // 1. RBAC check — does role have permission?
    const hasPermission = checkRBAC(req.user.role, resource, action);
    if (!hasPermission) return res.status(403).json({ error: "Forbidden" });

    // 2. ABAC check — is user authorized for THIS specific resource?
    const context = { userId: req.user.id, resourceOwnerId: req.params.ownerId };
    const allowed = evaluateABAC({ resource, action }, context);
    if (!allowed) return res.status(403).json({ error: "Forbidden" });

    next();
  };
}
```

**Defense in depth:** Client-side (`ProtectedRoute`) → API Gateway (auth middleware) → Service-level (RBAC + ABAC) → Database (foreign key constraints).

---

## Q19: How would you design the payment system?

**Answer:**

**Requirements:**
- Multiple payment methods (PayPal, credit card, COD)
- Idempotent payment processing
- Refund support
- Payment as part of the order saga
- PCI DSS compliance (don't store card numbers)

**Architecture:**
```
┌────────────┐     ┌───────────────┐     ┌──────────────────┐
│   Client   │────▶│ PaymentService│────▶│  PayPal Server   │
│            │     │ (Strategy     │     │  SDK             │
│            │     │  Pattern)     │     │                  │
└────────────┘     └───────┬───────┘     └──────────────────┘
                           │
                    ┌──────▼──────┐
                    │ Idempotency │
                    │    Store    │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ Circuit     │
                    │ Breaker     │  (Threshold: 3, Reset: 60s)
                    └─────────────┘
```

**Strategy Pattern for payment methods:**
```typescript
interface PaymentProvider {
  charge(amount: number, customerId: string): Promise<PaymentResult>;
  refund(paymentId: string, amount?: number): Promise<RefundResult>;
}

class PayPalProvider implements PaymentProvider { /* ... */ }
class StripeProvider implements PaymentProvider { /* ... */ }
class CODProvider implements PaymentProvider { /* ... */ }

class PaymentService {
  private providers: Map<string, PaymentProvider>;
  
  async processPayment(method: string, amount: number, customerId: string) {
    const provider = this.providers.get(method);
    return provider.charge(amount, customerId);
  }
}
```

**Payment in the Saga flow:**
```
Step 1: Validate order → 
Step 2: Create order record → 
Step 3: Process payment → (if fails → compensate: cancel order)
Step 4: Notify restaurant → (if fails → compensate: refund payment, cancel order)
```

**Idempotency:** Payment requests include an `idempotencyKey`. If the client retries after a timeout, the server returns the existing payment result instead of charging again.

**Cautious circuit breaker:** Payment circuit breaker has threshold 3 (not 5) and reset timeout 60s (not 30s) because payment failures are more costly.

---

## Q20: How does the delivery partner assignment algorithm work?

**Answer:**

```typescript
class DeliveryAssignmentService {
  async assignRider(orderId: string): Promise<DeliveryPartner | null> {
    // 1. Find available riders within 5km radius
    const availableRiders = await this.findAvailableRiders(
      order.deliveryLatitude,
      order.deliveryLongitude,
      5 // km radius
    );

    // 2. Score each rider
    const scoredRiders = availableRiders.map(rider => ({
      rider,
      score: this.calculateRiderScore(rider, order),
    }));

    // 3. Select highest scoring rider
    scoredRiders.sort((a, b) => b.score - a.score);
    return scoredRiders[0]?.rider;
  }

  calculateRiderScore(rider, order): number {
    let score = 0;

    // Distance score (closer is better) — max 100 points
    const distance = haversineDistance(rider, order);
    score += Math.max(0, 100 - distance * 10);

    // Rating score — max 50 points
    score += rider.rating * 10;

    // Current load (fewer active orders is better) — max 50 points
    score += Math.max(0, 50 - rider.activeOrders * 10);

    // Completion rate — max 50 points
    score += rider.completionRate * 50;

    return score;  // Max possible: 250
  }
}
```

**Scoring breakdown:**
| Factor | Weight | Logic |
|--------|--------|-------|
| **Distance** | 40% | Closer riders = faster pickup |
| **Rating** | 20% | Higher-rated riders provide better experience |
| **Current load** | 20% | Riders with fewer active orders deliver faster |
| **Completion rate** | 20% | Reliable riders are prioritized |

**At scale considerations:**
- Use geospatial index (PostGIS or Redis Geo) for efficient proximity queries.
- Batch assignments every 30s during peak hours (instead of per-order).
- Consider rider preferences (preferred zones, max distance).
- Surge pricing multiplier to incentivize riders during peak hours.

---

## Q21: How does the Service Registry and Discovery work?

**Answer:**

```typescript
class ServiceRegistry {
  private services = new Map<string, ServiceInstance[]>();

  register(instance: ServiceInstance): void;     // Register with UUID
  deregister(name: string, id: string): void;    // Remove instance
  heartbeat(name: string, id: string): void;     // Keep-alive signal
  discover(name: string): ServiceInstance[];      // Find healthy instances
  getInstance(name: string): ServiceInstance;     // Load-balanced selection
}
```

**Health Management:**
- Health checks run every **30 seconds**.
- Stale instances (no heartbeat for **90 seconds**) are automatically evicted.
- Each service reports: `healthy`, `degraded`, or `unhealthy`.

**Load Balancing Strategies:**

| Strategy | Implementation | Use Case |
|----------|---------------|----------|
| **Round Robin** | Sequential rotation | Equal distribution |
| **Weighted** | Route based on health score | Prefer healthy instances |

**How it works in FoodDash:**
1. Each microservice registers on startup: `registry.register({ name: "order-service", port: 3004, ... })`
2. Services send heartbeats every 30s.
3. When Service A needs to call Service B: `registry.getInstance("order-service")` returns a healthy instance.
4. If no healthy instances exist, circuit breaker activates.

**At scale:** Replace with Consul, etcd, or Kubernetes Service Discovery.

---

## Q22: How would you design for multi-region deployment?

**Answer:**

FoodDash supports 5 pre-configured regions:

| Region | Location | Role |
|--------|----------|------|
| `us-east-1` | Virginia | **Primary** (writes) |
| `us-west-2` | Oregon | Failover |
| `eu-west-1` | Ireland | EU operations + GDPR compliance |
| `ap-south-1` | Mumbai | APAC operations |
| `ap-northeast-1` | Tokyo | APAC operations |

**Region Routing Algorithm (weighted scoring):**
```
Score = (0.4 × distanceScore) + (0.3 × healthScore) + (0.2 × replicationLag) + (0.1 × primaryBonus)
```

**Read/Write splitting:**
```
Write Operations → Always routed to PRIMARY (us-east-1)
Read Operations  → Routed to nearest healthy replica
```

**Cross-region cache invalidation:**
When a restaurant updates its menu in us-east-1:
1. Cache invalidated locally in us-east-1.
2. Invalidation message published via Redis Pub/Sub.
3. All other regions receive and invalidate their local caches.

**Automatic failover:**
If primary region becomes unhealthy:
1. MultiRegionManager detects via health checks.
2. Promotes the highest-scoring backup region.
3. DNS updated to route traffic.
4. Replication lag monitored during transition.

**Feature flags per region:**
```typescript
// GDPR compliance only in EU region
if (multiRegionManager.isFeatureEnabled("gdpr")) {
  await anonymizeUserData(user);
}
```

---

## Q23: What is the Hexagonal Architecture (Ports and Adapters) and how does FoodDash use it?

**Answer:**

Hexagonal Architecture separates business logic from external concerns:

```
                    ┌─────────────────────────┐
                    │     DOMAIN CORE          │
                    │  (Business Logic)        │
                    │                          │
            ┌───────┤  OrderService            │
   Input    │ PORT  │  RestaurantService       │  PORT ┌───────┐
   Adapters │◄──────┤  PaymentService          ├──────▶│Output │
            │       │                          │       │Adapters│
   REST API │       │  Pure business rules     │       │ DB    │
   GraphQL  │       │  No framework deps       │       │ Cache │
   WebSocket│       │  No DB knowledge         │       │ Queue │
   CLI      │       │                          │       │ Email │
            └───────┤                          ├───────┘
                    └─────────────────────────┘
```

**FoodDash's `BaseService` is the hexagonal foundation:**

```typescript
abstract class BaseService {
  // DOMAIN LOGIC (pure business rules)
  abstract checkHealth(): Promise<ServiceHealth>;

  // INFRASTRUCTURE ADAPTERS (injected via config)
  protected logger: ServiceLogger;        // Logging adapter
  protected cache: InMemoryCache;         // Cache adapter
  protected eventBus: EventBus;           // Messaging adapter
  protected metrics: MetricsCollector;    // Observability adapter

  // RESILIENCE LAYER (cross-cutting)
  protected async executeWithResilience<T>(
    operation: () => Promise<T>,
    operationName: string,
    fallback?: () => Promise<T>
  ): Promise<T>;
}
```

**Benefits:**
1. **Testability** — Mock the database adapter, test business logic in isolation.
2. **Flexibility** — Swap PostgreSQL for MongoDB by changing the adapter, not the domain.
3. **Framework independence** — Business logic doesn't import Express or React.
4. **Clear boundaries** — Every external interaction goes through a port.

**In FoodDash:** Every service extends `BaseService`, automatically getting circuit breaker + retry + timeout + metrics + cache. The domain code (e.g., order validation, price calculation) knows nothing about Express routes or database queries.

---

## Q24: How does the Message Queue work? What are Dead Letter Queues?

**Answer:**

**FoodDash's Message Queue supports 5 transport backends:**
```typescript
type QueueTransport = 'rabbitmq' | 'kafka' | 'sqs' | 'azure-service-bus' | 'in-memory';
```

**24 predefined topics across 7 domains + 3 DLQs:**
```typescript
QueueTopics = {
  ORDER_CREATED: 'order.created',
  ORDER_STATUS_CHANGED: 'order.status.changed',
  PAYMENT_PROCESS: 'payment.process',
  DELIVERY_ASSIGN: 'delivery.assign',
  NOTIFICATION_SEND: 'notification.send',
  ANALYTICS_EVENT: 'analytics.event',
  // ... 18 more
  DLQ_ORDERS: 'dlq.orders',
  DLQ_PAYMENTS: 'dlq.payments',
  DLQ_NOTIFICATIONS: 'dlq.notifications',
};
```

**Message flow:**
```
Producer → Publish(topic, message) → Queue → Consumer → ACK/NACK
                                                │
                                          NACK + max retries exceeded
                                                │
                                                ▼
                                        Dead Letter Queue
```

**Dead Letter Queue (DLQ):**
Messages that fail processing after max retries are moved to a DLQ:
1. Consumer receives message, processing fails (e.g., database down).
2. NACK sent → message requeued with retry count incremented.
3. After 3 retries with exponential backoff (1s, 2s, 4s), message moved to DLQ.
4. DLQ messages stored for manual inspection/reprocessing.
5. Admin can view DLQ depth, inspect messages, and reprocess.

**Why DLQ matters:** Without it, a poison message (one that always fails) blocks the queue forever, preventing subsequent messages from being processed.

**Production features:**
- **Guaranteed delivery**: ACK/NACK callbacks.
- **Batch publishing**: Efficient bulk operations.
- **Consumer groups**: Multiple handlers per queue.
- **Queue monitoring**: Depth, in-flight count, DLQ size.

---

## Q25: How does FoodDash ensure data consistency across microservices?

**Answer:**

**Consistency spectrum in FoodDash:**

| Data | Consistency Model | Mechanism | Why |
|------|------------------|-----------|-----|
| Order creation | **Strong** | Saga (sequential steps) | Must not lose orders or double-charge |
| Order status | **Strong** | FSM + single-writer | State machine prevents invalid transitions |
| Payment | **Strong** | Idempotency key + saga | Money operations must be exact |
| Restaurant catalog | **Eventual** | Event Bus + cache invalidation | Slight delay acceptable |
| Analytics | **Eventual** | Async event processing | Dashboards don't need real-time accuracy |
| Search index | **Eventual** | Event-driven reindexing | 30-second delay acceptable |
| Notifications | **At-least-once** | Message queue + DLQ | Better to send twice than not at all |

**Ensuring consistency:**

1. **Saga Pattern** — Coordinates distributed transactions with compensation on failure.
2. **Event Sourcing** — Immutable event log provides single source of truth for order state.
3. **Idempotency** — Prevents duplicate operations even with retries.
4. **FSM Validation** — State machine prevents invalid state transitions.
5. **Database constraints** — Foreign keys, unique constraints, check constraints enforce data integrity at the storage level.

**CAP Theorem tradeoff:**
FoodDash prioritizes **AP (Availability + Partition Tolerance)** for read-heavy operations (browsing restaurants) and **CP (Consistency + Partition Tolerance)** for critical writes (order creation, payments).

---

## Q26: How would you handle a system outage during an order? Walk through the failure scenarios.

**Answer:**

**Scenario 1: Payment service down during order placement**
```
Step 1: Validate order → ✅ Success
Step 2: Create order → ✅ Success (order record in DB, status: pending)
Step 3: Process payment → ❌ Circuit breaker OPEN
  → Saga compensates:
    Step 2 compensate: Mark order as "cancelled"
  → User sees: "Payment service temporarily unavailable. Please try again."
  → Order events log: CREATED → CANCELLED (with reason: "payment_service_unavailable")
```

**Scenario 2: Database down during order creation**
```
Step 1: Validate order → ✅ Success
Step 2: Create order → ❌ Database timeout
  → Retry 3 times with exponential backoff (200ms, 400ms, 800ms)
  → All retries fail
  → Saga returns failure (no compensation needed — nothing was created)
  → User sees: "Unable to create order. Please try again later."
```

**Scenario 3: WebSocket disconnects during order tracking**
```
1. Client detects WebSocket close event.
2. Client implements exponential backoff reconnection:
   - Wait 1s → reconnect → if fail → wait 2s → reconnect → ...
3. On reconnect, fetch latest order status via REST API (fallback).
4. WebSocket updates resume from current state.
```

**Scenario 4: Notification service down after successful order**
```
1. Order created successfully ✅
2. Payment processed ✅
3. Notification publish → Message Queue
4. NotificationService is down → message stays in queue
5. NotificationService recovers → processes queued messages
6. If message fails 3x → moves to DLQ for manual processing
7. Order is NOT affected — notifications are async, non-blocking
```

**Key principle:** Critical path (order + payment) uses synchronous saga with compensation. Non-critical paths (notifications, analytics) use async message queues with DLQ.

---

## Q27: How does FoodDash implement observability? What are the three pillars?

**Answer:**

**Three Pillars of Observability:**

| Pillar | FoodDash Implementation | Tool |
|--------|------------------------|------|
| **Logging** | Structured JSON logs with correlation IDs | Custom Logger |
| **Metrics** | Counters, gauges, histograms | Prometheus-compatible |
| **Tracing** | Correlation ID propagation via AsyncLocalStorage | Custom middleware |

**1. Structured Logging:**
```
2026-02-10T14:30:00.000Z INFO [order-service][corr-abc-123] Order created {"orderId":"ord-1","total":45.99}
```
Every log entry includes: timestamp, level, service name, correlation ID, message, structured data.

**2. Prometheus-Style Metrics:**
```typescript
// Counter — monotonically increasing
metrics.increment("api.requests");
metrics.increment("api.status.200");

// Gauge — current value
metrics.setGauge("active_orders", 42);

// Histogram — distribution with buckets
metrics.observe("http_request_duration_ms", 150);

// Timer — automatic latency measurement
const timer = metrics.startTimer("order.create");
// ... operation ...
timer.end();
```

**3. Distributed Tracing (Correlation IDs):**
```typescript
// AsyncLocalStorage propagates context through entire async chain
const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

// Context: { correlationId, requestId, startTime, userId }
// Forwarded to downstream services via headers:
// x-correlation-id, x-request-id, x-user-id
```

**Health Check Aggregation:**
```
GET /api/health → { overall: "healthy", services: [
  { name: "order-service", status: "healthy", responseTime: 5 },
  { name: "payment-service", status: "degraded", responseTime: 150 },
]}

GET /api/health/live  → Kubernetes liveness probe (is process running?)
GET /api/health/ready → Kubernetes readiness probe (can it handle requests?)
```

**Alerting thresholds:**
| Metric | Warning | Critical |
|--------|---------|----------|
| Error rate | > 1% | > 5% |
| Latency p99 | > 500ms | > 2s |
| CPU usage | > 70% | > 90% |
| Memory usage | > 80% | > 95% |

---

## Q28: How does the retry strategy with exponential backoff work?

**Answer:**

```typescript
private async withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number,
  attempt: number = 1
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (attempt >= maxAttempts) throw error;

    // Exponential backoff with jitter
    const baseDelay = Math.pow(2, attempt) * 100;  // 200, 400, 800, 1600...
    const jitter = Math.random() * 100;             // Random 0-100ms
    const delay = baseDelay + jitter;

    await new Promise(resolve => setTimeout(resolve, delay));
    return this.withRetry(operation, maxAttempts, attempt + 1);
  }
}
```

**Delay progression:**
```
Attempt 1: 200-300ms   (2¹ × 100 + jitter)
Attempt 2: 400-500ms   (2² × 100 + jitter)
Attempt 3: 800-900ms   (2³ × 100 + jitter)
```

**Why jitter is critical:**
Without jitter, if 1000 requests fail simultaneously, they all retry at the exact same time (200ms, 400ms, 800ms) — causing a "thundering herd" that overwhelms the recovering service. Jitter spreads retries across a time window.

**Which errors to retry vs not:**

| Retry | Don't Retry |
|-------|-------------|
| 500 Internal Server Error | 400 Bad Request |
| 503 Service Unavailable | 401 Unauthorized |
| Network timeout | 403 Forbidden |
| Connection refused | 404 Not Found |
| Rate limited (429) with Retry-After | 422 Validation Error |

---

## Q29: How does the GraphQL BFF (Backend For Frontend) pattern work?

**Answer:**

The BFF aggregates data from multiple microservices into a single frontend-optimized response:

```
WITHOUT BFF:
Client → GET /api/orders/123                    (Order Service)
Client → GET /api/restaurants/abc               (Restaurant Service)
Client → GET /api/delivery-partners/xyz         (Delivery Service)
Client → GET /api/tracking/123                  (Tracking Service)
= 4 HTTP requests, client-side data joining

WITH GraphQL BFF:
Client → POST /graphql
query {
  order(id: "123") {
    id, status, total
    restaurant { name, imageUrl }
    deliveryPartner { name, phone, rating }
    tracking { currentLocation, eta }
  }
}
= 1 HTTP request, server-side data aggregation
```

**FoodDash GraphQL schema (860 lines):**
```graphql
type Query {
  restaurants(filter: RestaurantFilter): [Restaurant!]!
  restaurant(id: ID!): Restaurant
  orders: [Order!]!
  order(id: ID!): Order
  me: User
  recommendedRestaurants(location: GeoInput!): [Restaurant!]!
}

type Mutation {
  createOrder(input: CreateOrderInput!): Order!
  updateOrderStatus(id: ID!, status: OrderStatus!): Order!
  applyCoupon(code: String!): CouponResult!
}

type Subscription {
  orderStatusChanged(orderId: ID!): OrderUpdate!
  deliveryLocationUpdated(orderId: ID!): LocationUpdate!
}
```

**Benefits:**
1. **Reduced round trips** — 1 request instead of 4.
2. **No over-fetching** — Client specifies exactly which fields it needs.
3. **Frontend flexibility** — Mobile app can request fewer fields than web app.
4. **Server-side orchestration** — BFF handles service-to-service calls, error aggregation, and response composition.

---

## Q30: How would you design the analytics system for FoodDash?

**Answer:**

**FoodDash AnalyticsService (538 lines) provides:**

| Analytics Type | Metrics | Update Frequency |
|---------------|---------|-----------------|
| **Platform** | Total users, orders, revenue, active restaurants | Real-time |
| **Order** | Order count by status, avg order value, peak hours | Per-event |
| **Restaurant** | Revenue per restaurant, popular items, avg prep time | Daily rollup |
| **Delivery** | Avg delivery time, partner utilization, ratings | Per-delivery |
| **Revenue** | GMV, commission, refunds, net revenue | Daily |

**Architecture — CQRS Read Model:**
```
Event Bus → Analytics Event Handler → Time-Series Aggregation → Read Model (Cache)
                                                                      │
                                                                      ▼
                                                               Analytics API
                                                               (Pre-computed)
```

**Why CQRS for analytics:**
Analytics queries are expensive (aggregations, joins, time-series). Running them against the operational database would degrade order processing performance. The analytics read model is:
- Separate from the operational database
- Pre-computed (aggregated on event arrival, not at query time)
- Cached (30-minute TTL for dashboard data)
- Eventually consistent (acceptable for analytics)

**Key metrics tracked:**
```typescript
// Counter metrics
metrics.increment("orders.created");
metrics.increment("orders.delivered");
metrics.increment("payments.processed");

// Histogram metrics
metrics.observe("order.delivery_time_minutes", deliveryTime);
metrics.observe("restaurant.prep_time_minutes", prepTime);

// Gauge metrics
metrics.setGauge("active_orders", activeOrderCount);
metrics.setGauge("online_delivery_partners", onlinePartnerCount);
```

---

## Q31: How does FoodDash handle database scaling?

**Answer:**

**Current architecture:**
```
Application → Connection Pool (pg.Pool) → Single PostgreSQL Instance
```

**Scaling strategies (progression):**

**1. Vertical Scaling (scale up):**
- Increase CPU, RAM, storage of the PostgreSQL instance.
- Simple, no code changes. Reaches a ceiling.

**2. Read Replicas (CQRS):**
```
Write Operations → Primary Database
Read Operations  → Read Replica (async replication)
```
- FoodDash's CQRS naturally maps writes to primary, reads to replicas.
- Replication lag: ~100ms (acceptable for menu browsing, not for order status).

**3. Connection Pooling:**
```typescript
const pool = new Pool({
  max: 20,              // Max connections per instance
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```
- Prevents connection exhaustion under load.
- Each connection handles multiple queries serially.

**4. Sharding (horizontal):**
```
Orders for user A-M → Shard 1
Orders for user N-Z → Shard 2
```
- Hash-based sharding on user ID or restaurant ID.
- Cross-shard queries become complex (avoid for order lookups).

**5. Database per Service:**
- Each microservice owns its database.
- OrderService → orders DB, RestaurantService → restaurants DB.
- Eliminates cross-service joins (use events for data synchronization).

**FoodDash's design enables all 5 stages** without rewriting business logic. The storage layer abstracts database access, so switching from single DB to sharded DB only changes the storage implementation.

---

## Q32: What is the Anti-Corruption Layer pattern? How does FoodDash use it for SAP?

**Answer:**

The Anti-Corruption Layer (ACL) isolates your domain model from an external system's model that uses different naming, structure, or semantics:

```
FoodDash Domain Model              SAP ERP Model
─────────────────────              ──────────────────
vendor.id           ←── ACL ──→   LIFNR (Lieferantennummer)
vendor.name         ←── ACL ──→   NAME1
vendor.city         ←── ACL ──→   ORT01
material.id         ←── ACL ──→   MATNR (Materialnummer)
purchaseOrder.id    ←── ACL ──→   EBELN
```

**FoodDash SAPDataTransformer:**
```typescript
class SAPDataTransformer {
  // SAP → Domain (inbound)
  static transformVendor(sapVendor: SAPVendor): Vendor {
    return {
      id: sapVendor.LIFNR,
      name: sapVendor.NAME1,
      city: sapVendor.ORT01,
      country: sapVendor.LAND1,
    };
  }

  // Domain → SAP (outbound)
  static toSAPVendor(vendor: Partial<Vendor>): Partial<SAPVendor> {
    return {
      NAME1: vendor.name,
      ORT01: vendor.city,
      LAND1: vendor.country,
    };
  }
}
```

**SAP integration events:**
```
ORDER_DELIVERED  → SAPIntegrationService → Create SAP Sales Order
PAYMENT_SUCCESS  → SAPIntegrationService → Create SAP Finance Document
```

**Why ACL matters:**
1. **Domain purity** — Business logic uses clean names (`vendor.name`), never SAP codes (`NAME1`).
2. **Isolation** — If SAP changes field names, only the ACL transformer changes.
3. **Testability** — Test domain logic without SAP dependency.
4. **Gradual migration** — If you replace SAP with another ERP, only the ACL changes.

---

## Q33: How does the ML recommendation engine work at a system design level?

**Answer:**

**FoodDash MachineLearningService (1026 lines) provides 5 capabilities:**

| Capability | Algorithm | Input | Output |
|-----------|-----------|-------|--------|
| **Restaurant Recommendations** | Multi-factor scoring | userId, location | Ranked restaurant list |
| **Menu Item Recommendations** | Collaborative filtering | userId, restaurantId | Suggested items |
| **ETA Prediction** | Multi-factor regression | restaurant, location, order | Minutes estimate |
| **Fraud Detection** | Rule-based scoring | order details | Risk score (0-1) |
| **Dynamic Pricing** | Demand-supply analysis | restaurantId, time | Price multiplier |

**Restaurant Recommendation Scoring:**
```
Score = (0.30 × cuisineMatch)     // User prefers this cuisine?
      + (0.20 × ratingScore)      // restaurant.rating / 5.0
      + (0.20 × distanceScore)    // 1 - (distance / maxRadius)
      + (0.15 × priceScore)       // Matches user's price preference?
      + (0.15 × historyScore)     // User ordered from here before?
```

**Collaborative Filtering (Item-Item Similarity):**
```
"Customers who ordered Margherita Pizza also ordered:"
  1. Compute feature vectors for each menu item
  2. Calculate cosine similarity between items
  3. Rank by similarity score
  4. Filter out items user already ordered
```

**Cosine Similarity:**
```
similarity(A, B) = (A · B) / (|A| × |B|)
  where A, B are feature vectors [cuisine, price, rating, category]
```

**Fraud Detection (Rule-based):**
```typescript
const riskFactors = {
  newUserHighValue:    orderValue > $100 && accountAge < 7 days,   // Weight: 0.3
  unusualAmount:       orderValue > 3 × userAverage,               // Weight: 0.25
  highVelocity:        orders > 5 within 1 hour,                   // Weight: 0.25
  recentAddressChange: address changed recently,                   // Weight: 0.2
};

riskScore = Σ(matchedFactor × weight)  // Normalized to 0-1
riskLevel = score > 0.7 ? "high" : score > 0.4 ? "medium" : "low"
```

---

## Q34: How would you estimate capacity for FoodDash?

**Answer:**

**Assumptions:**
```
Daily Active Users (DAU):    100,000
Orders per day:              50,000
Peak multiplier:             3x (lunch/dinner rush)
Average items per order:     3
API calls per order journey: 15 (browse, search, view menu, cart, checkout, track)
```

**Request Calculations:**
```
Total API calls/day:        100,000 × 15 = 1,500,000
Average requests/sec:       1,500,000 / 86,400 ≈ 17 RPS
Peak requests/sec:          17 × 3 = ~50 RPS
With 2x safety margin:     ~100 RPS
```

**Storage Calculations:**
```
Per order:     ~2KB (order + items + events)
Daily storage: 50,000 × 2KB = 100MB
Annual:        100MB × 365 = 36.5GB
With indexes:  ~73GB (2x raw data)
```

**Cache Size:**
```
Restaurants:    1,000 × 1KB = 1MB
Menu items:     10,000 × 500B = 5MB
Active orders:  5,000 × 2KB = 10MB
Sessions:       10,000 × 500B = 5MB
Total L1 cache: ~21MB (fits in memory)
```

**WebSocket Connections:**
```
Concurrent tracking:  5,000 users
Connection memory:    ~50KB per connection
Total:                5,000 × 50KB = 250MB
```

**Bandwidth:**
```
Average response:     2KB
Peak at 100 RPS:      100 × 2KB = 200KB/s ≈ 1.6 Mbps
WebSocket updates:    5,000 × 100B × (1 update/5s) = 100KB/s
```

**Infrastructure estimate:**
- 2 application servers (4 CPU, 8GB RAM each) behind a load balancer
- 1 PostgreSQL primary + 1 read replica
- 1 Redis instance (cache + sessions)
- 1 message queue instance

---

## Q35: How does the security architecture work end-to-end?

**Answer:**

**Defense in Depth — 10 security layers:**

| Layer | Protection | Implementation |
|-------|-----------|---------------|
| 1. **Transport** | Encryption in transit | HTTPS in production (`cookie.secure: true`) |
| 2. **Rate Limiting** | DDoS/brute-force protection | 3-tier: API 100/min, Auth 10/15min, Orders 10/min |
| 3. **Authentication** | Identity verification | Multi-provider (Google OAuth, Keycloak SSO, Phone OTP) |
| 4. **Session** | Session hijacking prevention | `httpOnly`, `secure`, `sameSite: "lax"` cookies |
| 5. **Authorization** | Access control | RBAC (4 roles) + ABAC (ownership checks) |
| 6. **Input Validation** | Injection prevention | Zod schemas validate ALL inputs before processing |
| 7. **SQL Injection** | Database attack prevention | Drizzle ORM parameterized queries (never raw SQL) |
| 8. **XSS** | Cross-site scripting prevention | React auto-escapes output, CSP headers |
| 9. **CSRF** | Cross-site request forgery | `sameSite` cookies, origin validation |
| 10. **Secrets** | Credential protection | Environment variables, no hardcoded credentials |

**Request validation pipeline:**
```
Input → Rate Limit → Auth Check → Role Check → ABAC Check → Zod Validation → Handler → Response
                                                                    │
                                                              On ZodError → 400 with validation details
```

**Timing-safe token comparison:**
```typescript
// Prevents timing attacks on JWT verification
const a = Buffer.from(computedSignature, 'base64url');
const b = Buffer.from(tokenSignature, 'base64url');
return crypto.timingSafeEqual(a, b);
```

**Vite security:**
- `fs.strict: true` — prevents accessing files outside project root
- `fs.deny: ["**/.*"]` — blocks dotfile access (`.env`, `.git`)

**Error handling:** Stack traces hidden in production. Errors logged with correlation IDs server-side but only generic messages sent to clients.

---

## Q36: What is the difference between horizontal and vertical scaling? Where does each apply in FoodDash?

**Answer:**

| Aspect | Vertical Scaling (Scale Up) | Horizontal Scaling (Scale Out) |
|--------|---------------------------|-------------------------------|
| How | Add CPU/RAM to existing machine | Add more machines |
| Limit | Hardware ceiling | Theoretically unlimited |
| Complexity | Simple (no code changes) | Complex (distributed systems) |
| Downtime | Often required for hardware changes | Zero downtime (rolling deploy) |
| Cost | Expensive at top tier | Linear cost growth |

**FoodDash components and their scaling strategy:**

| Component | Strategy | How |
|-----------|----------|-----|
| **API Server** | Horizontal | Stateless (sessions in PostgreSQL) — add instances behind load balancer |
| **WebSocket** | Horizontal + Sticky | Shard by user ID, Redis Pub/Sub for cross-node messaging |
| **Cache L1** | Vertical | Increase memory per instance |
| **Cache L2 (Redis)** | Horizontal | Redis Cluster with automatic sharding |
| **Database (writes)** | Vertical → Sharding | Scale up first, then shard by user/region |
| **Database (reads)** | Horizontal | Add read replicas |
| **Message Queue** | Horizontal | Add partitions (Kafka) or nodes (RabbitMQ) |
| **Services** | Horizontal | Each service independently scalable via Kubernetes |
| **Multi-Region** | Horizontal | Add new regions with read replicas |

**FoodDash is horizontally scalable because:**
1. Stateless servers (sessions in DB, not in memory).
2. Services communicate via events (no shared state).
3. Cache invalidation via Pub/Sub (works across nodes).
4. Connection pooling prevents DB connection exhaustion.

---

## Q37: How would you design the coupon/offers system?

**Answer:**

**Requirements:**
- Bulk coupon creation (e.g., generate 10,000 codes)
- Validation rules: min order, max discount, expiry date, usage limit
- Per-user usage tracking (prevent abuse)
- Restaurant-specific vs platform-wide coupons
- Real-time validation at checkout

**FoodDash OffersCouponService (329 lines):**

```typescript
interface Coupon {
  id: string;
  code: string;                  // UNIQUE (e.g., "SAVE10")
  discountType: "percentage" | "fixed";
  discountValue: number;         // 10 (meaning 10% or $10)
  minimumOrder: number;          // Minimum order amount
  maximumDiscount: number;       // Cap for percentage discounts
  validFrom: Date;
  validUntil: Date;
  usageLimit: number;            // Total uses across all users
  perUserLimit: number;          // Uses per individual user
  restaurantId?: string;         // null = platform-wide
  isActive: boolean;
}
```

**Validation flow:**
```typescript
async validateCoupon(code: string, userId: string, orderTotal: number) {
  const coupon = await this.getCouponByCode(code);

  // 1. Existence check
  if (!coupon) throw new Error("Invalid coupon code");

  // 2. Active check
  if (!coupon.isActive) throw new Error("Coupon is no longer active");

  // 3. Date validation
  const now = new Date();
  if (now < coupon.validFrom || now > coupon.validUntil)
    throw new Error("Coupon has expired");

  // 4. Minimum order check
  if (orderTotal < coupon.minimumOrder)
    throw new Error(`Minimum order: $${coupon.minimumOrder}`);

  // 5. Usage limit check (global)
  if (coupon.totalUsed >= coupon.usageLimit)
    throw new Error("Coupon usage limit reached");

  // 6. Per-user limit check (abuse prevention)
  const userUsage = await this.getUserUsageCount(coupon.id, userId);
  if (userUsage >= coupon.perUserLimit)
    throw new Error("You've already used this coupon");

  // 7. Calculate discount
  const discount = coupon.discountType === "percentage"
    ? Math.min(orderTotal * coupon.discountValue / 100, coupon.maximumDiscount)
    : Math.min(coupon.discountValue, orderTotal);

  return { valid: true, discount };
}
```

**Abuse prevention:**
- Per-user usage tracking prevents one user from using the same coupon multiple times.
- Global usage limit prevents coupon from being used beyond its budget.
- Rate limiting on the coupon validation endpoint (10/min) prevents brute-force code guessing.

---

## Q38: How does FoodDash handle graceful degradation?

**Answer:**

**Graceful degradation** means the system continues functioning (possibly with reduced capability) rather than failing completely when a component goes down:

| Component Down | Degraded Behavior | User Impact |
|---------------|-------------------|-------------|
| **Payment Service** | Circuit breaker activates → fallback: "Payment temporarily unavailable" | Can browse, add to cart. Cannot checkout. |
| **Notification Service** | Messages queue up → processed when service recovers | Order proceeds. Notification delayed. |
| **Search Service** | Fallback to basic database query (no relevance scoring) | Search works but slower, less relevant |
| **Analytics Service** | Events buffered in queue → dashboards show stale data | No impact on customer experience |
| **ML Service** | Fallback to static recommendations (top-rated restaurants) | Less personalized but still functional |
| **Cache (Redis)** | Fallback to L1 in-memory cache → if miss, hit database | Slower responses, higher DB load |
| **Database (read replica)** | Reads routed to primary database | Slower reads, higher primary load |

**Implementation via circuit breaker fallbacks:**
```typescript
await this.executeWithResilience(
  () => searchService.search(query),     // Primary operation
  "search",
  () => basicDatabaseSearch(query)       // Fallback when circuit is open
);
```

**Health endpoints enable Kubernetes orchestration:**
- `/api/health/live` → Process running? (restart if not)
- `/api/health/ready` → Can handle requests? (remove from load balancer if not)

---

## Q39: What is the Strangler Fig pattern? How would you migrate FoodDash from monolith to microservices?

**Answer:**

The Strangler Fig pattern incrementally replaces a legacy system by routing specific functionality to new services while keeping the old system running:

```
Phase 1: Monolith handles everything
┌────────────────────────────┐
│         MONOLITH           │
│  Auth | Orders | Payment   │
│  Restaurant | Delivery     │
└────────────────────────────┘

Phase 2: Extract one service (e.g., Payment)
┌────────────────────────────┐     ┌──────────────┐
│         MONOLITH           │     │  Payment     │
│  Auth | Orders |           │────▶│  Service     │
│  Restaurant | Delivery     │     │  (New)       │
└────────────────────────────┘     └──────────────┘

Phase 3: Extract more services
┌────────────────────────────┐     ┌──────────────┐
│     MONOLITH (shrinking)   │     │  Payment Svc │
│  Auth | Restaurant         │────▶│  Order Svc   │
│                            │     │  Delivery Svc│
└────────────────────────────┘     └──────────────┘

Phase 4: Monolith fully replaced
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│  Auth  │ │  Order │ │Payment │ │Delivery│ │Restaur.│
│  Svc   │ │  Svc   │ │  Svc   │ │  Svc   │ │  Svc   │
└────────┘ └────────┘ └────────┘ └────────┘ └────────┘
```

**FoodDash is already designed for this:**
- Services communicate via **Event Bus** (in-memory → Kafka, no code change).
- Each service has **independent health checks**.
- Services are **in-process modules** but follow microservice boundaries.
- Extraction = deploy service as separate process + change Event Bus transport.

**Migration order (by risk/value):**
1. **Payment** (highest risk, isolate first for PCI compliance)
2. **Notifications** (stateless, easy to extract)
3. **Search** (resource-intensive, benefits most from independent scaling)
4. **Orders** (core business, extract last after proving the pattern)

---

## Q40: How does FoodDash handle data migration and schema evolution?

**Answer:**

**Drizzle ORM migration strategy:**

```bash
# Generate migration from schema changes
npx drizzle-kit generate

# Apply migration to database
npx drizzle-kit push

# Or use traditional migration files
npx drizzle-kit migrate
```

**Schema evolution best practices:**

| Change Type | Strategy | Downtime? |
|-------------|----------|-----------|
| Add column with default | `ALTER TABLE ADD COLUMN ... DEFAULT` | No |
| Add nullable column | `ALTER TABLE ADD COLUMN ... NULL` | No |
| Rename column | Add new → copy data → update code → drop old | No |
| Remove column | Stop reading → deploy → drop column | No |
| Change column type | Add new column → migrate data → swap | No |
| Add index | `CREATE INDEX CONCURRENTLY` | No |
| Drop table | Ensure no foreign keys → stop using → drop | No |

**Key principle:** Never make breaking changes in one step. Use **expand-contract** pattern:
1. **Expand**: Add the new schema alongside the old.
2. **Migrate**: Copy/transform data.
3. **Contract**: Remove the old schema after all code uses the new one.

**Drizzle-Zod integration ensures safety:**
```typescript
// Schema change automatically updates validation
export const insertOrderSchema = createInsertSchema(orders)
  .omit({ id: true, createdAt: true });
// If you add a required column, TypeScript + Zod catch all callers that don't provide it
```

---

## Q41: What load balancing strategies exist and which would FoodDash use?

**Answer:**

| Strategy | How It Works | Best For |
|----------|-------------|----------|
| **Round Robin** | Rotate through servers sequentially | Equal-capacity servers |
| **Weighted Round Robin** | Rotate with server weights | Mixed-capacity servers |
| **Least Connections** | Route to server with fewest active connections | Variable request durations |
| **IP Hash** | Hash client IP to pick server | Session affinity (sticky sessions) |
| **Random** | Pick a random server | Large server pool |
| **Least Response Time** | Route to fastest responding server | Heterogeneous infrastructure |

**FoodDash uses:**

1. **Weighted Load Balancing** for service discovery:
```typescript
class WeightedBalancer {
  getInstance(instances: ServiceInstance[]): ServiceInstance {
    // Weight based on health score (healthy=1.0, degraded=0.5, unhealthy=0.0)
    const weights = instances.map(i => ({
      instance: i,
      weight: i.successRate * (i.status === "healthy" ? 1 : 0.5),
    }));
    // Weighted random selection
    return weightedRandomPick(weights);
  }
}
```

2. **IP Hash** for WebSocket connections — ensures a user's WebSocket reconnects to the same server (sticky session).

3. **Round Robin** as default for stateless REST API requests.

**At scale:** Use Nginx, HAProxy, or cloud load balancers (AWS ALB) instead of application-level balancing.

---

## Q42: How would you design a feature flag system for FoodDash?

**Answer:**

```typescript
interface FeatureFlag {
  name: string;
  enabled: boolean;
  rolloutPercentage?: number;   // 0-100 (gradual rollout)
  userWhitelist?: string[];     // Specific users (beta testers)
  conditions?: FeatureCondition[];  // role, region, platform
}

class FeatureFlagService {
  isEnabled(flagName: string, context?: FeatureContext): boolean {
    const flag = this.flags.get(flagName);
    if (!flag || !flag.enabled) return false;

    // Whitelist check (always enabled for beta testers)
    if (flag.userWhitelist?.includes(context?.userId)) return true;

    // Rollout percentage (deterministic hash for consistency)
    if (flag.rolloutPercentage !== undefined) {
      const userHash = hashUserId(context?.userId) % 100;
      if (userHash >= flag.rolloutPercentage) return false;
    }

    // Condition evaluation (role, region, etc.)
    if (flag.conditions) return evaluateConditions(flag.conditions, context);

    return true;
  }
}
```

**Use cases in FoodDash:**
- **Gradual rollout**: New payment method enabled for 10% of users → 50% → 100%.
- **Region-specific**: GDPR compliance features only in EU region.
- **Beta testing**: New ML recommendations for whitelisted users.
- **Kill switch**: Disable a failing feature instantly without deployment.
- **A/B testing**: Show different UI variants to different user segments.

**Deterministic hashing:** Same user always gets the same result (no flickering). `hash(userId) % 100 < rolloutPercentage` ensures consistency.

---

## Q43: What consistency patterns exist and which does FoodDash use?

**Answer:**

| Pattern | Guarantee | FoodDash Usage |
|---------|----------|----------------|
| **Strong Consistency** | All reads see the latest write | Order creation, payments |
| **Eventual Consistency** | Reads eventually see the latest write | Restaurant catalog, search index |
| **Causal Consistency** | Writes that are causally related are seen in order | Chat messages (future feature) |
| **Read-Your-Writes** | A user always sees their own writes | Cart, profile updates |
| **Monotonic Reads** | Once you see a value, you never see an older one | Order status (FSM enforces this) |

**Implementation examples:**

**Strong (Saga for orders):**
```
Step 1: Write order → Step 2: Write payment → Step 3: Write notification
Each step commits before the next begins. Compensation ensures rollback on failure.
```

**Eventual (Event Bus for search):**
```
Restaurant updated → Event published → SearchService receives → Index updated
(30s delay acceptable)
```

**Read-Your-Writes (Cart):**
```
User adds item to cart → Redux state updated immediately
→ No server round-trip needed (cart is client-side state with redux-persist)
```

---

## Q44: How would you design for disaster recovery?

**Answer:**

**Recovery objectives:**
- **RPO (Recovery Point Objective)**: Maximum acceptable data loss = 1 minute.
- **RTO (Recovery Time Objective)**: Maximum acceptable downtime = 15 minutes.

**Disaster recovery strategy:**

| Component | Strategy | RPO | RTO |
|-----------|----------|-----|-----|
| **Database** | Streaming replication to standby | ~1s (async) | 5 min (promote standby) |
| **Redis** | AOF persistence + snapshot | ~1s | 2 min (restore from AOF) |
| **Application** | Multi-region deployment | 0 (stateless) | 30s (route to backup region) |
| **Message Queue** | Persistent messages + replication | 0 (persisted) | 2 min (failover broker) |
| **Events** | Event log + DLQ | 0 (persisted) | Replay from log |

**FoodDash multi-region failover:**
1. Health check detects primary region (us-east-1) failure.
2. MultiRegionManager promotes backup region (us-west-2).
3. DNS updated to route traffic to new primary.
4. Replication lag monitored during transition.
5. When us-east-1 recovers, it becomes a replica until manually promoted.

**Backup strategy:**
- Database: Hourly incremental backups, daily full backups, 30-day retention.
- Configuration: Version controlled in Git (infrastructure as code).
- Secrets: Stored in a secrets manager (AWS Secrets Manager, HashiCorp Vault).

---

## Q45: How does the build and deployment pipeline work?

**Answer:**

**FoodDash build pipeline:**
```
┌─────────────────────────────────────────┐
│              npm run build               │
│                                          │
│  1. rm -rf dist/                        │
│  2. vite build → dist/public/           │
│     (React SPA: tree-shaken, minified,  │
│      code-split by route)               │
│  3. esbuild → dist/index.cjs           │
│     (Server: bundled, minified, CJS)    │
│                                          │
│  Selective bundling:                     │
│  ✓ Bundled: express, pg, drizzle, zod  │
│  ✗ External: react, radix, tailwind    │
└─────────────────────────────────────────┘
```

**CI/CD pipeline:**
```yaml
on: push to main
jobs:
  test:
    - npm ci
    - npm run check      # TypeScript type checking
    - npm test           # Unit + integration tests
  
  build:
    needs: test
    - npm run build
    - docker build . -t fooddash:latest
  
  deploy:
    needs: build
    - docker push myregistry.com/fooddash:latest
    - kubectl rollout restart deployment/fooddash-api
```

**Kubernetes deployment:**
```yaml
apiVersion: apps/v1
kind: Deployment
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: api
        resources:
          requests: { memory: "256Mi", cpu: "200m" }
          limits: { memory: "512Mi", cpu: "500m" }
        readinessProbe:
          httpGet: { path: /api/health, port: 5000 }
        livenessProbe:
          httpGet: { path: /api/health/live, port: 5000 }
```

**Deployment strategy:** Rolling update — new pods are gradually rolled out while old pods are terminated, ensuring zero downtime.

---

## Q46: What are the 30+ design patterns used in FoodDash?

**Answer:**

| Category | Pattern | Where Used |
|----------|---------|-----------|
| **Architectural** | Microservices | 16 independent services |
| | Hexagonal (Ports & Adapters) | BaseService abstraction |
| | Event-Driven Architecture | 42 event types across Event Bus |
| | CQRS | OrderService separate read/write |
| | BFF (Backend for Frontend) | GraphQL gateway |
| **Resilience** | Circuit Breaker | Payment, external service calls |
| | Retry with Backoff | All service operations |
| | Timeout | 10s default per operation |
| | Bulkhead | Independent thread pools per service |
| | Dead Letter Queue | Failed notification/payment messages |
| **Distributed** | Saga (Orchestration) | Order creation flow |
| | Event Sourcing | order_events immutable log |
| | Service Registry | Dynamic service discovery |
| | Anti-Corruption Layer | SAP integration |
| **Structural** | Strategy | Multiple payment providers |
| | Observer | EventBus pub/sub, WebSocket updates |
| | Template Method | BaseService executeWithResilience |
| | Adapter | SAP data transformer |
| | Facade | API Gateway unified endpoint |
| **Data** | Cache-Aside | L1/L2 cache hierarchy |
| | Repository | Storage layer (db abstraction) |
| | Unit of Work | Saga step execution |
| | Materialized View | LiveOrderTracking composite view |
| | Database per Service | Each microservice owns its data |
| **Frontend** | Provider | Redux, Theme, QueryClient |
| | Initializer Component | AuthInitializer |
| | Protected Route | Role-based route guard |
| | Composition | Children prop, slot pattern |
| | Custom Hook | useAuth, useMobile, useToast |
| **Infrastructure** | Rate Limiting | 3-tier rate limits |
| | Correlation ID | AsyncLocalStorage tracing |
| | Health Check | Kubernetes probes |
| | Feature Flag | Per-region, per-user toggles |

---

## Q47: How do you handle backward compatibility in API versioning?

**Answer:**

**FoodDash uses URI-based versioning:**
```
/api/v1/restaurants     ← Current version
/api/v2/restaurants     ← Future version (when needed)
```

**Versioning strategies:**

| Strategy | Example | Pros | Cons |
|----------|---------|------|------|
| **URI Path** | `/api/v1/orders` | Explicit, cacheable | URL changes per version |
| **Query Param** | `/api/orders?v=1` | No URL change | Easy to miss |
| **Header** | `Accept: application/vnd.fooddash.v1+json` | Clean URLs | Hidden, harder to test |
| **Content Negotiation** | `Accept: application/json; version=1` | Standard HTTP | Complex |

**Backward compatibility rules:**
1. **Never remove a field** from a response (add new fields, mark old as deprecated).
2. **Never change a field's type** (add a new field with the new type).
3. **New required request fields** must have sensible defaults.
4. **Deprecation policy**: Announce deprecation → 6-month support → remove.

**FoodDash v1 → v2 example:**
```json
// v1 response
{ "deliveryTime": 30 }

// v2 response (backward compatible)
{ "deliveryTime": 30, "deliveryTimeRange": { "min": 25, "max": 35 } }
```

---

## Q48: What is the difference between synchronous and asynchronous communication in microservices?

**Answer:**

| Aspect | Synchronous | Asynchronous |
|--------|------------|-------------|
| **Mechanism** | REST API call, gRPC | Event Bus, Message Queue |
| **Coupling** | Temporal coupling (caller waits) | No temporal coupling |
| **Latency** | Immediate response | Eventual processing |
| **Failure** | Caller fails if callee is down | Message queued, processed later |
| **Debugging** | Easy (stack trace) | Hard (distributed events) |

**FoodDash uses both:**

**Synchronous (REST):**
```
Client → API Gateway → OrderService.createOrder()
  → Immediate response: { orderId: "123", status: "pending" }
```
Used when the client needs an immediate response.

**Asynchronous (Event Bus):**
```
OrderService → publishes ORDER_CREATED event
  → NotificationService subscribes → sends notification (async)
  → AnalyticsService subscribes → records metric (async)
  → DeliveryService subscribes → assigns driver (async)
```
Used when downstream processing shouldn't block the main flow.

**Key principle:** The critical path (order creation + payment) is synchronous via Saga. Non-critical side effects (notifications, analytics, search indexing) are asynchronous via events.

---

## Q49: How would you design the admin dashboard analytics system?

**Answer:**

**FoodDash AdminService (701 lines) provides:**

```typescript
// Platform analytics (real-time)
GET /api/v1/admin/analytics/platform
{
  totalUsers: 50000,
  activeOrders: 342,
  todayOrders: 2150,
  todayRevenue: 53750.00,
  onlineDeliveryPartners: 89,
  avgDeliveryTime: 32, // minutes
}

// Time-series analytics
GET /api/v1/admin/analytics/orders?period=7d
{
  data: [
    { date: "2026-02-04", orders: 1800, revenue: 45000 },
    { date: "2026-02-05", orders: 2100, revenue: 52500 },
    // ...
  ]
}

// Restaurant performance
GET /api/v1/admin/analytics/restaurants?sort=revenue
{
  data: [
    { id: "r1", name: "Bella Italia", orders: 450, revenue: 11250, avgRating: 4.7 },
    // ...
  ]
}
```

**Architecture:**
- Pre-computed aggregates updated on each event (not computed at query time).
- Dashboard data cached for 30 minutes (analytics don't need real-time precision).
- Bulk operations (suspend user, approve restaurant) have audit logging.
- Admin actions require RBAC check (`role === "admin"`) at both client and server.

**Real-time dashboard via WebSocket:**
Admin dashboard subscribes to aggregated metrics updated every 30 seconds — new order counts, revenue, active deliveries.

---

## Q50: Summarize the production-readiness checklist. What separates FoodDash from a "toy project"?

**Answer:**

| Category | Feature | Status |
|----------|---------|--------|
| **Security** | HTTPS, httpOnly cookies, sameSite, CSRF protection | ✅ |
| **Security** | Rate limiting (3-tier: API/Auth/Orders) | ✅ |
| **Security** | Input validation (Zod on all endpoints) | ✅ |
| **Security** | RBAC + ABAC authorization | ✅ |
| **Security** | SQL injection prevention (ORM) | ✅ |
| **Security** | Timing-safe token comparison | ✅ |
| **Resilience** | Circuit breaker (per-service configuration) | ✅ |
| **Resilience** | Retry with exponential backoff + jitter | ✅ |
| **Resilience** | Timeout protection (10s default) | ✅ |
| **Resilience** | Idempotent operations | ✅ |
| **Resilience** | Saga compensation (distributed rollback) | ✅ |
| **Resilience** | Dead letter queues | ✅ |
| **Resilience** | Graceful degradation (fallbacks) | ✅ |
| **Performance** | L1/L2 cache hierarchy | ✅ |
| **Performance** | Database connection pooling | ✅ |
| **Performance** | Bundle minification + tree-shaking | ✅ |
| **Performance** | Distributed lock (thundering herd prevention) | ✅ |
| **Observability** | Structured logging with correlation IDs | ✅ |
| **Observability** | Prometheus-compatible metrics | ✅ |
| **Observability** | Health check aggregation (K8s probes) | ✅ |
| **Observability** | Distributed tracing (AsyncLocalStorage) | ✅ |
| **Scalability** | Stateless servers (sessions in DB) | ✅ |
| **Scalability** | Event-driven decoupling (42 event types) | ✅ |
| **Scalability** | Multi-region routing (5 regions) | ✅ |
| **Scalability** | Service registry + load balancing | ✅ |
| **Data** | Event sourcing (immutable audit trail) | ✅ |
| **Data** | CQRS (optimized read/write) | ✅ |
| **Data** | UUID primary keys (no sequence contention) | ✅ |
| **Integration** | Enterprise ERP (SAP via Anti-Corruption Layer) | ✅ |
| **Integration** | SSO (Keycloak OIDC) | ✅ |
| **ML/AI** | Recommendation engine, ETA prediction, fraud detection | ✅ |

**What separates this from a "toy project":**

1. **Error handling is comprehensive** — Structured errors with correlation IDs, appropriate HTTP codes, production/dev-aware responses.
2. **State transitions are validated** — FSM prevents invalid order flows.
3. **Data consistency is protected** — Saga + compensation + idempotency.
4. **Performance is designed, not accidental** — Cache hierarchy with TTL tuning, connection pooling, selective bundling.
5. **Observability is built-in** — Every request traceable end-to-end via correlation IDs.
6. **Security is layered** — 10 defense layers, not just "add auth".
7. **Enterprise integration** — SAP via ACL shows real-world ERP connectivity.
8. **ML capabilities** — Data-driven features, not just CRUD.

---
