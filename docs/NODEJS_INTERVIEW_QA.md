# FoodDash — Node.js Interview Questions & Answers (50 Questions)

## For 6+ Years Fullstack Engineer | Node.js · Express.js · TypeScript · Microservices · Backend Architecture

> **Project**: FoodDash — Production-Grade Food Delivery Platform  
> **Backend Stack**: Node.js, Express.js 4, TypeScript, PostgreSQL, Drizzle ORM, WebSocket (ws), Passport.js, Zod  
> **Architecture**: 16 Microservices, Event Bus, CQRS, Saga Pattern, Circuit Breaker, L1/L2 Cache  
> **Last Updated**: February 2026

---

## Q1: Explain the Node.js Event Loop. How does it handle concurrent requests in FoodDash's Express server?

**Answer:**

The Event Loop is Node.js's mechanism for handling asynchronous, non-blocking I/O on a single thread. It continuously cycles through phases:

```
   ┌───────────────────────────┐
┌─▶│         timers             │  ← setTimeout, setInterval callbacks
│  └─────────────┬─────────────┘
│  ┌─────────────▼─────────────┐
│  │     pending callbacks      │  ← I/O callbacks deferred from previous cycle
│  └─────────────┬─────────────┘
│  ┌─────────────▼─────────────┐
│  │       idle, prepare        │  ← internal use only
│  └─────────────┬─────────────┘
│  ┌─────────────▼─────────────┐
│  │          poll              │  ← retrieve new I/O events (DB queries, HTTP)
│  └─────────────┬─────────────┘
│  ┌─────────────▼─────────────┐
│  │          check             │  ← setImmediate callbacks
│  └─────────────┬─────────────┘
│  ┌─────────────▼─────────────┐
│  │      close callbacks       │  ← socket.on('close'), etc.
│  └─────────────┬─────────────┘
└──────────────────┘
```

**Microtask queues** (`Promise.then`, `process.nextTick`) execute between EVERY phase transition, with `process.nextTick` having priority over `Promise.then`.

**How FoodDash handles concurrent requests:**
- When 1000 customers hit `/api/restaurants` simultaneously, Express accepts all connections.
- Each request triggers a DB query (async I/O) — the event loop registers a callback and moves on.
- While DB queries are pending, the event loop handles other requests.
- When a query completes, the callback is placed in the poll queue and executed.
- Result: One thread handles thousands of concurrent I/O-bound requests without blocking.

**Why this matters for FoodDash:** The entire microservices layer (16 services) runs in a single Node.js process. The event loop's non-blocking nature allows all services to handle requests concurrently without multi-threading overhead.

---

## Q2: What is `AsyncLocalStorage` and how does FoodDash use it for distributed tracing?

**Answer:**

`AsyncLocalStorage` (from `node:async_hooks`) provides a store that follows the entire async call chain without explicit parameter passing. It's like thread-local storage for async operations.

```typescript
import { AsyncLocalStorage } from "node:async_hooks";

const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

// Middleware creates context at request entry
export function correlationIdMiddleware(req, res, next) {
  const correlationId = req.headers["x-correlation-id"] || randomUUID();
  const requestId = randomUUID();

  req.correlationId = correlationId;
  res.setHeader("x-correlation-id", correlationId);
  res.setHeader("x-request-id", requestId);

  const context: CorrelationContext = {
    correlationId,
    requestId,
    startTime: Date.now(),
    userId: req.user?.id,
  };

  // Run the entire request chain within this context
  correlationStorage.run(context, () => next());
}

// Anywhere deep in the call stack — no parameter passing
export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore()?.correlationId;
}

// Forward headers to downstream services
export function getForwardHeaders(): Record<string, string> {
  const ctx = correlationStorage.getStore();
  return {
    "x-correlation-id": ctx.correlationId,
    "x-request-id": ctx.requestId,
    ...(ctx.userId && { "x-user-id": ctx.userId }),
  };
}
```

**Why this is critical:**
1. **Distributed tracing** — A single customer order triggers OrderService → PaymentService → NotificationService → DeliveryService. The correlation ID follows the entire chain, making debugging possible.
2. **Structured logging** — Every log entry automatically includes the correlation ID without developers passing it manually.
3. **Latency tracking** — `startTime` in context lets any service measure total request latency.

**Alternative without AsyncLocalStorage:** You'd have to pass `correlationId` as a parameter through every function call — 50+ functions deep in some FoodDash flows. Extremely error-prone.

---

## Q3: Explain the Express.js middleware chain in FoodDash. What order do middlewares execute and why?

**Answer:**

FoodDash's middleware chain processes every request in this order:

```
Request
  │
  ├─► express.json()              → Parse JSON body
  ├─► express.urlencoded()        → Parse URL-encoded body
  ├─► cors()                      → Set CORS headers
  ├─► helmet()                    → Security headers (CSP, X-Frame-Options, etc.)
  ├─► compression()               → Gzip response compression
  ├─► session()                   → Load/create session from PostgreSQL store
  ├─► passport.initialize()       → Initialize Passport.js
  ├─► passport.session()          → Deserialize user from session
  │
  ├─► correlationIdMiddleware     → Assign correlation ID + request ID
  │                                  Uses AsyncLocalStorage for propagation
  ├─► metricsMiddleware           → Record api.requests counter
  │                                  Record api.response_time histogram
  ├─► rateLimiter                 → Standard: 100 req/min
  │                                  Auth: 10 req/15min
  │                                  Orders: 10 req/min
  ├─► asyncHandler(routeHandler)  → Execute business logic
  │
  └─► errorHandler                → Catch errors, log, respond with proper status
```

**Why this order matters:**

1. **Body parsing first** — All subsequent middleware may need `req.body`.
2. **CORS before auth** — Preflight OPTIONS requests must get CORS headers without requiring auth.
3. **Session before routes** — Route handlers need `req.user` populated.
4. **Correlation ID before metrics** — Metrics logging needs the correlation context.
5. **Rate limiter before handlers** — Block abusive requests before they hit business logic.
6. **Error handler last** — Must be a 4-argument middleware `(err, req, res, next)` registered after all routes.

**Key insight:** Express middlewares execute in registration order. If you place `rateLimiter` after route handlers, it's useless.

---

## Q4: How does FoodDash implement the BaseService class and what patterns does it enforce?

**Answer:**

Every microservice extends `BaseService`, which provides production-grade infrastructure:

```typescript
abstract class BaseService {
  protected logger: ServiceLogger;
  protected config: ServiceConfig;

  // Core resilience wrapper — ALL operations go through this
  protected async executeWithResilience<T>(
    operation: () => Promise<T>,
    operationName: string,
    fallback?: () => Promise<T>
  ): Promise<T> {
    const timer = metrics.startTimer(`${this.config.name}.${operationName}`);
    try {
      const result = await this.withTimeout(
        this.withRetry(() => operation(), 3),
        this.config.timeout || 10000
      );
      metrics.increment(`${operationName}.success`);
      return result;
    } catch (error) {
      metrics.increment(`${operationName}.failure`);
      if (fallback) return fallback();
      throw error;
    } finally {
      timer.end();
    }
  }

  // Retry with exponential backoff + jitter
  private async withRetry<T>(operation, maxAttempts, attempt = 1);

  // Timeout using Promise.race
  private async withTimeout<T>(operation, timeoutMs);

  // Cache-aside with TTL
  protected async withCache<T>(key, fetcher, ttlSeconds);

  // Event publishing
  protected async publishEvent<T>(eventType, data, correlationId);

  // Cache invalidation
  protected async invalidateCache(pattern);

  // Every service MUST implement health checks
  abstract checkHealth(): Promise<ServiceHealth>;
}
```

**Patterns enforced:**
1. **Template Method Pattern** — `executeWithResilience` defines the algorithm skeleton (timeout → retry → circuit breaker → metrics). Subclasses override only the business operation.
2. **Mandatory health checks** — `abstract checkHealth()` — the compiler forces every service to implement it.
3. **Consistent observability** — Every operation automatically gets latency metrics, success/failure counters, and structured logging.
4. **Cache-aside built-in** — `withCache()` provides a standard caching pattern without each service reimplementing it.

**Why production-grade:** A junior developer creating a new microservice automatically gets circuit breaker, retry, timeout, metrics, and logging — they just extend `BaseService` and implement business logic.

---

## Q5: How does the Saga Orchestrator handle distributed transactions in FoodDash?

**Answer:**

The Saga Orchestrator implements the **Orchestration-based Saga pattern** for operations spanning multiple services (e.g., placing an order):

```
createOrder() → Saga Orchestrator
  ├── Step 1: validate_order    → Check restaurant is active
  │   compensate: (nothing to undo)
  │
  ├── Step 2: create_order      → Persist order to DB + event log
  │   compensate: Cancel order record
  │
  ├── Step 3: process_payment   → Publish payment event
  │   compensate: Refund payment
  │
  └── Step 4: notify_restaurant → Publish order notification
      compensate: Send cancellation notification
```

Each step has:
```typescript
interface SagaStep {
  name: string;
  execute: (context: SagaContext) => Promise<StepResult>;
  compensate: (context: SagaContext, result: StepResult) => Promise<void>;
  timeout: number;   // Default 30s per step
  retries: number;   // Default 3 retries per step
}
```

**Compensation flow:** If Step 3 (payment) fails:
1. Step 2 is compensated → order record cancelled.
2. Step 1 is compensated → (no-op for validation).
3. The orchestrator continues compensating even if one compensation fails (graceful degradation).

**Why Saga over 2PC (Two-Phase Commit):**
- 2PC requires all services to hold locks simultaneously — terrible for performance.
- 2PC has a single coordinator failure point — if coordinator dies, all services are stuck.
- Saga provides **eventual consistency** — services are independently available, compensation handles failures.
- Saga supports **long-running transactions** — a delivery that takes 30 minutes can't hold a DB lock.

---

## Q6: Explain the Event Bus implementation in FoodDash. How does it achieve loose coupling?

**Answer:**

```typescript
class EventBus {
  private subscribers: Map<string, EventHandler[]> = new Map();
  private eventLog: EventRecord[] = [];  // Last 1000 events

  subscribe(eventType: string, handler: EventHandler): string;  // Returns subscription ID
  publish(eventType: string, data: unknown, correlationId: string, source: string): Promise<void>;
  unsubscribe(subscriptionId: string): void;
  getEventLog(eventType?: string, limit?: number): EventLog[];
}
```

**42 event types** across 8 domains:
- **Order lifecycle**: ORDER_CREATED, ORDER_CONFIRMED, ORDER_PREPARING, ORDER_READY, ORDER_PICKED_UP, ORDER_DELIVERED, ORDER_CANCELLED, ORDER_STATUS_CHANGED
- **Payment**: PAYMENT_INITIATED, PAYMENT_SUCCESS, PAYMENT_FAILED, PAYMENT_REFUNDED
- **Rider**: RIDER_ASSIGNED, RIDER_LOCATION_UPDATE, RIDER_ARRIVED
- **Notifications**: NOTIFICATION_SEND
- Plus restaurant, menu, user, service, and coupon events.

**How it achieves loose coupling:**

```typescript
// OrderService publishes — doesn't know who listens
await eventBus.publish("ORDER_CREATED", orderData, correlationId, "order-service");

// These services subscribe independently:
eventBus.subscribe("ORDER_CREATED", async (data) => {
  await notificationService.notifyRestaurant(data);   // NotificationService
});
eventBus.subscribe("ORDER_CREATED", async (data) => {
  await analyticsService.recordOrderMetric(data);     // AnalyticsService
});
eventBus.subscribe("ORDER_CREATED", async (data) => {
  await deliveryService.initiateAssignment(data);     // DeliveryService
});
```

**Key production features:**
1. **Wildcard subscriptions** — `subscribe("*", handler)` captures all events (useful for logging/auditing).
2. **Event log** — Last 1000 events stored for debugging.
3. **Error isolation** — Failed handlers don't block other subscribers.
4. **Correlation ID propagation** — Each event carries its correlation context for distributed tracing.

**At scale:** The in-process event bus would be replaced with Kafka or RabbitMQ. The interface stays identical — swap the transport, not the business logic.

---

## Q7: How does the Circuit Breaker pattern work in FoodDash? Explain the state transitions.

**Answer:**

```
        ┌─────────┐
        │ CLOSED  │ ◄── Normal operation (requests pass through)
        └────┬────┘
             │ 5 failures in window
        ┌────▼────┐
        │  OPEN   │ ◄── Fail-fast (requests rejected immediately, fallback executed)
        └────┬────┘
             │ 30s reset timeout
        ┌────▼────┐
        │HALF-OPEN│ ◄── Testing (limited requests allowed)
        └────┬────┘
             │ 3 successes → CLOSED
             │ 1 failure   → OPEN
```

```typescript
class CircuitBreaker<T> {
  private state: "closed" | "open" | "half-open" = "closed";
  private failures: number = 0;
  private successesInHalfOpen: number = 0;
  private nextAttempt: Date | null = null;

  constructor(private options: {
    failureThreshold: number;   // Default: 5
    resetTimeout: number;       // Default: 30000ms
    halfOpenRequests: number;   // Default: 3
  }) {}

  async execute(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (this.nextAttempt && new Date() >= this.nextAttempt) {
        this.state = "half-open";  // Try recovery
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

| Circuit Breaker | Threshold | Reset Timeout | Use Case |
|----------------|-----------|---------------|----------|
| `paymentCircuitBreaker` | 3 failures | 60 seconds | More cautious for payments |
| `externalServiceCircuitBreaker` | 5 failures | 30 seconds | Default for other services |
| `sapCircuitBreaker` | 5 failures | 30 seconds | SAP RFC calls |

**Why different thresholds?** Payment failures have direct financial impact — tripping faster (3 vs 5) and recovering slower (60s vs 30s) protects against charging customers while PayPal is down.

---

## Q8: How does the Rate Limiter work in FoodDash? What are the different tiers?

**Answer:**

FoodDash implements a **sliding window counter** rate limiter per IP:

```typescript
class RateLimiter {
  private store: Map<string, { count: number; resetAt: number }> = new Map();

  middleware() {
    return (req, res, next) => {
      const key = this.options.keyGenerator(req);  // Default: req.ip
      const now = Date.now();

      let entry = this.store.get(key);
      if (!entry || entry.resetAt < now) {
        entry = { count: 0, resetAt: now + this.options.windowMs };
      }

      entry.count++;
      this.store.set(key, entry);

      // Standard rate limit headers
      res.setHeader("X-RateLimit-Limit", this.options.maxRequests);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, this.options.maxRequests - entry.count));
      res.setHeader("X-RateLimit-Reset", Math.ceil((entry.resetAt - now) / 1000));

      if (entry.count > this.options.maxRequests) {
        return res.status(429).json({
          error: "Too Many Requests",
          retryAfter: Math.ceil((entry.resetAt - now) / 1000),
        });
      }
      next();
    };
  }
}
```

**Three tiers in FoodDash:**

| Tier | Window | Max Requests | Applied To | Why |
|------|--------|-------------|-----------|-----|
| **API** | 1 min | 100 | All `/api/*` routes | General abuse protection |
| **Auth** | 15 min | 10 | `/api/auth/*` | Brute force login prevention |
| **Orders** | 1 min | 10 | `/api/orders` POST | Prevent order spam/abuse |

**Auto-cleanup:** Expired entries are cleaned every 60 seconds to prevent memory leaks.

**Headers returned on every response:**
- `X-RateLimit-Limit: 100` — Total allowed.
- `X-RateLimit-Remaining: 85` — Requests left.
- `X-RateLimit-Reset: 45` — Seconds until window resets.

**At scale:** The in-memory Map would be replaced with Redis (`INCR` + `EXPIRE`) for multi-instance deployments. The API remains identical.

---

## Q9: How does FoodDash implement retry with exponential backoff and jitter?

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

    this.logger.warn(`Retry attempt ${attempt}/${maxAttempts}, waiting ${delay}ms`);
    await new Promise(resolve => setTimeout(resolve, delay));

    return this.withRetry(operation, maxAttempts, attempt + 1);
  }
}
```

**Delay progression:**
```
Attempt 1: 200-300ms   (2¹ × 100 + jitter)
Attempt 2: 400-500ms   (2² × 100 + jitter)
Attempt 3: 800-900ms   (2³ × 100 + jitter)  ← max attempts, throw
```

**Why jitter is critical:**

Without jitter, if a service goes down and 1000 clients retry:
- All 1000 retry at exactly 200ms → service overwhelmed again.
- All 1000 retry at exactly 400ms → service overwhelmed again.
- This is the **thundering herd** problem.

With jitter, those 1000 retries spread across a 100ms window at each interval, giving the recovering service time to process requests gradually.

**Which operations get retried in FoodDash:**
- ✅ Database queries (transient connection errors).
- ✅ External API calls (PayPal, SAP RFC).
- ✅ Event publishing (temporary queue pressure).
- ❌ Validation errors (deterministic failure — retrying won't help).
- ❌ Authentication failures (user needs to re-login).

---

## Q10: Explain the timeout pattern using `Promise.race`. Why is it important?

**Answer:**

```typescript
private async withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    operation,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Operation timeout after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}
```

**How `Promise.race` works:** Returns the result of whichever promise settles first. If the timeout fires before the operation completes, the error rejects the race.

**Why timeouts are critical in FoodDash:**

Without timeouts, a hung database connection blocks the event loop callback indefinitely:
1. Customer places order → OrderService calls DB → DB hangs.
2. No timeout → Express handler never responds → client waits forever.
3. More customers arrive → All connections hang → **cascading failure**.

With 10s timeout:
1. DB hangs → timeout fires at 10s → error thrown.
2. Circuit breaker records failure.
3. Client gets a 503 → can retry or show error.
4. Other requests continue being served.

**FoodDash timeout configurations:**
- Default service operations: 10,000ms
- Payment processing: 15,000ms (PayPal API is slower)
- Database queries: 5,000ms
- Cache operations: 1,000ms

**Important nuance:** `Promise.race` doesn't cancel the losing promise. The DB query continues running even after timeout. For true cancellation, use `AbortController`:

```typescript
const controller = new AbortController();
setTimeout(() => controller.abort(), timeoutMs);
await fetch(url, { signal: controller.signal });
```

---

## Q11: How does FoodDash's session management work with PostgreSQL-backed sessions?

**Answer:**

```typescript
import session from "express-session";
import PgStore from "connect-pg-simple";

app.use(session({
  store: new PgStore({
    pool: dbPool,
    tableName: "sessions",
    createTableIfMissing: true,
    ttl: 7 * 24 * 60 * 60,  // 7 days
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,           // No JavaScript access (XSS protection)
    secure: isProduction,     // HTTPS only in production
    maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
    sameSite: "lax",          // CSRF protection
  },
}));
```

**Why PostgreSQL-backed sessions (not memory):**
1. **Survives server restarts** — In-memory sessions are lost when the process restarts. PG sessions persist.
2. **Horizontal scaling** — Multiple server instances share the same session store. Without this, a user authenticated on Instance A would be unauthenticated on Instance B.
3. **Session expiry** — PostgreSQL TTL + indexed `expire` column enables efficient cleanup.

**Cookie security flags explained:**
- `httpOnly: true` — JavaScript can't read `document.cookie`. Prevents XSS-based session theft.
- `secure: true` (production) — Cookie only sent over HTTPS. Prevents MITM session hijacking.
- `sameSite: "lax"` — Cookie sent on top-level navigations but not on cross-site POST requests. Prevents CSRF.
- `maxAge: 7 days` — Session expires after 7 days of inactivity.

**`resave: false`** — Don't re-save session if it wasn't modified. Reduces DB writes.
**`saveUninitialized: false`** — Don't create session for unauthenticated users. Reduces DB storage.

---

## Q12: How does Passport.js authentication work in FoodDash with multiple providers?

**Answer:**

FoodDash supports 3 authentication providers that all converge into the same user model:

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
          │  upsertUser()    │
          │  (DB)            │
          └──────────────────┘
```

**Google OAuth flow:**
```typescript
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/api/auth/google/callback",
}, async (accessToken, refreshToken, profile, done) => {
  // Find or create user — same user for all providers
  const user = await upsertUser({
    googleId: profile.id,
    email: profile.emails?.[0]?.value,
    name: profile.displayName,
    profileImageUrl: profile.photos?.[0]?.value,
  });
  done(null, user);
}));

// Serialization — store only user ID in session (not the full object)
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  const user = await db.select().from(users).where(eq(users.id, id));
  done(null, user);
});
```

**`upsertUser` pattern** — Uses PostgreSQL `ON CONFLICT DO UPDATE`:
```typescript
await db.insert(users)
  .values({ email, firstName, lastName, profileImageUrl })
  .onConflictDoUpdate({
    target: users.email,
    set: { firstName, lastName, profileImageUrl, updatedAt: new Date() },
  });
```

This means: If the email already exists, update the profile. If new, create the user. **Database-level idempotency**.

---

## Q13: How does FoodDash implement the CQRS (Command Query Responsibility Segregation) pattern?

**Answer:**

CQRS separates the write model (commands) from the read model (queries), allowing each to be optimized independently.

**OrderService — Command Side (Writes):**
```
createOrder() → Idempotency Check → Saga Orchestrator
  ├── Step 1: validate_order (check restaurant active)
  ├── Step 2: create_order (persist to DB + event log)
  ├── Step 3: process_payment (publish payment event)
  └── Step 4: notify_restaurant (publish order event)

On failure → Compensate in reverse order
```

**OrderService — Query Side (Reads):**
```
getOrder()           → Cache (1 min TTL) → Database
getOrderWithDetails()→ Cache (30s TTL)  → Aggregate from 3 tables
queryOrders()        → Filter + Sort in memory
```

**Why CQRS for FoodDash:**

1. **Different access patterns** — Writes go through saga (complex, multi-step). Reads are simple cache-first lookups.
2. **Independent scaling** — Read traffic is 10x write traffic. You can add read replicas without affecting write performance.
3. **Different data shapes** — `createOrder` takes `{items, address, paymentMethod}`. `getOrderWithDetails` returns `{order + items + restaurant + events + driver}`. One DB model can't optimize both.
4. **Event sourcing complement** — Every write produces an event stored in `order_events`. The read model can be rebuilt from these events.

**At scale:** Writes go to the primary DB. Reads go to the nearest read replica. Cache sits in front of reads.

---

## Q14: Explain the Event Sourcing pattern implemented in the OrderService.

**Answer:**

Every order state change is recorded as an immutable event in the `order_events` table:

```sql
CREATE TABLE order_events (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id VARCHAR REFERENCES orders(id) NOT NULL,
  event_type VARCHAR NOT NULL,    -- 'ORDER_CREATED', 'STATUS_CHANGED', etc.
  data JSONB NOT NULL,            -- Full event payload
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Event sequence for a typical order:**
```
1. ORDER_CREATED      → { orderId, customerId, items, total }
2. ORDER_CONFIRMED    → { orderId, restaurantId, estimatedTime }
3. ORDER_PREPARING    → { orderId, startedAt }
4. ORDER_READY        → { orderId, readyAt }
5. RIDER_ASSIGNED     → { orderId, riderId, riderName }
6. ORDER_PICKED_UP    → { orderId, pickedUpAt }
7. ORDER_DELIVERED     → { orderId, deliveredAt, actualTime }
```

**Benefits:**
1. **Complete audit trail** — Regulators can see exactly when each status changed and by whom.
2. **Time-travel debugging** — Replay events to reconstruct order state at any point in time.
3. **Analytics** — "Average time from CONFIRMED to DELIVERED" is a simple query on event timestamps.
4. **Event replay** — If the read model (cache) corrupts, rebuild it by replaying all events.
5. **Undo capability** — To understand what happened with a disputed order, replay its event log.

**Tradeoff:** Storage grows linearly with events. Mitigation: Snapshot the current state periodically and only replay events after the snapshot.

---

## Q15: How does the Order status Finite State Machine (FSM) work?

**Answer:**

Order status transitions are strictly validated — you can't jump from `pending` to `delivered`:

```typescript
const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending:            ["confirmed", "cancelled"],
  confirmed:          ["preparing", "cancelled"],
  preparing:          ["ready_for_pickup", "cancelled"],
  ready_for_pickup:   ["out_for_delivery", "cancelled"],
  out_for_delivery:   ["delivered", "cancelled"],
  delivered:          [],        // Terminal state
  cancelled:          [],        // Terminal state
};

function validateStatusTransition(currentStatus: string, newStatus: string): boolean {
  const allowed = ORDER_STATUS_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new Error(
      `Invalid transition: ${currentStatus} → ${newStatus}. Allowed: ${allowed?.join(", ")}`
    );
  }
  return true;
}
```

**Why FSM is critical:**
1. **Data integrity** — Prevents impossible states like "delivered → preparing".
2. **Business rules encoded in code** — Not scattered across documentation.
3. **Event sourcing compatibility** — Each transition produces an event.
4. **UI consistency** — Frontend status badges/timelines can trust the status progression.

**Who can trigger transitions:**

| Transition | Actor |
|-----------|-------|
| pending → confirmed | Restaurant Owner |
| confirmed → preparing | Restaurant Owner |
| preparing → ready_for_pickup | Restaurant Owner |
| ready_for_pickup → out_for_delivery | Delivery Partner |
| out_for_delivery → delivered | Delivery Partner |
| any → cancelled | Customer, Restaurant, Admin |

---

## Q16: How does FoodDash handle WebSocket connections for real-time order tracking?

**Answer:**

```typescript
import { WebSocketServer } from "ws";

const clients = new Map<string, Set<WebSocket>>();  // userId → Set<connections>

function setupWebSocket(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const userId = getUserIdFromRequest(req);

    // Support multiple connections per user (multiple tabs/devices)
    if (!clients.has(userId)) clients.set(userId, new Set());
    clients.get(userId)!.add(ws);

    ws.on("close", () => {
      clients.get(userId)?.delete(ws);
      if (clients.get(userId)?.size === 0) clients.delete(userId);
    });
  });
}

function broadcastToUser(userId: string, message: object) {
  const userConnections = clients.get(userId);
  if (!userConnections) return;

  const payload = JSON.stringify(message);
  for (const ws of userConnections) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}
```

**Event-driven WebSocket broadcasting:**
```typescript
// EventBus triggers WebSocket broadcasts
eventBus.subscribe("ORDER_STATUS_CHANGED", async (data) => {
  broadcastToUser(data.customerId, { type: "order_update", data });
  broadcastToUser(data.restaurantOwnerId, { type: "order_update", data });
  broadcastToUser(data.deliveryPartnerId, { type: "order_update", data });
});

eventBus.subscribe("RIDER_LOCATION_UPDATE", async (data) => {
  broadcastToUser(data.customerId, { type: "location_update", data });
});
```

**Design decisions:**
1. **Map of Sets** — One user can have multiple WebSocket connections (phone + laptop). All connections receive updates.
2. **Automatic cleanup** — `close` event removes dead connections.
3. **Event-driven, not polling** — No periodic `setInterval`. Updates are pushed instantly when events publish.
4. **Graceful degradation** — If WebSocket is unavailable, client falls back to polling via React Query.

---

## Q17: How does Drizzle ORM work and why was it chosen over Prisma or TypeORM?

**Answer:**

Drizzle ORM is a TypeScript-first SQL toolkit that compiles to raw SQL with zero runtime overhead.

```typescript
// Schema definition
export const restaurants = pgTable("restaurants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: varchar("owner_id").references(() => users.id).notNull(),
  name: varchar("name").notNull(),
  cuisine: varchar("cuisine").notNull(),
  rating: decimal("rating", { precision: 2, scale: 1 }).default("0"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Auto-generated Zod schema
export const insertRestaurantSchema = createInsertSchema(restaurants)
  .omit({ id: true, createdAt: true, updatedAt: true });

// Auto-inferred TypeScript type
export type Restaurant = typeof restaurants.$inferSelect;
export type InsertRestaurant = z.infer<typeof insertRestaurantSchema>;
```

**Why Drizzle over alternatives:**

| Feature | Drizzle | Prisma | TypeORM |
|---------|---------|--------|---------|
| Runtime overhead | Zero — compiles to raw SQL | Rust query engine binary | Heavy reflection metadata |
| Type safety | Full inference from schema | Generated types from `.prisma` | Decorators, partial inference |
| Validation | Auto Zod schemas via `drizzle-zod` | Manual | Manual |
| Migration | `drizzle-kit push` | `prisma migrate` | CLI migrations |
| Query builder | SQL-like, composable | Custom DSL | QueryBuilder or Active Record |
| Bundle size | Minimal | Large (Rust binary) | Large (decorators, metadata) |

**FoodDash-specific benefits:**
1. **Drizzle-Zod integration** — `createInsertSchema(table)` auto-generates validation for API endpoints. Same schema validates frontend forms and backend routes.
2. **Relational queries** — Explicit relation definitions with type-safe joins.
3. **`$inferSelect` / `$inferInsert`** — TypeScript types derived directly from the schema. Change a column → types update everywhere.

---

## Q18: How does FoodDash implement the L1/L2 caching architecture?

**Answer:**

**L1 Cache (In-Memory):**
```typescript
class InMemoryCache {
  private cache: Map<string, { value: any; expiresAt: number }> = new Map();

  async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const value = await fetcher();
    this.cache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    return value;
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern.replace(/\*/g, ".*"));
    for (const key of this.cache.keys()) {
      if (regex.test(key)) this.cache.delete(key);
    }
  }
}
```

**L2 Cache (Distributed Redis):**
```typescript
class DistributedCache {
  async get<T>(key: string): Promise<T | null> {
    // Try L1 first
    const l1 = await this.l1Cache.get(key);
    if (l1) return l1;

    // L1 miss → try L2 (Redis)
    const l2 = await this.redis.get(key);
    if (l2) {
      await this.l1Cache.set(key, l2, 60);  // Populate L1
      return l2;
    }
    return null;  // Cache miss
  }

  async getOrSetWithLock<T>(key: string, fetcher: () => Promise<T>, options): Promise<T> {
    // Distributed lock prevents thundering herd
    const lockKey = `lock:${key}`;
    const acquired = await this.redis.set(lockKey, "1", "NX", "EX", 5);
    if (!acquired) {
      // Another process is fetching — wait and retry
      await sleep(100);
      return this.get(key);
    }
    try {
      const value = await fetcher();
      await this.set(key, value, options);
      return value;
    } finally {
      await this.redis.del(lockKey);
    }
  }
}
```

**Cache hierarchy flow:**
```
Read:  L1 Hit → Return
       L1 Miss → L2 Hit → Populate L1, Return
       L2 Miss → DB → Populate L1 + L2, Return

Write: DB → Invalidate L1 → Invalidate L2 → Pub/Sub to other nodes
```

**Thundering herd prevention:** `getOrSetWithLock()` uses Redis `SETNX` (set if not exists). When 1000 requests hit a cold cache simultaneously, only ONE process fetches from DB. The other 999 wait briefly and get the cached result.

---

## Q19: How does FoodDash implement idempotency for critical operations?

**Answer:**

Idempotency ensures that performing the same operation multiple times has the same effect as performing it once.

**Order creation — Idempotency key:**
```typescript
async createOrder(command: CreateOrderCommand): Promise<Order> {
  // Check if this exact request was already processed
  const existing = this.idempotencyStore.get(command.idempotencyKey);
  if (existing) return existing;  // Return previous result

  const order = await this.executeOrderCreation(command);

  // Store result keyed by idempotency key
  this.idempotencyStore.set(command.idempotencyKey, order);
  return order;
}
```

**Client generates the key:**
```typescript
const idempotencyKey = `order-${Date.now()}-${userId}`;
```

**Why it's critical:**
- User double-clicks "Place Order" → Two requests with same key → Only ONE order created.
- Network timeout → Client retries → Same key → Returns existing order (no duplicate charge).

**Idempotency across FoodDash services:**

| Service | Method | Why |
|---------|--------|-----|
| OrderService | `idempotencyKey` in-memory Map | Prevent duplicate orders |
| PaymentService | `idempotencyKey` in-memory Map | Prevent double charges |
| User creation | `ON CONFLICT DO UPDATE` (PostgreSQL upsert) | Same email → update, not duplicate |
| Coupon usage | Customer usage tracking | Same coupon can't be applied twice |

**At scale:** The in-memory idempotency store would be replaced with Redis with TTL (e.g., 24 hours). After 24 hours, the key expires and a new request is treated as fresh.

---

## Q20: How does the Notification Service implement multi-channel delivery?

**Answer:**

```typescript
class NotificationService extends BaseService {
  // Template-based, priority queue, multi-channel, DLQ
  private channels = {
    push: new PushNotificationChannel(),
    email: new EmailChannel(),
    sms: new SMSChannel(),
    inApp: new InAppChannel(),
  };

  async sendNotification(notification: NotificationRequest) {
    const template = this.getTemplate(notification.type);
    const rendered = this.renderTemplate(template, notification.data);

    // Determine channels based on user preferences and notification priority
    const channels = this.resolveChannels(notification);

    // Send through each channel with independent error handling
    const results = await Promise.allSettled(
      channels.map(channel => this.channels[channel].send(rendered))
    );

    // Failed channels → Dead Letter Queue for retry
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        this.sendToDeadLetterQueue(notification, channels[index], result.reason);
      }
    });
  }
}
```

**Key design decisions:**
1. **Template-based** — Notification templates are defined once and filled with data. Consistent messaging.
2. **Priority queue** — Order status changes are high priority (immediate). Marketing emails are low priority (batched).
3. **`Promise.allSettled`** — If SMS fails, email still sends. Unlike `Promise.all` which would reject all.
4. **Dead Letter Queue** — Failed notifications are queued for retry, not silently lost.

---

## Q21: How does Node.js handle `process.nextTick` vs `setImmediate` vs `setTimeout`?

**Answer:**

```
Event Loop Tick:
  1. Execute synchronous code
  2. Drain process.nextTick queue     ← Microtask (highest priority)
  3. Drain Promise.then queue          ← Microtask
  4. Execute timer callbacks           ← setTimeout/setInterval
  5. Execute I/O callbacks             ← fs, net, db results
  6. Execute setImmediate callbacks    ← Check phase
```

```typescript
console.log("1: sync");

setTimeout(() => console.log("2: setTimeout"), 0);

setImmediate(() => console.log("3: setImmediate"));

process.nextTick(() => console.log("4: nextTick"));

Promise.resolve().then(() => console.log("5: promise"));

// Output: 1: sync → 4: nextTick → 5: promise → 2: setTimeout → 3: setImmediate
```

**FoodDash usage:**
- **`process.nextTick`** — Used in the EventBus for ensuring event handlers execute after the current operation completes but before any I/O:
```typescript
// After publishing an event, ensure subscribers are notified before next I/O
process.nextTick(() => this.processEventQueue());
```

- **`setImmediate`** — Used in background tasks (stale instance cleanup, cache cleanup) to avoid blocking the event loop:
```typescript
setImmediate(() => this.cleanupStaleInstances());
```

**Danger with `process.nextTick`:** If you recursively call `nextTick`, it starves the event loop — I/O callbacks never execute. Use `setImmediate` for recursive operations.

---

## Q22: How does the Service Registry implement health checks and instance management?

**Answer:**

```typescript
class ServiceRegistry {
  private services: Map<string, ServiceInstance[]> = new Map();

  register(instance: ServiceInstance): void {
    instance.instanceId = uuid();
    instance.status = "healthy";
    instance.lastHeartbeat = new Date();
    // Add to service's instance list
  }

  deregister(serviceName: string, instanceId: string): void;

  heartbeat(serviceName: string, instanceId: string): void {
    instance.lastHeartbeat = new Date();
    instance.status = "healthy";
  }

  discover(serviceName: string): ServiceInstance[] {
    return this.services.get(serviceName)
      ?.filter(i => i.status !== "unhealthy") ?? [];
  }

  getInstance(serviceName: string): ServiceInstance | undefined {
    const healthy = this.discover(serviceName);
    return this.loadBalancer.select(healthy);
  }
}
```

**Health management:**
- Health checks run every **30 seconds**.
- Instances with no heartbeat for **90 seconds** are automatically evicted.
- Each service reports: `healthy`, `degraded`, or `unhealthy`.

**Load balancing strategies:**

| Strategy | How | Use Case |
|----------|-----|----------|
| Round Robin | `index++ % instances.length` | Equal distribution |
| Weighted | Score based on success rate + response time | Health-aware routing |

**Kubernetes integration:**
```
GET /api/health       → Full health report (all services)
GET /api/health/live  → Liveness probe (is process running?)
GET /api/health/ready → Readiness probe (can it handle requests?)
```

K8s uses these probes to restart unhealthy pods and route traffic only to ready pods.

---

## Q23: How does FoodDash implement structured logging?

**Answer:**

```typescript
class ServiceLogger {
  private serviceName: string;

  info(message: string, data?: Record<string, unknown>, correlationId?: string) {
    this.log("info", message, data, correlationId);
  }

  error(message: string, data?: Record<string, unknown>, correlationId?: string) {
    this.log("error", message, data, correlationId);
  }

  private log(level: string, message: string, data?: Record<string, unknown>, correlationId?: string) {
    const entry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      service: this.serviceName,
      correlationId: correlationId || getCorrelationId(),
      message,
      ...(data && { data }),
    };
    console.log(JSON.stringify(entry));
  }
}

// Output:
// {"timestamp":"2026-02-10T14:30:00.000Z","level":"INFO","service":"order-service",
//  "correlationId":"abc-123","message":"Order created","data":{"orderId":"ord-1"}}
```

**Why structured (JSON) logging:**
1. **Machine parseable** — Log aggregators (ELK Stack, Datadog) can index and search by any field.
2. **Correlation** — Filter all logs for a single request across 16 services by `correlationId`.
3. **Alerting** — Set alerts on `level: "ERROR"` with specific `service` values.
4. **No regex** — Unstructured logs (`Order 123 created by user 456`) require regex to extract IDs. JSON gives you `data.orderId` directly.

**Automatic context propagation:** `getCorrelationId()` reads from `AsyncLocalStorage`. Developers never manually pass correlation IDs.

---

## Q24: How does the Metrics system work? What types of metrics does FoodDash collect?

**Answer:**

```typescript
class MetricsCollector {
  private counters = new Map<string, number>();
  private histograms = new Map<string, number[]>();
  private gauges = new Map<string, number>();

  increment(name: string, value: number = 1): void;
  gauge(name: string, value: number): void;
  observe(name: string, value: number): void;    // Histogram
  startTimer(name: string): { end: () => void }; // Auto-record duration

  // Prometheus-compatible export
  toPrometheus(): string {
    // Returns:
    // # TYPE api_requests counter
    // api_requests 1234
    // # TYPE http_request_duration_ms histogram
    // http_request_duration_ms_bucket{le="100"} 500
    // ...
  }
}
```

**Three types of metrics:**

| Type | Example | Use |
|------|---------|-----|
| **Counter** | `api.requests`, `api.status.200`, `order.created` | Monotonically increasing counts |
| **Gauge** | `active_orders`, `connected_websockets` | Current value (can go up/down) |
| **Histogram** | `http_request_duration_ms`, `api.response_time` | Distribution with percentiles |

**Metrics middleware:**
```typescript
function metricsMiddleware(req, res, next) {
  const start = Date.now();
  metrics.increment("api.requests");

  res.on("finish", () => {
    metrics.increment(`api.status.${res.statusCode}`);
    metrics.observe("api.response_time", Date.now() - start);
  });

  next();
}
```

**Alerting thresholds in FoodDash:**

| Metric | Warning | Critical |
|--------|---------|----------|
| Error rate | > 1% | > 5% |
| p99 latency | > 500ms | > 2s |
| CPU usage | > 70% | > 90% |
| Memory usage | > 80% | > 95% |

---

## Q25: Explain `streams` in Node.js. How would FoodDash use them?

**Answer:**

Streams process data piece-by-piece without loading the entire content into memory. Four types:

| Type | Example | Description |
|------|---------|------------|
| **Readable** | `fs.createReadStream`, `http.IncomingMessage` | Source of data |
| **Writable** | `fs.createWriteStream`, `http.ServerResponse` | Destination of data |
| **Transform** | `zlib.createGzip`, custom parsers | Modify data in transit |
| **Duplex** | `net.Socket`, WebSocket | Both readable and writable |

**FoodDash use cases:**

1. **CSV export for analytics** — Admin downloads order history (100K+ rows):
```typescript
app.get("/api/admin/orders/export", (req, res) => {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=orders.csv");

  const cursor = db.select().from(orders).stream(); // DB cursor
  const csvTransform = new Transform({
    transform(row, encoding, callback) {
      callback(null, `${row.id},${row.status},${row.total}\n`);
    }
  });

  cursor.pipe(csvTransform).pipe(res);
  // Memory usage: constant, regardless of row count
});
```

2. **Image upload for restaurant logos** — Stream directly to storage:
```typescript
req.pipe(uploadStream); // No buffering the entire file in memory
```

3. **Response compression** — `compression()` middleware uses Transform streams internally:
```typescript
readableResponse.pipe(gzipTransform).pipe(res);
```

**Without streams:** Loading 100K orders into memory for CSV export could consume 500MB+ RAM and crash the Node.js process. Streams keep memory constant at ~64KB.

---

## Q26: What is the `cluster` module and how would FoodDash use it for horizontal scaling?

**Answer:**

The `cluster` module forks the Node.js process to utilize multiple CPU cores:

```typescript
import cluster from "node:cluster";
import { cpus } from "node:os";

if (cluster.isPrimary) {
  const numCPUs = cpus().length;
  console.log(`Primary ${process.pid} forking ${numCPUs} workers`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker) => {
    console.log(`Worker ${worker.process.pid} died, restarting...`);
    cluster.fork(); // Auto-restart dead workers
  });
} else {
  // Each worker runs the full Express server
  const app = createExpressApp();
  app.listen(5000);
  console.log(`Worker ${process.pid} started`);
}
```

**Why FoodDash needs clustering:**
- Node.js is single-threaded — one process uses one CPU core.
- A server with 8 cores runs at 12.5% capacity without clustering.
- With cluster, 8 worker processes share port 5000 (OS distributes connections via round-robin).

**FoodDash considerations:**
1. **Shared sessions** — Sessions are in PostgreSQL (not in-memory), so all workers share the same session store.
2. **WebSocket state** — The `clients` Map is per-worker. A user connected to Worker 1 won't receive broadcasts from Worker 2. Solution: Use Redis pub/sub for cross-worker WebSocket broadcasting.
3. **In-memory cache** — Each worker has its own L1 cache. L2 (Redis) is shared.
4. **Graceful shutdown** — Workers complete in-flight requests before exiting on `SIGTERM`.

**In production:** PM2 or Kubernetes replicas replace manual clustering.

---

## Q27: How does FoodDash handle graceful shutdown?

**Answer:**

```typescript
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // 1. Stop accepting new connections
  httpServer.close(() => {
    logger.info("HTTP server closed");
  });

  // 2. Close WebSocket connections
  wss.clients.forEach(ws => ws.close(1001, "Server shutting down"));

  // 3. Deregister from Service Registry
  await serviceRegistry.deregister("api-service", instanceId);

  // 4. Finish processing in-flight requests (wait up to 30s)
  await Promise.race([
    waitForInFlightRequests(),
    new Promise(resolve => setTimeout(resolve, 30000)),
  ]);

  // 5. Close database connections
  await db.end();

  // 6. Flush metrics and logs
  await metrics.flush();
  await logger.flush();

  logger.info("Graceful shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
```

**Why graceful shutdown matters:**
- **No dropped requests** — In-flight orders complete before the process exits.
- **No data loss** — DB connections close after pending writes finish.
- **No orphan connections** — WebSocket clients receive a clean close frame.
- **No stale registry entries** — Service deregisters so the load balancer stops sending traffic.
- **Kubernetes compatibility** — K8s sends SIGTERM before killing a pod. Graceful shutdown lets the pod drain.

---

## Q28: How does FoodDash implement input validation with Zod on the server?

**Answer:**

```typescript
import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";

// Auto-generate from Drizzle schema
const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Custom validation for API-specific rules
const createOrderSchema = z.object({
  restaurantId: z.string().uuid(),
  items: z.array(z.object({
    menuItemId: z.string().uuid(),
    quantity: z.number().int().min(1).max(99),
    price: z.string().regex(/^\d+\.\d{2}$/),
  })).min(1),
  deliveryAddress: z.string().min(10).max(500),
  couponCode: z.string().optional(),
  paymentMethod: z.enum(["paypal", "card", "cod"]),
  idempotencyKey: z.string(),
});

// Validation middleware
function validate(schema: z.ZodSchema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.issues.map(issue => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    req.validatedBody = result.data;  // Typed and validated
    next();
  };
}

// Usage
router.post("/orders", validate(createOrderSchema), async (req, res) => {
  const order = await orderService.createOrder(req.validatedBody);
  res.status(201).json(order);
});
```

**Why Zod over Joi/express-validator:**
1. **TypeScript-first** — `z.infer<typeof schema>` gives the type for free. Joi requires separate type definitions.
2. **Drizzle integration** — `createInsertSchema` auto-generates from DB schema. One source of truth.
3. **Frontend + backend** — Same Zod schema validates on both sides.
4. **Composable** — `.extend()`, `.merge()`, `.pick()`, `.omit()` compose schemas.
5. **Smaller bundle** — Zod is ~13KB vs Joi's ~150KB.

---

## Q29: How does the error handling strategy work in FoodDash's Express server?

**Answer:**

**Custom error classes:**
```typescript
class AppError extends Error {
  constructor(
    message: string,
    public code: string = "INTERNAL_ERROR",
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message: string, public details: any) {
    super(message, "VALIDATION_ERROR", 400);
  }
}

class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, "NOT_FOUND", 404);
  }
}
```

**Async error wrapper:**
```typescript
const asyncHandler = (fn: Function) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Without asyncHandler: unhandled promise rejection crashes the server
// With asyncHandler: errors are caught and passed to error middleware
router.get("/orders/:id", asyncHandler(async (req, res) => {
  const order = await orderService.findById(req.params.id);
  if (!order) throw new NotFoundError("Order");
  res.json(order);
}));
```

**Global error handler:**
```typescript
app.use((err, req, res, _next) => {
  logger.error("API error", {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    correlationId: req.correlationId,
  });

  metrics.increment("api.errors");

  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const code = err instanceof AppError ? err.code : "INTERNAL_ERROR";

  res.status(statusCode).json({
    error: code,
    message: err instanceof AppError ? err.message : "An unexpected error occurred",
    // Stack traces ONLY in development
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});
```

**Why `isOperational`?** Operational errors (bad input, not found) are expected. Non-operational errors (null pointer, OOM) indicate bugs. FoodDash logs both but only sends user-friendly messages for operational errors.

---

## Q30: How does the Message Queue abstraction support multiple transports?

**Answer:**

```typescript
type QueueTransport = "rabbitmq" | "kafka" | "sqs" | "azure-service-bus" | "in-memory";

class MessageQueue {
  private transport: QueueTransport;

  async publish(topic: string, routingKey: string, payload: any, options?: PublishOptions): Promise<void>;
  async subscribe(topic: string, handler: MessageHandler): Promise<string>;
  async acknowledgeMessage(messageId: string): Promise<void>;
  async negativeAcknowledge(messageId: string, requeue: boolean): Promise<void>;
}
```

**24 predefined topics across 7 domains + 3 dead-letter queues:**
```typescript
const QueueTopics = {
  ORDER_CREATED: "order.created",
  ORDER_STATUS_CHANGED: "order.status.changed",
  PAYMENT_PROCESS: "payment.process",
  PAYMENT_COMPLETED: "payment.completed",
  DELIVERY_ASSIGN: "delivery.assign",
  NOTIFICATION_SEND: "notification.send",
  ANALYTICS_EVENT: "analytics.event",
  // ... 17 more topics
  DLQ_ORDERS: "dlq.orders",
  DLQ_PAYMENTS: "dlq.payments",
  DLQ_NOTIFICATIONS: "dlq.notifications",
};
```

**Dead Letter Queue pattern:**
```typescript
async subscribe(topic: string, handler: MessageHandler) {
  return this.transport.consume(topic, async (message) => {
    try {
      await handler(message.payload);
      this.acknowledgeMessage(message.id);  // ACK
    } catch (error) {
      if (message.retryCount < this.maxRetries) {
        this.negativeAcknowledge(message.id, true);  // Requeue
      } else {
        // Max retries exceeded → send to DLQ
        await this.publishToDLQ(topic, message, error);
        this.acknowledgeMessage(message.id);  // Remove from main queue
      }
    }
  });
}
```

**Why multi-transport:**
- **Development**: `in-memory` — no external dependencies.
- **Staging**: `rabbitmq` — simple, reliable, great management UI.
- **Production at scale**: `kafka` — high throughput, partitioning, replay.
- **AWS deployment**: `sqs` — managed, no infrastructure to maintain.

Same business code runs on all transports — only configuration changes.

---

## Q31: How does `Buffer` work in Node.js and where does FoodDash use it?

**Answer:**

`Buffer` represents fixed-length sequences of bytes — the fundamental binary data type in Node.js.

```typescript
// Creating buffers
const buf1 = Buffer.from("hello", "utf-8");       // From string
const buf2 = Buffer.alloc(256);                     // Pre-allocated, zero-filled
const buf3 = Buffer.from([0x48, 0x65, 0x6c]);     // From byte array

// Buffer operations
buf1.toString("base64");    // "aGVsbG8="
buf1.toString("hex");       // "68656c6c6f"
buf1.length;                // 5 (bytes, not characters)
```

**FoodDash usage:**

1. **JWT timing-safe comparison** — Prevents timing attacks:
```typescript
const a = Buffer.from(computedSignature, "base64url");
const b = Buffer.from(tokenSignature, "base64url");
const isValid = crypto.timingSafeEqual(a, b);
// timingSafeEqual takes constant time regardless of where mismatch occurs
```

2. **Webhook signature verification** — PayPal sends webhooks with HMAC signatures:
```typescript
const expectedSig = crypto
  .createHmac("sha256", webhookSecret)
  .update(Buffer.from(rawBody))
  .digest("hex");
```

3. **Session serialization** — Express sessions store `Buffer` objects in JSONB columns.

**`Buffer.alloc` vs `Buffer.allocUnsafe`:**
- `alloc(n)` — Zero-fills memory. Safe but slightly slower.
- `allocUnsafe(n)` — Doesn't zero-fill. May contain old memory data. **Security risk** — never use for sensitive data.

---

## Q32: Explain `worker_threads` in Node.js. When would FoodDash use them?

**Answer:**

`worker_threads` run JavaScript in parallel threads with isolated contexts but shared memory capabilities:

```typescript
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";

if (isMainThread) {
  // Main thread — offload CPU-intensive work
  const worker = new Worker("./ml-worker.ts", {
    workerData: { userId: "user-123", orderHistory: [...] }
  });

  worker.on("message", (recommendations) => {
    // Use ML recommendations
  });
} else {
  // Worker thread — CPU-intensive computation
  const recommendations = computeRecommendations(workerData);
  parentPort.postMessage(recommendations);
}
```

**FoodDash use cases:**
1. **ML Recommendation Engine** — Multi-factor scoring across 500+ restaurants involves matrix operations. Offloading to a worker thread prevents blocking the event loop.
2. **Fraud detection** — Calculating risk scores across order history patterns.
3. **CSV report generation** — Admin exports of 100K+ rows with complex aggregations.
4. **Dynamic pricing** — Real-time demand forecasting calculations.

**When NOT to use workers:**
- I/O-bound operations (DB queries, HTTP calls) — the event loop handles these efficiently.
- Simple computations (JSON parsing, string formatting) — thread creation overhead exceeds the computation.

**`worker_threads` vs `cluster`:**
- `cluster` — Multiple Node.js processes (separate V8 instances, separate memory). For scaling HTTP servers.
- `worker_threads` — Multiple threads within ONE process (shared `ArrayBuffer`). For CPU-intensive tasks.

---

## Q33: How does FoodDash's build process work with esbuild?

**Answer:**

```typescript
// script/build.ts
import esbuild from "esbuild";

// Step 1: Build client (Vite)
await exec("vite build");
// Output: dist/public/ (React SPA, tree-shaken, minified, code-split)

// Step 2: Build server (esbuild)
await esbuild.build({
  entryPoints: ["server/index.ts"],
  platform: "node",
  bundle: true,
  format: "cjs",
  minify: true,
  outfile: "dist/index.cjs",
  external: externals,  // Non-bundled dependencies
  define: {
    "process.env.NODE_ENV": '"production"',  // Dead code elimination
  },
});
```

**Why esbuild for server (not tsc):**
1. **Speed** — esbuild is 10-100x faster than `tsc` (written in Go, parallel processing).
2. **Bundling** — Single output file (`dist/index.cjs`) instead of hundreds of `.js` files. Fewer `openat(2)` syscalls → faster cold start.
3. **Minification** — Smaller bundle = faster Lambda cold start.
4. **Dead code elimination** — `process.env.NODE_ENV === "development"` blocks are removed.

**Selective bundling strategy:**
- ✅ **Bundled**: `express`, `pg`, `drizzle-orm`, `zod` — small, tree-shakeable.
- ❌ **External**: `react`, `@radix-ui/*`, `tailwindcss` — client-side only, not needed in server bundle.

**Output:**
```
dist/
├── index.cjs      ← Server (bundled, minified)
└── public/        ← Client (Vite output)
    ├── index.html
    ├── assets/
    │   ├── main-[hash].js
    │   └── main-[hash].css
    └── ...
```

---

## Q34: How does connection pooling work in FoodDash's PostgreSQL setup?

**Answer:**

```typescript
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                // Maximum connections in pool
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Fail if can't connect in 5s
});

export const db = drizzle(pool);
```

**How pooling works:**
1. Pool pre-creates connections to PostgreSQL (up to `max`).
2. When a query runs, it borrows a connection from the pool.
3. After the query completes, the connection is returned (not closed).
4. Next query reuses the same connection — no TCP handshake or auth overhead.

**Why pooling is critical:**
- **Without pooling**: 1000 concurrent requests → 1000 connections → PostgreSQL crashes (`max_connections` default is 100).
- **With pooling (max: 20)**: 1000 concurrent requests → 20 connections reused → PostgreSQL is fine. Requests queue briefly for a free connection.

**Tuning `max` for FoodDash:**
- Formula: `max = (num_cores * 2) + effective_spindle_count`
- For 4-core server with SSD: `max = (4 * 2) + 1 = 9`
- FoodDash uses 20 to accommodate microservice-level concurrency.

**Connection leak prevention:**
```typescript
// Drizzle ORM handles connection checkout/return automatically
const results = await db.select().from(orders);
// Connection returned to pool immediately after query
```

---

## Q35: How does FoodDash handle environment configuration?

**Answer:**

```typescript
// Environment variables required for FoodDash
const requiredEnvVars = {
  DATABASE_URL: process.env.DATABASE_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
};

// Validate at startup — fail fast if missing
for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) throw new Error(`Missing required env var: ${key}`);
}
```

**Environment-specific configuration:**

| Variable | Development | Production |
|----------|------------|-----------|
| `NODE_ENV` | `development` | `production` |
| `cookie.secure` | `false` | `true` (HTTPS only) |
| `error stack` | Included in response | Hidden |
| `Vite HMR` | Enabled | Disabled |
| `Log level` | `debug` | `info` |
| `Rate limits` | Relaxed | Strict |

**Security practices:**
1. **Never hardcode secrets** — All secrets in environment variables.
2. **Different secrets per environment** — Dev and production use different `SESSION_SECRET`.
3. **Fail fast** — Missing env var crashes at startup, not at first request.
4. **`.env` not in git** — `.gitignore` includes `.env`.

---

## Q36: How does the RBAC + ABAC authorization system work on the server?

**Answer:**

**RBAC (Role-Based Access Control) — 4 roles:**
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

**ABAC (Attribute-Based Access Control) — Context-aware rules:**
```typescript
function evaluateABAC(permission, context) {
  // Restaurant owner can only update THEIR OWN restaurant
  if (permission.resource === "restaurant" && permission.action === "update") {
    return context.resourceOwnerId === context.userId;
  }
  // Delivery partner can only update orders ASSIGNED to them
  if (permission.resource === "order" && permission.action === "update") {
    return context.assignedPartnerId === context.userId;
  }
  return true;
}
```

**Middleware implementation:**
```typescript
function requireRole(...roles: string[]) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

// Usage
router.get("/admin/users", requireRole("admin"), getUsers);
router.patch("/restaurants/:id", requireRole("restaurant_owner", "admin"), updateRestaurant);
```

**RBAC + ABAC combined:** Even if a `restaurant_owner` has permission to update restaurants (RBAC ✅), they can only update restaurants where `ownerId === userId` (ABAC check).

---

## Q37: How does FoodDash prevent SQL injection?

**Answer:**

**Drizzle ORM uses parameterized queries by default:**

```typescript
// Safe — Drizzle generates parameterized SQL
const orders = await db
  .select()
  .from(ordersTable)
  .where(eq(ordersTable.customerId, customerId))
  .limit(10);

// Generated SQL:
// SELECT * FROM orders WHERE customer_id = $1 LIMIT 10
// Parameters: [customerId]
```

**Why parameterized queries prevent injection:**
```
User input: "'; DROP TABLE orders; --"

Without parameterization:
  SELECT * FROM orders WHERE customer_id = ''; DROP TABLE orders; --'
  → TABLE DROPPED!

With parameterization:
  SELECT * FROM orders WHERE customer_id = $1
  $1 = "'; DROP TABLE orders; --"
  → Treated as a string value, not SQL. Returns 0 rows.
```

**Additional protections in FoodDash:**
1. **Zod validation** — All inputs validated before reaching the DB layer. UUIDs must match regex, strings have max length.
2. **Drizzle type checking** — TypeScript prevents passing wrong types to queries at compile time.
3. **No raw SQL** — FoodDash doesn't use `db.execute(sql\`...\`)` with string interpolation anywhere.
4. **ORM escaping** — Even `sql` template tag in Drizzle auto-escapes values.

---

## Q38: How does the `vite.config.ts` development server proxy work?

**Answer:**

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:5000",
        ws: true,
      },
    },
  },
  root: "client",
  build: {
    outDir: "../dist/public",
  },
});
```

**How it works in development:**
```
Browser → localhost:3000/api/restaurants
  │
  ├─► Vite Dev Server (port 3000)
  │   Matches "/api" prefix → proxy
  │
  └─► Express Server (port 5000)
      Returns restaurant data
```

**Why proxy:**
1. **No CORS issues** — Browser sees all requests going to `localhost:3000`. No cross-origin.
2. **Same cookies** — Session cookie set for `:3000` works for both Vite and API.
3. **Production parity** — In production, Express serves both static files and API from port 5000. The proxy mimics this in dev.
4. **WebSocket proxy** — `ws: true` forwards WebSocket upgrade requests.

**Vite security settings:**
```typescript
server: {
  fs: {
    strict: true,           // Only serve files within project root
    deny: ["**/.*"],        // Block dotfiles (.env, .git)
  },
}
```
This prevents Vite from accidentally serving `.env` files containing secrets.

---

## Q39: How does FoodDash implement the Health Check Aggregation pattern?

**Answer:**

```typescript
// GET /api/health — Aggregate health from all services
router.get("/health", async (req, res) => {
  const services = [
    authService, restaurantService, menuService, orderService,
    deliveryService, paymentService, notificationService,
    searchService, analyticsService, adminService,
  ];

  const healthChecks = await Promise.allSettled(
    services.map(async (svc) => ({
      name: svc.config.name,
      ...(await svc.checkHealth()),
    }))
  );

  const results = healthChecks.map((result, i) =>
    result.status === "fulfilled"
      ? result.value
      : { name: services[i].config.name, status: "unhealthy", error: result.reason.message }
  );

  const healthy = results.filter(r => r.status === "healthy").length;
  const degraded = results.filter(r => r.status === "degraded").length;
  const unhealthy = results.filter(r => r.status === "unhealthy").length;

  const overall = unhealthy > 0 ? "unhealthy" : degraded > 0 ? "degraded" : "healthy";

  res.status(overall === "unhealthy" ? 503 : 200).json({
    overall,
    services: results,
    checks: { totalServices: results.length, healthy, degraded, unhealthy },
    timestamp: new Date().toISOString(),
  });
});

// GET /api/health/live — Kubernetes liveness probe (is process running?)
router.get("/health/live", (req, res) => res.json({ status: "alive" }));

// GET /api/health/ready — Kubernetes readiness probe (can handle traffic?)
router.get("/health/ready", async (req, res) => {
  const dbHealthy = await checkDatabase();
  res.status(dbHealthy ? 200 : 503).json({ ready: dbHealthy });
});
```

**Each service's `checkHealth()` verifies:**
- Database connectivity (`SELECT 1`).
- Cache availability.
- External dependencies (PayPal API, SAP connection).

**Kubernetes uses these for:**
- **Liveness**: Process running? If not → restart pod.
- **Readiness**: Can handle traffic? If not → remove from load balancer (don't kill).

---

## Q40: How does FoodDash's static file serving work in production?

**Answer:**

```typescript
// server/static.ts
import express from "express";
import path from "path";

export function serveStatic(app: express.Express) {
  // Serve Vite's built assets with long-term caching
  app.use(
    "/assets",
    express.static(path.join(__dirname, "public/assets"), {
      maxAge: "1y",           // Cache for 1 year (files have content hash)
      immutable: true,         // Never revalidate
    })
  );

  // Serve other static files
  app.use(express.static(path.join(__dirname, "public")));

  // SPA fallback — all non-API routes serve index.html
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(__dirname, "public/index.html"));
  });
}
```

**Why this configuration:**
1. **Hashed assets** (`main-abc123.js`) — Vite generates unique filenames based on content hash. Safe to cache forever (`maxAge: "1y"`, `immutable: true`).
2. **SPA fallback** — Client-side routing (Wouter) needs `index.html` for all routes. Without the fallback, refreshing `/restaurant/123` returns 404.
3. **API passthrough** — `/api/*` routes skip the SPA fallback and reach Express route handlers.
4. **Single origin** — Both API and static files served from the same Express server (port 5000). No CORS issues.

---

## Q41: Explain the `crypto` module usage in FoodDash for JWT and security.

**Answer:**

```typescript
import crypto from "node:crypto";

// 1. JWT signing with HMAC-SHA256
function signJWT(payload: object, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

// 2. Timing-safe comparison (prevents timing attacks)
function verifySignature(token: string, secret: string): boolean {
  const [header, body, signature] = token.split(".");
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// 3. UUID generation for correlation IDs
const correlationId = crypto.randomUUID();

// 4. OTP generation
const otp = crypto.randomInt(100000, 999999).toString(); // 6-digit code
```

**Why `timingSafeEqual`?**

Regular string comparison (`===`) short-circuits on first mismatch:
- `"abcdef" === "xbcdef"` → fails at position 0 (fast, ~0.1μs)
- `"abcdef" === "abcdex"` → fails at position 5 (slow, ~0.5μs)

An attacker measuring response times can deduce the correct signature byte-by-byte. `timingSafeEqual` takes constant time regardless of where the mismatch occurs.

---

## Q42: How does FoodDash implement the Anti-Corruption Layer for SAP integration?

**Answer:**

The Anti-Corruption Layer (ACL) isolates the domain model from SAP's German-abbreviated naming:

```typescript
// SAP uses German abbreviations
interface SAPVendor {
  LIFNR: string;   // Lieferantennummer (vendor number)
  NAME1: string;   // Name
  ORT01: string;   // City (Ort)
  STRAS: string;   // Street (Straße)
}

// FoodDash uses clean domain names
interface Vendor {
  id: string;
  name: string;
  city: string;
  street: string;
}

// Transformer: SAP → Domain
class SAPDataTransformer {
  static transformVendor(sapVendor: SAPVendor): Vendor {
    return {
      id: sapVendor.LIFNR,
      name: sapVendor.NAME1,
      city: sapVendor.ORT01,
      street: sapVendor.STRAS,
    };
  }

  // Transformer: Domain → SAP
  static toSAPVendor(vendor: Partial<Vendor>): Partial<SAPVendor> {
    return {
      NAME1: vendor.name,
      ORT01: vendor.city,
      STRAS: vendor.street,
    };
  }
}
```

**SAP RFC calls wrapped with circuit breaker:**
```typescript
class SAPRFCConnection {
  async callFunction<T>(functionName: string, params: any): Promise<T> {
    return circuitBreaker.execute(async () => {
      await this.delay(50 + Math.random() * 100); // Simulated latency
      return this.mockRFCResponse(functionName, params);
    });
  }
}
```

**Event-driven sync:**
```
ORDER_DELIVERED → SAPIntegrationService → Create SAP Sales Order
PAYMENT_SUCCESS → SAPIntegrationService → Create SAP Finance Document
```

**Why ACL?** Without it, SAP's naming conventions (`LIFNR`, `MATNR`, `EBELN`) would leak into business logic, making code unreadable and tightly coupled to SAP's data model.

---

## Q43: How does FoodDash use `Promise.allSettled` vs `Promise.all`?

**Answer:**

```typescript
// Promise.all — Fails fast on first rejection
const results = await Promise.all([fetchOrders(), fetchPayments(), fetchNotifications()]);
// If fetchPayments fails → ENTIRE result is rejected. Orders and notifications lost.

// Promise.allSettled — Waits for all, never rejects
const results = await Promise.allSettled([fetchOrders(), fetchPayments(), fetchNotifications()]);
// results = [
//   { status: "fulfilled", value: orders },
//   { status: "rejected", reason: Error("Payment service down") },
//   { status: "fulfilled", value: notifications },
// ]
```

**FoodDash uses `Promise.allSettled` for:**

1. **Health check aggregation** — If one service is down, still report health of the other 15:
```typescript
const healthChecks = await Promise.allSettled(
  services.map(svc => svc.checkHealth())
);
```

2. **Multi-channel notifications** — Email fails? SMS still sends:
```typescript
const results = await Promise.allSettled([
  sendEmail(user, message),
  sendSMS(user, message),
  sendPush(user, message),
]);
```

3. **Saga compensation** — Even if compensating Step 2 fails, still try compensating Step 1:
```typescript
const compensations = await Promise.allSettled(
  completedSteps.reverse().map(step => step.compensate(context))
);
```

**Rule of thumb:**
- `Promise.all` — All must succeed (e.g., all saga steps in forward direction).
- `Promise.allSettled` — Best effort, partial success is acceptable (health checks, notifications).

---

## Q44: How does the Delivery Partner auto-assignment algorithm work?

**Answer:**

```typescript
async assignRider(orderId: string): Promise<DeliveryPartner | null> {
  const order = await this.getOrderWithLocation(orderId);

  // 1. Find available riders within 5km radius (Haversine distance)
  const availableRiders = await this.findAvailableRiders(
    order.restaurantLatitude,
    order.restaurantLongitude,
    5 // km radius
  );

  if (availableRiders.length === 0) return null;

  // 2. Score each rider
  const scored = availableRiders.map(rider => ({
    rider,
    score: this.calculateScore(rider, order),
  }));

  // 3. Select highest scoring
  scored.sort((a, b) => b.score - a.score);
  return scored[0].rider;
}

calculateScore(rider, order): number {
  let score = 0;

  // Distance (closer = better): max 100 points
  const distance = haversine(rider.location, order.restaurantLocation);
  score += Math.max(0, 100 - distance * 10);

  // Rating: max 50 points
  score += rider.rating * 10;

  // Current load (fewer orders = better): max 50 points
  score += Math.max(0, 50 - rider.activeOrders * 10);

  // Completion rate: max 50 points
  score += rider.completionRate * 50;

  return score;  // Max: 250
}
```

**Haversine formula** (calculates distance between two GPS coordinates on Earth's surface):
```typescript
function haversine(lat1, lon1, lat2, lon2): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
```

**Background processing:** The assignment runs as a background job triggered by the `ORDER_CONFIRMED` event. If no rider is found, the system retries with an expanding radius every 30 seconds.

---

## Q45: How does `process` event handling work in Node.js? What does FoodDash handle?

**Answer:**

```typescript
// Graceful shutdown
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Unhandled errors — log and exit
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", { error: error.message, stack: error.stack });
  // Exit with error code — let process manager restart
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled rejection", { reason: String(reason) });
  // In Node 15+, this causes exit by default
});

// Memory monitoring
process.on("warning", (warning) => {
  if (warning.name === "MaxListenersExceededWarning") {
    logger.warn("Memory leak detected — too many event listeners");
  }
});
```

**Why `uncaughtException` should exit:**
- The process is in an undefined state after an uncaught exception.
- Continuing could cause data corruption.
- Process managers (PM2, K8s) will restart the process automatically.

**`unhandledRejection` vs `uncaughtException`:**
- `unhandledRejection` — A Promise rejected without `.catch()`.
- `uncaughtException` — A synchronous throw without `try/catch`.
- In both cases, FoodDash logs the error and relies on the error handler for graceful recovery.

---

## Q46: How does FoodDash implement the GraphQL BFF (Backend for Frontend) pattern?

**Answer:**

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
  addToCart(item: CartItemInput!): Cart!
  applyCoupon(code: String!): CouponResult!
}

type Subscription {
  orderStatusChanged(orderId: ID!): OrderUpdate!
  deliveryLocationUpdated(orderId: ID!): LocationUpdate!
}
```

**BFF pattern — GraphQL aggregates multiple microservices:**
```typescript
const resolvers = {
  Query: {
    restaurant: async (_, { id }) => {
      const restaurant = await restaurantService.getById(id);
      const menu = await menuService.getByRestaurantId(id);
      const reviews = await reviewService.getByRestaurantId(id);
      return { ...restaurant, menu, reviews };
    },
  },
  Order: {
    // Field-level resolution — only fetches if client requests it
    deliveryPartner: async (order) => {
      if (!order.deliveryPartnerId) return null;
      return deliveryService.getById(order.deliveryPartnerId);
    },
  },
};
```

**Why BFF pattern:**
1. **One request** — Mobile client gets restaurant + menu + reviews in ONE request instead of three.
2. **Client-driven** — Client requests only the fields it needs. Mobile might skip `reviews`, desktop includes them.
3. **Aggregation layer** — Frontend doesn't need to know about individual microservice APIs.
4. **Subscriptions** — GraphQL subscriptions map naturally to WebSocket events.

---

## Q47: How does Node.js garbage collection work and how does it affect FoodDash?

**Answer:**

Node.js (V8 engine) uses a **generational garbage collector**:

**Young Generation (Scavenger):**
- Small, fast collections.
- Most objects die young (request/response objects, temporary variables).
- Copy-and-compact algorithm — survivors are copied to "old generation".

**Old Generation (Mark-Sweep-Compact):**
- Larger, slower collections.
- Long-lived objects (cache entries, service instances, DB connection pool).
- **Mark**: Walk from roots, mark reachable objects.
- **Sweep**: Free unmarked objects.
- **Compact**: Defragment memory.

**FoodDash concerns:**

1. **In-memory cache growth** — L1 cache stores restaurant/menu data. Without TTL cleanup, the old generation grows → longer GC pauses:
```typescript
// Cleanup runs every 60 seconds
setInterval(() => {
  for (const [key, entry] of this.cache.entries()) {
    if (entry.expiresAt < Date.now()) this.cache.delete(key);
  }
}, 60000);
```

2. **Event log** — EventBus stores last 1000 events. Without limiting: memory leak.
```typescript
this.eventLog.push(event);
if (this.eventLog.length > 1000) this.eventLog.shift();
```

3. **WebSocket connections** — Each `Map<string, Set<WebSocket>>` entry holds references. Cleanup on disconnect prevents memory leaks.

**Monitoring:**
```typescript
const memUsage = process.memoryUsage();
metrics.gauge("memory.heapUsed", memUsage.heapUsed);
metrics.gauge("memory.heapTotal", memUsage.heapTotal);
metrics.gauge("memory.rss", memUsage.rss);
```

---

## Q48: How does FoodDash implement the Multi-Region routing strategy?

**Answer:**

```typescript
// 5 pre-configured regions
const regions = [
  { id: "us-east-1", location: "Virginia", isPrimary: true },
  { id: "us-west-2", location: "Oregon" },
  { id: "eu-west-1", location: "Ireland" },    // GDPR compliance
  { id: "ap-south-1", location: "Mumbai" },
  { id: "ap-northeast-1", location: "Tokyo" },
];

// Weighted scoring for region selection
function routeRequest(userLocation) {
  return regions.map(region => ({
    region,
    score:
      (0.4 * distanceScore(userLocation, region)) +  // Closer = better
      (0.3 * healthScore(region)) +                    // Healthier = better
      (0.2 * replicationLagScore(region)) +            // Less lag = better
      (0.1 * (region.isPrimary ? 1 : 0)),             // Primary bonus
  }))
  .sort((a, b) => b.score - a.score)[0].region;
}
```

**Key rules:**
- **Writes always go to primary** (`us-east-1`) — Single source of truth.
- **Reads go to nearest region** — Lower latency for customers.
- **GDPR compliance** — `eu-west-1` has feature flag for GDPR-specific data handling.
- **Automatic failover** — If primary degrades, backup regions handle writes temporarily.
- **Cross-region cache invalidation** — Redis pub/sub invalidates cache globally.

---

## Q49: How does FoodDash implement the ETA prediction algorithm?

**Answer:**

```typescript
function predictETA(restaurant, customerLocation, orderItems): ETAPrediction {
  // Base preparation time (from restaurant config)
  const basePrepTime = restaurant.deliveryTime; // e.g., 25 minutes

  // Travel time (Haversine distance / average speed)
  const distance = haversine(restaurant.location, customerLocation);
  const avgSpeed = 20; // km/h for delivery bikes
  const travelTime = (distance / avgSpeed) * 60; // Convert to minutes

  // Adjustments
  let adjustments = 0;

  // Rush hour: +20% during 12-14 and 18-21
  const hour = new Date().getHours();
  if ((hour >= 12 && hour <= 14) || (hour >= 18 && hour <= 21)) {
    adjustments += basePrepTime * 0.20;
  }

  // Weather factor: +15% (from weather API)
  if (currentWeather === "rain") {
    adjustments += travelTime * 0.15;
  }

  // Restaurant load: +5-15% based on active orders
  const activeOrders = await getActiveOrderCount(restaurant.id);
  adjustments += basePrepTime * Math.min(0.15, activeOrders * 0.02);

  const totalMinutes = Math.ceil(basePrepTime + travelTime + adjustments);

  return {
    estimatedMinutes: totalMinutes,
    confidence: 0.85,
    range: { min: totalMinutes - 5, max: totalMinutes + 10 },
    factors: { basePrepTime, travelTime, adjustments },
  };
}
```

**ML-enhanced ETA** (from MachineLearningService):
- Trains on historical order data.
- Considers: restaurant's actual prep times, driver's average speed, time of day, day of week.
- Confidence score increases with more historical data.

---

## Q50: Compare Node.js with other backend runtimes. Why is Node.js the right choice for FoodDash?

**Answer:**

| Aspect | Node.js | Go | Java/Spring | Python/Django |
|--------|---------|-----|-------------|--------------|
| I/O model | Non-blocking event loop | Goroutines (lightweight threads) | Thread pool | WSGI (sync) / ASGI (async) |
| Concurrency | Excellent for I/O | Excellent for CPU + I/O | Good with thread pool | Good with asyncio |
| Cold start | Fast (~100ms) | Very fast (~50ms) | Slow (~2-5s) | Moderate (~500ms) |
| Ecosystem | npm (2M+ packages) | Growing | Maven (mature) | pip (large) |
| TypeScript | Native (shared with frontend) | Static typing (Go) | Java types | Type hints (optional) |
| Real-time | Excellent (WebSocket native) | Good | Good (Spring WebFlux) | Limited |
| JSON handling | Native (V8 optimized) | Good (encoding/json) | Verbose (Jackson) | Good (json module) |

**Why Node.js for FoodDash:**

1. **Full-stack TypeScript** — Frontend (React) and backend share types (`shared/schema.ts`). Zod schemas validate on both sides. One language for the entire team.

2. **I/O-bound workload** — FoodDash is mostly waiting on: database queries, external APIs (PayPal, SAP), WebSocket messages. Node.js's event loop excels at this.

3. **Real-time first** — WebSocket support is native. Order tracking, rider location, and live notifications all require persistent bidirectional connections.

4. **Microservices synergy** — Event-driven architecture maps naturally to Node.js's event-driven model (EventEmitter, pub/sub).

5. **Fast iteration** — Hot Module Replacement (Vite), fast builds (esbuild), rapid prototyping. Critical for a startup moving fast.

6. **JSON native** — Every API request/response is JSON. V8 optimizes JSON.parse/stringify natively.

**Where Node.js would struggle:**
- CPU-intensive ML computations → offload to `worker_threads` or a Python ML service.
- Heavy number crunching → Go or Rust would be more efficient.
- Enterprise Java integrations → SAP RFC calls are wrapped via the Anti-Corruption Layer.

---
