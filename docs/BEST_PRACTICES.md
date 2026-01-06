# Best Practices Guide - FoodDash Platform

This document outlines the best practices, design patterns, and coding standards implemented in the FoodDash food delivery platform. Use this guide as a reference for maintaining code quality and architectural consistency.

---

## Table of Contents

1. [Architecture Best Practices](#architecture-best-practices)
2. [Microservices Patterns](#microservices-patterns)
3. [Resilience Patterns](#resilience-patterns)
4. [Data Management](#data-management)
5. [API Design](#api-design)
6. [Security Best Practices](#security-best-practices)
7. [Frontend Best Practices](#frontend-best-practices)
8. [Testing Strategies](#testing-strategies)
9. [Observability](#observability)
10. [Code Organization](#code-organization)
11. [Performance Optimization](#performance-optimization)
12. [Error Handling](#error-handling)

---

## Architecture Best Practices

### 1. Microservices Architecture

**Principle**: Single Responsibility per Service

Each microservice owns a specific business domain and operates independently.

```
✅ DO:
- One service per business domain (Auth, Order, Payment, etc.)
- Independent data stores per service
- Well-defined API contracts between services

❌ DON'T:
- Create monolithic services that do everything
- Share databases between services
- Tightly couple services
```

**Implementation in FoodDash:**

```typescript
// Each service has clear boundaries
server/
  microservices/
    auth/AuthIdentityService.ts        // Authentication & Identity
    restaurant/RestaurantService.ts    // Restaurant management
    menu/MenuService.ts                // Menu items & categories
    order/OrderService.ts              // Order lifecycle
    delivery/DeliveryPartnerService.ts // Delivery operations
    payment/PaymentService.ts          // Payment processing
```

### 2. Hexagonal Architecture (Ports & Adapters)

**Principle**: Separate business logic from external concerns

```
┌─────────────────────────────────────────────┐
│              APPLICATION CORE                │
│  ┌─────────────────────────────────────┐    │
│  │         Business Logic               │    │
│  │    (Domain Services, Entities)       │    │
│  └─────────────────────────────────────┘    │
│                     ▲                        │
│                     │                        │
│  ┌────────┐    ┌────┴────┐    ┌────────┐   │
│  │  HTTP  │    │  Ports  │    │Database│   │
│  │Adapter │◀───│         │───▶│Adapter │   │
│  └────────┘    └─────────┘    └────────┘   │
└─────────────────────────────────────────────┘
```

**Implementation:**

```typescript
// BaseService.ts - Core abstraction
export abstract class BaseService {
  protected logger: ReturnType<typeof createServiceLogger>;
  protected config: ServiceConfig;

  constructor(config: ServiceConfig) {
    this.config = config;
    this.logger = createServiceLogger(config.name);
  }

  // Port: Health check interface
  abstract checkHealth(): Promise<ServiceHealth>;

  // Adapter: Event publishing
  protected async publishEvent<T>(eventType: string, data: T): Promise<void> {
    await eventBus.publish(eventType, data, undefined, this.config.name);
  }

  // Adapter: Caching
  protected async withCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    return cache.getOrSet(key, fetcher, 300);
  }
}
```

### 3. Event-Driven Architecture

**Principle**: Loose coupling through asynchronous events

**Implementation:**

```typescript
// Event Types - Well-defined event contracts
export const EventTypes = {
  // Order Domain Events
  ORDER_CREATED: "order.created",
  ORDER_CONFIRMED: "order.confirmed",
  ORDER_PREPARING: "order.preparing",
  ORDER_READY: "order.ready",
  ORDER_PICKED_UP: "order.picked_up",
  ORDER_DELIVERED: "order.delivered",
  ORDER_CANCELLED: "order.cancelled",

  // Payment Domain Events
  PAYMENT_INITIATED: "payment.initiated",
  PAYMENT_SUCCESS: "payment.success",
  PAYMENT_FAILED: "payment.failed",
  PAYMENT_REFUNDED: "payment.refunded",

  // Rider Domain Events
  RIDER_ASSIGNED: "rider.assigned",
  RIDER_LOCATION_UPDATE: "rider.location_update",
} as const;

// Event Publishing
await eventBus.publish(
  EventTypes.ORDER_CREATED,
  { orderId, customerId, items },
  correlationId,
  "OrderService"
);

// Event Subscription
eventBus.subscribe(EventTypes.ORDER_CREATED, async (data, metadata) => {
  // Handle order created event
  await notificationService.sendOrderConfirmation(data);
});
```

**Best Practices for Events:**

```
✅ DO:
- Use past tense for event names (ORDER_CREATED, not CREATE_ORDER)
- Include correlation IDs for traceability
- Make events immutable
- Include timestamps in event metadata
- Keep event payloads focused and minimal

❌ DON'T:
- Include sensitive data in events
- Make events too large
- Depend on event ordering across services
```

---

## Microservices Patterns

### 1. Base Service Pattern

**Principle**: Common functionality through inheritance

```typescript
export abstract class BaseService {
  // Configuration
  protected config: ServiceConfig;
  protected logger: ReturnType<typeof createServiceLogger>;
  protected startTime: Date;

  // Resilience patterns built-in
  protected async executeWithResilience<T>(
    operation: () => Promise<T>,
    operationName: string,
    fallback?: () => Promise<T>
  ): Promise<T> {
    const timer = metrics.startTimer(`${this.config.name}.${operationName}`);

    try {
      const result = await circuitBreaker.execute(
        async () => {
          return this.withTimeout(
            this.withRetry(operation, this.config.retryAttempts),
            this.config.timeout
          );
        },
        fallback
      );

      metrics.recordSuccess(`${this.config.name}.${operationName}`);
      return result as T;
    } catch (error) {
      metrics.recordError(`${this.config.name}.${operationName}`);
      throw error;
    } finally {
      timer.end();
    }
  }
}
```

### 2. Service Registry Pattern

**Principle**: Dynamic service discovery and registration

```typescript
export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private services: Map<string, BaseService> = new Map();

  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  register(service: BaseService): void {
    const metadata = service.getMetadata();
    this.services.set(metadata.name, service);
    logger.info(`Service registered: ${metadata.name} v${metadata.version}`);
  }

  getService(serviceName: string): BaseService | undefined {
    return this.services.get(serviceName);
  }

  async healthCheck(): Promise<Map<string, ServiceHealth>> {
    const results = new Map<string, ServiceHealth>();
    for (const [name, service] of this.services) {
      results.set(name, await service.checkHealth());
    }
    return results;
  }
}
```

### 3. Saga Pattern for Distributed Transactions

**Principle**: Maintain data consistency across services without distributed locks

**When to Use:**
- Multi-step business processes (order placement)
- Operations spanning multiple services
- Need for compensating transactions

**Implementation:**

```typescript
// Saga Definition
const orderPlacementSaga: SagaDefinition<OrderContext> = {
  name: "order-placement",
  steps: [
    {
      name: "validate-order",
      execute: async (context) => {
        return orderService.validateOrder(context.order);
      },
      compensate: async () => {
        // No compensation needed for validation
      },
    },
    {
      name: "reserve-inventory",
      execute: async (context) => {
        return inventoryService.reserve(context.order.items);
      },
      compensate: async (context, result) => {
        // Release reserved inventory
        await inventoryService.release(result.reservationId);
      },
    },
    {
      name: "process-payment",
      execute: async (context) => {
        return paymentService.charge(context.paymentInfo);
      },
      compensate: async (context, result) => {
        // Refund payment
        await paymentService.refund(result.transactionId);
      },
    },
    {
      name: "create-order",
      execute: async (context, previousResults) => {
        return orderService.create({
          ...context.order,
          paymentId: previousResults["process-payment"].transactionId,
        });
      },
      compensate: async (context, result) => {
        // Cancel order
        await orderService.cancel(result.orderId);
      },
    },
  ],
};

// Saga Execution
const result = await sagaOrchestrator.execute("order-placement", {
  order: orderDetails,
  paymentInfo: paymentDetails,
});

if (!result.success) {
  // All compensating transactions were executed
  console.log("Order failed, compensated steps:", result.compensatedSteps);
}
```

**Saga Best Practices:**

```
✅ DO:
- Make compensating transactions idempotent
- Log all saga steps for audit
- Implement timeouts per step
- Use exponential backoff for retries

❌ DON'T:
- Assume compensations always succeed
- Create circular dependencies between steps
- Skip compensation logging
```

---

## Resilience Patterns

### 1. Circuit Breaker Pattern

**Principle**: Prevent cascade failures by stopping calls to failing services

**States:**
- **Closed**: Normal operation, requests flow through
- **Open**: Service is failing, requests are rejected immediately
- **Half-Open**: Testing if service has recovered

```typescript
class CircuitBreaker<T> {
  private state: CircuitState = "closed";
  private failures: number = 0;
  private options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = {
      failureThreshold: options.failureThreshold || 5,    // Open after 5 failures
      resetTimeout: options.resetTimeout || 30000,        // Try again after 30s
      halfOpenRequests: options.halfOpenRequests || 3,    // 3 successful to close
    };
  }

  async execute(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === "open") {
      if (this.nextAttempt && new Date() >= this.nextAttempt) {
        this.state = "half-open";  // Try recovery
      } else {
        if (fallback) return fallback();  // Use fallback
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

  private onFailure(): void {
    this.failures++;
    if (this.failures >= this.options.failureThreshold) {
      this.trip();  // Open the circuit
    }
  }

  private trip(): void {
    this.state = "open";
    this.nextAttempt = new Date(Date.now() + this.options.resetTimeout);
  }
}
```

### 2. Retry with Exponential Backoff

**Principle**: Retry failed operations with increasing delays

```typescript
private async withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number,
  attempt: number = 1
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (attempt >= maxAttempts) {
      throw error;  // Max retries exceeded
    }

    // Exponential backoff with jitter
    const baseDelay = Math.pow(2, attempt) * 100;  // 200, 400, 800, 1600...
    const jitter = Math.random() * 100;            // Random 0-100ms
    const delay = baseDelay + jitter;

    this.logger.warn(`Retry attempt ${attempt}/${maxAttempts}, waiting ${delay}ms`);
    await new Promise((resolve) => setTimeout(resolve, delay));

    return this.withRetry(operation, maxAttempts, attempt + 1);
  }
}
```

**Why Jitter?**
- Prevents thundering herd problem
- Spreads retry load across time
- Reduces contention on recovering services

### 3. Timeout Pattern

**Principle**: Fail fast instead of waiting indefinitely

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

### 4. Rate Limiting

**Principle**: Protect services from overload

**Implementation:**

```typescript
class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.options.keyGenerator(req);
      const now = Date.now();

      let entry = this.store.get(key);
      if (!entry || entry.resetAt < now) {
        entry = { count: 0, resetAt: now + this.options.windowMs };
      }

      entry.count++;
      this.store.set(key, entry);

      // Set rate limit headers
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

// Different limits for different endpoints
export const apiRateLimiter = new RateLimiter({
  windowMs: 60 * 1000,      // 1 minute
  maxRequests: 100,          // 100 requests per minute
});

export const authRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10,           // 10 auth attempts per 15 min (brute force protection)
});

export const orderRateLimiter = new RateLimiter({
  windowMs: 60 * 1000,      // 1 minute
  maxRequests: 10,           // 10 orders per minute (prevent abuse)
});
```

---

## Data Management

### 1. Cache-Aside Pattern

**Principle**: Application manages cache population

```typescript
class InMemoryCache {
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    // Cache miss - fetch from source
    const value = await fetcher();
    await this.set(key, value, ttlSeconds);
    return value;
  }
}

// Usage in service
const restaurants = await cache.getOrSet(
  CacheKeys.restaurants(),
  () => db.select().from(restaurantsTable),
  300  // 5 minutes TTL
);
```

### 2. Cache Key Patterns

**Principle**: Consistent, hierarchical cache key naming

```typescript
export const CacheKeys = {
  // Entity patterns
  restaurants: () => "restaurants:all",
  restaurant: (id: string) => `restaurant:${id}`,
  restaurantMenu: (id: string) => `restaurant:${id}:menu`,
  menuItem: (id: string) => `menuItem:${id}`,

  // User-specific patterns
  userOrders: (userId: string) => `user:${userId}:orders`,
  
  // Query-based patterns
  search: (query: string) => `search:${query}`,

  // Time-based patterns
  activeCoupons: () => "coupons:active",
};
```

### 3. Cache Invalidation

**Principle**: Invalidate related cache entries on data changes

```typescript
// Pattern-based invalidation
async invalidatePattern(pattern: string): Promise<void> {
  const regex = new RegExp(pattern.replace(/\*/g, ".*"));
  for (const key of Array.from(this.cache.keys())) {
    if (regex.test(key)) {
      this.cache.delete(key);
    }
  }
}

// Usage: Invalidate all restaurant-related cache
await cache.invalidatePattern("restaurant:*");
```

### 4. Database Schema Design

**Principle**: Use enums for finite value sets, proper indexing

```typescript
// Enums for type safety and database constraints
export const userRoleEnum = pgEnum("user_role", [
  "customer",
  "restaurant_owner",
  "delivery_partner",
  "admin"
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "confirmed",
  "preparing",
  "ready_for_pickup",
  "out_for_delivery",
  "delivered",
  "cancelled"
]);

// Table with proper indexes
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull().references(() => users.id),
  restaurantId: varchar("restaurant_id").notNull().references(() => restaurants.id),
  status: orderStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_orders_customer").on(table.customerId),
  index("idx_orders_restaurant").on(table.restaurantId),
  index("idx_orders_status").on(table.status),
  index("idx_orders_created").on(table.createdAt),
]);
```

---

## API Design

### 1. RESTful Conventions

```typescript
// Resource naming (plural nouns)
GET    /api/restaurants           // List all
GET    /api/restaurants/:id       // Get one
POST   /api/restaurants           // Create
PUT    /api/restaurants/:id       // Update
DELETE /api/restaurants/:id       // Delete

// Nested resources
GET    /api/restaurants/:id/menu  // Get restaurant's menu

// Actions (when REST doesn't fit)
POST   /api/orders/:id/confirm    // Confirm order
POST   /api/orders/:id/cancel     // Cancel order
```

### 2. Consistent Response Format

```typescript
// Success response
{
  "success": true,
  "data": { ... }
}

// Error response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ]
  }
}

// List response with pagination
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "hasMore": true
  }
}
```

### 3. Correlation ID for Request Tracing

**Principle**: Track requests across distributed services

```typescript
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  // Accept from client or generate new
  const correlationId = 
    (req.headers["x-correlation-id"] as string) || 
    randomUUID();

  const requestId = randomUUID();

  // Attach to request
  req.correlationId = correlationId;
  req.requestId = requestId;

  // Return in response headers
  res.setHeader("x-correlation-id", correlationId);
  res.setHeader("x-request-id", requestId);

  // Store in async context for use in services
  const context: CorrelationContext = {
    correlationId,
    requestId,
    startTime: Date.now(),
    userId: (req as any).user?.id,
  };

  correlationStorage.run(context, () => next());
}

// Get correlation ID anywhere in the call stack
export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore()?.correlationId;
}

// Headers to forward to other services
export function getForwardHeaders(): Record<string, string> {
  const context = correlationStorage.getStore();
  return {
    "x-correlation-id": context.correlationId,
    "x-request-id": context.requestId,
    ...(context.userId && { "x-user-id": context.userId }),
  };
}
```

---

## Security Best Practices

### 1. Authentication

**Multi-method authentication:**

```typescript
// Phone OTP Authentication
app.post("/api/auth/otp/request", async (req, res) => {
  const { phone } = req.body;
  const otp = generateOTP();  // 6-digit code
  
  // Store with expiry (rate limited)
  otpStore.set(phone, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });
  
  // Send via SMS service
  await smsService.send(phone, `Your code is: ${otp}`);
});

// Google OAuth with Passport.js
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    const user = await findOrCreateUser({
      googleId: profile.id,
      email: profile.emails?.[0]?.value,
      name: profile.displayName,
    });
    done(null, user);
  }
));
```

### 2. Session Security

```typescript
app.use(
  session({
    store: new pgSession({
      pool: dbPool,
      tableName: "sessions",
    }),
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",  // HTTPS only in prod
      httpOnly: true,                                   // No JS access
      maxAge: 24 * 60 * 60 * 1000,                     // 24 hours
      sameSite: "lax",                                  // CSRF protection
    },
  })
);
```

### 3. Input Validation with Zod

```typescript
import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";

// Auto-generate from Drizzle schema
export const insertUserSchema = createInsertSchema(users);
export const insertOrderSchema = createInsertSchema(orders);

// Custom validation
const createOrderSchema = z.object({
  restaurantId: z.string().uuid(),
  items: z.array(z.object({
    menuItemId: z.string().uuid(),
    quantity: z.number().int().min(1).max(100),
    specialInstructions: z.string().max(500).optional(),
  })).min(1),
  deliveryAddress: z.object({
    street: z.string().min(5).max(200),
    city: z.string().min(2).max(100),
    zipCode: z.string().regex(/^\d{5}(-\d{4})?$/),
  }),
});

// Usage in route
app.post("/api/orders", async (req, res) => {
  const validationResult = createOrderSchema.safeParse(req.body);
  if (!validationResult.success) {
    return res.status(400).json({ 
      error: "Validation failed",
      details: validationResult.error.issues 
    });
  }
  // Proceed with validated data
});
```

### 4. Authorization (RBAC)

```typescript
// Role-based middleware
function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    next();
  };
}

// Usage
app.get("/api/admin/users", requireRole("admin"), getUsers);
app.get("/api/restaurant/orders", requireRole("restaurant_owner", "admin"), getRestaurantOrders);
```

---

## Frontend Best Practices

### 1. State Management

**Server State with TanStack Query:**

```typescript
// Query client configuration
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,           // Don't refetch unless invalidated
      refetchOnWindowFocus: false,   // Manual control
      retry: false,                   // Handle errors explicitly
    },
  },
});

// Custom hook for auth
export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
  };
}
```

**Client State with Zustand:**

```typescript
// Cart store
interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (itemId: string) => void;
  clearCart: () => void;
  getTotal: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  addItem: (item) => set((state) => ({
    items: [...state.items, item]
  })),
  removeItem: (itemId) => set((state) => ({
    items: state.items.filter(i => i.id !== itemId)
  })),
  clearCart: () => set({ items: [] }),
  getTotal: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),
}));
```

### 2. Component Architecture

**Composition over Prop Drilling:**

```typescript
// Context for shared state
const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook for consuming
export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return context;
}
```

### 3. Styling with Tailwind CSS

**Design System Approach:**

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // ... other semantic colors
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
};

// Reusable component with variants
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

### 4. API Request Handling

```typescript
// Centralized API request function
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",  // Include session cookies
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }

  return res;
}

// Type-safe query function
export const getQueryFn: <T>(options: {
  on401: "returnNull" | "throw";
}) => QueryFunction<T> =
  ({ on401 }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/"), { credentials: "include" });

    if (on401 === "returnNull" && res.status === 401) {
      return null;
    }

    if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
    return res.json();
  };
```

---

## Observability

### 1. Structured Logging

```typescript
class Logger {
  private formatLog(entry: LogEntry): string {
    const { level, message, correlationId, service, timestamp, data } = entry;
    const prefix = correlationId ? `[${correlationId}]` : "";
    const dataStr = data ? ` ${JSON.stringify(data)}` : "";
    return `${timestamp} ${level.toUpperCase()} [${service}]${prefix} ${message}${dataStr}`;
  }

  info(message: string, data?: Record<string, unknown>, correlationId?: string) {
    this.log("info", message, data, correlationId);
  }

  // Log levels: debug, info, warn, error
}

// Usage
logger.info("Order created", { orderId, customerId }, correlationId);
// Output: 2024-12-07T10:30:00.000Z INFO [OrderService][abc-123] Order created {"orderId":"ord-1","customerId":"user-1"}
```

### 2. Metrics Collection

```typescript
class MetricsCollector {
  // Counter - only increases
  increment(name: string, value: number = 1, labels: Record<string, string> = {}): void {
    const key = this.buildKey(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + value);
  }

  // Gauge - can increase or decrease
  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    this.gauges.set(this.buildKey(name, labels), value);
  }

  // Histogram - distribution of values
  observe(name: string, value: number, labels: Record<string, string> = {}): void {
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);
  }

  // Timer helper
  startTimer(name: string): Timer {
    const startTime = Date.now();
    return {
      end: () => {
        this.observe(`${name}.duration_ms`, Date.now() - startTime);
      },
    };
  }

  // Request metrics
  recordRequest(method: string, path: string, statusCode: number, durationMs: number): void {
    this.increment("http_requests_total", 1, { method, path, status: statusCode.toString() });
    this.observe("http_request_duration_ms", durationMs, { method, path });
  }
}

// Usage
const timer = metrics.startTimer("order.create");
try {
  await createOrder(data);
  metrics.recordSuccess("order.create");
} catch (error) {
  metrics.recordError("order.create");
} finally {
  timer.end();
}
```

### 3. Health Checks

```typescript
abstract class BaseService {
  abstract checkHealth(): Promise<ServiceHealth>;
}

class OrderService extends BaseService {
  async checkHealth(): Promise<ServiceHealth> {
    const checks: HealthCheck[] = [];

    // Database check
    try {
      const start = Date.now();
      await db.execute(sql`SELECT 1`);
      checks.push({
        name: "database",
        status: "pass",
        responseTime: Date.now() - start,
      });
    } catch (error) {
      checks.push({
        name: "database",
        status: "fail",
        message: error.message,
      });
    }

    // Cache check
    try {
      await cache.set("health-check", "ok", 10);
      const value = await cache.get("health-check");
      checks.push({
        name: "cache",
        status: value === "ok" ? "pass" : "fail",
      });
    } catch (error) {
      checks.push({ name: "cache", status: "fail", message: error.message });
    }

    return {
      status: checks.every(c => c.status === "pass") ? "healthy" : "degraded",
      checks,
      uptime: Date.now() - this.startTime.getTime(),
      timestamp: new Date(),
    };
  }
}
```

---

## Code Organization

### 1. Project Structure

```
project/
├── client/                    # Frontend (React)
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   └── ui/           # Shadcn/ui components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Utilities and helpers
│   │   ├── pages/            # Page components (routes)
│   │   └── App.tsx           # App entry point
│   └── public/               # Static assets
│
├── server/                    # Backend (Node.js)
│   ├── index.ts              # Server entry point
│   ├── routes.ts             # API route definitions
│   ├── db.ts                 # Database connection
│   ├── gateway/              # API gateway components
│   │   ├── circuitBreaker.ts
│   │   ├── correlationId.ts
│   │   └── rateLimiter.ts
│   ├── infrastructure/       # Cross-cutting concerns
│   │   ├── cache.ts
│   │   ├── eventBus.ts
│   │   ├── logger.ts
│   │   └── metrics.ts
│   └── microservices/        # Domain services
│       ├── core/             # Base classes
│       ├── auth/
│       ├── order/
│       ├── restaurant/
│       └── ...
│
├── shared/                    # Shared code
│   └── schema.ts             # Database schema & types
│
└── docs/                      # Documentation
    ├── README.md
    ├── TECHNICAL_ARCHITECTURE.md
    └── BEST_PRACTICES.md
```

### 2. Naming Conventions

```
Files:
- Components: PascalCase.tsx (UserProfile.tsx)
- Hooks: camelCase with use prefix (useAuth.ts)
- Utilities: camelCase.ts (formatDate.ts)
- Services: PascalCase with Service suffix (OrderService.ts)

Variables/Functions:
- camelCase for variables and functions
- PascalCase for classes and types
- SCREAMING_SNAKE_CASE for constants

Types:
- Prefix with I for interfaces when extending (IBaseService)
- Suffix with Type for type aliases (UserType)
- Suffix with Props for component props (ButtonProps)
```

### 3. Import Organization

```typescript
// 1. External libraries
import express from "express";
import { z } from "zod";

// 2. Internal absolute imports
import { db } from "@/db";
import { logger } from "@/infrastructure/logger";

// 3. Relative imports (parent first, then siblings)
import { BaseService } from "../core/BaseService";
import { OrderValidator } from "./validators";

// 4. Types (last)
import type { Order, User } from "@shared/schema";
```

---

## Performance Optimization

### 1. Database Query Optimization

```typescript
// Use indexes for frequently queried columns
export const orders = pgTable("orders", {
  // ...columns
}, (table) => [
  index("idx_orders_customer").on(table.customerId),
  index("idx_orders_status").on(table.status),
  index("idx_orders_created").on(table.createdAt),
]);

// Select only needed columns
const orderSummary = await db
  .select({
    id: orders.id,
    status: orders.status,
    total: orders.totalAmount,
  })
  .from(orders)
  .where(eq(orders.customerId, userId));

// Use pagination
const page = await db
  .select()
  .from(orders)
  .limit(20)
  .offset((pageNumber - 1) * 20);
```

### 2. Caching Strategy

```typescript
// Cache with appropriate TTLs
const TTL = {
  RESTAURANTS: 300,      // 5 minutes - changes rarely
  MENU: 60,              // 1 minute - can change more often
  ACTIVE_ORDERS: 10,     // 10 seconds - changes frequently
  USER_PROFILE: 300,     // 5 minutes
};

// Cache-aside pattern
const restaurants = await cache.getOrSet(
  CacheKeys.restaurants(),
  () => db.select().from(restaurantsTable),
  TTL.RESTAURANTS
);

// Invalidate on write
async function updateRestaurant(id: string, data: UpdateData) {
  await db.update(restaurantsTable).set(data).where(eq(restaurantsTable.id, id));
  await cache.invalidate(CacheKeys.restaurant(id));
  await cache.invalidate(CacheKeys.restaurants());
}
```

### 3. Frontend Performance

```typescript
// Lazy loading for code splitting
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const RestaurantDashboard = lazy(() => import("./pages/RestaurantDashboard"));

// Usage with Suspense
<Suspense fallback={<Loading />}>
  <Switch>
    <Route path="/admin" component={AdminDashboard} />
    <Route path="/restaurant" component={RestaurantDashboard} />
  </Switch>
</Suspense>

// Memoization for expensive computations
const sortedItems = useMemo(() => {
  return items.sort((a, b) => b.rating - a.rating);
}, [items]);

// Callback memoization
const handleSubmit = useCallback(async (data: FormData) => {
  await submitOrder(data);
}, [submitOrder]);
```

---

## Error Handling

### 1. Backend Error Handling

```typescript
// Custom error classes
class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

class ValidationError extends AppError {
  constructor(message: string, public details?: any) {
    super(400, message, "VALIDATION_ERROR");
  }
}

class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found`, "NOT_FOUND");
  }
}

// Global error handler middleware
function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  logger.error("Request error", {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  }, req.correlationId);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      details: (err as ValidationError).details,
    });
  }

  // Don't leak internal errors
  res.status(500).json({
    error: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
  });
}

// Usage
app.get("/api/orders/:id", async (req, res, next) => {
  try {
    const order = await orderService.findById(req.params.id);
    if (!order) {
      throw new NotFoundError("Order");
    }
    res.json(order);
  } catch (error) {
    next(error);  // Pass to error handler
  }
});
```

### 2. Frontend Error Handling

```typescript
// Error boundary
class ErrorBoundary extends React.Component<Props, State> {
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("UI Error:", error, errorInfo);
    // Send to error tracking service
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

// API error handling
async function apiRequest(method: string, url: string, data?: unknown) {
  try {
    const res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || res.statusText);
    }

    return res.json();
  } catch (error) {
    // Log error
    console.error(`API Error [${method} ${url}]:`, error);
    throw error;
  }
}

// Toast notifications for user feedback
function useApiMutation() {
  const { toast } = useToast();

  return useMutation({
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Operation completed successfully",
      });
    },
  });
}
```

---

## Summary

This guide covers the key best practices implemented in FoodDash:

| Category | Key Patterns |
|----------|--------------|
| Architecture | Microservices, Hexagonal, Event-Driven |
| Resilience | Circuit Breaker, Retry, Timeout, Rate Limiting |
| Data | Cache-Aside, Consistent Keys, Schema Validation |
| API | REST conventions, Correlation IDs, Structured Responses |
| Security | Multi-auth, Session Security, RBAC, Input Validation |
| Frontend | React Query, Zustand, Component Composition |
| Observability | Structured Logging, Metrics, Health Checks |
| Code | Consistent Structure, Naming Conventions |
| Performance | Caching, Lazy Loading, Query Optimization |
| Errors | Custom Errors, Global Handlers, User Feedback |

Follow these practices to maintain code quality, reliability, and scalability across the platform.

---

*Last Updated: December 7, 2025*
