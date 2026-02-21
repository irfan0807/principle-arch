# FoodDash — Low-Level Design (LLD) Interview Q&A (50 Questions)

## For 6+ Years Fullstack Engineer | Design Patterns · Class Design · OOP · SOLID · Data Structures

> **Project**: FoodDash — Production-Grade Food Delivery Platform  
> **Architecture**: Microservices + Event-Driven + CQRS + Saga + Hexagonal Architecture  
> **Patterns Used**: 30+ Design Patterns across 16 Microservices  
> **Last Updated**: February 2026

---

## Q1: Design the BaseService abstract class that all microservices inherit from.

**Answer:**

**Requirements:**
- Every microservice needs: health checks, resilience (retry + timeout + circuit breaker), event publishing, logging
- Must not repeat this boilerplate in each service

**Class Diagram:**
```
┌─────────────────────────────────────────────┐
│              BaseService (abstract)          │
├─────────────────────────────────────────────┤
│ # serviceName: string                       │
│ # port: number                              │
│ # eventBus: EventBus                        │
│ # cache: CacheManager                       │
│ # circuitBreaker: CircuitBreaker            │
│ # logger: Logger                            │
│ # metrics: MetricsCollector                 │
│ - startTime: Date                           │
│ - operationCount: number                    │
│ - errorCount: number                        │
├─────────────────────────────────────────────┤
│ + constructor(name, port, eventBus, cache)  │
│ + abstract initialize(): Promise<void>      │
│ + getHealth(): HealthStatus                 │
│ + getMetrics(): ServiceMetrics              │
│ # executeWithResilience<T>(                 │
│     operation, name, options                │
│   ): Promise<T>                             │
│ # publishEvent(type, data): void            │
│ # log(level, message, meta): void           │
│ # withTimeout<T>(op, ms): Promise<T>        │
│ # withRetry<T>(op, attempts): Promise<T>    │
└─────────────────────────────────────────────┘
         ▲          ▲          ▲
         │          │          │
┌────────┴──┐ ┌────┴─────┐ ┌──┴──────────┐
│OrderService│ │MenuService│ │PaymentService│
└────────────┘ └──────────┘ └─────────────┘
```

**Key Method — `executeWithResilience`:**
```typescript
protected async executeWithResilience<T>(
  operation: () => Promise<T>,
  operationName: string,
  options: { timeout?: number; retries?: number } = {}
): Promise<T> {
  const { timeout = 10000, retries = 3 } = options;

  this.operationCount++;
  const timer = this.metrics.startTimer(`${this.serviceName}.${operationName}`);

  try {
    // Layer 1: Circuit Breaker wraps everything
    const result = await this.circuitBreaker.execute(async () => {
      // Layer 2: Timeout prevents hanging
      return this.withTimeout(
        // Layer 3: Retry handles transient failures
        this.withRetry(operation, retries),
        timeout
      );
    });
    timer.end();
    return result;
  } catch (error) {
    this.errorCount++;
    this.log("error", `Operation ${operationName} failed`, { error });
    throw error;
  }
}
```

**Design Decisions:**
- **Template Method Pattern** — `initialize()` is abstract; subclasses define service-specific startup
- **Protected methods** — Subclasses access resilience/logging but can't break internals
- **Composition over inheritance** — `eventBus`, `cache`, `circuitBreaker` are injected (Dependency Injection)
- **Single Responsibility** — BaseService handles cross-cutting concerns; subclasses handle business logic

---

## Q2: Design the CircuitBreaker class with its state machine.

**Answer:**

**State Diagram:**
```
  CLOSED ──(failures >= threshold)──▶ OPEN
    ▲                                   │
    │                              (resetTimeout elapsed)
    │                                   │
    │                                   ▼
    └───(successes >= required)──── HALF_OPEN
                                        │
                                   (any failure)
                                        │
                                        ▼
                                      OPEN
```

**Class Design:**
```typescript
enum CircuitState {
  CLOSED = "closed",
  OPEN = "open",
  HALF_OPEN = "half_open",
}

interface CircuitBreakerConfig {
  failureThreshold: number;     // Default: 5
  resetTimeout: number;         // Default: 30000ms
  halfOpenRequests: number;     // Default: 3 (successes needed to close)
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private config: CircuitBreakerConfig;
  private fallback?: () => Promise<any>;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      resetTimeout: config.resetTimeout ?? 30000,
      halfOpenRequests: config.halfOpenRequests ?? 3,
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime >= this.config.resetTimeout) {
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        if (this.fallback) return this.fallback() as Promise<T>;
        throw new Error("Circuit breaker is OPEN");
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.halfOpenRequests) {
        this.transitionTo(CircuitState.CLOSED);
      }
    }
    this.failureCount = 0;  // Reset on any success in CLOSED state
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN);  // Immediately re-open
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  private transitionTo(newState: CircuitState): void {
    this.state = newState;
    this.successCount = 0;
    if (newState === CircuitState.CLOSED) this.failureCount = 0;
  }
}
```

**Two Instances in FoodDash:**

| Instance | Threshold | Reset | Why |
|----------|-----------|-------|-----|
| `externalServiceCircuitBreaker` | 5 failures | 30s | General external calls |
| `paymentCircuitBreaker` | 3 failures | 60s | Payments are critical, fail faster, recover slower |

**SOLID Principles Applied:**
- **SRP** — Only manages circuit state; doesn't do logging or retries
- **OCP** — New states/strategies can be added without modifying existing code
- **DIP** — Takes `operation: () => Promise<T>` (function), not concrete service

---

## Q3: Design the EventBus (Pub/Sub) system.

**Answer:**

**Class Diagram:**
```
┌──────────────────────────────────────────────┐
│                  EventBus                     │
├──────────────────────────────────────────────┤
│ - handlers: Map<string, Set<EventHandler>>   │
│ - eventLog: Event[]                          │
│ - maxLogSize: number (1000)                  │
│ - metrics: MetricsCollector                  │
├──────────────────────────────────────────────┤
│ + subscribe(type, handler): unsubscribeFn    │
│ + publish(type, data, correlationId): void   │
│ + getEventLog(): Event[]                     │
│ + getHandlerCount(): number                  │
│ + clearEventLog(): void                      │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│                   Event                       │
├──────────────────────────────────────────────┤
│ + id: string (uuid)                          │
│ + type: string                               │
│ + data: unknown                              │
│ + correlationId: string                      │
│ + source: string                             │
│ + timestamp: Date                            │
└──────────────────────────────────────────────┘
```

**Subscribe with Wildcard Support:**
```typescript
subscribe(eventType: string, handler: EventHandler): () => void {
  if (!this.handlers.has(eventType)) {
    this.handlers.set(eventType, new Set());
  }
  this.handlers.get(eventType)!.add(handler);

  // Return unsubscribe function (Closure pattern)
  return () => {
    this.handlers.get(eventType)?.delete(handler);
  };
}
```

**Publish with Error Isolation:**
```typescript
async publish(type: string, data: unknown, correlationId?: string): Promise<void> {
  const event: Event = {
    id: randomUUID(),
    type,
    data,
    correlationId: correlationId ?? getCorrelationId() ?? randomUUID(),
    source: "event-bus",
    timestamp: new Date(),
  };

  // Log event (circular buffer, max 1000)
  this.eventLog.push(event);
  if (this.eventLog.length > this.maxLogSize) this.eventLog.shift();

  // Notify specific handlers
  const handlers = this.handlers.get(type) ?? new Set();
  // Notify wildcard handlers
  const wildcardHandlers = this.handlers.get("*") ?? new Set();

  const allHandlers = [...handlers, ...wildcardHandlers];

  // Execute ALL handlers — one failure doesn't block others
  await Promise.allSettled(
    allHandlers.map(handler =>
      Promise.resolve(handler(event)).catch(err =>
        console.error(`Handler error for ${type}:`, err)
      )
    )
  );

  this.metrics.increment(`events.published.${type}`);
}
```

**Design Patterns:**
- **Observer Pattern** — Publishers and subscribers are decoupled
- **Mediator Pattern** — EventBus mediates all inter-service communication
- **Closure** — `subscribe` returns an unsubscribe function (no need for separate `unsubscribe` method)

**Key Design Decision — `Promise.allSettled` vs `Promise.all`:**
`Promise.allSettled` ensures one failing handler doesn't prevent other handlers from executing. Critical for reliability — if the notification handler fails, the analytics handler should still run.

---

## Q4: Design the SagaOrchestrator for distributed transactions.

**Answer:**

**Class Diagram:**
```
┌─────────────────────────────────────────────┐
│             SagaOrchestrator                 │
├─────────────────────────────────────────────┤
│ - eventBus: EventBus                        │
│ - activeSagas: Map<string, SagaExecution>   │
│ - sagaDefinitions: Map<string, SagaStep[]>  │
├─────────────────────────────────────────────┤
│ + registerSaga(name, steps): void           │
│ + execute(sagaName, data): SagaResult       │
│ - executeStep(step, context): StepResult    │
│ - compensate(steps, context): void          │
│ + getSagaStatus(sagaId): SagaExecution      │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│                SagaStep                      │
├─────────────────────────────────────────────┤
│ + name: string                              │
│ + execute: (ctx) => Promise<StepResult>     │
│ + compensate: (ctx) => Promise<void>        │
│ + timeout: number (default 30000)           │
│ + retries: number (default 3)              │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│             SagaExecution                    │
├─────────────────────────────────────────────┤
│ + id: string                                │
│ + sagaName: string                          │
│ + status: "running" | "completed" | "failed"│
│ + completedSteps: string[]                  │
│ + failedStep: string | null                 │
│ + startedAt: Date                           │
│ + completedAt: Date | null                  │
│ + context: Record<string, any>              │
└─────────────────────────────────────────────┘
```

**Execute Method (Forward + Compensation):**
```typescript
async execute(sagaName: string, initialData: any): Promise<SagaResult> {
  const steps = this.sagaDefinitions.get(sagaName);
  const execution: SagaExecution = {
    id: randomUUID(),
    sagaName,
    status: "running",
    completedSteps: [],
    failedStep: null,
    startedAt: new Date(),
    context: { ...initialData },
  };

  this.activeSagas.set(execution.id, execution);

  for (const step of steps) {
    try {
      const result = await this.executeStep(step, execution.context);
      execution.completedSteps.push(step.name);
      Object.assign(execution.context, result);  // Accumulate step results
    } catch (error) {
      execution.failedStep = step.name;
      execution.status = "failed";

      // Compensate in REVERSE order
      await this.compensate(
        steps.slice(0, execution.completedSteps.length).reverse(),
        execution.context
      );

      this.eventBus.publish("SAGA_FAILED", { sagaId: execution.id, step: step.name });
      return { success: false, error: error.message, sagaId: execution.id };
    }
  }

  execution.status = "completed";
  execution.completedAt = new Date();
  this.eventBus.publish("SAGA_COMPLETED", { sagaId: execution.id });
  return { success: true, data: execution.context, sagaId: execution.id };
}
```

**Compensate Method:**
```typescript
private async compensate(stepsToReverse: SagaStep[], context: any): Promise<void> {
  for (const step of stepsToReverse) {
    try {
      await step.compensate(context);
    } catch (compensateError) {
      // Log but DON'T throw — best-effort compensation
      // Failed compensations go to DLQ for manual resolution
      this.eventBus.publish("COMPENSATION_FAILED", {
        step: step.name,
        error: compensateError.message,
      });
    }
  }
}
```

**Design Patterns:**
- **Saga Pattern** — Distributed transaction with compensation
- **Command Pattern** — Each step is a command with execute/undo (compensate)
- **Chain of Responsibility** — Steps execute in sequence, failure triggers reverse chain

---

## Q5: Design the CacheManager with L1/L2 hierarchy.

**Answer:**

**Class Diagram:**
```
┌──────────────────────────────────────────────┐
│               CacheManager                    │
├──────────────────────────────────────────────┤
│ - l1: Map<string, CacheEntry>                │
│ - l2: RedisClient                            │
│ - defaultTTL: number                         │
│ - maxL1Size: number (10000)                  │
│ - stats: { hits, misses, l1Hits, l2Hits }    │
├──────────────────────────────────────────────┤
│ + get<T>(key): Promise<T | null>             │
│ + set(key, value, ttl?): Promise<void>       │
│ + invalidate(key): Promise<void>             │
│ + invalidatePattern(pattern): Promise<void>  │
│ + getStats(): CacheStats                     │
│ - isExpired(entry): boolean                  │
│ - evictLRU(): void                           │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│               CacheEntry                      │
├──────────────────────────────────────────────┤
│ + value: any                                 │
│ + expiresAt: number                          │
│ + createdAt: number                          │
│ + accessCount: number                        │
└──────────────────────────────────────────────┘
```

**Get Method (L1 → L2 → DB):**
```typescript
async get<T>(key: string): Promise<T | null> {
  // L1: In-memory check
  const l1Entry = this.l1.get(key);
  if (l1Entry && !this.isExpired(l1Entry)) {
    l1Entry.accessCount++;
    this.stats.l1Hits++;
    this.stats.hits++;
    return l1Entry.value as T;
  }

  // L1 miss or expired — remove stale entry
  if (l1Entry) this.l1.delete(key);

  // L2: Redis check
  if (this.l2) {
    const l2Value = await this.l2.get(key);
    if (l2Value) {
      const parsed = JSON.parse(l2Value) as T;
      // Populate L1 from L2 (write-back)
      this.setL1(key, parsed, this.defaultTTL);
      this.stats.l2Hits++;
      this.stats.hits++;
      return parsed;
    }
  }

  this.stats.misses++;
  return null;  // Caller must fetch from DB and call set()
}
```

**Set Method (Write-Through):**
```typescript
async set(key: string, value: any, ttlMs?: number): Promise<void> {
  const ttl = ttlMs ?? this.defaultTTL;

  // L1: In-memory
  this.setL1(key, value, ttl);

  // L2: Redis
  if (this.l2) {
    await this.l2.set(key, JSON.stringify(value), "PX", ttl);
  }
}

private setL1(key: string, value: any, ttlMs: number): void {
  if (this.l1.size >= this.maxL1Size) {
    this.evictLRU();
  }
  this.l1.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
    createdAt: Date.now(),
    accessCount: 0,
  });
}
```

**Eviction — LRU (Least Recently Used):**
```typescript
private evictLRU(): void {
  let lruKey: string | null = null;
  let lruAccess = Infinity;

  for (const [key, entry] of this.l1) {
    if (entry.accessCount < lruAccess) {
      lruAccess = entry.accessCount;
      lruKey = key;
    }
  }

  if (lruKey) this.l1.delete(lruKey);
}
```

**Invalidation with Pattern:**
```typescript
async invalidatePattern(pattern: string): Promise<void> {
  // L1: Iterate and match
  for (const key of this.l1.keys()) {
    if (key.startsWith(pattern.replace("*", ""))) {
      this.l1.delete(key);
    }
  }
  // L2: Redis SCAN + DEL (non-blocking)
  if (this.l2) {
    const keys = await this.l2.keys(pattern);
    if (keys.length > 0) await this.l2.del(...keys);
  }
}
```

**Design Patterns:**
- **Cache-Aside** — Application manages cache (get → miss → load from DB → set)
- **Write-Through** — Writes go to both L1 and L2
- **LRU Eviction** — Least frequently accessed entry evicted when L1 is full
- **Strategy Pattern** — L2 backend is pluggable (Redis, Memcached, None)

---

## Q6: Design the RateLimiter middleware using the Sliding Window algorithm.

**Answer:**

**Class Design:**
```
┌──────────────────────────────────────────────┐
│              RateLimiter                      │
├──────────────────────────────────────────────┤
│ - store: Map<string, RateLimitEntry>         │
│ - config: { windowMs, maxRequests }          │
│ - cleanupInterval: NodeJS.Timeout            │
├──────────────────────────────────────────────┤
│ + middleware(): Express.RequestHandler       │
│ + isRateLimited(key): boolean                │
│ - getKey(req): string                        │
│ - cleanup(): void                            │
│ - setRateLimitHeaders(res, entry): void      │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│             RateLimitEntry                    │
├──────────────────────────────────────────────┤
│ + count: number                              │
│ + resetAt: number (timestamp)                │
└──────────────────────────────────────────────┘
```

**Middleware Implementation:**
```typescript
class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private config: { windowMs: number; maxRequests: number };

  constructor(windowMs: number, maxRequests: number) {
    this.config = { windowMs, maxRequests };
    // Periodic cleanup of expired entries
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  middleware(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.getKey(req);
      const now = Date.now();
      let entry = this.store.get(key);

      // Reset window if expired
      if (!entry || now > entry.resetAt) {
        entry = { count: 0, resetAt: now + this.config.windowMs };
        this.store.set(key, entry);
      }

      entry.count++;

      // RFC 6585 compliant headers
      res.setHeader("X-RateLimit-Limit", this.config.maxRequests);
      res.setHeader("X-RateLimit-Remaining",
        Math.max(0, this.config.maxRequests - entry.count));
      res.setHeader("X-RateLimit-Reset",
        Math.ceil((entry.resetAt - now) / 1000));

      if (entry.count > this.config.maxRequests) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        res.setHeader("Retry-After", retryAfter);
        return res.status(429).json({
          error: "Too Many Requests",
          retryAfter,
        });
      }

      next();
    };
  }

  private getKey(req: Request): string {
    return req.ip ?? req.socket.remoteAddress ?? "unknown";
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.resetAt) this.store.delete(key);
    }
  }
}
```

**Three Instances:**
```typescript
const apiLimiter   = new RateLimiter(60_000,  100);  // 100/min for general API
const authLimiter  = new RateLimiter(900_000, 10);   // 10/15min for auth
const orderLimiter = new RateLimiter(60_000,  10);   // 10/min for orders
```

**Key Design Decisions:**
- **IP-based key** — Simple, works for unauthenticated users
- **Periodic cleanup** — Prevents memory leak from stale entries
- **RFC 6585 headers** — Clients can self-throttle using `Retry-After`
- **At scale**: Replace in-memory Map with Redis `INCR` + `EXPIRE` for distributed rate limiting

---

## Q7: Design the CorrelationId middleware using AsyncLocalStorage.

**Answer:**

**Problem:** In async Node.js code, there's no thread-local storage. When multiple requests run concurrently, how do you associate a log entry with the right request?

**Solution — AsyncLocalStorage (Node.js 16+):**
```
┌────────────────────────────────────────────────────────────┐
│  AsyncLocalStorage                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Request A    │  │ Request B    │  │ Request C    │    │
│  │ corr: abc123 │  │ corr: def456 │  │ corr: ghi789 │    │
│  │              │  │              │  │              │    │
│  │ All async    │  │ All async    │  │ All async    │    │
│  │ operations   │  │ operations   │  │ operations   │    │
│  │ inherit this │  │ inherit this │  │ inherit this │    │
│  │ context      │  │ context      │  │ context      │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└────────────────────────────────────────────────────────────┘
```

**Implementation:**
```typescript
import { AsyncLocalStorage } from "node:async_hooks";

interface RequestContext {
  correlationId: string;
  startTime: number;
  userId?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

// Middleware: creates context for each request
function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId =
    (req.headers["x-correlation-id"] as string) ?? randomUUID();

  const context: RequestContext = {
    correlationId,
    startTime: Date.now(),
    userId: req.user?.id,
  };

  // Set response header for client-side tracing
  res.setHeader("X-Correlation-Id", correlationId);

  // Run the rest of the request within this context
  asyncLocalStorage.run(context, () => next());
}

// Helper: get correlation ID from anywhere in the call stack
function getCorrelationId(): string | undefined {
  return asyncLocalStorage.getStore()?.correlationId;
}
```

**Usage in any service/handler:**
```typescript
// In OrderService — no need to pass correlationId through every function
class OrderService {
  async createOrder(data: CreateOrderInput) {
    const correlationId = getCorrelationId();
    this.logger.info("Creating order", { correlationId, data });
    // correlationId is available in ANY function called from this chain
  }
}
```

**Why AsyncLocalStorage over passing context manually:**
- No "context pollution" — don't need to add `correlationId` param to every function
- Works across `await` boundaries (unlike thread-local in other languages)
- Automatic propagation to EventBus events

---

## Q8: Design the Order state machine with Finite State Machine (FSM) pattern.

**Answer:**

**Class Design:**
```
┌──────────────────────────────────────────────┐
│            OrderStateMachine                  │
├──────────────────────────────────────────────┤
│ - transitions: Map<Status, Set<Status>>      │
│ - hooks: Map<TransitionKey, Hook[]>          │
├──────────────────────────────────────────────┤
│ + canTransition(from, to): boolean           │
│ + transition(order, newStatus): Order        │
│ + onTransition(from, to, hook): void         │
│ + getValidNextStates(current): Status[]      │
└──────────────────────────────────────────────┘
```

**Transition Table:**
```typescript
type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready_for_pickup"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending:          ["confirmed", "cancelled"],
  confirmed:        ["preparing", "cancelled"],
  preparing:        ["ready_for_pickup", "cancelled"],
  ready_for_pickup: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered:        [],   // Terminal state
  cancelled:        [],   // Terminal state
};
```

**Transition with Hooks:**
```typescript
class OrderStateMachine {
  private hooks = new Map<string, Array<(order: Order) => Promise<void>>>();

  canTransition(from: OrderStatus, to: OrderStatus): boolean {
    return TRANSITIONS[from]?.includes(to) ?? false;
  }

  async transition(order: Order, newStatus: OrderStatus): Promise<Order> {
    if (!this.canTransition(order.status, newStatus)) {
      throw new ValidationError(
        `Invalid transition: ${order.status} → ${newStatus}. ` +
        `Valid: [${TRANSITIONS[order.status].join(", ")}]`
      );
    }

    const previousStatus = order.status;
    order.status = newStatus;

    // Execute transition hooks (notifications, events, etc.)
    const hookKey = `${previousStatus}→${newStatus}`;
    const hooks = this.hooks.get(hookKey) ?? [];
    await Promise.allSettled(hooks.map(hook => hook(order)));

    return order;
  }

  onTransition(from: OrderStatus, to: OrderStatus, hook: (order: Order) => Promise<void>): void {
    const key = `${from}→${to}`;
    if (!this.hooks.has(key)) this.hooks.set(key, []);
    this.hooks.get(key)!.push(hook);
  }
}
```

**Registering Side Effects:**
```typescript
const fsm = new OrderStateMachine();

// When order confirmed → notify restaurant
fsm.onTransition("pending", "confirmed", async (order) => {
  eventBus.publish("ORDER_CONFIRMED", { orderId: order.id, restaurantId: order.restaurantId });
});

// When order out for delivery → notify customer via WebSocket
fsm.onTransition("ready_for_pickup", "out_for_delivery", async (order) => {
  eventBus.publish("RIDER_ASSIGNED", { orderId: order.id, customerId: order.customerId });
});

// When order cancelled → trigger saga compensation
fsm.onTransition("*", "cancelled", async (order) => {
  eventBus.publish("ORDER_CANCELLED", { orderId: order.id, reason: "customer_request" });
});
```

**Design Patterns:**
- **State Pattern** — Each state defines allowed transitions
- **Observer Pattern** — Hooks observe transitions, trigger side effects
- **Guard Clause** — `canTransition()` prevents invalid state changes

---

## Q9: Design the Drizzle ORM schema with Zod validation.

**Answer:**

**Schema Design Pattern — Single Source of Truth:**
```
┌──────────────────────┐     ┌──────────────────────┐
│  Drizzle Table Schema│────▶│  Zod Validation      │
│  (DB definition)     │     │  (Runtime validation) │
│                      │     │                       │
│  pgTable("users",{  │     │  insertUserSchema =   │
│    id: uuid().pk(),  │     │   createInsertSchema( │
│    email: varchar(), │     │     users             │
│  })                  │     │   )                   │
└──────────────────────┘     └──────────────────────┘
```

**Users Table:**
```typescript
import { pgTable, uuid, varchar, text, decimal, timestamp, boolean } from "drizzle-orm/pg-core";
import { pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", [
  "customer", "restaurant_owner", "delivery_partner", "admin"
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).unique(),
  name: varchar("name", { length: 100 }),
  phone: varchar("phone", { length: 20 }),
  role: userRoleEnum("role").default("customer").notNull(),
  password: text("password"),
  profileImage: text("profile_image"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

**Zod Validation (auto-generated from schema):**
```typescript
export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email("Invalid email format"),
  name: z.string().min(2, "Name too short").max(100),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone"),
  role: z.enum(["customer", "restaurant_owner", "delivery_partner", "admin"]),
}).omit({ id: true, createdAt: true, updatedAt: true });
```

**Orders Table with Status Enum:**
```typescript
export const orderStatusEnum = pgEnum("order_status", [
  "pending", "confirmed", "preparing", "ready_for_pickup",
  "out_for_delivery", "delivered", "cancelled"
]);

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").references(() => users.id).notNull(),
  restaurantId: uuid("restaurant_id").references(() => restaurants.id).notNull(),
  deliveryPartnerId: uuid("delivery_partner_id").references(() => users.id),
  status: orderStatusEnum("status").default("pending").notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).default("0"),
  deliveryAddress: text("delivery_address"),
  idempotencyKey: varchar("idempotency_key", { length: 255 }).unique(),
  specialInstructions: text("special_instructions"),
  estimatedDeliveryTime: timestamp("estimated_delivery_time"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

**Why Drizzle over Prisma/TypeORM:**
- **Type-safe** — SQL-like syntax with full TypeScript inference
- **Lightweight** — No binary engine (unlike Prisma)
- **Zod integration** — `drizzle-zod` generates validators from schema
- **Migration support** — `drizzle-kit` generates and runs migrations

---

## Q10: Design the Strategy Pattern for authentication providers.

**Answer:**

**Class Diagram:**
```
┌─────────────────────────────────────┐
│       AuthStrategy (interface)       │
├─────────────────────────────────────┤
│ + authenticate(req): Promise<User>  │
│ + getCallbackURL(): string          │
│ + getProviderName(): string         │
└──────────┬──────────────────────────┘
           │
     ┌─────┼──────────────┐
     ▼     ▼              ▼
┌─────────┐ ┌──────────┐ ┌──────────────┐
│ Google  │ │ Keycloak │ │   Phone OTP  │
│ OAuth   │ │  OIDC    │ │   Strategy   │
│Strategy │ │ Strategy │ │              │
└─────────┘ └──────────┘ └──────────────┘
```

**Strategy Interface:**
```typescript
interface AuthStrategy {
  authenticate(req: Request): Promise<AuthResult>;
  getCallbackURL(): string;
  getProviderName(): string;
}

interface AuthResult {
  user: User;
  isNewUser: boolean;
  token?: string;
}
```

**Google OAuth Strategy:**
```typescript
class GoogleOAuthStrategy implements AuthStrategy {
  private passport: PassportStatic;

  constructor() {
    this.passport = passport;
    this.passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: this.getCallbackURL(),
    }, this.verifyCallback.bind(this)));
  }

  async authenticate(req: Request): Promise<AuthResult> {
    return new Promise((resolve, reject) => {
      this.passport.authenticate("google", { scope: ["profile", "email"] },
        (err, user) => err ? reject(err) : resolve(user)
      )(req);
    });
  }

  private async verifyCallback(accessToken, refreshToken, profile, done) {
    // findOrCreate pattern — upsert user
    const user = await findOrCreateUser({
      email: profile.emails[0].value,
      name: profile.displayName,
      profileImage: profile.photos?.[0]?.value,
      provider: "google",
      providerId: profile.id,
    });
    done(null, { user, isNewUser: !user.existedBefore });
  }

  getCallbackURL(): string { return "/api/auth/google/callback"; }
  getProviderName(): string { return "google"; }
}
```

**Auth Manager (Context):**
```typescript
class AuthManager {
  private strategies = new Map<string, AuthStrategy>();

  registerStrategy(strategy: AuthStrategy): void {
    this.strategies.set(strategy.getProviderName(), strategy);
  }

  async authenticate(provider: string, req: Request): Promise<AuthResult> {
    const strategy = this.strategies.get(provider);
    if (!strategy) throw new Error(`Unknown provider: ${provider}`);
    return strategy.authenticate(req);
  }
}

// Registration
const authManager = new AuthManager();
authManager.registerStrategy(new GoogleOAuthStrategy());
authManager.registerStrategy(new KeycloakOIDCStrategy());
authManager.registerStrategy(new PhoneOTPStrategy());
```

**Design Patterns:**
- **Strategy Pattern** — Interchangeable auth algorithms
- **Factory Method** — `findOrCreateUser` abstracts user creation across providers
- **Open/Closed Principle** — Add new providers without modifying existing code

---

## Q11: Design the Repository Pattern for database access.

**Answer:**

**Class Diagram:**
```
┌───────────────────────────────────────────┐
│       IRepository<T> (interface)           │
├───────────────────────────────────────────┤
│ + findById(id: string): Promise<T | null> │
│ + findAll(filter?): Promise<T[]>          │
│ + create(data): Promise<T>                │
│ + update(id, data): Promise<T>            │
│ + delete(id): Promise<boolean>            │
│ + count(filter?): Promise<number>         │
└────────────────┬──────────────────────────┘
                 │
    ┌────────────┼────────────────┐
    ▼            ▼                ▼
┌──────────┐ ┌──────────┐ ┌──────────────┐
│  Order   │ │Restaurant│ │   User       │
│Repository│ │Repository│ │ Repository   │
└──────────┘ └──────────┘ └──────────────┘
```

**OrderRepository Implementation:**
```typescript
class OrderRepository implements IRepository<Order> {
  constructor(private db: DrizzleDB, private cache: CacheManager) {}

  async findById(id: string): Promise<Order | null> {
    // Cache-aside: check cache first
    const cached = await this.cache.get<Order>(`order:${id}`);
    if (cached) return cached;

    const [order] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);

    if (order) await this.cache.set(`order:${id}`, order, 60_000); // 1 min TTL
    return order ?? null;
  }

  async create(data: InsertOrder): Promise<Order> {
    const [order] = await this.db
      .insert(orders)
      .values(data)
      .returning();

    // Event Sourcing: record creation event
    await this.db.insert(orderEvents).values({
      orderId: order.id,
      eventType: "ORDER_CREATED",
      data: order,
    });

    return order;
  }

  async findWithDetails(id: string): Promise<OrderWithDetails | null> {
    const cached = await this.cache.get<OrderWithDetails>(`order-details:${id}`);
    if (cached) return cached;

    const result = await this.db
      .select()
      .from(orders)
      .leftJoin(restaurants, eq(orders.restaurantId, restaurants.id))
      .leftJoin(users, eq(orders.customerId, users.id))
      .where(eq(orders.id, id));

    // Aggregate join results into nested object
    const details = this.mapToOrderWithDetails(result);
    if (details) await this.cache.set(`order-details:${id}`, details, 30_000);
    return details;
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const [order] = await this.db
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();

    // Invalidate all related cache entries
    await this.cache.invalidatePattern(`order*:${id}`);

    return order;
  }
}
```

**Why Repository Pattern:**
- **Abstraction** — Service layer doesn't know about Drizzle/SQL
- **Testability** — Mock the repository in unit tests
- **Cache integration** — Cache logic lives in repository, not business logic
- **Query optimization** — Complex joins encapsulated in repository methods

---

## Q12: Design the Observer Pattern for real-time WebSocket notifications.

**Answer:**

**Class Diagram:**
```
┌──────────────────────────────────────────────┐
│          WebSocketManager                     │
├──────────────────────────────────────────────┤
│ - clients: Map<string, Set<WebSocket>>       │
│ - wss: WebSocket.Server                      │
│ - eventBus: EventBus                         │
│ - heartbeatInterval: NodeJS.Timeout          │
├──────────────────────────────────────────────┤
│ + initialize(server: HTTPServer): void       │
│ + addClient(userId, ws): void                │
│ + removeClient(userId, ws): void             │
│ + broadcastToUser(userId, message): void     │
│ + broadcastToAll(message): void              │
│ + getConnectedCount(): number                │
│ - setupEventListeners(): void                │
│ - heartbeat(): void                          │
└──────────────────────────────────────────────┘
```

**Implementation:**
```typescript
class WebSocketManager {
  private clients = new Map<string, Set<WebSocket>>();
  private wss: WebSocket.Server;

  initialize(server: HTTPServer): void {
    this.wss = new WebSocket.Server({ server, path: "/ws" });

    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      const userId = this.extractUserId(req);
      if (!userId) { ws.close(4001, "Unauthorized"); return; }

      this.addClient(userId, ws);

      ws.on("message", (data) => this.handleMessage(userId, data));
      ws.on("close", () => this.removeClient(userId, ws));
      ws.on("error", () => this.removeClient(userId, ws));

      // Send connection acknowledgment
      ws.send(JSON.stringify({ type: "connected", userId }));
    });

    this.setupEventListeners();
    this.heartbeatInterval = setInterval(() => this.heartbeat(), 30_000);
  }

  addClient(userId: string, ws: WebSocket): void {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId)!.add(ws);
  }

  removeClient(userId: string, ws: WebSocket): void {
    const userClients = this.clients.get(userId);
    if (userClients) {
      userClients.delete(ws);
      if (userClients.size === 0) this.clients.delete(userId);
    }
  }

  broadcastToUser(userId: string, message: object): void {
    const userClients = this.clients.get(userId);
    if (!userClients) return;

    const payload = JSON.stringify(message);
    for (const ws of userClients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  private setupEventListeners(): void {
    // Subscribe to relevant events
    this.eventBus.subscribe("ORDER_CONFIRMED", (event) => {
      this.broadcastToUser(event.data.customerId, {
        type: "order_update", data: event.data
      });
    });

    this.eventBus.subscribe("RIDER_LOCATION_UPDATE", (event) => {
      this.broadcastToUser(event.data.customerId, {
        type: "location_update", data: event.data
      });
    });
  }

  private heartbeat(): void {
    for (const [userId, clients] of this.clients) {
      for (const ws of clients) {
        if (ws.readyState !== WebSocket.OPEN) {
          this.removeClient(userId, ws);
        } else {
          ws.ping();
        }
      }
    }
  }
}
```

**Design Patterns:**
- **Observer** — WebSocket clients observe server-side events
- **Mediator** — WebSocketManager mediates between EventBus and connected clients
- **Composite** — Multiple WebSocket connections per user (tabs/devices) managed as a Set

---

## Q13: Design the Anti-Corruption Layer (ACL) for SAP integration.

**Answer:**

**Class Diagram:**
```
┌───────────────────────────────────────────────┐
│          SAPIntegrationService                 │
├───────────────────────────────────────────────┤
│ - transformer: SAPDataTransformer             │
│ - rfcClient: SAPRFCClient                     │
│ - circuitBreaker: CircuitBreaker              │
│ - eventBus: EventBus                          │
├───────────────────────────────────────────────┤
│ + syncOrder(order): Promise<SAPDocument>      │
│ + syncPayment(payment): Promise<SAPDocument>  │
│ + getVendor(sapId): Promise<Vendor>           │
│ + getMaterial(sapId): Promise<Material>        │
│ - callRFC(functionName, params): Promise<any> │
└───────────────────────────────────────────────┘

┌───────────────────────────────────────────────┐
│          SAPDataTransformer                    │
├───────────────────────────────────────────────┤
│ + toSAPVendor(vendor: Vendor): SAPVendor     │
│ + fromSAPVendor(sap: SAPVendor): Vendor      │
│ + toSAPOrder(order: Order): SAPSalesOrder    │
│ + fromSAPOrder(sap: SAPSalesOrder): Order    │
│ + toSAPMaterial(item: MenuItem): SAPMaterial │
│ + fromSAPMaterial(sap: SAPMaterial): MenuItem│
└───────────────────────────────────────────────┘
```

**Transformer Implementation:**
```typescript
class SAPDataTransformer {
  // FoodDash Domain → SAP Fields
  toSAPVendor(vendor: Vendor): SAPVendor {
    return {
      LIFNR: vendor.id,         // Lieferantennummer (vendor number)
      NAME1: vendor.name,       // Name 1
      ORT01: vendor.city,       // City
      PSTLZ: vendor.postalCode, // Postal code
      LAND1: vendor.country,    // Country key
      TELF1: vendor.phone,      // Telephone
    };
  }

  // SAP Fields → FoodDash Domain
  fromSAPVendor(sap: SAPVendor): Vendor {
    return {
      id: sap.LIFNR,
      name: sap.NAME1,
      city: sap.ORT01,
      postalCode: sap.PSTLZ,
      country: sap.LAND1,
      phone: sap.TELF1,
    };
  }

  toSAPOrder(order: Order): SAPSalesOrder {
    return {
      VBELN: order.id,                          // Sales document number
      KUNNR: order.customerId,                  // Customer number
      NETWR: parseFloat(order.totalAmount),     // Net value
      WAERK: "USD",                             // Currency
      AUDAT: this.toSAPDate(order.createdAt),   // Document date
      POSNR: order.items.map((item, i) => ({    // Line items
        POSNR: String((i + 1) * 10).padStart(6, "0"),
        MATNR: item.menuItemId,
        MENGE: item.quantity,
        NETPR: parseFloat(item.price),
      })),
    };
  }

  private toSAPDate(date: Date): string {
    return date.toISOString().slice(0, 10).replace(/-/g, ""); // 20260210
  }
}
```

**Event-Driven Sync:**
```typescript
class SAPIntegrationService extends BaseService {
  async initialize() {
    this.eventBus.subscribe("ORDER_DELIVERED", async (event) => {
      await this.executeWithResilience(
        () => this.syncOrder(event.data),
        "sap_sync_order"
      );
    });

    this.eventBus.subscribe("PAYMENT_SUCCESS", async (event) => {
      await this.executeWithResilience(
        () => this.syncPayment(event.data),
        "sap_sync_payment"
      );
    });
  }
}
```

**Key Design Decision:**
The ACL ensures SAP's German-named fields (LIFNR, MATNR, VBELN) never leak into FoodDash's domain model. The transformer is the ONLY place where SAP field names appear.

---

## Q14: Design the Decorator Pattern for composing middleware.

**Answer:**

**Problem:** FoodDash's request processing needs multiple layers: logging → rate limiting → auth → correlation ID → metrics → route handler. Each layer "wraps" the next.

**Class Diagram:**
```
┌──────────────────────────────────────────────────────┐
│  Middleware Pipeline (Decorator Chain)                 │
│                                                       │
│  correlationId( rateLimit( auth( metrics( handler ))))│
│       ▼              ▼        ▼       ▼               │
│    Layer 1        Layer 2   Layer 3  Layer 4          │
└──────────────────────────────────────────────────────┘
```

**Express Middleware as Decorators:**
```typescript
// Each middleware decorates the request/response, then calls next()
type Middleware = (req: Request, res: Response, next: NextFunction) => void;

function composeMiddleware(...middlewares: Middleware[]): Middleware {
  return (req, res, next) => {
    let index = 0;

    function dispatch(): void {
      if (index >= middlewares.length) return next();
      const mw = middlewares[index++];
      mw(req, res, dispatch);
    }

    dispatch();
  };
}

// Usage: compose a protected route pipeline
const protectedRoute = composeMiddleware(
  correlationIdMiddleware,           // Adds X-Correlation-Id
  rateLimiter.middleware(),           // 429 if limit exceeded
  authMiddleware,                     // 401 if not authenticated
  rbacMiddleware("restaurant_owner"), // 403 if wrong role
  metricsMiddleware,                  // Records latency
);

app.post("/api/v1/restaurants", protectedRoute, createRestaurantHandler);
```

**Async Error Handler Decorator:**
```typescript
// Wraps any async route handler to catch errors
function asyncHandler(fn: (req: Request, res: Response) => Promise<any>): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}

// Decorated route handler
app.get("/api/v1/orders/:id",
  asyncHandler(async (req, res) => {
    const order = await orderService.getById(req.params.id);
    if (!order) throw new NotFoundError("Order");
    res.json(order);
  })
);
```

**Design Patterns:**
- **Decorator** — Each middleware adds behavior around the next
- **Chain of Responsibility** — `next()` passes control to the next middleware
- **Higher-Order Function** — `asyncHandler` wraps a function with error handling

---

## Q15: Design the Factory Pattern for creating microservice instances.

**Answer:**

**Class Diagram:**
```
┌──────────────────────────────────────────────────┐
│            ServiceFactory                         │
├──────────────────────────────────────────────────┤
│ - eventBus: EventBus                             │
│ - cache: CacheManager                            │
│ - db: DrizzleDB                                  │
│ - registry: ServiceRegistry                      │
├──────────────────────────────────────────────────┤
│ + createService(type: ServiceType): BaseService  │
│ + createAll(): Map<string, BaseService>          │
│ - configureService(service: BaseService): void   │
└──────────────────────────────────────────────────┘
```

**Implementation:**
```typescript
enum ServiceType {
  AUTH = "auth",
  RESTAURANT = "restaurant",
  ORDER = "order",
  PAYMENT = "payment",
  DELIVERY = "delivery",
  NOTIFICATION = "notification",
  SEARCH = "search",
  MENU = "menu",
  ANALYTICS = "analytics",
  ML = "ml",
  ADMIN = "admin",
  GRAPHQL = "graphql",
  SAP = "sap",
  OFFERS = "offers",
  TRACKING = "tracking",
  SAGA = "saga",
}

class ServiceFactory {
  private eventBus: EventBus;
  private cache: CacheManager;
  private db: DrizzleDB;

  createService(type: ServiceType): BaseService {
    const portMap: Record<ServiceType, number> = {
      auth: 3001, restaurant: 3002, menu: 3003,
      order: 3004, delivery: 3005, payment: 3006,
      notification: 3007, search: 3008, analytics: 3009,
      ml: 3010, admin: 3011, graphql: 3012,
      sap: 3013, offers: 3014, tracking: 3015, saga: 3016,
    };

    switch (type) {
      case ServiceType.AUTH:
        return new AuthIdentityService(this.eventBus, this.cache, this.db);
      case ServiceType.ORDER:
        return new OrderService(this.eventBus, this.cache, this.db);
      case ServiceType.PAYMENT:
        return new PaymentService(this.eventBus, this.cache, this.db);
      case ServiceType.DELIVERY:
        return new DeliveryPartnerService(this.eventBus, this.cache, this.db);
      // ... 12 more services
      default:
        throw new Error(`Unknown service type: ${type}`);
    }
  }

  async createAll(): Promise<Map<string, BaseService>> {
    const services = new Map<string, BaseService>();

    for (const type of Object.values(ServiceType)) {
      const service = this.createService(type as ServiceType);
      await service.initialize();
      this.registry.register(service);
      services.set(type, service);
    }

    return services;
  }
}
```

**Why Factory Pattern:**
- **Encapsulates creation logic** — Service dependencies (eventBus, cache, db) are wired once
- **Single initialization point** — `createAll()` starts and registers all 16 services
- **Extensible** — New service type? Add one case to the switch

---

## Q16: Design the Singleton Pattern for shared infrastructure.

**Answer:**

**Shared Singletons in FoodDash:**
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  EventBus   │  │CacheManager │  │   Logger    │
│ (singleton) │  │ (singleton) │  │ (singleton) │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
              All 16 services share
              these instances
```

**Module-Level Singleton (Node.js pattern):**
```typescript
// infrastructure/eventBus.ts — Module singleton (no class needed)
let instance: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!instance) {
    instance = new EventBus();
  }
  return instance;
}
```

**Class-Level Singleton:**
```typescript
class Logger {
  private static instance: Logger;
  private level: LogLevel;

  private constructor(level: LogLevel = "info") {
    this.level = level;
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(
        process.env.NODE_ENV === "development" ? "debug" : "info"
      );
    }
    return Logger.instance;
  }

  log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const correlationId = getCorrelationId();
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      correlationId,
      message,
      ...meta,
    };
    // Structured JSON output
    console[level === "error" ? "error" : "log"](JSON.stringify(entry));
  }
}
```

**Why Singleton for these components:**
- **EventBus** — All services must publish/subscribe to the SAME bus
- **CacheManager** — L1 cache is per-process; sharing ensures consistent stats
- **Logger** — Consistent configuration (log level, format) across all modules
- **MetricsCollector** — Single metrics registry for Prometheus scraping

**Warning about Singleton:**
Singletons make testing harder (global state). FoodDash mitigates this by:
1. Constructor injection — Services receive EventBus as a parameter
2. The Singleton is just the default; tests can inject mocks

---

## Q17: Design the Builder Pattern for complex query construction.

**Answer:**

**Problem:** Building restaurant search queries with many optional filters.

**Class Design:**
```
┌──────────────────────────────────────────────────┐
│          RestaurantQueryBuilder                    │
├──────────────────────────────────────────────────┤
│ - baseQuery: DrizzleSelectBuilder                │
│ - conditions: SQL[]                              │
│ - sortBy: string                                 │
│ - limitValue: number                             │
│ - offsetValue: number                            │
├──────────────────────────────────────────────────┤
│ + withCuisine(cuisine: string): this             │
│ + withMinRating(rating: number): this            │
│ + withinRadius(lat, lng, km): this               │
│ + withMaxDeliveryTime(minutes: number): this     │
│ + isOpen(): this                                 │
│ + isVegetarian(): this                           │
│ + sortByRating(): this                           │
│ + sortByDistance(lat, lng): this                  │
│ + paginate(page, pageSize): this                 │
│ + build(): DrizzleQuery                          │
│ + execute(): Promise<Restaurant[]>               │
└──────────────────────────────────────────────────┘
```

**Implementation:**
```typescript
class RestaurantQueryBuilder {
  private conditions: SQL[] = [];
  private orderByClause: SQL | null = null;
  private limitVal: number = 20;
  private offsetVal: number = 0;

  withCuisine(cuisine: string): this {
    this.conditions.push(ilike(restaurants.cuisine, `%${cuisine}%`));
    return this;
  }

  withMinRating(rating: number): this {
    this.conditions.push(gte(restaurants.rating, rating));
    return this;
  }

  withinRadius(lat: number, lng: number, radiusKm: number): this {
    // Haversine formula in SQL
    this.conditions.push(
      sql`(
        6371 * acos(
          cos(radians(${lat})) * cos(radians(${restaurants.latitude}))
          * cos(radians(${restaurants.longitude}) - radians(${lng}))
          + sin(radians(${lat})) * sin(radians(${restaurants.latitude}))
        )
      ) <= ${radiusKm}`
    );
    return this;
  }

  isOpen(): this {
    const now = sql`CURRENT_TIME`;
    this.conditions.push(
      and(
        eq(restaurants.isActive, true),
        lte(restaurants.openingTime, now),
        gte(restaurants.closingTime, now)
      )!
    );
    return this;
  }

  paginate(page: number, pageSize: number = 20): this {
    this.limitVal = pageSize;
    this.offsetVal = (page - 1) * pageSize;
    return this;
  }

  sortByRating(): this {
    this.orderByClause = desc(restaurants.rating);
    return this;
  }

  async execute(): Promise<Restaurant[]> {
    let query = db.select().from(restaurants);

    if (this.conditions.length > 0) {
      query = query.where(and(...this.conditions));
    }
    if (this.orderByClause) {
      query = query.orderBy(this.orderByClause);
    }

    return query.limit(this.limitVal).offset(this.offsetVal);
  }
}

// Usage: fluent API
const results = await new RestaurantQueryBuilder()
  .withCuisine("Italian")
  .withMinRating(4.0)
  .withinRadius(12.9716, 77.5946, 5)
  .isOpen()
  .sortByRating()
  .paginate(1, 10)
  .execute();
```

**Why Builder:**
- **Fluent API** — Readable chained calls
- **Optional parameters** — Only add conditions that are needed
- **Separation** — Query construction logic separate from business logic
- **Testable** — Each filter method can be tested independently

---

## Q18: Design the Adapter Pattern for multiple message queue backends.

**Answer:**

**Class Diagram:**
```
┌──────────────────────────────────────────────┐
│     IMessageQueueAdapter (interface)          │
├──────────────────────────────────────────────┤
│ + publish(topic, message): Promise<void>     │
│ + subscribe(topic, handler): Promise<void>   │
│ + acknowledge(msgId): Promise<void>          │
│ + connect(): Promise<void>                   │
│ + disconnect(): Promise<void>                │
│ + getHealth(): { connected: boolean }        │
└────────────────┬─────────────────────────────┘
                 │
     ┌───────────┼───────────┬──────────────┐
     ▼           ▼           ▼              ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐
│ RabbitMQ │ │  Kafka   │ │ AWS SQS  │ │ In-Memory  │
│ Adapter  │ │ Adapter  │ │ Adapter  │ │  Adapter   │
└──────────┘ └──────────┘ └──────────┘ └────────────┘
```

**Interface:**
```typescript
interface IMessageQueueAdapter {
  publish(topic: string, message: QueueMessage): Promise<void>;
  subscribe(topic: string, handler: MessageHandler): Promise<void>;
  acknowledge(messageId: string): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getHealth(): { connected: boolean; pendingMessages: number };
}

interface QueueMessage {
  id: string;
  topic: string;
  payload: unknown;
  metadata: {
    correlationId: string;
    timestamp: Date;
    retryCount: number;
    maxRetries: number;
  };
}
```

**In-Memory Adapter (Development):**
```typescript
class InMemoryQueueAdapter implements IMessageQueueAdapter {
  private topics = new Map<string, MessageHandler[]>();
  private messages = new Map<string, QueueMessage>();

  async publish(topic: string, message: QueueMessage): Promise<void> {
    this.messages.set(message.id, message);
    const handlers = this.topics.get(topic) ?? [];
    // Fire-and-forget to all handlers
    await Promise.allSettled(handlers.map(h => h(message)));
  }

  async subscribe(topic: string, handler: MessageHandler): Promise<void> {
    if (!this.topics.has(topic)) this.topics.set(topic, []);
    this.topics.get(topic)!.push(handler);
  }

  async acknowledge(messageId: string): Promise<void> {
    this.messages.delete(messageId);
  }

  async connect(): Promise<void> { /* no-op for in-memory */ }
  async disconnect(): Promise<void> { this.topics.clear(); }
  getHealth() { return { connected: true, pendingMessages: this.messages.size }; }
}
```

**Adapter Selection (config-driven):**
```typescript
function createMessageQueue(transport: string): IMessageQueueAdapter {
  switch (transport) {
    case "rabbitmq": return new RabbitMQAdapter(process.env.RABBITMQ_URL);
    case "kafka":    return new KafkaAdapter(process.env.KAFKA_BROKERS);
    case "sqs":      return new AWSSQSAdapter(process.env.AWS_REGION);
    case "memory":   return new InMemoryQueueAdapter();
    default:         return new InMemoryQueueAdapter();
  }
}

const mq = createMessageQueue(process.env.MQ_TRANSPORT ?? "memory");
```

**Design Patterns:**
- **Adapter** — Uniform interface over different MQ systems
- **Strategy** — Runtime selection of MQ backend via config
- **Null Object** — `InMemoryAdapter` acts as a no-infrastructure default

---

## Q19: Design the Proxy Pattern for caching database queries.

**Answer:**

**Class Diagram:**
```
┌──────────────────────────────────────────┐
│    IRestaurantService (interface)         │
├──────────────────────────────────────────┤
│ + getAll(): Promise<Restaurant[]>        │
│ + getById(id): Promise<Restaurant>       │
│ + search(query): Promise<Restaurant[]>   │
└────────────────┬─────────────────────────┘
                 │
        ┌────────┼────────┐
        ▼                 ▼
┌──────────────┐  ┌──────────────────────┐
│ Restaurant   │  │ CachingProxy         │
│ ServiceImpl  │  │ (wraps ServiceImpl)  │
│ (real DB)    │  │                      │
└──────────────┘  └──────────────────────┘
```

**Implementation:**
```typescript
class CachingRestaurantProxy implements IRestaurantService {
  constructor(
    private realService: IRestaurantService,
    private cache: CacheManager
  ) {}

  async getAll(): Promise<Restaurant[]> {
    const cached = await this.cache.get<Restaurant[]>("restaurants:all");
    if (cached) return cached;

    const restaurants = await this.realService.getAll();
    await this.cache.set("restaurants:all", restaurants, 5 * 60_000); // 5 min
    return restaurants;
  }

  async getById(id: string): Promise<Restaurant | null> {
    const cached = await this.cache.get<Restaurant>(`restaurant:${id}`);
    if (cached) return cached;

    const restaurant = await this.realService.getById(id);
    if (restaurant) {
      await this.cache.set(`restaurant:${id}`, restaurant, 10 * 60_000); // 10 min
    }
    return restaurant;
  }

  async search(query: SearchQuery): Promise<Restaurant[]> {
    const cacheKey = `restaurant:search:${JSON.stringify(query)}`;
    const cached = await this.cache.get<Restaurant[]>(cacheKey);
    if (cached) return cached;

    const results = await this.realService.search(query);
    await this.cache.set(cacheKey, results, 2 * 60_000); // 2 min
    return results;
  }
}

// Usage: transparent to consumers
const restaurantService: IRestaurantService = new CachingRestaurantProxy(
  new RestaurantServiceImpl(db),
  cacheManager
);
```

**Why Proxy over direct caching in service:**
- **Transparent** — Consumer doesn't know about caching
- **Single Responsibility** — Service handles business logic; proxy handles caching
- **Composable** — Can stack proxies: `LoggingProxy(CachingProxy(RealService))`

---

## Q20: Design the Command Pattern for order operations.

**Answer:**

**Class Diagram:**
```
┌──────────────────────────────────────────┐
│      ICommand (interface)                 │
├──────────────────────────────────────────┤
│ + execute(): Promise<CommandResult>      │
│ + undo(): Promise<void>                 │
│ + getName(): string                      │
└────────────────┬─────────────────────────┘
                 │
    ┌────────────┼────────────┬────────────────┐
    ▼            ▼            ▼                ▼
┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌─────────────┐
│ Create   │ │ Update   │ │  Cancel      │ │  Apply      │
│ Order    │ │ Status   │ │  Order       │ │  Coupon     │
│ Command  │ │ Command  │ │  Command     │ │  Command    │
└──────────┘ └──────────┘ └──────────────┘ └─────────────┘
```

**Implementation:**
```typescript
interface ICommand {
  execute(): Promise<CommandResult>;
  undo(): Promise<void>;
  getName(): string;
}

class CreateOrderCommand implements ICommand {
  private createdOrderId: string | null = null;

  constructor(
    private orderData: CreateOrderInput,
    private orderRepo: OrderRepository,
    private eventBus: EventBus
  ) {}

  async execute(): Promise<CommandResult> {
    // Validate idempotency
    const existing = await this.orderRepo.findByIdempotencyKey(
      this.orderData.idempotencyKey
    );
    if (existing) return { success: true, data: existing, cached: true };

    // Create order
    const order = await this.orderRepo.create(this.orderData);
    this.createdOrderId = order.id;

    // Publish event
    this.eventBus.publish("ORDER_CREATED", order);

    return { success: true, data: order };
  }

  async undo(): Promise<void> {
    if (this.createdOrderId) {
      await this.orderRepo.updateStatus(this.createdOrderId, "cancelled");
      this.eventBus.publish("ORDER_CANCELLED", {
        orderId: this.createdOrderId,
        reason: "command_undo",
      });
    }
  }

  getName(): string { return "CreateOrder"; }
}
```

**Command Invoker (Saga integration):**
```typescript
class CommandInvoker {
  private history: ICommand[] = [];

  async execute(command: ICommand): Promise<CommandResult> {
    const result = await command.execute();
    if (result.success) {
      this.history.push(command);
    }
    return result;
  }

  async undoLast(): Promise<void> {
    const command = this.history.pop();
    if (command) await command.undo();
  }

  async undoAll(): Promise<void> {
    while (this.history.length > 0) {
      await this.undoLast();
    }
  }
}
```

**Why Command:**
- **Undo/Redo** — Every command has an `undo()` method (maps to Saga compensation)
- **Queuing** — Commands can be serialized, stored, replayed
- **Audit trail** — Command history = audit log
- **Decoupling** — Invoker doesn't know what the command does internally

---

## Q21: Design the ServiceRegistry with load balancing algorithms.

**Answer:**

**Class Design:**
```typescript
interface ServiceInstance {
  serviceName: string;
  instanceId: string;
  host: string;
  port: number;
  status: "healthy" | "degraded" | "unhealthy";
  metadata: { version: string; region: string };
  lastHeartbeat: number;
  responseTime: number;     // For weighted routing
  activeConnections: number; // For least-connections
}

class ServiceRegistry {
  private services = new Map<string, Map<string, ServiceInstance>>();
  private roundRobinCounters = new Map<string, number>();

  register(instance: ServiceInstance): void {
    if (!this.services.has(instance.serviceName)) {
      this.services.set(instance.serviceName, new Map());
    }
    this.services.get(instance.serviceName)!.set(instance.instanceId, instance);
  }

  deregister(serviceName: string, instanceId: string): void {
    this.services.get(serviceName)?.delete(instanceId);
  }

  // Round Robin: sequential rotation
  discoverRoundRobin(serviceName: string): ServiceInstance | null {
    const instances = this.getHealthyInstances(serviceName);
    if (instances.length === 0) return null;

    const counter = this.roundRobinCounters.get(serviceName) ?? 0;
    const selected = instances[counter % instances.length];
    this.roundRobinCounters.set(serviceName, counter + 1);
    return selected;
  }

  // Weighted: prefer healthier, faster instances
  discoverWeighted(serviceName: string): ServiceInstance | null {
    const instances = this.getHealthyInstances(serviceName);
    if (instances.length === 0) return null;

    return instances.reduce((best, current) => {
      const currentScore = this.calculateWeight(current);
      const bestScore = this.calculateWeight(best);
      return currentScore > bestScore ? current : best;
    });
  }

  // Least Connections: even load distribution
  discoverLeastConnections(serviceName: string): ServiceInstance | null {
    const instances = this.getHealthyInstances(serviceName);
    if (instances.length === 0) return null;

    return instances.reduce((min, current) =>
      current.activeConnections < min.activeConnections ? current : min
    );
  }

  private calculateWeight(instance: ServiceInstance): number {
    const healthScore = instance.status === "healthy" ? 1.0 : 0.5;
    const speedScore = Math.max(0, 1 - instance.responseTime / 1000);
    return healthScore * 0.6 + speedScore * 0.4;
  }

  private getHealthyInstances(serviceName: string): ServiceInstance[] {
    const all = this.services.get(serviceName);
    if (!all) return [];
    return [...all.values()].filter(i =>
      i.status !== "unhealthy" &&
      Date.now() - i.lastHeartbeat < 90_000  // Stale after 90s
    );
  }
}
```

**Health Check Loop:**
```typescript
setInterval(() => {
  for (const [name, instances] of this.services) {
    for (const [id, instance] of instances) {
      if (Date.now() - instance.lastHeartbeat > 90_000) {
        this.deregister(name, id); // Evict stale
      }
    }
  }
}, 30_000); // Every 30 seconds
```

---

## Q22: Design the MetricsCollector with Prometheus-compatible output.

**Answer:**

**Class Design:**
```typescript
type MetricType = "counter" | "gauge" | "histogram" | "timer";

interface MetricEntry {
  name: string;
  type: MetricType;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

class MetricsCollector {
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, number[]>();
  private timers = new Map<string, { start: number }>();

  // Counter: monotonically increasing (total requests, errors)
  increment(name: string, amount: number = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + amount);
  }

  // Gauge: can go up or down (active connections, queue depth)
  gauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  // Histogram: distribution of values (response times)
  observe(name: string, value: number): void {
    if (!this.histograms.has(name)) this.histograms.set(name, []);
    this.histograms.get(name)!.push(value);
  }

  // Timer: measure duration
  startTimer(name: string): { end: () => number } {
    const start = performance.now();
    return {
      end: () => {
        const duration = performance.now() - start;
        this.observe(`${name}.duration_ms`, duration);
        return duration;
      },
    };
  }

  // Percentile calculation for histograms
  getPercentile(name: string, percentile: number): number {
    const values = this.histograms.get(name);
    if (!values || values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  // Prometheus exposition format
  toPrometheus(): string {
    const lines: string[] = [];

    for (const [name, value] of this.counters) {
      const sanitized = name.replace(/\./g, "_");
      lines.push(`# TYPE ${sanitized} counter`);
      lines.push(`${sanitized} ${value}`);
    }

    for (const [name, value] of this.gauges) {
      const sanitized = name.replace(/\./g, "_");
      lines.push(`# TYPE ${sanitized} gauge`);
      lines.push(`${sanitized} ${value}`);
    }

    for (const [name, values] of this.histograms) {
      const sanitized = name.replace(/\./g, "_");
      lines.push(`# TYPE ${sanitized} summary`);
      lines.push(`${sanitized}{quantile="0.5"} ${this.getPercentile(name, 50)}`);
      lines.push(`${sanitized}{quantile="0.9"} ${this.getPercentile(name, 90)}`);
      lines.push(`${sanitized}{quantile="0.99"} ${this.getPercentile(name, 99)}`);
      lines.push(`${sanitized}_count ${values.length}`);
    }

    return lines.join("\n");
  }
}
```

**Usage in API Routes:**
```typescript
app.use((req, res, next) => {
  const timer = metrics.startTimer("api.response_time");
  metrics.increment("api.requests");

  res.on("finish", () => {
    timer.end();
    metrics.increment(`api.status.${res.statusCode}`);
  });

  next();
});

// Prometheus scraping endpoint
app.get("/api/metrics", (req, res) => {
  res.set("Content-Type", "text/plain");
  res.send(metrics.toPrometheus());
});
```

---

## Q23: Design the Idempotency Store for preventing duplicate operations.

**Answer:**

```typescript
interface IdempotencyEntry<T> {
  key: string;
  result: T;
  statusCode: number;
  createdAt: number;
  expiresAt: number;
}

class IdempotencyStore<T = any> {
  private store = new Map<string, IdempotencyEntry<T>>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private defaultTTL: number = 3600_000) { // 1 hour
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  get(key: string): IdempotencyEntry<T> | null {
    if (!this.has(key)) return null;
    return this.store.get(key)!;
  }

  set(key: string, result: T, statusCode: number, ttl?: number): void {
    this.store.set(key, {
      key,
      result,
      statusCode,
      createdAt: Date.now(),
      expiresAt: Date.now() + (ttl ?? this.defaultTTL),
    });
  }

  // Middleware pattern
  middleware(extractKey: (req: Request) => string | null): RequestHandler {
    return (req, res, next) => {
      const key = extractKey(req);
      if (!key) return next();

      const existing = this.get(key);
      if (existing) {
        // Return cached response — no re-processing
        return res.status(existing.statusCode).json(existing.result);
      }

      // Intercept response to cache it
      const originalJson = res.json.bind(res);
      res.json = (body: any) => {
        this.set(key, body, res.statusCode);
        return originalJson(body);
      };

      next();
    };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }
}

// Usage
const orderIdempotency = new IdempotencyStore();

app.post("/api/v1/orders",
  orderIdempotency.middleware(req => req.headers["x-idempotency-key"] as string),
  createOrderHandler
);
```

---

## Q24: Design the Error Hierarchy with custom error classes.

**Answer:**

**Class Hierarchy:**
```
Error (built-in)
└── AppError (base application error)
    ├── ValidationError (400)
    │   └── SchemaValidationError (Zod failures)
    ├── AuthenticationError (401)
    ├── AuthorizationError (403)
    ├── NotFoundError (404)
    ├── ConflictError (409)
    ├── RateLimitError (429)
    ├── CircuitBreakerOpenError (503)
    └── ExternalServiceError (502)
```

**Implementation:**
```typescript
class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  public readonly fields: Array<{ field: string; message: string }>;

  constructor(message: string, fields: Array<{ field: string; message: string }> = []) {
    super(message, 400, "VALIDATION_ERROR");
    this.fields = fields;
  }
}

class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      `${resource}${id ? ` with ID ${id}` : ""} not found`,
      404,
      "NOT_FOUND"
    );
  }
}

class ConflictError extends AppError {
  constructor(message: string = "Resource already exists") {
    super(message, 409, "CONFLICT");
  }
}

class CircuitBreakerOpenError extends AppError {
  constructor(serviceName: string) {
    super(
      `Service ${serviceName} is temporarily unavailable`,
      503,
      "CIRCUIT_BREAKER_OPEN"
    );
  }
}
```

**Global Error Handler:**
```typescript
function globalErrorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  const correlationId = getCorrelationId();

  if (err instanceof AppError) {
    logger.log(err.isOperational ? "warn" : "error", err.message, {
      correlationId,
      code: err.code,
      statusCode: err.statusCode,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });

    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      correlationId,
      ...(err instanceof ValidationError && { fields: err.fields }),
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  }

  // Unknown error — NOT operational → alert immediately
  logger.log("error", "Unhandled error", {
    correlationId,
    message: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    error: "Internal Server Error",
    correlationId,
  });
}
```

**Key Decision — `isOperational`:**
- `true` — Expected errors (bad input, not found). Log as WARN. Don't page on-call.
- `false` — Unexpected errors (null reference, DB crash). Log as ERROR. Page on-call.

---

## Q25: Design the RBAC + ABAC authorization system.

**Answer:**

**Class Diagram:**
```
┌──────────────────────────────────────────────────┐
│            AuthorizationEngine                    │
├──────────────────────────────────────────────────┤
│ - policies: Map<Role, Permission[]>              │
│ - abacRules: Map<string, ABACRule>               │
├──────────────────────────────────────────────────┤
│ + checkPermission(ctx: AuthContext): boolean      │
│ + hasRole(userId, role): boolean                 │
│ + canAccessResource(ctx): boolean                │
│ + middleware(resource, action): RequestHandler    │
└──────────────────────────────────────────────────┘
```

**RBAC Policy Table:**
```typescript
interface Permission {
  resource: string;
  actions: string[];
}

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  customer: [
    { resource: "order",   actions: ["create", "read", "cancel"] },
    { resource: "review",  actions: ["create", "read"] },
    { resource: "profile", actions: ["read", "update"] },
  ],
  restaurant_owner: [
    { resource: "restaurant", actions: ["create", "read", "update"] },
    { resource: "menu",       actions: ["create", "read", "update", "delete"] },
    { resource: "order",      actions: ["read", "update"] },
    { resource: "analytics",  actions: ["read"] },
  ],
  delivery_partner: [
    { resource: "delivery", actions: ["read", "update"] },
    { resource: "order",    actions: ["read", "update"] },
    { resource: "profile",  actions: ["read", "update"] },
  ],
  admin: [
    { resource: "*", actions: ["*"] },
  ],
};
```

**ABAC Rules (Attribute-Based):**
```typescript
interface AuthContext {
  userId: string;
  role: string;
  resource: string;
  action: string;
  resourceOwnerId?: string;   // Who owns this resource?
  assignedPartnerId?: string; // Who's assigned to this order?
}

type ABACRule = (ctx: AuthContext) => boolean;

const ABAC_RULES: Record<string, ABACRule> = {
  "restaurant:update": (ctx) => ctx.resourceOwnerId === ctx.userId,
  "restaurant:delete": (ctx) => ctx.resourceOwnerId === ctx.userId,
  "order:update":      (ctx) => ctx.assignedPartnerId === ctx.userId
                              || ctx.resourceOwnerId === ctx.userId,
  "order:cancel":      (ctx) => ctx.resourceOwnerId === ctx.userId, // Only order creator
};
```

**Combined Check:**
```typescript
class AuthorizationEngine {
  checkPermission(ctx: AuthContext): boolean {
    // Step 1: RBAC — does the role have this permission?
    const permissions = ROLE_PERMISSIONS[ctx.role];
    if (!permissions) return false;

    const hasRolePermission = permissions.some(p =>
      (p.resource === "*" || p.resource === ctx.resource) &&
      (p.actions.includes("*") || p.actions.includes(ctx.action))
    );
    if (!hasRolePermission) return false;

    // Step 2: ABAC — does the user own this resource?
    const abacKey = `${ctx.resource}:${ctx.action}`;
    const abacRule = ABAC_RULES[abacKey];
    if (abacRule && !abacRule(ctx)) return false;

    return true;
  }

  // Express middleware
  middleware(resource: string, action: string): RequestHandler {
    return (req, res, next) => {
      const ctx: AuthContext = {
        userId: req.user!.id,
        role: req.user!.role,
        resource,
        action,
        resourceOwnerId: req.resourceOwner?.id,
      };

      if (!this.checkPermission(ctx)) {
        throw new AuthorizationError(
          `User ${ctx.userId} cannot ${action} ${resource}`
        );
      }

      next();
    };
  }
}
```

---

## Q26: Design the Event Sourcing system for order history.

**Answer:**

**Class Design:**
```typescript
interface OrderEvent {
  id: string;
  orderId: string;
  eventType: string;
  data: Record<string, any>;
  timestamp: Date;
  causedBy: string; // userId who triggered
}

class OrderEventStore {
  constructor(private db: DrizzleDB) {}

  // Append event (immutable — never update/delete)
  async append(event: Omit<OrderEvent, "id" | "timestamp">): Promise<OrderEvent> {
    const [stored] = await this.db.insert(orderEvents).values({
      orderId: event.orderId,
      eventType: event.eventType,
      data: event.data,
      causedBy: event.causedBy,
    }).returning();

    return stored;
  }

  // Get all events for an order (timeline)
  async getEvents(orderId: string): Promise<OrderEvent[]> {
    return this.db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.orderId, orderId))
      .orderBy(asc(orderEvents.timestamp));
  }

  // Replay: reconstruct order state from events
  async replay(orderId: string): Promise<Order> {
    const events = await this.getEvents(orderId);
    let state: Partial<Order> = {};

    for (const event of events) {
      state = this.applyEvent(state, event);
    }

    return state as Order;
  }

  private applyEvent(state: Partial<Order>, event: OrderEvent): Partial<Order> {
    switch (event.eventType) {
      case "ORDER_CREATED":
        return { ...event.data };
      case "ORDER_STATUS_CHANGED":
        return { ...state, status: event.data.newStatus };
      case "DELIVERY_PARTNER_ASSIGNED":
        return { ...state, deliveryPartnerId: event.data.partnerId };
      case "PAYMENT_COMPLETED":
        return { ...state, paymentStatus: "completed" };
      default:
        return state;
    }
  }
}
```

**Usage:**
```typescript
// Recording events
await eventStore.append({
  orderId: "order-123",
  eventType: "ORDER_CREATED",
  data: { customerId, restaurantId, items, total },
  causedBy: customerId,
});

await eventStore.append({
  orderId: "order-123",
  eventType: "ORDER_STATUS_CHANGED",
  data: { previousStatus: "pending", newStatus: "confirmed" },
  causedBy: restaurantOwnerId,
});

// Reconstructing state
const order = await eventStore.replay("order-123");
// order.status === "confirmed"

// Full timeline for customer
const timeline = await eventStore.getEvents("order-123");
// [ORDER_CREATED, ORDER_STATUS_CHANGED, ...]
```

**Why Event Sourcing:**
- **Complete audit trail** — Every change recorded, immutable
- **Time travel** — Replay to any point in history
- **Debugging** — Exactly recreate state that caused a bug
- **Analytics** — Compute metrics from raw events (avg prep time, etc.)

---

## Q27: Design the Zod validation middleware for API request validation.

**Answer:**

```typescript
import { ZodSchema, ZodError } from "zod";

interface ValidateOptions {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

function validate(schemas: ValidateOptions): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: Array<{ field: string; message: string; location: string }> = [];

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        errors.push(...formatZodErrors(result.error, "body"));
      } else {
        req.body = result.data; // Replace with parsed (trimmed, coerced) data
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        errors.push(...formatZodErrors(result.error, "params"));
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        errors.push(...formatZodErrors(result.error, "query"));
      }
    }

    if (errors.length > 0) {
      throw new ValidationError("Validation failed", errors);
    }

    next();
  };
}

function formatZodErrors(
  error: ZodError,
  location: string
): Array<{ field: string; message: string; location: string }> {
  return error.errors.map(e => ({
    field: e.path.join("."),
    message: e.message,
    location,
  }));
}
```

**Usage with Drizzle-Zod schemas:**
```typescript
import { insertOrderSchema } from "../../shared/schema";

const createOrderSchema = insertOrderSchema.extend({
  items: z.array(z.object({
    menuItemId: z.string().uuid(),
    quantity: z.number().int().positive().max(99),
  })).min(1, "At least one item required"),
});

app.post("/api/v1/orders",
  validate({ body: createOrderSchema }),
  asyncHandler(createOrderHandler)
);
```

**Design Pattern — Intercepting Filter:**
Validation happens BEFORE the handler. Invalid requests are rejected immediately with structured error messages. The handler can trust that `req.body` is fully validated and typed.

---

## Q28: Design the HealthCheck aggregator for microservices.

**Answer:**

```typescript
interface ServiceHealth {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  responseTime: number;
  lastCheck: Date;
  details?: Record<string, any>;
}

interface AggregatedHealth {
  overall: "healthy" | "degraded" | "unhealthy";
  uptime: number;
  timestamp: Date;
  services: ServiceHealth[];
  checks: {
    totalServices: number;
    healthyServices: number;
    degradedServices: number;
    unhealthyServices: number;
  };
}

class HealthAggregator {
  constructor(
    private services: Map<string, BaseService>,
    private startTime: Date
  ) {}

  async aggregate(): Promise<AggregatedHealth> {
    const serviceHealths: ServiceHealth[] = [];

    for (const [name, service] of this.services) {
      const start = performance.now();
      try {
        const health = service.getHealth();
        serviceHealths.push({
          name,
          status: health.status,
          responseTime: Math.round(performance.now() - start),
          lastCheck: new Date(),
          details: health.details,
        });
      } catch (error) {
        serviceHealths.push({
          name,
          status: "unhealthy",
          responseTime: Math.round(performance.now() - start),
          lastCheck: new Date(),
          details: { error: (error as Error).message },
        });
      }
    }

    const counts = {
      totalServices: serviceHealths.length,
      healthyServices: serviceHealths.filter(s => s.status === "healthy").length,
      degradedServices: serviceHealths.filter(s => s.status === "degraded").length,
      unhealthyServices: serviceHealths.filter(s => s.status === "unhealthy").length,
    };

    // Overall status: worst-case
    let overall: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (counts.unhealthyServices > 0) overall = "unhealthy";
    else if (counts.degradedServices > 0) overall = "degraded";

    return {
      overall,
      uptime: Date.now() - this.startTime.getTime(),
      timestamp: new Date(),
      services: serviceHealths,
      checks: counts,
    };
  }
}

// Routes
app.get("/api/health", asyncHandler(async (req, res) => {
  const health = await healthAggregator.aggregate();
  const statusCode = health.overall === "healthy" ? 200 : 503;
  res.status(statusCode).json(health);
}));

app.get("/api/health/live", (req, res) => {
  res.status(200).json({ status: "alive" }); // Process is running
});

app.get("/api/health/ready", asyncHandler(async (req, res) => {
  const health = await healthAggregator.aggregate();
  if (health.overall === "unhealthy") {
    res.status(503).json({ status: "not ready" });
  } else {
    res.status(200).json({ status: "ready" });
  }
}));
```

---

## Q29: Design the Haversine distance calculator for geo-spatial queries.

**Answer:**

```typescript
interface GeoCoordinate {
  latitude: number;
  longitude: number;
}

class GeoUtils {
  private static readonly EARTH_RADIUS_KM = 6371;

  /**
   * Haversine formula: calculates great-circle distance between two points on a sphere.
   *
   * Formula:
   * a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlng/2)
   * c = 2 × atan2(√a, √(1−a))
   * d = R × c
   */
  static distanceKm(from: GeoCoordinate, to: GeoCoordinate): number {
    const toRadians = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRadians(to.latitude - from.latitude);
    const dLng = toRadians(to.longitude - from.longitude);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(from.latitude)) *
        Math.cos(toRadians(to.latitude)) *
        Math.sin(dLng / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return this.EARTH_RADIUS_KM * c;
  }

  /**
   * Find all restaurants within a given radius.
   * Uses bounding box pre-filter for performance,
   * then Haversine for exact distance.
   */
  static filterWithinRadius(
    center: GeoCoordinate,
    restaurants: Array<GeoCoordinate & { id: string }>,
    radiusKm: number
  ): Array<GeoCoordinate & { id: string; distanceKm: number }> {
    // Step 1: Bounding box pre-filter (cheap — no trig)
    const latDelta = radiusKm / 111; // ~111 km per degree of latitude
    const lngDelta = radiusKm / (111 * Math.cos((center.latitude * Math.PI) / 180));

    const candidates = restaurants.filter(r =>
      r.latitude >= center.latitude - latDelta &&
      r.latitude <= center.latitude + latDelta &&
      r.longitude >= center.longitude - lngDelta &&
      r.longitude <= center.longitude + lngDelta
    );

    // Step 2: Haversine exact distance (only on candidates)
    return candidates
      .map(r => ({
        ...r,
        distanceKm: this.distanceKm(center, r),
      }))
      .filter(r => r.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }
}
```

**Why two-step filtering:**
- Bounding box: O(n) simple comparisons (no trigonometry)
- Haversine: Only computed for candidates within the bounding box
- At 10K restaurants, this reduces Haversine calls from 10K to ~100

---

## Q30: Design the Recommendation Engine scoring algorithm.

**Answer:**

```typescript
interface UserProfile {
  userId: string;
  preferredCuisines: string[];
  orderHistory: Array<{ restaurantId: string; rating?: number }>;
  averageOrderValue: number;
  location: GeoCoordinate;
}

interface ScoredRestaurant {
  restaurant: Restaurant;
  score: number;
  factors: Record<string, number>;
}

class RecommendationEngine {
  private readonly WEIGHTS = {
    cuisineMatch:  0.30,
    ratingScore:   0.20,
    distanceScore: 0.20,
    priceScore:    0.15,
    historyScore:  0.15,
  };

  recommend(
    user: UserProfile,
    restaurants: Restaurant[],
    maxResults: number = 10
  ): ScoredRestaurant[] {
    return restaurants
      .map(restaurant => this.score(user, restaurant))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }

  private score(user: UserProfile, restaurant: Restaurant): ScoredRestaurant {
    const factors: Record<string, number> = {};

    // Factor 1: Cuisine preference match (0-1)
    factors.cuisineMatch = user.preferredCuisines.includes(restaurant.cuisine)
      ? 1.0
      : this.getRelatedCuisineScore(user.preferredCuisines, restaurant.cuisine);

    // Factor 2: Restaurant rating (0-1)
    factors.ratingScore = (restaurant.rating ?? 0) / 5.0;

    // Factor 3: Distance (0-1, closer = higher)
    const distanceKm = GeoUtils.distanceKm(user.location, {
      latitude: parseFloat(restaurant.latitude),
      longitude: parseFloat(restaurant.longitude),
    });
    factors.distanceScore = Math.max(0, 1 - distanceKm / 10); // 10km max

    // Factor 4: Price alignment (0-1)
    factors.priceScore = 1 - Math.abs(
      user.averageOrderValue - restaurant.averagePrice
    ) / Math.max(user.averageOrderValue, restaurant.averagePrice);

    // Factor 5: Order history (0-1)
    const orderCount = user.orderHistory.filter(
      o => o.restaurantId === restaurant.id
    ).length;
    factors.historyScore = Math.min(1, orderCount / 5); // Cap at 5 orders

    // Weighted sum
    const score =
      factors.cuisineMatch  * this.WEIGHTS.cuisineMatch +
      factors.ratingScore   * this.WEIGHTS.ratingScore +
      factors.distanceScore * this.WEIGHTS.distanceScore +
      factors.priceScore    * this.WEIGHTS.priceScore +
      factors.historyScore  * this.WEIGHTS.historyScore;

    return { restaurant, score, factors };
  }

  private getRelatedCuisineScore(preferred: string[], cuisine: string): number {
    // Cuisine similarity map
    const RELATED: Record<string, string[]> = {
      "Italian": ["Mediterranean", "French"],
      "Chinese": ["Japanese", "Thai", "Korean"],
      "Indian": ["Pakistani", "Nepali"],
      // ...
    };

    for (const pref of preferred) {
      if (RELATED[pref]?.includes(cuisine)) return 0.5;
    }
    return 0.1; // Base score for any restaurant
  }
}
```

---

## Q31: Design the Collaborative Filtering algorithm for "also ordered" recommendations.

**Answer:**

```typescript
class CollaborativeFilter {
  private orderMatrix: Map<string, Map<string, number>>; // userId → restaurantId → orderCount

  /**
   * Item-Item Collaborative Filtering using Cosine Similarity.
   *
   * cosine_similarity(A, B) = (A · B) / (||A|| × ||B||)
   *
   * Where A and B are restaurant vectors (how many times each user ordered from them)
   */
  findSimilarRestaurants(restaurantId: string, topN: number = 5): string[] {
    const targetVector = this.getRestaurantVector(restaurantId);
    const similarities: Array<{ id: string; similarity: number }> = [];

    for (const otherRestaurantId of this.getAllRestaurantIds()) {
      if (otherRestaurantId === restaurantId) continue;

      const otherVector = this.getRestaurantVector(otherRestaurantId);
      const similarity = this.cosineSimilarity(targetVector, otherVector);

      if (similarity > 0) {
        similarities.push({ id: otherRestaurantId, similarity });
      }
    }

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topN)
      .map(s => s.id);
  }

  private cosineSimilarity(
    a: Map<string, number>,
    b: Map<string, number>
  ): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const [userId, countA] of a) {
      normA += countA * countA;
      const countB = b.get(userId) ?? 0;
      dotProduct += countA * countB;
    }

    for (const [, countB] of b) {
      normB += countB * countB;
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  // Get vector: how many times each user ordered from this restaurant
  private getRestaurantVector(restaurantId: string): Map<string, number> {
    const vector = new Map<string, number>();
    for (const [userId, restaurants] of this.orderMatrix) {
      const count = restaurants.get(restaurantId) ?? 0;
      if (count > 0) vector.set(userId, count);
    }
    return vector;
  }
}
```

---

## Q32: Design the Dynamic Pricing engine with surge calculation.

**Answer:**

```typescript
interface PricingContext {
  restaurantId: string;
  timeOfDay: Date;
  currentDemand: number;    // Orders in last hour
  averageDemand: number;    // Historical average for this time
  availableDrivers: number;
  pendingOrders: number;
  weatherCondition: "clear" | "rain" | "snow";
}

class DynamicPricingEngine {
  private static readonly SURGE_CAP = 1.5;        // Max 50% surge
  private static readonly MIN_MULTIPLIER = 1.0;
  private static readonly COOLDOWN_MS = 600_000;   // 10 minutes

  private lastPriceChange = new Map<string, number>();

  calculateMultiplier(ctx: PricingContext): {
    multiplier: number;
    factors: Record<string, number>;
    reason: string;
  } {
    // Cooldown check: don't change prices more than once per 10 minutes
    const lastChange = this.lastPriceChange.get(ctx.restaurantId) ?? 0;
    if (Date.now() - lastChange < DynamicPricingEngine.COOLDOWN_MS) {
      return { multiplier: 1.0, factors: {}, reason: "Cooldown period" };
    }

    const factors: Record<string, number> = {};

    // Factor 1: Demand surge (0 to +0.2)
    const demandRatio = ctx.averageDemand > 0
      ? (ctx.currentDemand - ctx.averageDemand) / ctx.averageDemand
      : 0;
    factors.demand = Math.max(0, Math.min(0.2, demandRatio * 0.2));

    // Factor 2: Supply/demand imbalance (0 to +0.2)
    const supplyRatio = ctx.availableDrivers > 0
      ? ctx.pendingOrders / ctx.availableDrivers
      : 1;
    factors.supply = Math.max(0, Math.min(0.2, (supplyRatio - 1) * 0.1));

    // Factor 3: Weather (0 to +0.1)
    factors.weather = ctx.weatherCondition === "snow" ? 0.1
      : ctx.weatherCondition === "rain" ? 0.05
      : 0;

    // Factor 4: Peak hours (+0.05)
    const hour = ctx.timeOfDay.getHours();
    factors.peakHour = (hour >= 12 && hour <= 14) || (hour >= 18 && hour <= 21)
      ? 0.05 : 0;

    // Calculate final multiplier with cap
    const rawMultiplier = 1.0 + Object.values(factors).reduce((a, b) => a + b, 0);
    const multiplier = Math.min(
      DynamicPricingEngine.SURGE_CAP,
      Math.max(DynamicPricingEngine.MIN_MULTIPLIER, rawMultiplier)
    );

    // Determine reason
    const dominantFactor = Object.entries(factors)
      .sort(([, a], [, b]) => b - a)[0];
    const reason = multiplier > 1.0
      ? `Prices slightly higher due to ${dominantFactor[0]}`
      : "Normal pricing";

    this.lastPriceChange.set(ctx.restaurantId, Date.now());

    return { multiplier, factors, reason };
  }
}
```

---

## Q33: Design the Fraud Detection risk scoring system.

**Answer:**

```typescript
interface TransactionContext {
  userId: string;
  orderValue: number;
  paymentMethod: string;
  deliveryAddress: string;
  accountAge: number;          // Days since registration
  userAverageOrder: number;
  recentOrderCount: number;    // Orders in last hour
  recentPaymentMethods: number; // Distinct methods in last 24h
  addressChangedRecently: boolean;
}

type RiskLevel = "low" | "medium" | "high";

interface RiskAssessment {
  score: number;         // 0.0 to 1.0
  level: RiskLevel;
  flags: string[];
  action: "allow" | "review" | "block";
}

class FraudDetector {
  private rules: Array<{
    name: string;
    weight: number;
    check: (ctx: TransactionContext) => boolean;
  }> = [
    {
      name: "new_user_high_value",
      weight: 0.3,
      check: (ctx) => ctx.accountAge < 7 && ctx.orderValue > 100,
    },
    {
      name: "unusual_amount",
      weight: 0.25,
      check: (ctx) => ctx.userAverageOrder > 0 &&
                       ctx.orderValue > ctx.userAverageOrder * 3,
    },
    {
      name: "velocity_abuse",
      weight: 0.2,
      check: (ctx) => ctx.recentOrderCount > 5,
    },
    {
      name: "address_change",
      weight: 0.15,
      check: (ctx) => ctx.addressChangedRecently,
    },
    {
      name: "payment_method_hopping",
      weight: 0.1,
      check: (ctx) => ctx.recentPaymentMethods >= 3,
    },
  ];

  assess(ctx: TransactionContext): RiskAssessment {
    const triggeredFlags: string[] = [];
    let totalWeight = 0;
    let triggeredWeight = 0;

    for (const rule of this.rules) {
      totalWeight += rule.weight;
      if (rule.check(ctx)) {
        triggeredFlags.push(rule.name);
        triggeredWeight += rule.weight;
      }
    }

    const score = totalWeight > 0 ? triggeredWeight / totalWeight : 0;
    const level: RiskLevel = score > 0.7 ? "high" : score > 0.4 ? "medium" : "low";
    const action = level === "high" ? "block" : level === "medium" ? "review" : "allow";

    return { score, level, flags: triggeredFlags, action };
  }
}
```

---

## Q34: Design the ETA Prediction service.

**Answer:**

```typescript
interface ETAPrediction {
  estimatedMinutes: number;
  confidence: number;           // 0.0 to 1.0
  range: { min: number; max: number };
  breakdown: {
    prepTime: number;
    travelTime: number;
    adjustments: number;
  };
}

class ETAPredictor {
  private static readonly AVG_SPEED_KMH = 20;           // Urban average
  private static readonly RUSH_HOUR_MULTIPLIER = 1.2;   // +20%
  private static readonly WEATHER_MULTIPLIER = 1.15;    // +15%
  private static readonly MAX_LOAD_MULTIPLIER = 1.15;   // +15%

  predict(
    restaurant: Restaurant,
    customerLocation: GeoCoordinate,
    orderItems: OrderItem[],
    context: { isRushHour: boolean; hasAdverseWeather: boolean; activeRestaurantOrders: number }
  ): ETAPrediction {
    // Step 1: Base preparation time
    const basePrepTime = this.calculatePrepTime(restaurant, orderItems);

    // Step 2: Travel time
    const distance = GeoUtils.distanceKm(
      { latitude: parseFloat(restaurant.latitude), longitude: parseFloat(restaurant.longitude) },
      customerLocation
    );
    const travelTime = (distance / ETAPredictor.AVG_SPEED_KMH) * 60; // minutes

    // Step 3: Adjustments
    const rushMultiplier = context.isRushHour
      ? ETAPredictor.RUSH_HOUR_MULTIPLIER : 1.0;
    const weatherMultiplier = context.hasAdverseWeather
      ? ETAPredictor.WEATHER_MULTIPLIER : 1.0;
    const loadMultiplier = 1 + Math.min(
      0.15,
      (context.activeRestaurantOrders / 100) * 0.15
    );

    const combinedMultiplier = rushMultiplier * weatherMultiplier * loadMultiplier;
    const adjustments = (basePrepTime + travelTime) * (combinedMultiplier - 1);

    const estimatedMinutes = Math.ceil(
      basePrepTime + travelTime + adjustments
    );

    return {
      estimatedMinutes,
      confidence: 0.85,
      range: {
        min: Math.max(5, estimatedMinutes - 5),
        max: estimatedMinutes + 10,
      },
      breakdown: {
        prepTime: Math.ceil(basePrepTime),
        travelTime: Math.ceil(travelTime),
        adjustments: Math.ceil(adjustments),
      },
    };
  }

  private calculatePrepTime(restaurant: Restaurant, items: OrderItem[]): number {
    // Base: restaurant's average prep time
    const base = restaurant.averagePrepTime ?? 20; // Default 20 min
    // Add 2 min per additional item beyond 3
    const itemAdjustment = Math.max(0, (items.length - 3)) * 2;
    return base + itemAdjustment;
  }
}
```

---

## Q35: Design the Session Store with PostgreSQL backend.

**Answer:**

```typescript
interface Session {
  sid: string;
  sess: {
    cookie: { maxAge: number; httpOnly: boolean; secure: boolean; sameSite: string };
    userId?: string;
    role?: string;
    passport?: { user: string };
  };
  expire: Date;
}

class PostgresSessionStore extends Store {
  constructor(private db: DrizzleDB, private options: { ttl: number }) {
    super();
  }

  async get(sid: string, callback: (err: any, session?: any) => void): Promise<void> {
    try {
      const [session] = await this.db
        .select()
        .from(sessions)
        .where(and(
          eq(sessions.sid, sid),
          gt(sessions.expire, new Date())  // Not expired
        ))
        .limit(1);

      callback(null, session?.sess ?? null);
    } catch (err) {
      callback(err);
    }
  }

  async set(sid: string, session: any, callback: (err?: any) => void): Promise<void> {
    try {
      const expire = new Date(
        Date.now() + (session.cookie?.maxAge ?? this.options.ttl)
      );

      await this.db
        .insert(sessions)
        .values({ sid, sess: session, expire })
        .onConflictDoUpdate({
          target: sessions.sid,
          set: { sess: session, expire },
        });

      callback();
    } catch (err) {
      callback(err);
    }
  }

  async destroy(sid: string, callback: (err?: any) => void): Promise<void> {
    try {
      await this.db.delete(sessions).where(eq(sessions.sid, sid));
      callback();
    } catch (err) {
      callback(err);
    }
  }

  // Periodic cleanup of expired sessions
  async prune(): Promise<number> {
    const result = await this.db
      .delete(sessions)
      .where(lt(sessions.expire, new Date()));
    return result.rowCount ?? 0;
  }
}

// Cleanup every hour
setInterval(() => sessionStore.prune(), 3600_000);
```

**Why PostgreSQL over Redis for sessions:**
- **Persistence** — Sessions survive server restarts
- **No additional infrastructure** — Reuses existing PostgreSQL
- **At scale** — Switch to Redis for faster reads (sub-millisecond)

---

## Q36: Design the JWT utility with timing-safe verification.

**Answer:**

```typescript
import { createHmac, timingSafeEqual } from "node:crypto";

interface JWTPayload {
  sub: string;     // User ID
  email: string;
  role: string;
  iat: number;     // Issued at
  exp: number;     // Expiration
}

class JWTService {
  private readonly algorithm = "HS256";
  private readonly secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  sign(payload: Omit<JWTPayload, "iat" | "exp">, expiresInMs: number = 3600_000): string {
    const now = Math.floor(Date.now() / 1000);
    const fullPayload: JWTPayload = {
      ...payload,
      iat: now,
      exp: now + Math.floor(expiresInMs / 1000),
    };

    const header = this.base64url({ alg: this.algorithm, typ: "JWT" });
    const body = this.base64url(fullPayload);
    const signature = this.createSignature(`${header}.${body}`);

    return `${header}.${body}.${signature}`;
  }

  verify(token: string): JWTPayload {
    const parts = token.split(".");
    if (parts.length !== 3) throw new AuthenticationError("Malformed JWT");

    const [header, body, signature] = parts;

    // Timing-safe comparison prevents timing attacks
    const expectedSignature = this.createSignature(`${header}.${body}`);
    const signatureBuffer = Buffer.from(signature, "base64url");
    const expectedBuffer = Buffer.from(expectedSignature, "base64url");

    if (signatureBuffer.length !== expectedBuffer.length ||
        !timingSafeEqual(signatureBuffer, expectedBuffer)) {
      throw new AuthenticationError("Invalid JWT signature");
    }

    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString()
    ) as JWTPayload;

    // Check expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new AuthenticationError("JWT expired");
    }

    return payload;
  }

  private createSignature(data: string): string {
    return createHmac("sha256", this.secret)
      .update(data)
      .digest("base64url");
  }

  private base64url(obj: object): string {
    return Buffer.from(JSON.stringify(obj)).toString("base64url");
  }
}
```

**Why `timingSafeEqual`:**
A naive `===` comparison returns `false` as soon as the first mismatched byte is found. An attacker can measure the time difference to guess the signature byte-by-byte. `timingSafeEqual` always compares ALL bytes, taking constant time regardless of match.

---

## Q37: Design the Redux store with typed hooks and slices.

**Answer:**

```typescript
// store/store.ts
import { configureStore } from "@reduxjs/toolkit";
import { persistStore, persistReducer } from "redux-persist";
import storage from "redux-persist/lib/storage"; // localStorage

import cartReducer from "./slices/cartSlice";
import authReducer from "./slices/authSlice";
import uiReducer from "./slices/uiSlice";

const cartPersistConfig = {
  key: "cart",
  storage,
  whitelist: ["items", "restaurantId"], // Only persist these fields
};

export const store = configureStore({
  reducer: {
    cart: persistReducer(cartPersistConfig, cartReducer),
    auth: authReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ["persist/PERSIST", "persist/REHYDRATE"],
      },
    }),
});

export const persistor = persistStore(store);

// Type inference
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

**Typed Hooks:**
```typescript
// store/hooks.ts
import { useDispatch, useSelector, TypedUseSelectorHook } from "react-redux";
import type { RootState, AppDispatch } from "./store";

// Use these INSTEAD of plain useDispatch/useSelector
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

**Cart Slice:**
```typescript
// store/slices/cartSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  restaurantId: string | null;
  restaurantName: string | null;
}

const initialState: CartState = {
  items: [],
  restaurantId: null,
  restaurantName: null,
};

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addItem(state, action: PayloadAction<CartItem & { restaurantId: string; restaurantName: string }>) {
      const { restaurantId, restaurantName, ...item } = action.payload;

      // Clear cart if switching restaurants
      if (state.restaurantId && state.restaurantId !== restaurantId) {
        state.items = [];
      }

      state.restaurantId = restaurantId;
      state.restaurantName = restaurantName;

      // Merge duplicate items
      const existing = state.items.find(i => i.menuItemId === item.menuItemId);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        state.items.push(item);  // Immer allows "mutation"
      }
    },

    removeItem(state, action: PayloadAction<string>) {
      state.items = state.items.filter(i => i.menuItemId !== action.payload);
      if (state.items.length === 0) {
        state.restaurantId = null;
        state.restaurantName = null;
      }
    },

    clearCart(state) {
      return initialState;  // Reset to initial state
    },
  },
});

export const { addItem, removeItem, clearCart } = cartSlice.actions;
export default cartSlice.reducer;
```

---

## Q38: Design the React Query configuration with global defaults.

**Answer:**

```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Global query client with production-grade defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't refetch when window regains focus (prevents flicker)
      refetchOnWindowFocus: false,

      // Don't retry in development; retry 2x in production
      retry: process.env.NODE_ENV === "production" ? 2 : false,

      // Stale time: 5 minutes (don't refetch if data is < 5 min old)
      staleTime: 5 * 60 * 1000,

      // Cache time: 30 minutes (keep in memory after unmount)
      gcTime: 30 * 60 * 1000,

      // Custom error handler
      throwOnError: false,
    },
    mutations: {
      retry: false,
      throwOnError: false,
    },
  },
});

// Custom hook for fetching with auth
function useAuthenticatedQuery<T>(
  key: string[],
  url: string,
  options?: { staleTime?: number; enabled?: boolean }
) {
  return useQuery<T>({
    queryKey: key,
    queryFn: async () => {
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        if (response.status === 401) {
          queryClient.clear(); // Clear cache on auth failure
          throw new Error("Unauthorized");
        }
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    },
    staleTime: options?.staleTime,
    enabled: options?.enabled,
  });
}
```

**Optimistic Update Pattern:**
```typescript
function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { orderId: string; status: string }) =>
      fetch(`/api/v1/orders/${data.orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: data.status }),
      }),

    // Optimistic update
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["order", data.orderId] });
      const previous = queryClient.getQueryData(["order", data.orderId]);

      queryClient.setQueryData(["order", data.orderId], (old: any) => ({
        ...old,
        status: data.status,
      }));

      return { previous };
    },

    // Rollback on error
    onError: (err, data, context) => {
      queryClient.setQueryData(
        ["order", data.orderId],
        context?.previous
      );
    },

    // Refetch on success (source of truth)
    onSettled: (data, err, variables) => {
      queryClient.invalidateQueries({ queryKey: ["order", variables.orderId] });
    },
  });
}
```

---

## Q39: Design the ProtectedRoute component with RBAC.

**Answer:**

```typescript
import { Route, Redirect } from "wouter";

interface ProtectedRouteProps {
  path: string;
  component: React.ComponentType;
  allowedRoles?: string[];         // RBAC
  requireAuth?: boolean;           // Default true
  fallbackPath?: string;           // Where to redirect
}

function ProtectedRoute({
  path,
  component: Component,
  allowedRoles,
  requireAuth = true,
  fallbackPath = "/sign-in",
}: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();

  return (
    <Route path={path}>
      {() => {
        // Loading state: show skeleton
        if (isLoading) {
          return <LoadingSkeleton />;
        }

        // Not authenticated: redirect to sign-in
        if (requireAuth && !isAuthenticated) {
          return <Redirect to={`${fallbackPath}?redirect=${path}`} />;
        }

        // Wrong role: redirect to appropriate dashboard
        if (allowedRoles && !allowedRoles.includes(user!.role)) {
          const roleRedirects: Record<string, string> = {
            customer: "/",
            restaurant_owner: "/restaurant-dashboard",
            delivery_partner: "/delivery-dashboard",
            admin: "/admin",
          };
          return <Redirect to={roleRedirects[user!.role] ?? "/"} />;
        }

        // Authorized: render component
        return <Component />;
      }}
    </Route>
  );
}

// Usage
<ProtectedRoute path="/admin" component={AdminDashboard} allowedRoles={["admin"]} />
<ProtectedRoute path="/restaurant-dashboard" component={RestaurantDashboard}
  allowedRoles={["restaurant_owner", "admin"]} />
<ProtectedRoute path="/orders" component={Orders} />  {/* Any authenticated user */}
```

---

## Q40: Design the three-layer state management architecture.

**Answer:**

```
┌────────────────────────────────────────────────────────────────────┐
│                    React State Architecture                        │
│                                                                    │
│  Layer 1: React Query (Server State)                               │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ • Restaurant list, menu items, order details, user profile    │ │
│  │ • Auto-caching (staleTime: 5min, gcTime: 30min)              │ │
│  │ • Background refetching, error/loading states                 │ │
│  │ • Optimistic updates for mutations                            │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  Layer 2: Redux Toolkit (Client State — Persistent)                │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ • Shopping cart (persisted to localStorage via redux-persist)  │ │
│  │ • Authentication state                                        │ │
│  │ • Global UI state (theme, sidebar, modals)                    │ │
│  │ • Cross-component state that survives navigation              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  Layer 3: React useState / useReducer (Local UI State)             │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ • Form inputs, validation errors                              │ │
│  │ • Modal open/close, accordion state                           │ │
│  │ • Dropdown selections, hover/focus state                      │ │
│  │ • Component-specific loading/error states                     │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

**Decision Matrix:**

| Question | Layer |
|----------|-------|
| Does it come from the server? | React Query |
| Does it need to persist across navigation? | Redux |
| Does it need to be shared across distant components? | Redux / Context |
| Is it only used in one component? | useState |
| Is it complex with multiple sub-values? | useReducer |

**Anti-Patterns Avoided:**
1. ❌ Storing server data in Redux → ✅ React Query handles caching
2. ❌ Using Redux for form state → ✅ useState is simpler
3. ❌ Using Context for frequently-changing data → ✅ Redux (avoids re-render cascade)
4. ❌ Prop drilling through 5+ levels → ✅ Redux or Context

---

## Q41: Design the AuthProvider with initialization flow.

**Answer:**

```typescript
interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthState & {
  login: (provider: string) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
} | null>(null);

function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,  // Start loading — check session on mount
    isAuthenticated: false,
    error: null,
  });

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/user", { credentials: "include" });
      if (response.ok) {
        const user = await response.json();
        setState({
          user,
          isLoading: false,
          isAuthenticated: true,
          error: null,
        });
      } else {
        setState({ user: null, isLoading: false, isAuthenticated: false, error: null });
      }
    } catch (error) {
      setState({ user: null, isLoading: false, isAuthenticated: false, error: "Network error" });
    }
  }, []);

  // Check auth on mount
  useEffect(() => { checkAuth(); }, [checkAuth]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setState({ user: null, isLoading: false, isAuthenticated: false, error: null });
    queryClient.clear(); // Clear all cached data
  }, []);

  const login = useCallback((provider: string) => {
    window.location.href = `/api/auth/${provider}`;
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
```

**AuthInitializer (Separation of Concerns):**
```typescript
// Separate component — keeps AuthProvider clean
function AuthInitializer({ children }: { children: ReactNode }) {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <FullScreenSpinner message="Checking authentication..." />;
  }

  return <>{children}</>;
}

// App.tsx — Provider nesting order matters
<QueryClientProvider client={queryClient}>
  <ReduxProvider store={store}>
    <AuthProvider>
      <AuthInitializer>
        <ThemeProvider>
          <Router />
        </ThemeProvider>
      </AuthInitializer>
    </AuthProvider>
  </ReduxProvider>
</QueryClientProvider>
```

---

## Q42: Design the Custom Hook pattern for reusable logic.

**Answer:**

```typescript
// useDebounce — delays value updates
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// useLocalStorage — useState backed by localStorage
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value: T) => {
    setStoredValue(value);
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key]);

  return [storedValue, setValue];
}

// useWebSocket — auto-reconnecting WebSocket
function useWebSocket(url: string) {
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout>();

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setIsConnected(true);
      ws.onclose = () => {
        setIsConnected(false);
        reconnectTimeout.current = setTimeout(connect, 3000); // Auto-reconnect
      };
      ws.onmessage = (event) => {
        setLastMessage(JSON.parse(event.data));
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [url]);

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { lastMessage, isConnected, send };
}
```

**Hook Rules Enforced:**
1. Only call at top level (not inside conditions/loops)
2. Only call from React components or other hooks
3. Prefix with `use` for linter detection
4. Return stable references via `useCallback`/`useMemo`

---

## Q43: Design the Error Boundary component with fallback UI.

**Answer:**

```typescript
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: any[]; // Reset when these values change
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to error tracking service
    console.error("ErrorBoundary caught:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Reset when resetKeys change (e.g., route change)
    if (this.state.hasError && this.props.resetKeys) {
      const hasChanged = this.props.resetKeys.some(
        (key, i) => key !== prevProps.resetKeys?.[i]
      );
      if (hasChanged) {
        this.setState({ hasError: false, error: null });
      }
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-muted-foreground mb-4">
            {this.state.error?.message ?? "An unexpected error occurred"}
          </p>
          <Button
            onClick={() => this.setState({ hasError: false, error: null })}
            variant="outline"
          >
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Usage: wrap sections, not the entire app
<ErrorBoundary resetKeys={[location.pathname]}>
  <OrderTracking />
</ErrorBoundary>
```

**Why class component:**
`getDerivedStateFromError` and `componentDidCatch` are only available in class components. No hook equivalent exists (as of React 18).

---

## Q44: Design the theme system with CSS variables and React context.

**Answer:**

```typescript
type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useLocalStorage<Theme>("theme", "system");

  const resolvedTheme = useMemo(() => {
    if (theme !== "system") return theme;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark" : "light";
  }, [theme]);

  // Apply theme class to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
  }, [resolvedTheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setTheme("system"); // Trigger re-render

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

**CSS Variables (Tailwind + shadcn/ui):**
```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --destructive: 0 84.2% 60.2%;
  --muted: 210 40% 96.1%;
  --radius: 0.5rem;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --primary: 210 40% 98%;
  --destructive: 0 62.8% 30.6%;
  --muted: 217.2 32.6% 17.5%;
}
```

---

## Q45: Design the Vite build configuration for production.

**Answer:**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => ({
  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },

  root: path.resolve(__dirname, "client"),

  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,

    // Code splitting
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "redux-vendor": ["@reduxjs/toolkit", "react-redux"],
          "ui-vendor": ["framer-motion", "@radix-ui/react-dialog"],
        },
      },
    },

    // Content hashing for cache busting
    // Output: assets/react-vendor-[hash].js
    assetsDir: "assets",

    // Production optimizations
    minify: "terser",
    sourcemap: mode === "development",

    // Tree-shaking
    treeshake: true,
  },

  // Dev server proxies API calls to backend
  server: {
    proxy: {
      "/api": { target: "http://localhost:5000", changeOrigin: true },
      "/ws": { target: "ws://localhost:5000", ws: true },
    },
  },

  // Security: prevent accessing files outside allowed directories
  fs: {
    strict: true,
    deny: ["**/.*"],  // Block dotfiles
  },
}));
```

**Server Build (esbuild):**
```typescript
import { build } from "esbuild";

await build({
  entryPoints: ["server/index.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  outfile: "dist/index.cjs",
  format: "cjs",
  minify: true,
  sourcemap: false,
  external: [],      // Bundle everything for fewer disk reads on cold start
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});
```

**Key Decisions:**
- **Manual chunks** — Vendor bundles cached separately (react rarely changes)
- **Content hashing** — File names include hash; safe to cache forever
- **esbuild for server** — Single `dist/index.cjs` file, no `node_modules` needed at runtime
- **Proxy** — Dev server forwards `/api` to backend (no CORS issues)

---

## Q46: Design the Wouter routing configuration with code splitting.

**Answer:**

```typescript
import { Switch, Route, Redirect } from "wouter";
import { lazy, Suspense } from "react";

// Code-split page components (loaded on demand)
const Home = lazy(() => import("./pages/Home"));
const Restaurant = lazy(() => import("./pages/Restaurant"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Orders = lazy(() => import("./pages/Orders"));
const OrderTracking = lazy(() => import("./pages/OrderTracking"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const RestaurantDashboard = lazy(() => import("./pages/RestaurantDashboard"));
const DeliveryDashboard = lazy(() => import("./pages/DeliveryDashboard"));

function AppRouter() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Switch>
        {/* Public routes */}
        <Route path="/" component={Landing} />  {/* Not lazy — first paint */}
        <Route path="/sign-in" component={SignIn} />
        <Route path="/sign-up" component={SignUp} />

        {/* Protected routes */}
        <ProtectedRoute path="/home" component={Home} />
        <ProtectedRoute path="/restaurant/:id" component={Restaurant} />
        <ProtectedRoute path="/checkout" component={Checkout} />
        <ProtectedRoute path="/orders" component={Orders} />
        <ProtectedRoute path="/orders/:id/tracking" component={OrderTracking} />

        {/* Role-restricted routes */}
        <ProtectedRoute path="/admin"
          component={AdminDashboard}
          allowedRoles={["admin"]} />
        <ProtectedRoute path="/restaurant-dashboard"
          component={RestaurantDashboard}
          allowedRoles={["restaurant_owner", "admin"]} />
        <ProtectedRoute path="/delivery-dashboard"
          component={DeliveryDashboard}
          allowedRoles={["delivery_partner", "admin"]} />

        {/* Catch-all 404 */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}
```

**Why Wouter over React Router:**
- **2KB** vs 40KB+ — Minimal bundle size
- **Hook-based API** — `useLocation()`, `useRoute()`
- **No Context dependency** — Works with any state manager
- **Simple matching** — Pattern-based routing without complex configuration

---

## Q47: Design the Optimistic Update pattern for cart operations.

**Answer:**

```typescript
function useAddToCart() {
  const dispatch = useAppDispatch();
  const { toast } = useToast();

  return useCallback(
    async (item: CartItem & { restaurantId: string; restaurantName: string }) => {
      // Step 1: Optimistic update (instant UI feedback)
      dispatch(addItem(item));
      toast({ title: `${item.name} added to cart`, variant: "success" });

      try {
        // Step 2: Server sync (background)
        await fetch("/api/v1/cart/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(item),
        });
      } catch (error) {
        // Step 3: Rollback on failure
        dispatch(removeItem(item.menuItemId));
        toast({ title: "Failed to add item", variant: "destructive" });
      }
    },
    [dispatch, toast]
  );
}
```

**Server-State Optimistic Update (React Query):**
```typescript
function usePlaceOrder() {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: async (orderData: CreateOrderInput) => {
      const response = await fetch("/api/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": `order-${Date.now()}-${orderData.restaurantId}`,
        },
        credentials: "include",
        body: JSON.stringify(orderData),
      });
      if (!response.ok) throw new Error("Order failed");
      return response.json();
    },

    onMutate: async (orderData) => {
      // Cancel in-flight queries
      await queryClient.cancelQueries({ queryKey: ["orders"] });

      // Snapshot previous orders
      const previousOrders = queryClient.getQueryData(["orders"]);

      // Optimistically add new order
      queryClient.setQueryData(["orders"], (old: Order[] = []) => [
        { ...orderData, id: "temp-id", status: "pending", createdAt: new Date() },
        ...old,
      ]);

      return { previousOrders };
    },

    onError: (err, data, context) => {
      // Rollback to snapshot
      queryClient.setQueryData(["orders"], context?.previousOrders);
    },

    onSuccess: () => {
      dispatch(clearCart());
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
```

---

## Q48: Design the Express route registration pattern.

**Answer:**

```typescript
// routes.ts — Central route registration
export function registerRoutes(app: Express): Server {
  // Middleware order matters!
  app.use(correlationIdMiddleware);               // 1. Trace ID
  app.use(express.json({ limit: "10mb" }));       // 2. Parse body
  app.use(express.urlencoded({ extended: true })); // 3. Parse forms
  app.use(sessionMiddleware);                      // 4. Session management
  app.use(passport.initialize());                  // 5. Auth init
  app.use(passport.session());                     // 6. Auth session
  app.use(metricsMiddleware);                      // 7. Request metrics

  // Auth routes (strict rate limiting)
  app.use("/api/auth", authLimiter.middleware(), authRouter);

  // API routes (standard rate limiting)
  app.use("/api/v1/restaurants", apiLimiter.middleware(), restaurantRouter);
  app.use("/api/v1/orders", orderLimiter.middleware(), authRequired, orderRouter);
  app.use("/api/v1/menu", apiLimiter.middleware(), menuRouter);
  app.use("/api/v1/delivery-partners", apiLimiter.middleware(), authRequired, deliveryRouter);
  app.use("/api/v1/admin", apiLimiter.middleware(), authRequired, roleCheck("admin"), adminRouter);

  // Health & metrics (no auth, no rate limit)
  app.get("/api/health", healthHandler);
  app.get("/api/health/live", liveHandler);
  app.get("/api/health/ready", readyHandler);
  app.get("/api/metrics", metricsHandler);

  // Global error handler (must be LAST)
  app.use(globalErrorHandler);

  // Create HTTP server + WebSocket
  const httpServer = createServer(app);
  webSocketManager.initialize(httpServer);

  return httpServer;
}
```

**Router Pattern (per-domain):**
```typescript
// Each domain has its own router file
const orderRouter = Router();

orderRouter.post("/",
  validate({ body: createOrderSchema }),
  asyncHandler(async (req, res) => {
    const order = await orderService.createOrder(req.user!.id, req.body);
    res.status(201).json(order);
  })
);

orderRouter.get("/:id",
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const order = await orderService.getById(req.params.id);
    if (!order) throw new NotFoundError("Order", req.params.id);
    res.json(order);
  })
);

orderRouter.patch("/:id/status",
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({ status: orderStatusEnum }),
  }),
  asyncHandler(async (req, res) => {
    const order = await orderService.updateStatus(req.params.id, req.body.status);
    res.json(order);
  })
);
```

---

## Q49: Design the Multi-Region routing algorithm.

**Answer:**

```typescript
interface Region {
  id: string;           // "us-east-1"
  location: string;     // "Virginia"
  isPrimary: boolean;
  health: number;       // 0.0 - 1.0
  replicationLag: number; // milliseconds
  features: string[];
}

class MultiRegionRouter {
  private regions: Region[];

  constructor(regions: Region[]) {
    this.regions = regions;
  }

  // Route reads to nearest healthy region
  routeRead(userLocation: GeoCoordinate): Region {
    const scored = this.regions
      .filter(r => r.health > 0.3) // Exclude unhealthy
      .map(r => ({
        region: r,
        score: this.calculateScore(r, userLocation),
      }))
      .sort((a, b) => b.score - a.score);

    return scored[0]?.region ?? this.getPrimary();
  }

  // Route writes ALWAYS to primary
  routeWrite(): Region {
    const primary = this.getPrimary();
    if (primary.health < 0.5) {
      // Primary unhealthy — failover
      return this.electNewPrimary();
    }
    return primary;
  }

  private calculateScore(region: Region, userLocation: GeoCoordinate): number {
    // Distance score (0-1, closer is better)
    const regionCoords = this.getRegionCoords(region.id);
    const distanceKm = GeoUtils.distanceKm(userLocation, regionCoords);
    const maxDistance = 20000; // Half Earth circumference
    const distanceScore = 1 - distanceKm / maxDistance;

    // Health score (0-1)
    const healthScore = region.health;

    // Replication lag score (0-1, lower lag is better)
    const lagScore = Math.max(0, 1 - region.replicationLag / 10000);

    // Primary bonus
    const primaryBonus = region.isPrimary ? 0.1 : 0;

    return (
      distanceScore * 0.4 +
      healthScore * 0.3 +
      lagScore * 0.2 +
      primaryBonus * 0.1
    );
  }

  private electNewPrimary(): Region {
    return this.regions
      .filter(r => !r.isPrimary && r.health > 0.7)
      .sort((a, b) => a.replicationLag - b.replicationLag)[0];
  }

  private getPrimary(): Region {
    return this.regions.find(r => r.isPrimary)!;
  }

  private getRegionCoords(regionId: string): GeoCoordinate {
    const coords: Record<string, GeoCoordinate> = {
      "us-east-1": { latitude: 39.0438, longitude: -77.4874 },
      "us-west-2": { latitude: 46.15, longitude: -123.88 },
      "eu-west-1": { latitude: 53.3331, longitude: -6.2489 },
      "ap-south-1": { latitude: 19.076, longitude: 72.8777 },
      "ap-northeast-1": { latitude: 35.6762, longitude: 139.6503 },
    };
    return coords[regionId];
  }
}
```

---

## Q50: Summarize the key LLD design patterns used in FoodDash and when to apply each.

**Answer:**

| # | Pattern | Where Used | When to Apply |
|---|---------|-----------|---------------|
| 1 | **Template Method** | `BaseService.initialize()` | Common algorithm with customizable steps |
| 2 | **Strategy** | Auth providers (Google, Keycloak, OTP) | Multiple interchangeable algorithms |
| 3 | **Observer** | EventBus pub/sub, WebSocket notifications | One-to-many event broadcasting |
| 4 | **Mediator** | EventBus (central communication hub) | Decouple many-to-many interactions |
| 5 | **State Machine** | Order FSM (7 states, guarded transitions) | Entities with defined lifecycle states |
| 6 | **Saga** | SagaOrchestrator (distributed transactions) | Multi-service atomic operations |
| 7 | **Command** | Order operations (execute + undo) | Reversible operations, queuing |
| 8 | **Builder** | RestaurantQueryBuilder (fluent filters) | Complex object construction |
| 9 | **Factory** | ServiceFactory (creates 16 microservices) | Encapsulate complex creation logic |
| 10 | **Singleton** | EventBus, Logger, MetricsCollector | Shared global infrastructure |
| 11 | **Repository** | OrderRepository, RestaurantRepository | Abstract database access |
| 12 | **Proxy** | CachingRestaurantProxy | Transparent caching, logging, access control |
| 13 | **Adapter** | Message queue backends (RabbitMQ, Kafka, SQS) | Uniform interface over different systems |
| 14 | **Decorator** | Express middleware chain | Add behavior without modifying core |
| 15 | **Anti-Corruption Layer** | SAPDataTransformer | Protect domain from external system leakage |
| 16 | **CQRS** | Order Service read/write separation | Different read vs write scaling needs |
| 17 | **Event Sourcing** | OrderEventStore (immutable event log) | Complete audit trail, time travel |
| 18 | **Circuit Breaker** | External service calls (payment, SAP) | Prevent cascade failures |
| 19 | **Retry with Backoff** | `withRetry()` in BaseService | Transient failure recovery |
| 20 | **Idempotency** | IdempotencyStore (orders, payments) | Prevent duplicate operations |
| 21 | **Cache-Aside** | CacheManager L1/L2 | Read-heavy workloads |
| 22 | **Intercepting Filter** | Zod validation middleware | Request validation before processing |
| 23 | **Closure** | `subscribe()` returns unsubscribe function | Encapsulate cleanup logic |
| 24 | **Higher-Order Function** | `asyncHandler()` wraps route handlers | Cross-cutting concerns around functions |
| 25 | **Composition** | Provider nesting, middleware pipeline | Build complex behavior from simple parts |

**SOLID Principles in Practice:**

| Principle | Example |
|-----------|---------|
| **S**ingle Responsibility | Each microservice owns one domain |
| **O**pen/Closed | Add new auth provider without modifying existing |
| **L**iskov Substitution | Any `IMessageQueueAdapter` is interchangeable |
| **I**nterface Segregation | `IRepository<T>` — only CRUD methods, no service logic |
| **D**ependency Inversion | Services depend on abstractions (EventBus), not concrete implementations |

---
