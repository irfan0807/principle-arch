# FoodDash — High-Level Design (HLD) Interview Q&A (50 Questions)

## For 6+ Years Fullstack Engineer | Architecture · Scalability · Distributed Systems · Cloud Design

> **Project**: FoodDash — Production-Grade Food Delivery Platform  
> **Architecture**: Microservices + Event-Driven + CQRS + Saga + Hexagonal Architecture  
> **Infrastructure**: Event Bus, L1/L2 Cache, Circuit Breaker, Rate Limiter, Message Queue, Service Registry, Multi-Region  
> **Last Updated**: February 2026

---

## Q1: What is High-Level Design (HLD) and how does it differ from Low-Level Design (LLD)?

**Answer:**

| Aspect | HLD | LLD |
|--------|-----|-----|
| **Focus** | System-wide architecture, service boundaries, data flow | Class-level design, function signatures, algorithms |
| **Audience** | Architects, tech leads, stakeholders | Developers implementing features |
| **Artifacts** | Architecture diagrams, service topology, data flow diagrams | Class diagrams, sequence diagrams, API contracts |
| **Decisions** | Which database? Monolith vs microservices? Sync vs async? | Which design pattern? How to implement the cache? |
| **Granularity** | Boxes and arrows (services, queues, databases) | Methods, interfaces, data structures |

**FoodDash HLD decisions:**
- Microservices architecture (16 services) instead of monolith
- PostgreSQL as primary database
- Event-driven communication via Event Bus
- L1/L2 caching hierarchy
- CQRS for read/write separation in Order Service
- Saga pattern for distributed transactions

**FoodDash LLD decisions:**
- `BaseService` abstract class with `executeWithResilience()` method
- Circuit breaker state machine (CLOSED → OPEN → HALF-OPEN)
- Cosine similarity algorithm for ML recommendations
- Drizzle ORM schema definitions with Zod validation

---

## Q2: Walk through the HLD of the FoodDash food delivery platform.

**Answer:**

**Step 1 — Functional Requirements:**
- Customers: Browse restaurants, search, view menus, place orders, track delivery in real-time, apply coupons
- Restaurant owners: Manage menus, accept/reject orders, view analytics, set business hours
- Delivery partners: Go online/offline, accept deliveries, share live GPS location
- Admin: Manage users, restaurants, coupons, disputes, platform analytics

**Step 2 — Non-Functional Requirements:**
- **Latency**: Order placement < 500ms, search < 200ms
- **Availability**: 99.9% uptime (< 8.7 hours downtime/year)
- **Scalability**: 10K concurrent orders, 100K daily users
- **Consistency**: Orders — strong consistency. Restaurant catalog — eventual consistency.

**Step 3 — Capacity Estimation:**
```
Daily orders: 50,000
Peak orders/sec: 50,000 / 86,400 × 5 (peak factor) ≈ 30 orders/sec
Average order size: 2KB (metadata + items)
Daily storage: 50,000 × 2KB = 100MB/day ≈ 36GB/year
WebSocket connections (peak): 20,000 concurrent (customers tracking orders + delivery partners)
```

**Step 4 — High-Level Architecture:**

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Mobile/    │────▶│  CDN / Edge  │────▶│  API Gateway │
│   Web App    │     │   Network    │     │  (Rate Limit │
│   (React)    │     │              │     │   + Auth)    │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
        ┌─────────────┬──────────────┬────────────┼────────────┬─────────────┐
        ▼             ▼              ▼            ▼            ▼             ▼
  ┌──────────┐ ┌──────────┐  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
  │  Auth    │ │Restaurant│  │  Order   │ │ Payment  │ │ Delivery │ │  Search  │
  │ Service  │ │ Service  │  │ Service  │ │ Service  │ │ Service  │ │ Service  │
  └────┬─────┘ └────┬─────┘  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
       │             │             │             │             │             │
       └─────────────┴──────┬──────┴─────────────┴─────────────┴─────────────┘
                            │
                     ┌──────▼───────┐
                     │  Event Bus   │
                     │  (Pub/Sub)   │
                     └──────┬───────┘
                            │
              ┌─────────────┼──────────────┐
              ▼             ▼              ▼
       ┌──────────┐  ┌──────────┐  ┌──────────┐
       │PostgreSQL│  │  Redis   │  │ Message  │
       │ (Primary)│  │ (Cache)  │  │  Queue   │
       └──────────┘  └──────────┘  └──────────┘
```

**Step 5 — Key Design Decisions:**
1. **API Gateway** — Single entry point with rate limiting, auth, correlation ID
2. **Microservices** — Each service owns its domain and data
3. **Event Bus** — Async communication, loose coupling between services
4. **CQRS** — Order Service separates read/write paths for performance
5. **Saga** — Distributed transactions (order creation spans 4 services)
6. **L1/L2 Cache** — In-memory + Redis for low-latency reads

---

## Q3: How do you decide between a monolith and microservices architecture?

**Answer:**

**Decision framework:**

| Factor | Monolith | Microservices |
|--------|----------|---------------|
| Team size | < 10 developers | 10+ developers, multiple teams |
| Domain complexity | Simple, few bounded contexts | Complex, many bounded contexts |
| Deployment frequency | Monthly releases | Daily/continuous deployments |
| Scaling needs | Uniform scaling | Independent service scaling |
| Operational maturity | Limited DevOps | Mature CI/CD, observability |
| Latency tolerance | Tight coupling OK | Network latency acceptable |

**FoodDash's approach — Modular Monolith → Microservices:**

FoodDash starts as a **modular monolith** that internally follows microservices boundaries:

```
Single Process
├── AuthIdentityService     (Port 3001 — logical)
├── RestaurantService       (Port 3002 — logical)
├── OrderService            (Port 3004 — logical)
├── PaymentService          (Port 3006 — logical)
├── DeliveryPartnerService  (Port 3005 — logical)
└── ... (16 services total)
```

**Why this hybrid approach:**
1. **Avoids premature distribution** — No service mesh, container orchestration, distributed tracing infrastructure needed at launch.
2. **Maintains boundaries** — Each service communicates via the Event Bus and has independent health checks.
3. **Extraction-ready** — Port assignments and service isolation mean any service can be deployed independently when scaling demands it.

**When to extract to true microservices:**
- Order Service needs 10x the resources of Auth Service
- Teams own different services and need independent deployment cycles
- Regulatory requirements isolate payment processing

---

## Q4: How would you design the API Gateway layer for FoodDash?

**Answer:**

**Responsibilities:**

```
Request → Rate Limiter → Auth Middleware → Correlation ID → Metrics → Route → Service
```

1. **Rate Limiting** — Protects downstream services from abuse:
   - API routes: 100 requests/minute per IP
   - Auth routes: 10 requests/15 minutes (brute force protection)
   - Order routes: 10 requests/minute (prevent order spam)

2. **Authentication** — Validates session cookies/JWT tokens before forwarding to services.

3. **Correlation ID** — Generates a unique ID per request using `AsyncLocalStorage` for end-to-end tracing across all services.

4. **Metrics** — Records `api.requests`, `api.response_time`, `api.status.{code}` for every request.

5. **Routing** — Maps URLs to microservices:
```
/api/v1/auth/*           → AuthIdentityService
/api/v1/restaurants/*    → RestaurantService
/api/v1/orders/*         → OrderService + SagaOrchestrator
/api/v1/tracking/*       → LiveOrderTrackingService
/api/v1/payments/*       → PaymentService
/api/v1/delivery-partners/* → DeliveryPartnerService
/api/v1/search/*         → SearchDiscoveryService
/api/v1/admin/*          → AdminService
/api/health              → Health aggregation (all services)
/api/health/live         → Kubernetes liveness probe
/api/health/ready        → Kubernetes readiness probe
/api/metrics             → Prometheus metrics endpoint
```

6. **Error Handling** — Consistent error responses with correlation IDs. Stack traces hidden in production.

**Why not an off-the-shelf gateway (Kong, AWS API Gateway)?**
- FoodDash's gateway is embedded (Express middleware), avoiding network hops.
- At scale, you'd extract to Kong/Envoy for features like canary deployments, request transformation, and circuit breaking at the edge.

---

## Q5: How would you design the database schema for a food delivery system?

**Answer:**

**Entity Relationship Diagram:**

```
users ──┬──< restaurants ──┬──< menu_categories ──< menu_items
        │                  ├──< orders ──┬──< order_items
        │                  │             ├──< order_events (Event Sourcing)
        │                  │             └──── reviews
        │                  └──< coupons
        ├──< delivery_partners ──< orders (via deliveryPartnerId)
        ├──< notifications
        └──── sessions (auth sessions)
```

**11 Core Tables:**

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | All user types | id (UUID), email, role (enum: customer/restaurant_owner/delivery_partner/admin), lat/lng |
| `restaurants` | Restaurant profiles | ownerId (FK→users), cuisine, rating, deliveryTime, isActive, openingTime/closingTime |
| `menu_categories` | Menu sections | restaurantId (FK), name, sortOrder |
| `menu_items` | Individual dishes | restaurantId (FK), categoryId (FK), price, isAvailable, isVegetarian |
| `orders` | Order records | customerId, restaurantId, deliveryPartnerId, status (FSM enum), total, idempotencyKey (UNIQUE) |
| `order_items` | Line items | orderId (FK), menuItemId (FK), quantity, price |
| `order_events` | Event sourcing log | orderId (FK), eventType, data (JSONB), timestamp |
| `delivery_partners` | Driver profiles | userId (FK), vehicleType, status (online/offline/busy), lat/lng, rating |
| `coupons` | Discount codes | code (UNIQUE), discountPercent, minOrder, maxDiscount, validFrom/validUntil, maxUsage |
| `notifications` | User notifications | userId (FK), type, title, data (JSONB), isRead |
| `sessions` | Auth sessions | sid, sess (JSONB), expire |

**Key Design Decisions:**
1. **UUID primary keys** — No sequence contention across distributed nodes. `gen_random_uuid()`.
2. **Enums for finite sets** — `user_role`, `order_status`, `payment_status`, `delivery_partner_status`.
3. **JSONB for flexible data** — `order_events.data`, `notifications.data`, `sessions.sess`.
4. **Decimal precision** — `DECIMAL(10,2)` for money, `DECIMAL(10,7)` for GPS coordinates.
5. **Idempotency key** — `orders.idempotencyKey` with UNIQUE constraint prevents duplicate orders.
6. **Soft deletes** — `isActive: false` instead of DELETE to preserve referential integrity and analytics.

---

## Q6: How does FoodDash handle distributed transactions across microservices?

**Answer:**

FoodDash uses the **Saga Orchestrator Pattern** — not two-phase commit (2PC):

**Why not 2PC:**
- Blocks all participants during the commit phase (high latency)
- Single coordinator failure blocks the entire transaction
- Doesn't work well across network boundaries

**Saga Orchestrator Flow for Order Creation:**

```
SagaOrchestrator.execute("place_order", orderData)
│
├── Step 1: validate_order
│   ├── Execute: Check restaurant is active, menu items available
│   └── Compensate: (no-op — read-only)
│
├── Step 2: create_order
│   ├── Execute: Insert order record + order items in DB
│   └── Compensate: Cancel order, set status to "cancelled"
│
├── Step 3: process_payment
│   ├── Execute: Charge customer via PayPal
│   └── Compensate: Refund payment
│
└── Step 4: notify_restaurant
    ├── Execute: Send notification + WebSocket event
    └── Compensate: Send cancellation notification
```

**Compensation flow (on failure):**
If Step 3 (payment) fails:
1. Step 2 compensated → Order cancelled in DB
2. Step 1 compensated → No-op
3. Customer receives failure notification

**Each step has:**
- `execute()` — Forward operation
- `compensate()` — Backward rollback
- `timeout` — Per-step timeout (default 30s)
- `retries` — Per-step retry count (default 3)

**Key property:** Compensations are **idempotent** — running them multiple times produces the same result. This is critical because compensations themselves might fail and need retrying.

---

## Q7: How would you design the caching architecture for FoodDash?

**Answer:**

**L1/L2 Cache Hierarchy:**

```
Read Path:
  Client Request
      │
      ▼
  L1 Cache (In-Memory, per-node)
  ├── HIT → Return instantly (< 1ms)
  └── MISS
      │
      ▼
  L2 Cache (Redis, distributed)
  ├── HIT → Populate L1, Return (< 5ms)
  └── MISS
      │
      ▼
  Database (PostgreSQL)
  └── Populate L1 + L2, Return (10-50ms)

Write Path:
  Data Changed
      │
      ▼
  Update Database
      │
      ▼
  Invalidate L1 (local)
      │
      ▼
  Invalidate L2 (Redis)
      │
      ▼
  Pub/Sub to other nodes → They invalidate their L1
```

**Cache TTLs by resource:**

| Resource | TTL | Invalidation Trigger | Reason |
|----------|-----|---------------------|--------|
| All restaurants | 5 min | Create/update restaurant | Changes rarely |
| Single restaurant | 5-10 min | Update restaurant | Semi-static |
| Restaurant menu | 5 min | Menu item CRUD | Moderate changes |
| Single order | 1 min | Status change | Frequently changing |
| Order details (aggregate) | 30 sec | Status change | Joins 3 tables |
| Order events | 30 sec | New event | Append-only |
| Restaurant stats | 30 min | New order/review | Analytics data |
| Active coupons | 5 min | Coupon CRUD | Moderate changes |
| Search index | On change | Restaurant/menu updates | Search relevance |

**Thundering Herd Prevention:**
When a popular restaurant's cache expires and 1000 requests arrive simultaneously:
```typescript
// Only ONE process fetches from DB; others wait for the result
const data = await distributedCache.getOrSetWithLock(
  "restaurant:popular-123",
  () => db.select().from(restaurants).where(eq(id, "popular-123")),
  { ttl: 300, lockTtl: 5000 }
);
```
Uses Redis `SETNX` as a distributed lock. First caller acquires the lock, fetches data, populates cache. Other callers wait and read from cache.

---

## Q8: How would you design the real-time order tracking system?

**Answer:**

**Architecture:**

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Delivery App │────▶│   Express    │────▶│  Event Bus   │
│ (GPS Update) │ REST│   Server     │     │  (Pub/Sub)   │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                           ┌──────────────────────┼──────────────┐
                           ▼                      ▼              ▼
                    ┌──────────────┐    ┌──────────────┐  ┌──────────┐
                    │  WebSocket   │    │  Tracking    │  │  Cache   │
                    │   Manager    │    │  Service     │  │  (Redis) │
                    │ (per-user)   │    │              │  │          │
                    └──────┬───────┘    └──────────────┘  └──────────┘
                           │
                    ┌──────▼───────┐
                    │   Customer   │
                    │   Browser    │
                    │ (WebSocket)  │
                    └──────────────┘
```

**Data Flow:**
1. Delivery partner's app sends GPS update every 5 seconds: `PUT /api/v1/tracking/:orderId/location`
2. Server stores location in Redis cache (5-minute TTL) for fast access
3. Server publishes `RIDER_LOCATION_UPDATE` event to Event Bus
4. WebSocket handler subscribes to the event, broadcasts to the customer's WebSocket connection
5. Customer's browser receives the update and moves the map marker

**WebSocket Connection Management:**
```typescript
// Server maintains a Map: userId → Set<WebSocket>
// Multiple connections per user (multiple tabs/devices)
const clients = new Map<string, Set<WebSocket>>();

broadcastToUser(userId, { type: "location_update", data: { lat, lng, heading, speed } });
```

**Tracking Data Model:**
```typescript
interface TrackingInfo {
  orderId: string;
  currentStatus: string;
  steps: TrackingStep[];                    // 6 ordered steps with completion status
  timeline: TimelineEntry[];                // Historical events from order_events
  estimatedDelivery: { time: Date; remainingMinutes: number };
  deliveryPartner?: { name, phone, vehicle, rating };
  currentLocation?: { latitude, longitude, heading, speed, updatedAt };
}
```

**Scale considerations:**
- At 20K concurrent WebSocket connections, a single server handles ~50K connections (Node.js is good at this)
- For >50K connections: Shard by userId hash across multiple WebSocket servers
- Use Redis Pub/Sub for cross-server message broadcasting

---

## Q9: How would you design the search and discovery system?

**Answer:**

**Search Architecture:**

```
User Query → API Gateway → Search Service
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼              ▼
          Full-Text     Geo-Spatial     Faceted
          Search        Search          Filters
                ▼             ▼              ▼
                └─────────────┼─────────────┘
                              ▼
                    Relevance Scoring
                              ▼
                    Ranked Results
```

**Search Features:**

1. **Full-text search** — Search by restaurant name, cuisine, menu item name
2. **Geo-spatial search** — Find restaurants within X km using Haversine distance formula:
   ```
   distance = 2 × R × arcsin(√(sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlng/2)))
   ```
3. **Faceted filters** — Cuisine type, vegetarian, rating > 4.0, delivery time < 30 min, price range
4. **Autocomplete** — Typeahead suggestions as user types
5. **Trending** — Track popular searches and surface trending restaurants

**Relevance Scoring:**
```
Score = (0.30 × textRelevance) + (0.25 × distance) + (0.20 × rating) + (0.15 × popularity) + (0.10 × freshness)
```

**Current implementation (PostgreSQL):**
- `ILIKE` for text search with index support
- Haversine formula computed in application code
- Results sorted by composite score

**At scale (Elasticsearch):**
```sql
-- PostgreSQL full-text search index
CREATE INDEX idx_restaurants_search
  ON restaurants USING gin(to_tsvector('english', name || ' ' || cuisine || ' ' || description));

-- Geospatial index
CREATE INDEX idx_restaurants_location
  ON restaurants USING gist(point(longitude, latitude));
```

**Scaling path:** PostgreSQL → Elasticsearch (inverted index, built-in geo-queries, fuzzy matching, aggregations).

---

## Q10: How would you design the payment processing system?

**Answer:**

**HLD:**

```
┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌──────────┐
│ Checkout │───▶│  Order   │───▶│   Payment    │───▶│  PayPal  │
│  Page    │    │ Service  │    │   Service    │    │   API    │
└──────────┘    └──────────┘    └──────┬───────┘    └──────────┘
                                       │
                                ┌──────▼───────┐
                                │   Circuit    │
                                │   Breaker    │
                                └──────────────┘
```

**Payment Flow:**
1. Customer clicks "Place Order"
2. Order Service creates order with `idempotencyKey`
3. Saga Step 3 triggers Payment Service
4. Payment Service calls PayPal via Circuit Breaker (threshold: 3 failures, reset: 60s)
5. On success → `PAYMENT_SUCCESS` event published
6. On failure → Saga compensates (cancel order)

**Idempotency:**
```typescript
// Prevent duplicate charges
const existing = await checkIdempotencyKey(request.idempotencyKey);
if (existing) return existing; // Return cached result

const result = await paypalClient.capturePayment(paymentId);
await storeIdempotencyResult(request.idempotencyKey, result);
```

**Multiple Payment Methods (Strategy Pattern):**

| Method | Implementation | Use Case |
|--------|---------------|----------|
| PayPal | PayPal Server SDK | Online payments |
| Credit Card | Stripe API (future) | Direct card payments |
| Cash on Delivery | Status tracking only | Cash preference markets |
| Wallet | Internal ledger | Pre-loaded balance |

**Refund Flow:**
```
Customer Request → Admin Approval → Payment Service → PayPal Refund API
                                         │
                                         ▼
                                   Update order status → "refunded"
                                   Publish PAYMENT_REFUNDED event
                                   Notify customer via WebSocket
```

**Security:**
- PCI DSS compliance: FoodDash never stores card details (PayPal handles tokenization)
- All payment operations wrapped in Circuit Breaker
- Idempotency keys prevent double charges
- Payment circuit breaker is MORE cautious: threshold 3 (vs 5 default), reset 60s (vs 30s)

---

## Q11: How would you design the notification system?

**Answer:**

**Architecture:**

```
Event Source → Event Bus → Notification Service → Channel Router
                                                       │
                                    ┌──────────────────┼──────────────────┐
                                    ▼                  ▼                  ▼
                              ┌──────────┐      ┌──────────┐      ┌──────────┐
                              │   Push   │      │  Email   │      │   SMS    │
                              │Notification│     │ Service  │      │ Service  │
                              └──────────┘      └──────────┘      └──────────┘
                                    │                  │                  │
                                    ▼                  ▼                  ▼
                              ┌──────────┐      ┌──────────┐      ┌──────────┐
                              │In-App/WS │      │  SMTP    │      │ Twilio   │
                              └──────────┘      └──────────┘      └──────────┘
```

**Notification Types & Channels:**

| Event | Recipients | Channels | Priority |
|-------|-----------|----------|----------|
| Order placed | Restaurant owner | Push + Sound + In-App | Critical |
| Order confirmed | Customer | Push + In-App | High |
| Order preparing | Customer | In-App | Medium |
| Rider assigned | Customer + Rider | Push + In-App | High |
| Order delivered | Customer | Push + Email + In-App | High |
| Promotional offer | Customers (batch) | Email + Push | Low |

**Priority Queue:**
```
Critical (P0) → Processed immediately, max 3 retries
High (P1)     → Processed within 5 seconds
Medium (P2)   → Processed within 30 seconds
Low (P3)      → Batched, processed every 5 minutes
```

**Dead Letter Queue (DLQ):**
Failed notifications (after max retries) are sent to `dlq.notifications` for manual inspection. This prevents notification failures from blocking the queue.

**Template System:**
```typescript
const templates = {
  ORDER_CONFIRMED: {
    title: "Order Confirmed! 🎉",
    body: "Your order from {{restaurantName}} is confirmed. ETA: {{eta}} minutes.",
    channels: ["push", "in-app"],
  },
  RIDER_ASSIGNED: {
    title: "Rider on the way! 🏍️",
    body: "{{riderName}} is picking up your order from {{restaurantName}}.",
    channels: ["push", "in-app"],
  },
};
```

---

## Q12: How would you design the authentication and authorization system?

**Answer:**

**Multi-Provider Authentication HLD:**

```
┌──────────┐   ┌──────────┐   ┌──────────────┐
│ Google   │   │ Phone    │   │  Keycloak    │
│ OAuth2.0 │   │ OTP      │   │  SSO (OIDC)  │
└────┬─────┘   └────┬─────┘   └──────┬───────┘
     │              │                 │
     └──────────────┼─────────────────┘
                    ▼
          ┌──────────────────┐
          │   Passport.js    │
          │  Session Store   │
          │  (PostgreSQL)    │
          └────────┬─────────┘
                   ▼
          ┌──────────────────┐
          │  User Upsert     │  ← findOrCreate pattern
          │  (DB)            │
          └──────────────────┘
```

**Authorization — RBAC + ABAC:**

**Role-Based Access Control (4 roles):**
```
customer:          order:create, order:read, profile:read/update
restaurant_owner:  restaurant:CRUD, menu:CRUD, order:read/update
delivery_partner:  delivery:read/update, order:read/update
admin:             *:* (full access)
```

**Attribute-Based Access Control:**
```
restaurant:update → Only if context.resourceOwnerId === context.userId
order:update      → Only if context.assignedPartnerId === context.userId
```

**Session Security:**
```
Cookie: httpOnly (no XSS), secure (HTTPS only in prod), sameSite: "lax" (CSRF protection)
Store: PostgreSQL (survives server restarts)
TTL: 7 days
```

**JWT Token Management:**
```
Access Token:  1 hour, HMAC-SHA256, contains { sub, email, role }
Refresh Token: 7 days, stored server-side
Timing-safe comparison: crypto.timingSafeEqual() to prevent timing attacks
```

---

## Q13: How would you design the restaurant management system?

**Answer:**

**HLD:**

```
Restaurant Owner App → API Gateway → Restaurant Service
                                          │
                              ┌───────────┼───────────┐
                              ▼           ▼           ▼
                        Restaurant    Menu Service  Analytics
                          CRUD         (Menu +      Service
                        (CQRS)       Categories)   (Read Model)
```

**CQRS Pattern for Restaurant Service:**
- **Command side (writes):** Create/update restaurant, toggle active status, update hours
- **Query side (reads):** List restaurants (cached 5 min), search with geo-filters, get stats (cached 30 min)

**Key features:**
1. **Geo-spatial queries** — Find restaurants within radius using Haversine formula
2. **Business hours** — `openingTime`/`closingTime` fields, auto-filter inactive restaurants
3. **Rating system** — Running average: `newRating = ((oldRating × totalRatings) + newScore) / (totalRatings + 1)`
4. **Menu management** — Categories with `sortOrder`, items with `isAvailable` toggle
5. **Analytics** — Revenue, order count, popular items, peak hours (read from CQRS query model)

**Cache Strategy:**
- Restaurant list: 5-min TTL, invalidated on create/update
- Single restaurant: 5-10 min TTL
- Restaurant stats: 30-min TTL (analytics aren't real-time)
- Menu: 5-min TTL, invalidated on any menu CRUD

---

## Q14: How would you design the delivery partner assignment algorithm?

**Answer:**

**Assignment Flow:**

```
Order Ready for Pickup
        │
        ▼
Find Available Partners (within 5km radius)
        │
        ▼
Score Each Partner (multi-factor)
        │
        ▼
Assign Top-Scoring Partner
        │
        ▼
Notify Partner (WebSocket + Push)
        │
        ├── Accept → Status: "assigned", start navigation
        └── Reject/Timeout (60s) → Try next partner
```

**Scoring Algorithm:**
```
Score = distance_score + rating_score + load_score + completion_score

distance_score   = max(0, 100 - distance_km × 10)    // 0-100, closer is better
rating_score     = partner.rating × 10                 // 0-50
load_score       = max(0, 50 - activeOrders × 10)     // 0-50, fewer orders is better
completion_score = completionRate × 50                  // 0-50
```

**Geo-spatial matching:**
```typescript
// Haversine distance between partner and restaurant
const distance = 2 * R * asin(sqrt(
  sin²((lat2 - lat1) / 2) + cos(lat1) * cos(lat2) * sin²((lng2 - lng1) / 2)
));
```

**Scale considerations:**
- **Geohash indexing** — At scale, use geohash to bucket partners into grid cells for O(1) lookups instead of computing Haversine for every partner.
- **Assignment queue** — During peak hours, use a priority queue for pending assignments.
- **Surge pricing** — When demand > supply, increase delivery fees to attract more partners online.

---

## Q15: How would you design the event-driven architecture?

**Answer:**

**Event Bus Architecture:**

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Publisher   │────▶│  Event Bus   │────▶│  Subscriber  │
│  (Service)   │     │  (In-Memory) │     │  (Service)   │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                     ┌──────▼───────┐
                     │  Event Log   │
                     │ (Last 1000)  │
                     └──────────────┘
```

**42 Event Types across 8 Domains:**

| Domain | Events | Examples |
|--------|--------|---------|
| Order | 8 | ORDER_CREATED, ORDER_CONFIRMED, ORDER_PREPARING, ORDER_DELIVERED, ORDER_CANCELLED |
| Payment | 4 | PAYMENT_INITIATED, PAYMENT_SUCCESS, PAYMENT_FAILED, PAYMENT_REFUNDED |
| Delivery | 3 | RIDER_ASSIGNED, RIDER_LOCATION_UPDATE, DELIVERY_COMPLETED |
| Notification | 1 | SEND_NOTIFICATION |
| Restaurant | 1 | RESTAURANT_UPDATED |
| Menu | 1 | MENU_UPDATED |
| User | 2 | USER_REGISTERED, USER_UPDATED |
| Service | 2 | SERVICE_HEALTH_CHANGED, SERVICE_REGISTERED |

**Event Structure:**
```typescript
interface Event {
  id: string;              // Unique event ID
  type: string;            // Event type (e.g., "ORDER_CREATED")
  data: unknown;           // Event payload
  correlationId: string;   // Request tracing
  source: string;          // Publishing service name
  timestamp: Date;         // When event was published
}
```

**Production Features:**
- **Wildcard subscriptions** — `subscribe("*", handler)` captures all events (useful for analytics)
- **Event log** — Last 1000 events stored for debugging
- **Correlation ID propagation** — Events carry request context
- **Error isolation** — Failed handler doesn't block other subscribers
- **Dead Letter Queues** — Failed messages routed to DLQ after max retries

**Scaling path:**
- Current: In-process EventEmitter (single node)
- At scale: Replace with Apache Kafka (persistent, partitioned, replay-able) or RabbitMQ (routing, priorities)

---

## Q16: How would you design the CQRS (Command Query Responsibility Segregation) pattern?

**Answer:**

**CQRS in FoodDash's Order Service:**

```
                    ┌──────────────────────┐
                    │     API Gateway      │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                                  ▼
     ┌──────────────┐                   ┌──────────────┐
     │ Command Side │                   │  Query Side  │
     │  (Writes)    │                   │  (Reads)     │
     ├──────────────┤                   ├──────────────┤
     │ createOrder  │                   │ getOrder     │
     │ updateStatus │                   │ getWithDetails│
     │ cancelOrder  │                   │ queryOrders  │
     └──────┬───────┘                   └──────┬───────┘
            │                                  │
            ▼                                  ▼
     ┌──────────────┐                   ┌──────────────┐
     │  PostgreSQL  │────events────▶    │    Cache     │
     │  (Source of  │                   │  (L1/L2)     │
     │   Truth)     │                   │  (Read Model)│
     └──────────────┘                   └──────────────┘
```

**Command Side:**
- Validates input with Zod schemas
- Checks idempotency key
- Executes business logic (status FSM validation)
- Persists to PostgreSQL
- Records event in `order_events` table (Event Sourcing)
- Publishes event to Event Bus
- Invalidates read cache

**Query Side:**
- Reads from cache first (L1 → L2 → DB)
- Short TTLs for frequently-changing data (order: 1 min, order details: 30 sec)
- Aggregates data from multiple tables
- Filters and sorts in memory for complex queries

**Why CQRS for Orders:**
1. **Different read/write patterns** — Writes are complex (saga, validation, events). Reads need to be fast (cache-first).
2. **Different scaling needs** — Reads outnumber writes 10:1. Cache absorbs read load.
3. **Audit trail** — Event Sourcing on the write side gives complete order history.

---

## Q17: How would you design the circuit breaker pattern?

**Answer:**

**State Machine:**

```
        ┌─────────┐
        │ CLOSED  │ ◄── Normal operation, requests flow through
        │         │
        └────┬────┘
             │ failure_count >= threshold (5)
        ┌────▼────┐
        │  OPEN   │ ◄── Fail-fast mode, all requests rejected
        │         │     Execute fallback if provided
        └────┬────┘
             │ reset_timeout elapsed (30s)
        ┌────▼────┐
        │HALF-OPEN│ ◄── Testing mode, limited requests allowed
        │         │
        └────┬────┘
             │ success_count >= 3 → CLOSED
             │ any failure → OPEN
```

**FoodDash's Circuit Breaker Configuration:**

| Circuit Breaker | Threshold | Reset Timeout | Half-Open Requests | Why |
|----------------|-----------|---------------|-------------------|-----|
| `externalServiceCircuitBreaker` | 5 failures | 30 seconds | 3 successes | Default for most services |
| `paymentCircuitBreaker` | 3 failures | 60 seconds | 3 successes | More cautious — payments are critical |

**Integration with BaseService:**
Every microservice operation is wrapped:
```
operation() → withTimeout(10s) → withRetry(3 attempts) → circuitBreaker.execute()
```

**Fallback strategies:**
- Payment service down → Return "payment pending, retry later" (don't block order)
- Restaurant service down → Serve from cache (stale data better than no data)
- Notification service down → Queue for later delivery (best-effort)
- Search service down → Return basic restaurant list without relevance scoring

---

## Q18: How would you handle rate limiting at the system level?

**Answer:**

**Rate Limiting Architecture:**

```
Client → API Gateway → Rate Limiter → Service
                          │
                   ┌──────▼───────┐
                   │ Sliding Window│
                   │  Per-IP Store │
                   └──────────────┘
```

**Three tiers in FoodDash:**

| Tier | Limit | Window | Endpoint | Purpose |
|------|-------|--------|----------|---------|
| Standard | 100 req | 1 minute | `/api/*` | General API protection |
| Strict | 10 req | 15 minutes | `/api/auth/*` | Brute force protection |
| Order | 10 req | 1 minute | `/api/orders` | Order spam prevention |

**Algorithm — Sliding Window Counter:**
```typescript
middleware(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  let entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
  }

  entry.count++;

  // Rate limit headers (RFC 6585 compliant)
  res.setHeader("X-RateLimit-Limit", maxRequests);
  res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - entry.count));
  res.setHeader("X-RateLimit-Reset", Math.ceil((entry.resetAt - now) / 1000));

  if (entry.count > maxRequests) {
    return res.status(429).json({
      error: "Too Many Requests",
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    });
  }
  next();
}
```

**At scale (distributed rate limiting):**
- Replace in-memory Map with Redis (shared across all API Gateway instances)
- Use Redis `INCR` + `EXPIRE` for atomic sliding window
- Consider token bucket algorithm for burst tolerance
- Add per-user rate limiting (not just per-IP) for authenticated endpoints

---

## Q19: How would you design the analytics and reporting system?

**Answer:**

**HLD:**

```
Event Sources (All Services)
        │
        ▼
   Event Bus → Analytics Service → CQRS Read Model
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
  ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ Platform │ │  Order   │ │ Revenue  │
  │ Analytics│ │ Analytics│ │ Analytics│
  └──────────┘ └──────────┘ └──────────┘
```

**Analytics Dimensions:**

| Dimension | Metrics | Update Frequency |
|-----------|---------|-----------------|
| **Platform** | Total users, orders, GMV, active restaurants | Real-time counters |
| **Orders** | Daily count, avg value, peak hours, status distribution | Per-order event |
| **Revenue** | Daily/weekly/monthly revenue, take rate, refund rate | Per-payment event |
| **Restaurants** | Per-restaurant orders, rating trends, popular items | Per-order + review |
| **Delivery** | Avg delivery time, partner utilization, on-time rate | Per-delivery event |

**Data Pipeline:**
1. Every service publishes events to Event Bus
2. Analytics Service subscribes to ALL events (wildcard `*`)
3. Events are aggregated into pre-computed read models
4. Dashboard queries read models (cached 30 min)

**At scale:**
- Event Bus → Kafka (persistent event stream)
- Analytics Service → Apache Flink / Spark Streaming (real-time aggregations)
- Read models → ClickHouse / TimescaleDB (time-series optimized)
- Dashboard → Grafana / custom React dashboard

---

## Q20: How does multi-region deployment work?

**Answer:**

**FoodDash's 5-Region Setup:**

| Region | Location | Role | Features |
|--------|----------|------|----------|
| `us-east-1` | Virginia | **Primary** | All writes, full feature set |
| `us-west-2` | Oregon | Failover | Read replicas, standby |
| `eu-west-1` | Ireland | EU operations | GDPR compliance, local reads |
| `ap-south-1` | Mumbai | APAC operations | Local reads |
| `ap-northeast-1` | Tokyo | APAC operations | Local reads |

**Region Routing Algorithm:**
```
Score = (0.4 × distanceScore) + (0.3 × healthScore) + (0.2 × replicationLag) + (0.1 × primaryBonus)
```

**Read/Write Splitting:**
```
Write Operations → Always route to Primary (us-east-1)
Read Operations  → Route to nearest healthy region (local replica)
```

**Failover:**
1. Health checks run every 30 seconds per region
2. If primary region health drops below threshold → automatic failover
3. Backup region promoted to primary
4. DNS updated (< 60 second TTL)
5. Cache invalidated globally via cross-region Pub/Sub

**Data Replication:**
- PostgreSQL streaming replication to read replicas
- Redis replication for cache consistency
- Event Bus events replicated to regional Kafka clusters

**Feature Flags per Region:**
```typescript
const regionFeatures = {
  "eu-west-1": ["gdpr", "cookie-consent", "data-residency"],
  "ap-south-1": ["upi-payments", "local-languages"],
  "us-east-1": ["ml-recommendations", "dynamic-pricing"],
};
```

---

## Q21: How would you design the coupon and offers system?

**Answer:**

**HLD:**

```
Customer applies coupon → Order Service → Offers/Coupon Service → Validation
                                                                      │
                                                          ┌───────────┼───────────┐
                                                          ▼           ▼           ▼
                                                    Check Code   Check Usage   Check Rules
                                                    (exists?)    (limit?)     (min order?)
                                                          │           │           │
                                                          └───────────┼───────────┘
                                                                      ▼
                                                              Apply Discount
```

**Coupon Data Model:**
```sql
coupons:
  id, code (UNIQUE), description,
  discountType (percentage | flat),
  discountValue, minOrderAmount, maxDiscount,
  validFrom, validUntil,
  maxUsageTotal, maxUsagePerUser,
  currentUsage, isActive,
  restaurantId (nullable — platform-wide if null)
```

**Validation Pipeline:**
1. **Code lookup** — Find by code, check `isActive`
2. **Date validation** — `validFrom <= now <= validUntil`
3. **Usage limits** — `currentUsage < maxUsageTotal`
4. **Per-user limits** — Track usage per customer per coupon
5. **Min order check** — `orderSubtotal >= minOrderAmount`
6. **Restaurant scope** — If `restaurantId` set, only applies to that restaurant

**Abuse Prevention:**
- Per-user usage tracking prevents multi-account abuse
- Rate limit on coupon validation endpoint (10/min)
- Coupons with `isActive: false` are soft-deleted, preserving analytics
- Bulk creation for marketing campaigns with batch ID tracking

---

## Q22: How would you design a GraphQL BFF (Backend for Frontend)?

**Answer:**

**Architecture:**

```
┌──────────────┐     ┌──────────────┐
│   React App  │────▶│  GraphQL BFF │
│   (Client)   │ GQL │  (Gateway)   │
└──────────────┘     └──────┬───────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │Restaurant│ │  Order   │ │  User    │
        │ Service  │ │ Service  │ │ Service  │
        └──────────┘ └──────────┘ └──────────┘
```

**Why BFF:**
1. **Client-specific aggregation** — Mobile needs different data shapes than web
2. **Reduce over-fetching** — Client requests exactly the fields it needs
3. **Single request** — One GraphQL query replaces 3-4 REST calls

**FoodDash GraphQL Schema:**
```graphql
type Query {
  restaurants(filter: RestaurantFilter): [Restaurant!]!
  restaurant(id: ID!): Restaurant
  orders: [Order!]!
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

**Key design decisions:**
- BFF resolvers call internal REST microservices (not direct DB access)
- DataLoader pattern for N+1 query prevention
- Subscriptions backed by WebSocket for real-time updates
- Schema stitching if multiple teams own different schema parts

---

## Q23: How would you design the ML recommendation engine?

**Answer:**

**HLD:**

```
User Request → ML Service → Feature Extraction → Scoring → Ranked Results
                                 │
                   ┌─────────────┼─────────────┐
                   ▼             ▼             ▼
             User Profile   Restaurant    Context
             (history,      (rating,      (time, weather,
              preferences)   cuisine)      location)
```

**Multi-Factor Scoring:**
```
Score = (0.30 × cuisineMatch) + (0.20 × ratingScore) + (0.20 × distanceScore) + (0.15 × priceScore) + (0.15 × historyScore)
```

**Factor Details:**
| Factor | Weight | Calculation | Range |
|--------|--------|------------|-------|
| Cuisine match | 30% | 1.0 if preferred, 0.5 if related, 0.1 otherwise | 0-1 |
| Rating score | 20% | `rating / 5.0` | 0-1 |
| Distance score | 20% | `1 - (distance / maxRadius)` | 0-1 |
| Price score | 15% | `1 - |userAvg - restaurantAvg| / maxPrice` | 0-1 |
| History score | 15% | Order frequency for this restaurant | 0-1 |

**Collaborative Filtering (Item-Item):**
```
cosine_similarity(A, B) = (A · B) / (||A|| × ||B||)
```
Used for "Customers who ordered X also ordered Y" recommendations.

**Other ML Features:**
1. **ETA Prediction** — `basePrepTime + travelTime + adjustments` (rush hour: +20%, weather: +15%)
2. **Fraud Detection** — Risk scoring based on: new user + high value, unusual amount, order velocity, address changes
3. **Dynamic Pricing** — `priceMultiplier = 1.0 + demandFactor + popularityFactor - competitionFactor` (capped at 1.5×)
4. **Demand Forecasting** — Predict order volume by time slot for restaurant prep planning

---

## Q24: How would you handle data consistency in a microservices architecture?

**Answer:**

**Consistency Spectrum:**

```
Strong Consistency ◄────────────────────────────► Eventual Consistency
   (Synchronous)                                    (Asynchronous)
   
   Orders, Payments    ──────────    Restaurant Catalog, Analytics
```

**FoodDash's approach by domain:**

| Domain | Consistency | Mechanism | Why |
|--------|-----------|-----------|-----|
| Order creation | Strong | Saga with compensation | Cannot have partial orders |
| Payment processing | Strong | Idempotency key + saga | Cannot double-charge |
| Order status | Strong | FSM validation | Invalid transitions corrupt state |
| Restaurant catalog | Eventual | Cache + TTL | Stale menu for 5 min is acceptable |
| Analytics | Eventual | Event-driven aggregation | Analytics lag is OK |
| Notifications | Best-effort | Event Bus + DLQ | Missing notification is not critical |
| Search index | Eventual | Event-driven rebuild | Search lag is OK |

**Mechanisms for consistency:**

1. **Saga Pattern** — Distributed transactions with compensation (order creation)
2. **Idempotency Keys** — Prevent duplicate operations (payments, orders)
3. **Event Sourcing** — Immutable event log as source of truth (order history)
4. **Cache Invalidation** — Write-through cache strategy for reads
5. **FSM Validation** — State machine prevents invalid transitions

---

## Q25: How would you design the admin dashboard and platform moderation?

**Answer:**

**HLD:**

```
Admin Dashboard (React) → API Gateway → Admin Service
                                            │
                      ┌─────────────────────┼─────────────────────┐
                      ▼                     ▼                     ▼
               User Management    Restaurant Moderation     Platform Config
               (CRUD + suspend)   (approve/reject/flag)    (coupons, fees)
                      │                     │                     │
                      ▼                     ▼                     ▼
              ┌──────────────┐    ┌──────────────┐     ┌──────────────┐
              │  Audit Log   │    │  Audit Log   │     │  Audit Log   │
              └──────────────┘    └──────────────┘     └──────────────┘
```

**Admin Features:**
1. **User management** — View all users, filter by role, suspend/unsuspend accounts
2. **Restaurant moderation** — Approve new restaurants, flag violations, toggle active status
3. **Order management** — View all orders, handle disputes, process refunds
4. **Coupon management** — Create/deactivate platform-wide coupons
5. **Platform configuration** — Commission rates, delivery fees, minimum order amounts
6. **Analytics** — GMV, daily orders, user growth, revenue trends

**Authorization:**
```
admin role → resource: "*", actions: ["*"]  // Full access
```

**Audit Logging:**
Every admin action is logged with:
```typescript
{
  adminId: string;
  action: string;        // "suspend_user", "approve_restaurant"
  targetType: string;    // "user", "restaurant", "order"
  targetId: string;
  changes: Record<string, { before: any; after: any }>;
  reason: string;
  timestamp: Date;
  correlationId: string;
}
```

**Bulk Operations:**
- Bulk user suspension (e.g., fraud ring detection)
- Bulk coupon creation (marketing campaigns)
- Bulk restaurant activation/deactivation (city-level operations)

---

## Q26: How would you design the observability stack?

**Answer:**

**Three Pillars of Observability:**

```
┌──────────────────────────────────────────────────────────┐
│                    OBSERVABILITY                          │
│                                                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────┐   │
│  │ Logging  │    │ Metrics  │    │ Distributed      │   │
│  │          │    │          │    │ Tracing          │   │
│  └──────────┘    └──────────┘    └──────────────────┘   │
│                                                          │
│  "What happened"  "How much"     "Where in the flow"    │
└──────────────────────────────────────────────────────────┘
```

**1. Structured Logging:**
```
2026-02-10T14:30:00.000Z INFO [order-service][corr-abc123] Order created {"orderId":"xyz"}
```
- Levels: DEBUG, INFO, WARN, ERROR
- Every entry: timestamp, level, service name, correlation ID, message, structured data
- Stack traces only in development

**2. Prometheus-Style Metrics:**
```
Counter:   api.requests, api.errors, order.created_total
Gauge:     active_orders, connected_websockets, cache_size
Histogram: api.response_time (p50, p90, p99), order.processing_time
Timer:     service.operation.duration_ms
```

**3. Distributed Tracing (Correlation IDs):**
```
Request → correlationId generated → propagated via AsyncLocalStorage
                                  → included in all logs
                                  → forwarded to downstream services via x-correlation-id header
                                  → returned in response headers
```

**Health Check Aggregation:**
```
GET /api/health → Aggregates health from all 16 services
  {
    "overall": "healthy",
    "services": [
      { "name": "order-service", "status": "healthy", "responseTime": 5 },
      { "name": "payment-service", "status": "degraded", "responseTime": 150 }
    ],
    "checks": { "totalServices": 16, "healthyServices": 15, "degradedServices": 1 }
  }
```

**Kubernetes probes:**
- `/api/health/live` — Liveness: Is the process running?
- `/api/health/ready` — Readiness: Can it handle requests?

---

## Q27: How would you design the SAP enterprise integration?

**Answer:**

**Anti-Corruption Layer (ACL) Pattern:**

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  FoodDash    │────▶│  Anti-Corruption │────▶│    SAP ERP   │
│  Domain      │     │    Layer (ACL)   │     │   System     │
│  Model       │     ├──────────────────┤     │              │
│              │     │ SAPDataTransformer│     │  LIFNR,NAME1│
│  vendor.name │◄────│ transforms both   │◄────│  ORT01,MATNR│
│  vendor.city │     │ directions        │     │              │
└──────────────┘     └──────────────────┘     └──────────────┘
```

**Why ACL:**
SAP uses German field names (LIFNR = Lieferantennummer = vendor number). Without ACL, SAP naming would leak into FoodDash's domain model, creating confusion.

**Field Mapping:**
```
FoodDash Domain              SAP Field
─────────────────           ─────────────────
vendor.id              ←→   LIFNR
vendor.name            ←→   NAME1
vendor.city            ←→   ORT01
material.id            ←→   MATNR
material.name          ←→   MAKTX
purchaseOrder.id       ←→   EBELN
```

**Event-Driven Sync:**
```
ORDER_DELIVERED → SAPIntegrationService → Create SAP Sales Order
PAYMENT_SUCCESS → SAPIntegrationService → Create SAP Finance Document
```

**RFC Connection with Circuit Breaker:**
SAP RFC calls are wrapped in the circuit breaker — if SAP is down, FoodDash continues operating and syncs when SAP recovers.

---

## Q28: How would you design for horizontal scaling?

**Answer:**

**Scaling Strategy by Component:**

| Component | Current | At Scale | Strategy |
|-----------|---------|----------|----------|
| API Server | Single process | N instances behind LB | Stateless (sessions in PostgreSQL) |
| WebSocket | In-process | Sharded by userId | Redis Pub/Sub for cross-node broadcast |
| Cache | L1 in-memory | L1 + Redis Cluster | L1/L2 with Pub/Sub invalidation |
| Database | Single PostgreSQL | Primary + read replicas | CQRS reads from replicas |
| Message Queue | In-memory | Kafka/RabbitMQ cluster | Partitioned by topic |
| Services | In-process modules | Separate K8s pods | Container orchestration |
| Search | PostgreSQL queries | Elasticsearch cluster | Inverted index, sharded |
| ML | In-process scoring | Separate ML service | GPU instances for training |

**Stateless API Design:**
```
Session → PostgreSQL (not in-memory)
Cache → Redis (not in-memory Map)
File uploads → S3 (not local filesystem)
WebSocket state → Redis Pub/Sub (not in-process Map)
```

**Database Scaling:**
```
Write Operations → Primary Database (us-east-1)
Read Operations  → Nearest Read Replica (region-local)
```

**Auto-scaling triggers:**
- CPU > 70% → Scale out API servers
- Memory > 80% → Scale out
- Request queue depth > 100 → Scale out
- WebSocket connections > 40K per node → Add WebSocket servers

---

## Q29: How would you design the message queue system?

**Answer:**

**Multi-Transport Abstraction:**

```
┌──────────────┐
│ Application  │
│ Code         │
└──────┬───────┘
       │ publish() / subscribe()
┌──────▼───────┐
│ MessageQueue │   ← Transport-agnostic interface
│  Abstraction │
└──────┬───────┘
       │
┌──────▼───────────────────────────────────┐
│ Transport Backends (pluggable)            │
├──────────┬───────────┬──────────┬────────┤
│ RabbitMQ │ Kafka     │ AWS SQS  │In-Memory│
└──────────┴───────────┴──────────┴────────┘
```

**24 Predefined Topics:**
```
order.created, order.status.changed, order.cancelled
payment.process, payment.completed, payment.failed
delivery.assign, delivery.completed
notification.send, notification.email, notification.sms
analytics.event, user.action, system.metric
dlq.orders, dlq.payments, dlq.notifications
```

**Dead Letter Queue (DLQ) Flow:**
```
Message published → Consumer processes → ACK (success)
                                       → NACK → Retry (exponential backoff)
                                                 → Max retries exceeded → DLQ
                                                                          │
                                                                     Manual inspection
                                                                     & reprocessing
```

**Choosing between RabbitMQ and Kafka:**

| Feature | RabbitMQ | Kafka |
|---------|----------|-------|
| Message model | Queue (consumed once) | Log (replay-able) |
| Ordering | Per-queue | Per-partition |
| Best for | Task queues, routing | Event streaming, analytics |
| Scale | 50K msg/sec | 1M+ msg/sec |
| FoodDash use | Order processing, notifications | Analytics events, audit log |

---

## Q30: How would you handle database migrations in production?

**Answer:**

**Migration Strategy:**

```
1. Schema change authored → Drizzle migration file generated
2. Review in PR → Team reviews SQL changes
3. CI runs migration on staging → Validate no breaking changes
4. Blue-green deploy:
   a. Deploy new code (backward-compatible with old schema)
   b. Run migration
   c. Deploy code that uses new schema
   d. Remove backward-compatibility code
```

**FoodDash uses Drizzle Kit:**
```bash
# Generate migration from schema changes
npx drizzle-kit generate

# Push schema to database
npx drizzle-kit push

# Inspect current schema
npx drizzle-kit introspect
```

**Zero-Downtime Migration Rules:**
1. **Never drop a column directly** — First stop reading it, then drop in next release
2. **Add columns as nullable** — Or with default values
3. **Rename via add + copy + drop** — Three separate migrations
4. **Index creation: `CONCURRENTLY`** — Avoids locking the table
5. **Large data backfills** — Run in batches (1000 rows at a time)

**Rollback plan:**
- Every migration has a reverse migration
- Database snapshots before major migrations
- Feature flags to toggle between old/new schema readers

---

## Q31: How would you design the service registry and discovery?

**Answer:**

**Architecture:**

```
┌──────────┐ register  ┌──────────────┐ discover ┌──────────┐
│ Service  │──────────▶│   Service    │◀─────────│  Client  │
│ Instance │           │  Registry    │          │          │
│          │◀──────────│              │          │          │
│          │ heartbeat └──────┬───────┘          └──────────┘
└──────────┘                  │
                        ┌─────▼─────┐
                        │   Health  │
                        │  Checker  │
                        └───────────┘
```

**Service Registration:**
```typescript
serviceRegistry.register({
  serviceName: "order-service",
  instanceId: uuid(),
  host: "localhost",
  port: 3004,
  metadata: { version: "1.0.0" }
});
```

**Health Management:**
- Health checks every 30 seconds
- Stale instances (no heartbeat for 90s) automatically evicted
- Status: `healthy` | `degraded` | `unhealthy`

**Load Balancing Strategies:**

| Strategy | Implementation | Use Case |
|----------|---------------|----------|
| Round Robin | Sequential rotation | Equal instance distribution |
| Weighted | Health-aware routing | Route away from degraded instances |
| Least Connections | Connection count tracking | Even load distribution |
| Consistent Hashing | Hash ring | Session affinity (WebSocket) |

**At scale:** Replace custom registry with Consul, etcd, or Kubernetes Service Discovery.

---

## Q32: How would you design the WebSocket infrastructure for scale?

**Answer:**

**Single-Server Architecture (Current):**
```
Client → WebSocket Server → In-Memory Map<userId, Set<WebSocket>>
```

**Multi-Server Architecture (At Scale):**
```
                    ┌──────────────┐
Client A ──────────▶│  WS Server 1 │──┐
                    └──────────────┘  │
                                      ├──▶ Redis Pub/Sub ──▶ Broadcast
                    ┌──────────────┐  │
Client B ──────────▶│  WS Server 2 │──┘
                    └──────────────┘
```

**How cross-server broadcasting works:**
1. Client A connected to WS Server 1
2. Client B connected to WS Server 2
3. Order update for Client B published to Redis channel `user:clientB`
4. WS Server 2 subscribes to `user:clientB` channel
5. WS Server 2 sends the update to Client B's WebSocket

**Connection Management:**
- Multiple connections per user (multiple tabs/devices)
- Ping/pong heartbeat every 30 seconds
- Automatic cleanup on disconnect
- Connection limit per user (prevent resource exhaustion)

**Scale numbers:**
- Single Node.js server: ~50K concurrent WebSocket connections
- With 10 servers + Redis Pub/Sub: ~500K concurrent connections
- With sticky sessions (Consistent Hashing): ~1M connections

---

## Q33: How would you design the CI/CD pipeline for FoodDash?

**Answer:**

**Pipeline:**

```
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
│  Code   │──▶│  Build  │──▶│  Test   │──▶│ Deploy  │──▶│ Monitor │
│  Push   │   │         │   │         │   │ Staging │   │         │
└─────────┘   └─────────┘   └─────────┘   └────┬────┘   └─────────┘
                                                │
                                          ┌─────▼────┐
                                          │  Deploy  │
                                          │Production│
                                          └──────────┘
```

**Build Stage:**
```bash
npm ci                     # Deterministic install
npm run check              # TypeScript type checking
npm run build              # Vite (client) + esbuild (server)
```

**Test Stage:**
```bash
npm run test:unit          # Vitest unit tests
npm run test:integration   # API integration tests
npm run test:e2e           # Playwright end-to-end tests
npm run lint               # ESLint + Prettier check
```

**Deploy Stage:**
```yaml
# Docker build
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:5000/api/health || exit 1
CMD ["node", "dist/index.cjs"]
```

**Deployment Strategies:**

| Strategy | Risk | Rollback | FoodDash Use |
|----------|------|----------|-------------|
| Blue-Green | Low | Instant (switch traffic) | Primary strategy |
| Canary | Very Low | Route traffic back | New features |
| Rolling | Medium | Roll forward/back | Minor patches |

---

## Q34: How would you design the error handling strategy across the entire system?

**Answer:**

**Error Classification:**

| Category | HTTP Code | Retry? | User Message | Example |
|----------|-----------|--------|-------------|---------|
| Validation | 400 | No | "Invalid delivery address" | Zod parse failure |
| Authentication | 401 | No | "Please sign in" | Missing/expired session |
| Authorization | 403 | No | "You don't have permission" | Wrong role |
| Not Found | 404 | No | "Restaurant not found" | Invalid ID |
| Conflict | 409 | No | "Coupon already used" | Duplicate idempotency key |
| Rate Limited | 429 | Yes (after delay) | "Too many requests" | Rate limit exceeded |
| Server Error | 500 | Yes (with backoff) | "Something went wrong" | Unexpected exception |
| Service Unavailable | 503 | Yes (with backoff) | "Service temporarily unavailable" | Circuit breaker open |

**Error Propagation Chain:**
```
Service Method → catches → logs with correlation ID → throws AppError
     │
     ▼
Route Handler → asyncHandler wrapper → catches → passes to next(error)
     │
     ▼
Global Error Handler → maps to HTTP status → returns JSON → hides stack in production
```

**Custom Error Hierarchy:**
```
Error
└── AppError (code, statusCode, isOperational)
    ├── ValidationError (400, field details)
    ├── NotFoundError (404, resource name)
    ├── UnauthorizedError (401)
    ├── ForbiddenError (403)
    └── ConflictError (409)
```

**Key design decision:** `isOperational` distinguishes expected errors (bad user input) from unexpected errors (null pointer). Only non-operational errors trigger alerts.

---

## Q35: How would you design the security architecture?

**Answer:**

**Defense in Depth (7 Layers):**

```
Layer 1: Transport    → HTTPS (TLS 1.3), cookie.secure: true
Layer 2: Edge         → CDN DDoS protection, WAF rules
Layer 3: Gateway      → Rate limiting (3 tiers), CORS whitelist
Layer 4: Auth         → Multi-provider auth, session management
Layer 5: Authorization→ RBAC + ABAC, resource-level ownership checks
Layer 6: Input        → Zod validation on every endpoint, parameterized queries
Layer 7: Application  → httpOnly cookies, sameSite, CSP headers, timing-safe comparison
```

**Security Measures in FoodDash:**

| Threat | Protection | Implementation |
|--------|-----------|----------------|
| XSS | httpOnly cookies | `cookie: { httpOnly: true }` |
| CSRF | sameSite cookie | `cookie: { sameSite: "lax" }` |
| SQL Injection | Parameterized queries | Drizzle ORM (never raw SQL) |
| Brute Force | Rate limiting | 10 auth attempts per 15 min |
| Session Hijacking | Secure cookie | `cookie: { secure: true }` in production |
| Timing Attack | Timing-safe comparison | `crypto.timingSafeEqual()` for JWT verification |
| Secret Exposure | Environment variables | No hardcoded credentials |
| Stack Trace Leak | Production check | Stack traces only in `NODE_ENV === "development"` |
| Dotfile Access | Vite security | `fs.strict: true`, `fs.deny: ["**/.*"]` |

**Webhook Security:**
- Raw body capture for signature verification
- HMAC comparison to verify webhook authenticity

---

## Q36: How would you design the ETA prediction system?

**Answer:**

**ETA Calculation:**

```
ETA = basePrepTime + travelTime + adjustments

where:
  travelTime   = distance / avgSpeed (20 km/h urban)
  adjustments  = rushHourFactor + weatherFactor + restaurantLoadFactor
```

**Adjustment Factors:**

| Factor | Condition | Impact |
|--------|-----------|--------|
| Rush hour | 12:00-14:00, 18:00-21:00 | +20% |
| Weather | Rain/snow | +15% |
| Restaurant load | Active orders > threshold | +5-15% |
| Distance | Per km from restaurant to customer | +3 min/km |

**Implementation:**
```typescript
class ETAService {
  predict(restaurantId, customerLocation, orderItems): ETAPrediction {
    const basePrepTime = this.getBasePrepTime(restaurantId, orderItems);
    const distance = haversine(restaurantLocation, customerLocation);
    const travelTime = (distance / 20) * 60; // 20 km/h average speed

    const rushMultiplier = isRushHour() ? 1.2 : 1.0;
    const weatherMultiplier = hasAdverseWeather() ? 1.15 : 1.0;
    const loadMultiplier = 1 + (activeOrders / 100) * 0.15;

    const estimatedMinutes = Math.ceil(
      (basePrepTime + travelTime) * rushMultiplier * weatherMultiplier * loadMultiplier
    );

    return {
      estimatedMinutes,
      confidence: 0.85,
      range: { min: estimatedMinutes - 5, max: estimatedMinutes + 10 },
    };
  }
}
```

**At scale (ML-based ETA):**
- Train on historical order data (prep time, travel time, actual delivery time)
- Features: time of day, day of week, restaurant, distance, order size, weather
- Model: Gradient Boosted Trees (XGBoost) or LSTM for temporal patterns
- Continuously retrain as new data arrives

---

## Q37: How would you design the fraud detection system?

**Answer:**

**Risk Scoring Framework:**

```
Transaction → Feature Extraction → Rule Engine → Risk Score → Decision
                                                      │
                                          ┌───────────┼───────────┐
                                          ▼           ▼           ▼
                                     Low (< 0.4)  Med (0.4-0.7)  High (> 0.7)
                                     ┌──────┐    ┌──────┐      ┌──────┐
                                     │ Allow│    │Manual│      │Block │
                                     │      │    │Review│      │      │
                                     └──────┘    └──────┘      └──────┘
```

**Risk Flags:**

| Flag | Condition | Weight |
|------|-----------|--------|
| New user + high value | `orderValue > $100 && accountAge < 7 days` | 0.3 |
| Unusual amount | `orderValue > 3 × userAverage` | 0.25 |
| Velocity | `orders > 5 within 1 hour` | 0.2 |
| Address change | Delivery address changed recently | 0.15 |
| Multiple payment methods | 3+ payment methods in 24 hours | 0.1 |

**Risk Score Calculation:**
```
riskScore = Σ(flagWeights) / Σ(allWeights)   // Normalized to 0-1
riskLevel = score > 0.7 ? "high" : score > 0.4 ? "medium" : "low"
```

**Actions by risk level:**
- **Low** — Process normally
- **Medium** — Process but flag for manual review. Add to review queue.
- **High** — Block transaction, notify admin, require additional verification

**At scale:** Replace rule-based scoring with ML model trained on labeled fraud/legitimate transactions using Gradient Boosted Trees.

---

## Q38: How would you design the dynamic pricing system?

**Answer:**

**Pricing Formula:**
```
finalPrice = basePrice × priceMultiplier

priceMultiplier = 1.0 + demandFactor + popularityFactor - competitionFactor

Constraints: 1.0 ≤ priceMultiplier ≤ 1.5 (max 50% surge)
```

**Factors:**

| Factor | Calculation | Impact |
|--------|-----------|--------|
| Demand | `(currentOrders - avgOrders) / avgOrders` | +0.0 to +0.2 |
| Popularity | Order velocity in last hour | +0.0 to +0.15 |
| Competition | Nearby restaurants with lower prices | -0.0 to -0.1 |
| Time of day | Peak hours (lunch/dinner) | +0.05 to +0.1 |

**Surge Pricing for Delivery Fee:**
```
deliveryFee = baseFee × surgeFactor

surgeFactor based on:
- Available delivery partners vs pending orders
- Weather conditions
- Geographic demand concentration
```

**Guardrails:**
- Maximum 50% surge cap (prevent price gouging)
- Minimum 10-minute cool-down between price changes
- Transparent to users: "Prices are slightly higher due to high demand"
- No surge during emergencies (weather, natural disasters)

---

## Q39: How would you design data partitioning/sharding?

**Answer:**

**Sharding Strategies:**

| Strategy | Key | Pros | Cons |
|----------|-----|------|------|
| Hash-based | `hash(userId) % N` | Even distribution | Rebalancing is hard |
| Range-based | Date ranges | Archival friendly | Hot partitions |
| Geographic | City/region | Data locality | Uneven city sizes |
| Directory-based | Lookup table | Flexible | Single point of failure |

**FoodDash Sharding Plan:**

1. **Orders table** — Shard by `customerId` hash
   - Orders for same customer on same shard (efficient history queries)
   - Cross-shard queries rare (admin analytics can use read replicas)

2. **Restaurants table** — Shard by `city`
   - Geo-queries are city-scoped
   - Search within a city stays on one shard

3. **Analytics** — Partition by date range
   - Time-series data naturally partitioned by month
   - Old partitions moved to cold storage

**Implementation:**
```typescript
class DatabaseSharding {
  getShard(key: string): DatabaseConnection {
    const shardIndex = this.hash(key) % this.shards.length;
    return this.shards[shardIndex];
  }

  private hash(key: string): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash + key.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash);
  }
}
```

**When to shard:**
- Single table > 100M rows
- Single server can't handle write throughput
- Regulatory requirement for data locality (GDPR)

---

## Q40: How would you design the feature flag system?

**Answer:**

**Architecture:**

```
Application Code → Feature Flag Service → Flag Store (DB/Config)
                         │
                   ┌─────▼─────┐
                   │ Evaluation │
                   │ Engine     │
                   └─────┬─────┘
                         │
           ┌─────────────┼─────────────┐
           ▼             ▼             ▼
      Rollout %    User Whitelist   Conditions
      (gradual)    (beta testers)   (role, region)
```

**Flag Types:**

| Type | Use Case | Example |
|------|----------|---------|
| Boolean | Simple on/off | `new_checkout_flow` |
| Percentage rollout | Gradual release | 10% → 25% → 50% → 100% |
| User segment | Beta testing | Specific user IDs |
| Conditional | Region/role-based | GDPR features for EU only |

**Evaluation Logic:**
```typescript
isEnabled(flagName, context): boolean {
  const flag = flags.get(flagName);
  if (!flag || !flag.enabled) return false;

  // Check whitelist first
  if (flag.userWhitelist?.includes(context.userId)) return true;

  // Check percentage rollout
  if (flag.rolloutPercentage !== undefined) {
    const userHash = hash(context.userId) % 100;
    if (userHash >= flag.rolloutPercentage) return false;
  }

  // Check conditions
  if (flag.conditions) {
    return evaluateConditions(flag.conditions, context);
  }

  return true;
}
```

**FoodDash uses feature flags for:**
- New payment methods (gradual rollout)
- ML recommendations (A/B testing)
- GDPR compliance (EU region only)
- New dashboard features (beta users)
- Dynamic pricing (market-by-market)

---

## Q41: How would you design the logging and monitoring alerting system?

**Answer:**

**Log Pipeline:**

```
Application → Structured Logs (JSON) → Log Aggregator → Storage → Query/Alert
                                            │
                                     ┌──────▼──────┐
                                     │ ELK Stack   │  (at scale)
                                     │ Elastic +   │
                                     │ Kibana      │
                                     └─────────────┘
```

**Log Levels and Usage:**

| Level | When | Alert? |
|-------|------|--------|
| DEBUG | Detailed diagnostics (dev only) | No |
| INFO | Normal operations (order created, user logged in) | No |
| WARN | Degraded state (cache miss, retry) | Dashboard |
| ERROR | Failed operations (payment failure, DB error) | PagerDuty alert |

**Alert Thresholds:**

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Error rate | > 1% | > 5% | Page on-call |
| Latency P99 | > 500ms | > 2s | Investigate |
| CPU usage | > 70% | > 90% | Auto-scale |
| Memory usage | > 80% | > 95% | Auto-scale |
| Circuit breaker opens | Any | Multiple | Investigate dependency |
| DLQ depth | > 10 | > 100 | Manual intervention |

**Dashboard Components:**
- Real-time request rate and error rate
- Service health grid (green/yellow/red)
- P50/P90/P99 latency graphs
- Active orders count
- WebSocket connection count
- Cache hit rate

---

## Q42: How would you design the order state machine?

**Answer:**

**Finite State Machine (FSM):**

```
                    ┌─────────┐
         ┌─────────│ pending  │─────────┐
         │         └────┬─────┘         │
         │              │               │
         │         ┌────▼─────┐         │
         │    ┌────│confirmed │────┐    │
         │    │    └────┬─────┘    │    │
         │    │         │          │    │
         │    │    ┌────▼──────┐   │    │
         │    │    │ preparing │   │    │
         │    │    └────┬──────┘   │    │
         │    │         │          │    │
         │    │  ┌──────▼────────┐ │    │
         │    │  │ready_for_     │ │    │
         │    │  │pickup         │ │    │
         │    │  └──────┬────────┘ │    │
         │    │         │          │    │
         │    │  ┌──────▼────────┐ │    │
         │    │  │out_for_       │ │    │
         │    │  │delivery       │ │    │
         │    │  └──────┬────────┘ │    │
         │    │         │          │    │
         │    │  ┌──────▼────────┐ │    │
         │    │  │  delivered    │ │    │
         │    │  │  (terminal)   │ │    │
         │    │  └───────────────┘ │    │
         │    │                    │    │
         │    └──────────┬─────────┘    │
         │               │              │
         │        ┌──────▼──────┐       │
         └───────▶│  cancelled  │◀──────┘
                  │  (terminal)  │
                  └─────────────┘
```

**Transition Rules:**
```typescript
const VALID_TRANSITIONS = {
  pending:            ["confirmed", "cancelled"],
  confirmed:          ["preparing", "cancelled"],
  preparing:          ["ready_for_pickup", "cancelled"],
  ready_for_pickup:   ["out_for_delivery", "cancelled"],
  out_for_delivery:   ["delivered", "cancelled"],
  delivered:          [],  // Terminal
  cancelled:          [],  // Terminal
};
```

**Validation:**
```typescript
function validateTransition(currentStatus: OrderStatus, newStatus: OrderStatus): boolean {
  return VALID_TRANSITIONS[currentStatus].includes(newStatus);
}
```

**Why FSM:**
1. **Prevents invalid states** — Can't go from "pending" to "delivered" directly
2. **Auditable** — Every transition recorded as an event (Event Sourcing)
3. **Trigger actions** — Each transition can trigger side effects (notifications, WebSocket updates)
4. **Easy to visualize** — Stakeholders understand the flow

---

## Q43: How would you design the idempotency mechanism?

**Answer:**

**Problem:** Network retries, client bugs, and load balancer failovers can cause duplicate requests.

**Solution — Idempotency Keys:**

```
Client → includes idempotencyKey header → Server
                                            │
                                    ┌───────▼───────┐
                                    │ Check: Does   │
                                    │ key exist in  │
                                    │ idempotency   │
                                    │ store?        │
                                    └───────┬───────┘
                                    ┌───────┼───────┐
                                    ▼               ▼
                                 YES              NO
                              Return          Process request
                              cached          Store key + result
                              result          Return result
```

**Implementation by Service:**

| Service | Method | Key Example |
|---------|--------|-------------|
| Order Service | In-memory Map | `order-{timestamp}-{userId}` |
| Payment Service | In-memory Map | `payment-{orderId}-{amount}` |
| User creation | PostgreSQL `ON CONFLICT` | Email (unique constraint) |
| Coupon usage | Usage tracking table | `{couponId}-{userId}` |

**Idempotency Key Design:**
```typescript
// Client generates key
const idempotencyKey = `order-${Date.now()}-${restaurantId}-${userId}`;

// Server checks before processing
const existing = idempotencyStore.get(key);
if (existing) return existing;  // Return same result

const result = await processOrder(data);
idempotencyStore.set(key, result, TTL_1_HOUR);
return result;
```

**At scale:** Move idempotency store from in-memory Map to Redis with TTL.

---

## Q44: How would you design the retry strategy?

**Answer:**

**Exponential Backoff with Jitter:**

```
Attempt 1: wait  200-300ms  (2^1 × 100 + random 0-100)
Attempt 2: wait  400-500ms  (2^2 × 100 + random 0-100)
Attempt 3: wait  800-900ms  (2^3 × 100 + random 0-100)
(max 3 attempts by default)
```

**Why jitter?**
Without jitter, if 1000 requests fail at the same time, all 1000 retry simultaneously at exactly 200ms, 400ms, 800ms — overwhelming the recovering service. Random jitter spreads retries across the time window.

**Implementation:**
```typescript
async withRetry<T>(operation, maxAttempts, attempt = 1): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (attempt >= maxAttempts) throw error;

    const baseDelay = Math.pow(2, attempt) * 100;
    const jitter = Math.random() * 100;
    await sleep(baseDelay + jitter);

    return this.withRetry(operation, maxAttempts, attempt + 1);
  }
}
```

**Non-retryable errors:**
- 400 Bad Request (validation error — retrying won't fix it)
- 401 Unauthorized (auth issue)
- 403 Forbidden (permission issue)
- 404 Not Found (resource doesn't exist)
- 409 Conflict (idempotency violation)

**Retryable errors:**
- 429 Too Many Requests (wait for retry-after header)
- 500 Internal Server Error (transient failure)
- 503 Service Unavailable (dependency down)
- Network timeouts

---

## Q45: How would you design the timeout strategy?

**Answer:**

**Timeout Hierarchy:**

```
Client (browser) → API Gateway → Service → External Dependency
  30s timeout       15s timeout    10s timeout   5s timeout
```

**Implementation (Promise.race):**
```typescript
async withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    operation,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}
```

**Timeout Configuration by Service:**

| Service | Timeout | Why |
|---------|---------|-----|
| Order creation | 10s | Involves saga (4 steps) |
| Payment processing | 15s | External PayPal API |
| Search | 5s | Should be fast |
| Menu fetch | 5s | Mostly cached |
| Health check | 3s | Quick probe |
| SAP RFC call | 10s | External ERP system |

**Cascading timeout prevention:**
- Each layer's timeout is shorter than its parent's
- If Payment Service times out at 15s, the Order Service saga detects it and compensates
- API Gateway timeout (15s) > Service timeout (10s) > External call timeout (5s)

---

## Q46: How would you design the build and deployment pipeline?

**Answer:**

**Build Pipeline:**

```
npm run build
├── Step 1: rm -rf dist/
├── Step 2: vite build → dist/public/
│           (React SPA: tree-shaken, code-split, minified)
├── Step 3: esbuild → dist/index.cjs
│           (Server bundle: single file, minified, CJS)
└── Output: dist/
            ├── public/        (static assets, hashed filenames)
            └── index.cjs      (server entry point)
```

**Selective Bundling:**
- **Bundled**: express, pg, drizzle-orm, zod (reduces `openat()` syscalls on cold start)
- **External**: Native modules, optional dependencies

**Docker Build:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 5000
HEALTHCHECK --interval=30s CMD curl -f http://localhost:5000/api/health || exit 1
CMD ["node", "dist/index.cjs"]
```

**Kubernetes Deployment:**
```yaml
spec:
  replicas: 3
  containers:
  - name: api
    resources:
      requests: { memory: "256Mi", cpu: "200m" }
      limits: { memory: "512Mi", cpu: "500m" }
    readinessProbe:
      httpGet: { path: /api/health/ready, port: 5000 }
    livenessProbe:
      httpGet: { path: /api/health/live, port: 5000 }
```

---

## Q47: How would you design the data backup and disaster recovery plan?

**Answer:**

**Backup Strategy:**

| Data | Method | Frequency | Retention |
|------|--------|-----------|-----------|
| PostgreSQL | pg_dump + WAL archiving | Continuous WAL + daily full | 30 days |
| Redis | RDB snapshots + AOF | Every 5 minutes | 7 days |
| Event log | Event sourcing (immutable) | Continuous | Indefinite |
| File uploads | S3 with versioning | Real-time | 90 days |

**Recovery Point Objective (RPO):** < 5 minutes (max data loss)
**Recovery Time Objective (RTO):** < 30 minutes (max downtime)

**Disaster Recovery Scenarios:**

| Scenario | Recovery |
|----------|----------|
| Single server failure | Auto-failover to standby |
| Database corruption | Restore from WAL + last good snapshot |
| Region outage | Multi-region failover (us-east-1 → us-west-2) |
| Complete data loss | Restore from off-site backup + event replay |

**Event Sourcing as DR:**
Because FoodDash stores all order state changes as immutable events in `order_events`, the entire order state can be reconstructed by replaying events from any point in time.

---

## Q48: How would you design the API versioning strategy?

**Answer:**

**Versioning Approach — URL Path:**
```
/api/v1/restaurants    (current)
/api/v2/restaurants    (future, breaking changes)
```

**Why URL path (not header-based):**
- Simple to implement and understand
- Easy to route in API Gateway/load balancer
- Cacheable (different URL = different cache entry)
- Visible in logs and monitoring

**Versioning Rules:**
1. **Non-breaking changes** — Add new fields, new endpoints (no version bump)
2. **Breaking changes** — Remove fields, change types, rename endpoints (version bump)
3. **Deprecation** — Old version runs for 6 months after new version launches
4. **Sunset header** — `Sunset: Sat, 01 Jun 2026 00:00:00 GMT` on deprecated endpoints

**Backward Compatibility Pattern:**
```typescript
// v1 returns flat structure
GET /api/v1/orders/123 → { id, status, total, restaurantName }

// v2 returns nested structure (breaking change)
GET /api/v2/orders/123 → { id, status, total, restaurant: { id, name, cuisine } }

// Both versions coexist during migration period
```

---

## Q49: How would you design the testing strategy for a microservices architecture?

**Answer:**

**Testing Pyramid:**

```
           ┌─────────────┐
           │    E2E      │  ← Few (5-10), slow, expensive
           │  (Playwright)│     Full user journeys
           ├─────────────┤
           │ Integration │  ← Medium (50-100), moderate speed
           │  (API Tests) │     Service interactions
           ├─────────────┤
           │    Unit     │  ← Many (500+), fast, cheap
           │  (Vitest)   │     Individual functions/methods
           └─────────────┘
```

**Unit Tests (per service):**
```typescript
describe("OrderService", () => {
  it("validates order status transitions", () => {
    expect(validateTransition("pending", "confirmed")).toBe(true);
    expect(validateTransition("pending", "delivered")).toBe(false);
  });

  it("calculates order total correctly", () => {
    const items = [{ price: 10.99, quantity: 2 }, { price: 5.50, quantity: 1 }];
    expect(calculateTotal(items)).toBe(27.48);
  });
});
```

**Integration Tests (API-level):**
```typescript
test("POST /api/v1/orders creates order", async ({ request }) => {
  const response = await request.post("/api/v1/orders", { data: orderPayload });
  expect(response.ok()).toBeTruthy();
  const order = await response.json();
  expect(order.status).toBe("pending");
});
```

**E2E Tests (user journey):**
```typescript
test("customer places order successfully", async ({ page }) => {
  await page.goto("/");
  await page.click("text=Sign In");
  // ... complete order flow
  await expect(page.locator("text=Order placed")).toBeVisible();
});
```

**Contract Tests (between services):**
- Ensure Order Service publishes events in the format Notification Service expects
- Prevent breaking changes in inter-service communication

---

## Q50: Summarize the key HLD decisions that make FoodDash production-grade.

**Answer:**

| Category | Decision | Why |
|----------|----------|-----|
| **Architecture** | Modular monolith with microservice boundaries | Best of both: simple deployment + clean separation |
| **Communication** | Event-driven (42 event types) | Loose coupling, scalable, audit trail |
| **Transactions** | Saga Orchestrator with compensation | Distributed transactions without 2PC blocking |
| **Data** | CQRS + Event Sourcing for orders | Write safety + read performance + audit trail |
| **Caching** | L1 (in-memory) + L2 (Redis) | Sub-millisecond reads + cross-node consistency |
| **Resilience** | Circuit Breaker + Retry + Timeout | Cascade failure prevention |
| **Auth** | Multi-provider (Google, Keycloak, OTP) + RBAC + ABAC | Flexible login + fine-grained authorization |
| **Real-time** | WebSocket + Event Bus | Live order tracking without polling |
| **Security** | 7-layer defense in depth | Comprehensive threat coverage |
| **Observability** | Structured logs + Prometheus metrics + correlation IDs | Full visibility into distributed system |
| **Database** | PostgreSQL + Drizzle ORM + UUID PKs | Type-safe, no sequence contention, referential integrity |
| **Deployment** | Docker + Kubernetes-ready + health probes | Container orchestration ready |
| **Scale** | Multi-region (5 regions) + stateless servers | Geographic distribution + horizontal scaling |
| **ML/AI** | Recommendations + ETA + fraud detection + dynamic pricing | Data-driven features |
| **Enterprise** | SAP integration via Anti-Corruption Layer | ERP connectivity without domain pollution |

**What separates it from a toy project:**
1. Error handling is comprehensive with correlation IDs, not just `try/catch`
2. State transitions are FSM-validated, not arbitrary string updates
3. Data consistency is saga-protected, not "hope for the best"
4. Performance is designed (cache hierarchy, TTL tuning), not accidental
5. Observability is built-in (every request traceable), not afterthought
6. Security is layered (7 layers), not just "add JWT"
7. Enterprise integrations exist (SAP ACL), not just CRUD

---
