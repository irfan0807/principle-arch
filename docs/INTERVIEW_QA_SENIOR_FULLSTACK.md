# FoodDash — Senior Fullstack Engineer Interview Q&A Guide

## For 6+ Years Experience | React.js · Node.js · JavaScript · Redux · System Design

> **Project**: FoodDash — Production-Grade Food Delivery Platform  
> **Stack**: TypeScript (Full-Stack), React 18, Express.js, PostgreSQL, Drizzle ORM, Redux Toolkit  
> **Architecture**: Microservices + Event-Driven + CQRS + Saga Pattern  
> **Last Updated**: February 2026

---

## Table of Contents

1. [JavaScript — Advanced Concepts](#1-javascript--advanced-concepts)
2. [React.js — Architecture & Patterns](#2-reactjs--architecture--patterns)
3. [Redux & State Management](#3-redux--state-management)
4. [Node.js & Express — Backend Architecture](#4-nodejs--express--backend-architecture)
5. [TypeScript — Full-Stack Type Safety](#5-typescript--full-stack-type-safety)
6. [System Design — Architecture Decisions](#6-system-design--architecture-decisions)
7. [Microservices & Event-Driven Architecture](#7-microservices--event-driven-architecture)
8. [Database Design & ORM](#8-database-design--orm)
9. [Caching & Performance](#9-caching--performance)
10. [Security & Authentication](#10-security--authentication)
11. [Resilience Patterns](#11-resilience-patterns)
12. [Real-Time Communication](#12-real-time-communication)
13. [Testing & Quality Assurance](#13-testing--quality-assurance)
14. [DevOps, CI/CD & Deployment](#14-devops-cicd--deployment)
15. [Scenario-Based Questions](#15-scenario-based-questions)
16. [Behavioral & Leadership Questions](#16-behavioral--leadership-questions)

---

## 1. JavaScript — Advanced Concepts

### Q1.1: How does `AsyncLocalStorage` work, and why is it used for correlation ID tracking in this project?

**Answer:**

`AsyncLocalStorage` (from Node.js `async_hooks` module) provides a store that follows the entire async call chain without explicitly passing context. In FoodDash, it's used for correlation ID propagation:

```typescript
const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

// Middleware creates context
correlationStorage.run({ correlationId, requestId, startTime, userId }, () => next());

// Anywhere in the async chain — no parameter passing needed
export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore()?.correlationId;
}
```

**Why this matters:**
- Eliminates "context drilling" — no need to pass `correlationId` through every function signature
- Works across `async/await`, Promises, `setTimeout`, event emitters
- Thread-safe equivalent for Node.js single-threaded event loop
- Essential for distributed tracing — every log, metric, and inter-service call carries the same correlation ID

**Follow-up — What are the performance implications?**
`AsyncLocalStorage` adds minimal overhead (~2-5%) using Node.js's internal `async_hooks`. The tradeoff is acceptable because observability in production is non-negotiable for debugging distributed failures.

---

### Q1.2: Explain the event loop implications of the `Promise.race` timeout pattern used in the `BaseService`.

**Answer:**

```typescript
private async withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    operation,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}
```

**Key nuances:**
1. **`Promise.race` settles with the first Promise** — if timeout wins, the rejection propagates immediately
2. **The original operation keeps running** — `Promise.race` doesn't cancel the losing Promise. The DB query or HTTP call still completes, just its result is ignored
3. **Memory leak risk** — the `setTimeout` reference keeps the timer alive even if the operation completes first. In a high-throughput system, you'd add `clearTimeout` cleanup:

```typescript
// Improved version
private async withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout`)), timeoutMs);
  });
  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}
```

4. **Event loop impact** — `setTimeout` is a macrotask. If the event loop is saturated with microtasks (Promises), the timeout may fire later than expected

---

### Q1.3: What are closures, and where are they leveraged in this codebase?

**Answer:**

A closure is a function that retains access to variables from its lexical scope even after the outer function has returned.

**FoodDash examples:**

1. **Rate Limiter Factory** — the `middleware()` method returns a closure over the rate limiter's `store` and `options`:
```typescript
class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  middleware() {
    return (req, res, next) => {
      // Closure over `this.store` and `this.options`
      const key = this.options.keyGenerator(req);
      let entry = this.store.get(key);
      // ...
    };
  }
}
```

2. **Query Function Factory** — `getQueryFn` returns a closure over the `on401` behavior:
```typescript
export const getQueryFn = ({ on401 }) => async ({ queryKey }) => {
  // Closure over `on401` from outer scope
  if (on401 === "returnNull" && res.status === 401) return null;
};
```

3. **Circuit Breaker** — the `execute` method captures `fallback` in its closure for the catch block

**Why closures matter at senior level:**
- They enable the Factory and Strategy patterns without explicit class hierarchies
- They're the foundation for middleware chains in Express
- Memory implications — closures retain references to outer variables, which can prevent garbage collection if not managed

---

### Q1.4: Explain the difference between `Map` and plain objects. Why does the codebase use `Map` extensively?

**Answer:**

The codebase uses `Map` for runtime data stores (cache, rate limiter, WebSocket clients, event subscriptions):

```typescript
// WebSocket connection tracking
const clients = new Map<string, Set<WebSocket>>();

// Rate limiter store
private store: Map<string, RateLimitEntry> = new Map();

// Cache entries
private cache: Map<string, CacheEntry<any>> = new Map();
```

**Why `Map` over plain objects:**

| Feature | `Map` | Plain Object |
|---------|-------|-------------|
| Key types | Any type (strings, objects, functions) | Strings/Symbols only |
| Iteration order | Insertion order guaranteed | Not guaranteed (though engines do) |
| Size | `map.size` O(1) | `Object.keys(obj).length` O(n) |
| Performance | Optimized for frequent add/delete | Optimized for static lookup |
| Prototype pollution | Not vulnerable | Vulnerable (`__proto__`, `constructor`) |
| Serialization | Not JSON-serializable | JSON-serializable |

**FoodDash-specific reason:** The cache and rate limiter frequently add/delete entries (TTL expiration, cleanup). `Map` has O(1) delete vs potential deoptimization in V8 when deleting object properties repeatedly.

---

### Q1.5: How does `const` with `as const` work for the `EventTypes` definition? What does it buy you?

**Answer:**

```typescript
export const EventTypes = {
  ORDER_CREATED: "order.created",
  ORDER_CONFIRMED: "order.confirmed",
  // ...
} as const;
```

Without `as const`, TypeScript infers `EventTypes.ORDER_CREATED` as `string`. With `as const`:
- Every value is a **literal type**: `"order.created"`, not `string`
- The entire object is **readonly** (deeply frozen at the type level)
- Enables **discriminated union patterns** — you can use the literal types in switch/case exhaustiveness checks

**Practical benefit in FoodDash:** When subscribing to events, `eventBus.subscribe(EventTypes.ORDER_CREATED, handler)` ensures the handler receives correctly typed payloads. Typos like `"order.craeted"` would be caught at compile time.

---

## 2. React.js — Architecture & Patterns

### Q2.1: Explain the three-layer state management strategy. Why not just use Redux for everything?

**Answer:**

FoodDash uses three layers because different state has different lifetimes and characteristics:

| Layer | Technology | What It Manages | Why |
|-------|-----------|----------------|-----|
| **Server State** | React Query (TanStack Query) | API responses (restaurants, orders, user data) | Auto-caching, background refetching, deduplication, stale-while-revalidate |
| **Global Client State** | Redux Toolkit + redux-persist | Auth state, Cart state | Predictable updates, DevTools, survives page refresh |
| **Local UI State** | `useState`, Zustand | Modals, tooltips, form state, theme | Ephemeral, component-scoped |

**Why not Redux for everything?**

1. **Server state is fundamentally different** — it's async, cacheable, has TTLs, needs background refetching, and requires deduplication. Redux requires writing boilerplate (thunks, loading states, error states) for each API call. React Query handles all this declaratively:
```typescript
// React Query — 3 lines, handles loading/error/caching automatically
const { data, isLoading } = useQuery({ queryKey: ["/api/restaurants"] });

// Redux equivalent — 30+ lines: action types, thunk, reducer cases, selectors
```

2. **Performance** — Redux re-renders all connected components on any state change (unless using `reselect`). React Query only re-renders components subscribed to the specific query key that changed.

3. **Cart state DOES need Redux** — it must persist across page refreshes (`redux-persist`), needs predictable state transitions (add/remove/update quantity), and benefits from Redux DevTools for debugging.

---

### Q2.2: How does the `AuthInitializer` component work, and why is it a separate component?

**Answer:**

```typescript
// AuthInitializer.tsx — dispatches fetchUser on mount
function AuthInitializer() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(fetchUser());
  }, [dispatch]);
  return null; // Renders nothing
}
```

**Why separate?**
1. **Separation of Concerns** — authentication initialization is a side effect, not a UI concern. Embedding it in `App.tsx` would mix rendering logic with auth bootstrapping
2. **Single Responsibility** — if auth logic changes (e.g., adding token refresh), only this component changes
3. **Render-free** — returns `null`, so it has zero DOM impact. It's purely a side-effect orchestrator
4. **Redux lifecycle** — it bridges the gap between app mount and Redux state initialization. Without it, components would render without user data, potentially flashing unauthenticated UI

**Pattern name:** This is the **Initializer Component** pattern — a component whose sole purpose is executing side effects on mount.

---

### Q2.3: Why was Wouter chosen over React Router? What are the tradeoffs?

**Answer:**

| Aspect | Wouter (2KB) | React Router (15KB+) |
|--------|-------------|---------------------|
| Bundle size | ~2KB gzipped | ~15KB gzipped |
| API surface | Minimal (`Route`, `Switch`, `Link`, `useLocation`) | Extensive (loaders, actions, nested routes, data APIs) |
| Data loading | Not included (use React Query) | Built-in loaders/actions (v6.4+) |
| Nested routing | Manual | First-class |
| SSR support | Basic | Full |

**Why Wouter for FoodDash:**
- The app is a **client-side SPA** — no SSR needed
- Data loading is handled by **React Query** — no need for React Router's loaders
- Route structure is **flat** (11 routes, no deep nesting)
- **7.5x smaller bundle** for the same functionality

**Tradeoff accepted:** If FoodDash needed server-side rendering or complex nested layouts, React Router would be the better choice.

---

### Q2.4: How do you handle protected routes in this application?

**Answer:**

```typescript
// ProtectedRoute.tsx — Redux-based route protection
function ProtectedRoute({ children, allowedRoles }: Props) {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const user = useAppSelector(selectUser);
  const isLoading = useAppSelector(selectIsLoading);

  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <Redirect to="/sign-in" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Redirect to="/home" />;

  return children;
}
```

**Design decisions:**
1. **Loading state** — prevents flash of login page while `fetchUser` is in-flight
2. **Role-based** — `allowedRoles` prop enables route-level authorization (`admin`, `restaurant_owner`)
3. **Redux-driven** — uses Redux selectors, ensuring consistent auth state across the app
4. **Client-side only** — this is a UX guard, not a security boundary. True authorization happens server-side via `requireRole()` middleware

---

### Q2.5: Explain the Provider nesting order in the App component. Does order matter?

**Answer:**

```tsx
<Provider store={store}>             {/* 1. Redux store */}
  <PersistGate loading={null} persistor={persistor}>  {/* 2. Rehydrate persisted state */}
    <ThemeProvider>                   {/* 3. Theme context */}
      <AuthInitializer />            {/* 4. Fetch user */}
      <QueryClientProvider client={queryClient}>  {/* 5. React Query */}
        <TooltipProvider>            {/* 6. UI primitives */}
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </PersistGate>
</Provider>
```

**Yes, order matters critically:**

1. **Redux Provider first** — `AuthInitializer` needs `useAppDispatch`, so Redux must wrap it
2. **PersistGate before AuthInitializer** — cart state must be rehydrated before any component reads it
3. **AuthInitializer before QueryClientProvider** — user data should start loading before queries fire (some queries depend on auth)
4. **QueryClientProvider wraps Router** — page components use `useQuery`, so the client must be available
5. **TooltipProvider innermost** — it's a UI utility with no dependencies on the above

**Common mistake:** Placing `QueryClientProvider` outside `Provider` — then React Query's `queryFn` can't access Redux state for auth tokens.

---

### Q2.6: How does the `useAuth` custom hook work? What patterns does it demonstrate?

**Answer:**

```typescript
export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    error,
  };
}
```

**Patterns demonstrated:**
1. **Custom Hook Pattern** — encapsulates React Query configuration into a reusable interface
2. **Derived State** — `isAuthenticated` is computed from `user` existence, not stored separately
3. **Null-safe default** — `user ?? null` ensures consistent return type
4. **No retry on 401** — `retry: false` prevents infinite retry loops when not logged in

**Why `retry: false` for auth?** If the user is not authenticated, retrying `/api/auth/user` will keep getting 401. The default React Query retry (3 times with backoff) would delay the sign-in redirect by several seconds.

---

## 3. Redux & State Management

### Q3.1: Walk through the Redux store configuration. Why are specific middleware customizations needed?

**Answer:**

```typescript
export const store = configureStore({
  reducer: {
    cart: persistedCartReducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
});
```

**Why `serializableCheck` customization?**

Redux Toolkit includes a serializable state invariant middleware by default — it warns if non-serializable values (functions, Promises, class instances) appear in actions or state. `redux-persist` dispatches `persist/PERSIST` and `persist/REHYDRATE` actions that contain non-serializable internal metadata (register/rehydrate functions). Without this exclusion, you'd get console warnings on every page load.

**Why not disable `serializableCheck` entirely?**
Because it catches real bugs. If you accidentally put a `Date` object or a function in Redux state, serialization breaks (time-travel debugging, persistence, SSR hydration). Only exclude what you must.

---

### Q3.2: Explain the Cart Slice design. How does `addItem` handle adding items from different restaurants?

**Answer:**

```typescript
const cartSlice = createSlice({
  name: 'cart',
  initialState: { items: [], restaurantId: null, restaurantName: null },
  reducers: {
    addItem: (state, action: PayloadAction<{menuItem, restaurantId, restaurantName}>) => {
      const { menuItem, restaurantId, restaurantName } = action.payload;
      
      // Clear cart if switching restaurants
      if (state.restaurantId && state.restaurantId !== restaurantId) {
        state.items = [];
      }
      
      state.restaurantId = restaurantId;
      state.restaurantName = restaurantName;
      
      // Check if item already exists
      const existing = state.items.find(item => item.id === menuItem.id);
      if (existing) {
        existing.quantity += 1;
      } else {
        state.items.push({ ...menuItem, quantity: 1 });
      }
    },
  },
});
```

**Key design decisions:**

1. **Single-restaurant constraint** — Cart clears when switching restaurants because a food delivery order can only be from one restaurant (logistics constraint — one rider, one pickup location)
2. **Immer under the hood** — Redux Toolkit uses Immer, so `state.items = []` is safe (it looks like mutation but creates a new immutable state)
3. **Upsert pattern** — `find` + increment vs push new. Prevents duplicate entries
4. **Persistence** — This slice is wrapped with `persistReducer`, so cart survives page refresh. The `restaurantId` and `restaurantName` persist too, ensuring the cart page can display restaurant info without re-fetching

---

### Q3.3: How does `createAsyncThunk` work for the `fetchUser` and `signOutUser` actions?

**Answer:**

```typescript
export const fetchUser = createAsyncThunk('auth/fetchUser', async () => {
  const response = await fetch('/api/auth/user', { credentials: 'include' });
  if (!response.ok) throw new Error('Not authenticated');
  return response.json();
});

export const signOutUser = createAsyncThunk('auth/signOut', async () => {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
});
```

**`createAsyncThunk` generates three action types automatically:**
- `auth/fetchUser/pending` → sets `isLoading: true`
- `auth/fetchUser/fulfilled` → sets `user`, `isAuthenticated: true`, `isLoading: false`
- `auth/fetchUser/rejected` → sets `user: null`, `isAuthenticated: false`, `isLoading: false`

**Handled in `extraReducers`:**
```typescript
extraReducers: (builder) => {
  builder
    .addCase(fetchUser.pending, (state) => { state.isLoading = true; })
    .addCase(fetchUser.fulfilled, (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.isLoading = false;
    })
    .addCase(fetchUser.rejected, (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.isLoading = false;
    });
}
```

**Why `createAsyncThunk` over manual dispatch?**
- Automatic action type generation (no string constants)
- Built-in `AbortController` support for cancellation
- Lifecycle actions (pending/fulfilled/rejected) standardize async handling
- `condition` option can prevent duplicate requests
- `unwrapResult` allows try/catch on the caller side

---

### Q3.4: What are Redux selectors, and how do they optimize performance?

**Answer:**

```typescript
// Simple selectors
export const selectCartItems = (state: RootState) => state.cart.items;
export const selectCartRestaurantId = (state: RootState) => state.cart.restaurantId;

// Computed selector
export const selectCartTotal = (state: RootState) =>
  state.cart.items.reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0);

export const selectCartItemCount = (state: RootState) =>
  state.cart.items.reduce((sum, item) => sum + item.quantity, 0);
```

**Performance optimization:**
- `useAppSelector(selectCartItems)` only re-renders the component when `state.cart.items` reference changes (shallow equality by default)
- If auth state changes, components using only cart selectors don't re-render

**For 6+ years — when would you use `createSelector` (reselect)?**

When selectors compute derived data:
```typescript
import { createSelector } from '@reduxjs/toolkit';

const selectCartTotal = createSelector(
  [selectCartItems],
  (items) => items.reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0)
);
```
`createSelector` memoizes — if `items` reference hasn't changed, it returns the cached result without recalculating. Critical when the computation is expensive or the selector is used in many components.

---

### Q3.5: Compare the migration from Zustand to Redux Toolkit. What were the tradeoffs?

**Answer:**

**Before (Zustand):**
```typescript
const useCartStore = create<CartStore>()(
  persist((set, get) => ({
    items: [],
    addItem: (item) => set((state) => ({ items: [...state.items, item] })),
    getTotal: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  }), { name: 'cart-storage' })
);
```

**After (Redux Toolkit):**
```typescript
const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addItem: (state, action) => { /* Immer-based mutation */ },
  },
});
```

| Aspect | Zustand | Redux Toolkit |
|--------|---------|--------------|
| Boilerplate | Minimal (~20 lines) | Moderate (~50 lines) |
| DevTools | Plugin needed | Built-in |
| Middleware | Manual | `configureStore` built-in |
| Persistence | `persist` middleware | `redux-persist` |
| Async | Direct in store | `createAsyncThunk` |
| Type inference | Simpler | More setup (`RootState`, `AppDispatch`) |
| Scalability | Good for isolated stores | Better for cross-cutting state |
| Debugging | Limited | Time-travel, action replay |

**Why migrate?**
The project needed **unified state management** — auth and cart state were in different systems (React Context + Zustand). Redux provides a single store with unified DevTools, making debugging cross-cutting concerns (e.g., "clear cart on logout") much easier.

---

## 4. Node.js & Express — Backend Architecture

### Q4.1: Explain the Express middleware chain order. Why does it matter?

**Answer:**

```
1. express.json() with raw body capture
2. express.urlencoded()
3. Request logging middleware
4. Custom auth setup (session, passport, Keycloak)
5. Microservices API router mount
6. Route registration (REST + WebSocket)
7. Error handler (structured logging)
8. Static file serving / Vite dev server
```

**Order is critical:**

1. **Body parsing before auth** — passport needs to read `req.body` for login
2. **Auth before routes** — `req.user` must be populated before route handlers check it
3. **Rate limiting before handlers** — reject overload before doing expensive work
4. **Error handler after routes** — catches all `next(error)` calls from handlers
5. **Static serving last** — serves SPA fallback only if no API route matched

**Raw body capture deserves attention:**
```typescript
express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
})
```
PayPal/Stripe webhooks require the raw (unparsed) body to verify HMAC signatures. If you parse JSON first and then `JSON.stringify` again, whitespace/encoding differences break signature verification.

---

### Q4.2: How does the Repository Pattern (`IStorage` interface) work, and why is it important?

**Answer:**

```typescript
export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getRestaurants(): Promise<Restaurant[]>;
  searchRestaurants(query: string, filters?: Filters): Promise<Restaurant[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  // 40+ methods across 13 domain aggregates
}

class DatabaseStorage implements IStorage {
  async getUser(id: string) {
    return db.select().from(users).where(eq(users.id, id)).then(r => r[0]);
  }
  // ... concrete implementations
}

export const storage: IStorage = new DatabaseStorage();
```

**Benefits:**
1. **Testability** — mock `IStorage` for unit tests without touching the database
2. **Swappability** — replace `DatabaseStorage` with `InMemoryStorage` for integration tests
3. **Encapsulation** — query logic (joins, filters, pagination) is hidden from route handlers
4. **Dependency Inversion (SOLID 'D')** — route handlers depend on the abstraction, not PostgreSQL specifics

**Follow-up — What's the `upsert` pattern?**
```typescript
async upsertUser(user: UpsertUser): Promise<User> {
  const [result] = await db
    .insert(users)
    .values(user)
    .onConflictDoUpdate({
      target: users.email,
      set: { firstName: user.firstName, lastName: user.lastName, updatedAt: new Date() },
    })
    .returning();
  return result;
}
```
This makes user creation idempotent — Google OAuth callbacks may fire multiple times, but the user is only created once.

---

### Q4.3: How is the WebSocket server integrated with the Express HTTP server?

**Answer:**

```typescript
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
const clients = new Map<string, Set<WebSocket>>();

// Per-user connection tracking (supports multiple tabs/devices)
wss.on("connection", (ws, req) => {
  const userId = new URL(req.url, `http://${req.headers.host}`).searchParams.get("userId");
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(ws);
  
  ws.on("close", () => {
    clients.get(userId)?.delete(ws);
    if (clients.get(userId)?.size === 0) clients.delete(userId);
  });
});
```

**Key design decisions:**
1. **Shared HTTP server** — WebSocket upgrades happen on the same port (5000), no CORS issues
2. **`Map<string, Set<WebSocket>>`** — supports multiple connections per user (multiple browser tabs)
3. **Event-driven broadcasts** — EventBus events trigger WebSocket pushes:
```typescript
eventBus.subscribe(EventTypes.ORDER_STATUS_CHANGED, (data) => {
  broadcastToUser(data.customerId, { type: "order_update", data });
  broadcastToUser(data.restaurantOwnerId, { type: "order_update", data });
});
```
4. **Cleanup on disconnect** — prevents memory leaks by removing closed connections

---

### Q4.4: Explain the rate limiting strategy. Why three different rate limiters?

**Answer:**

```typescript
const apiRateLimiter = new RateLimiter({ windowMs: 60_000, maxRequests: 100 });     // 100/min
const authRateLimiter = new RateLimiter({ windowMs: 15 * 60_000, maxRequests: 10 }); // 10/15min
const orderRateLimiter = new RateLimiter({ windowMs: 60_000, maxRequests: 10 });     // 10/min
```

**Why three tiers?**

| Limiter | Why | Attack Vector |
|---------|-----|--------------|
| API (100/min) | General abuse protection | Scrapers, DDoS |
| Auth (10/15min) | Brute force prevention | Password guessing, OTP bruteforce |
| Order (10/min) | Fraud prevention | Automated fake orders |

**Implementation — Sliding Window Counter:**
- Per-IP tracking using `Map<string, { count, resetAt }>`
- Returns `429 Too Many Requests` with `Retry-After` header
- Sets `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers
- Auto-cleanup every 60 seconds to prevent memory leaks

**Bulkhead Pattern connection:** Different rate limiters per domain act as **bulkheads** — if the order endpoint is being attacked, API and auth endpoints remain available.

---

### Q4.5: How does the error handling middleware work? What's the production vs development difference?

**Answer:**

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

  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    error: err.message,
    code: err.code,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});
```

**Production safeguards:**
1. **Stack traces hidden** — `stack` only included in development. Stack traces reveal file paths, framework versions, and internal logic
2. **Structured logging** — every error has correlation ID, path, method for debugging
3. **Metrics** — `api.errors` counter enables alerting (PagerDuty, Datadog)
4. **Status code propagation** — custom errors with `statusCode` property propagate correctly; unknown errors default to 500

**Custom error hierarchy:**
```typescript
class AppError extends Error { constructor(statusCode, message, code) }
class ValidationError extends AppError { constructor(message, details) → 400 }
class NotFoundError extends AppError { constructor(resource) → 404 }
class UnauthorizedError extends AppError → 401
class ForbiddenError extends AppError → 403
```

---

## 5. TypeScript — Full-Stack Type Safety

### Q5.1: How does Drizzle ORM achieve end-to-end type safety from database schema to API response?

**Answer:**

```typescript
// 1. Schema definition (shared/schema.ts)
export const restaurants = pgTable("restaurants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  cuisine: varchar("cuisine").notNull(),
  rating: decimal("rating", { precision: 2, scale: 1 }),
});

// 2. Auto-inferred SELECT type
export type Restaurant = typeof restaurants.$inferSelect;
// Result: { id: string; name: string; cuisine: string; rating: string | null; ... }

// 3. Auto-generated Zod validation schema
export const insertRestaurantSchema = createInsertSchema(restaurants)
  .omit({ id: true, createdAt: true, updatedAt: true });

// 4. Inferred INSERT type
export type InsertRestaurant = z.infer<typeof insertRestaurantSchema>;

// 5. Used in route handler — full type safety
app.post("/api/restaurants", async (req, res) => {
  const parsed = insertRestaurantSchema.safeParse(req.body);  // Runtime validation
  if (!parsed.success) return res.status(400).json(parsed.error);
  const restaurant: Restaurant = await storage.createRestaurant(parsed.data); // Type-safe
  res.json(restaurant);
});
```

**The chain:** PostgreSQL schema → Drizzle table → TypeScript type → Zod validator → Route handler → API response. Any schema change propagates type errors across the entire stack at compile time.

---

### Q5.2: What is the `typeof store.getState` pattern for Redux type inference?

**Answer:**

```typescript
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
```

**Why this pattern?**
- `RootState` is **inferred from the store**, not manually defined. Adding a new slice automatically updates `RootState`
- `AppDispatch` includes thunk dispatch types (`ThunkDispatch`), so `dispatch(fetchUser())` is type-safe
- `useAppDispatch` and `useAppSelector` are pre-typed — components don't need to import `RootState` or cast types

---

## 6. System Design — Architecture Decisions

### Q6.1: Why was a modular monolith chosen over pure microservices?

**Answer:**

**Decision:** Deploy as a single Express process, but internally structure as independent microservices.

**Reasons:**
1. **Avoid premature distribution** — distributed systems add: network latency, partial failures, eventual consistency, service mesh, container orchestration, distributed tracing infrastructure
2. **Clean boundaries maintained** — each service has its own class, health checks, and communicates via the event bus
3. **Extraction-ready** — any service can be pulled into its own process because:
   - It extends `BaseService` (standard interface)
   - It communicates via `EventBus` (swap with Kafka/RabbitMQ)
   - It registers with `ServiceRegistry` (add network discovery)
4. **Shared infrastructure** — all services share `pg.Pool`, `cache`, `eventBus`, reducing operational complexity

**When to extract:**
- When a single service needs independent scaling (e.g., `OrderService` handles 10x more load)
- When team structure demands independent deployment
- When different services need different technology stacks

**Interview talking point:** *"We follow the 'monolith first' principle. Internal microservice boundaries let us evolve toward distribution when scaling demands it, without the day-one operational tax."*

---

### Q6.2: Design the order placement flow. How do you ensure consistency across multiple services?

**Answer:**

**The Saga Pattern (Orchestration-based):**

```
Customer → OrderService.createOrder()
              │
              ├── Step 1: validate_order
              │     ✓ Check restaurant is active
              │     ✓ Validate menu items exist
              │     ✗ Compensate: nothing (read-only)
              │
              ├── Step 2: create_order
              │     ✓ Persist order to DB + event log
              │     ✗ Compensate: cancel order, set status "cancelled"
              │
              ├── Step 3: process_payment
              │     ✓ Charge customer via PayPal
              │     ✗ Compensate: refund payment
              │
              └── Step 4: notify_restaurant
                    ✓ Send push notification
                    ✗ Compensate: send cancellation notice
```

**If Step 3 (payment) fails:**
1. Step 3 is marked failed
2. Step 2 compensated → order cancelled
3. Step 1 compensated → no-op
4. Customer receives "Order failed, please retry"

**Idempotency guarantee:**
```typescript
// Order creation checks idempotency key first
const existing = idempotencyStore.get(command.idempotencyKey);
if (existing) return existing; // Return same result for duplicate request
```

**Why Saga over 2PC (Two-Phase Commit)?**
- 2PC blocks all participants until commit/abort — terrible for availability
- Saga allows each step to complete independently with compensation on failure
- 2PC requires distributed locks — Saga uses eventual consistency

---

### Q6.3: How would you scale this system to handle 100x current load?

**Answer:**

| Component | Current | At 100x Scale |
|-----------|---------|--------------|
| **API Server** | Single Express process | 10+ stateless instances behind ALB |
| **Database** | Single PostgreSQL | Primary + 3 read replicas, connection pooling (PgBouncer) |
| **Event Bus** | In-memory pub/sub | Apache Kafka (partitioned by orderId for ordering) |
| **Cache** | In-memory L1 | Redis Cluster (6 nodes, 3 shards) |
| **WebSocket** | In-process Map | Redis pub/sub for cross-node broadcasting |
| **Message Queue** | In-memory | RabbitMQ (durable queues, consumer groups) |
| **Search** | In-memory filtering | Elasticsearch cluster |
| **Monitoring** | Console logging | ELK Stack + Grafana + Jaeger |
| **Services** | In-process modules | Kubernetes pods (horizontal autoscaling) |

**Key scaling steps:**
1. **Stateless servers** — sessions already in PostgreSQL, so add instances behind a load balancer
2. **Database read replicas** — CQRS is already implemented; route queries to replicas
3. **Kafka for events** — partition by `orderId` to maintain event ordering per order
4. **Redis for WebSocket** — use Redis pub/sub to broadcast across server instances
5. **CDN for static assets** — Vite build output served from CloudFront/Cloudflare
6. **Database sharding** — shard `orders` table by `customerId` hash when single primary is insufficient

---

### Q6.4: Explain the CQRS pattern as implemented in the OrderService.

**Answer:**

**CQRS (Command Query Responsibility Segregation)** separates read and write models:

**Command Side (Writes):**
```typescript
createOrder()     → Saga orchestration → Write to DB + Event log
updateStatus()    → State machine validation → Write to DB + Publish event
cancelOrder()     → Compensation → Write to DB + Publish event
```

**Query Side (Reads):**
```typescript
getOrder()            → Cache (1 min TTL) → DB fallback
getOrderWithDetails() → Cache (30s TTL) → Aggregate from orders + orderItems + restaurants
queryOrders()         → Filter + Sort (in-memory for small datasets)
```

**Why CQRS for orders?**
- **Read/write asymmetry** — orders are read 10x more than written (customer checks status repeatedly)
- **Different models** — write model ensures FSM validation; read model joins data for display
- **Cache efficiency** — reads served from cache; writes invalidate cache + publish events
- **Event sourcing** — every write creates an immutable event in `order_events` table, enabling audit trail and event replay

---

### Q6.5: How does the Event Sourcing implementation work for orders?

**Answer:**

Every order state change is recorded as an immutable event:

```
Event 1: { type: "ORDER_CREATED",     data: { orderId, items, total }, timestamp }
Event 2: { type: "ORDER_CONFIRMED",   data: { orderId, restaurantId }, timestamp }
Event 3: { type: "ORDER_PREPARING",   data: { orderId, estimatedTime }, timestamp }
Event 4: { type: "ORDER_READY",       data: { orderId }, timestamp }
Event 5: { type: "ORDER_PICKED_UP",   data: { orderId, riderId }, timestamp }
Event 6: { type: "ORDER_DELIVERED",   data: { orderId, actualTime }, timestamp }
```

**Stored in `order_events` table:**
```sql
CREATE TABLE order_events (
  id VARCHAR PRIMARY KEY,
  orderId VARCHAR REFERENCES orders(id),
  eventType VARCHAR NOT NULL,
  data JSONB NOT NULL,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

**Benefits:**
1. **Complete audit trail** — reconstruct any order's full history
2. **Time-travel debugging** — replay events to reproduce bugs
3. **Analytics** — calculate average time per status transition
4. **Compliance** — immutable log for regulatory requirements
5. **Event replay** — rebuild read models or populate new services from event history

---

## 7. Microservices & Event-Driven Architecture

### Q7.1: How does the Event Bus ensure loose coupling between services?

**Answer:**

```typescript
class EventBus {
  private subscriptions = new Map<string, EventSubscription[]>();
  private eventLog: EventRecord[] = []; // Last 1000 events

  subscribe<T>(eventType: string, handler: (data: T, metadata) => Promise<void>): string;
  publish(eventType: string, data: unknown, correlationId?: string, source?: string): Promise<void>;
}
```

**Loose coupling achieved through:**
1. **Publishers don't know subscribers** — `OrderService` publishes `ORDER_CREATED` without knowing `NotificationService` exists
2. **Subscribers don't know publishers** — `NotificationService` subscribes to `ORDER_CREATED` without importing `OrderService`
3. **New consumers are zero-change** — adding `AnalyticsService` as a subscriber requires no changes to `OrderService`
4. **Error isolation** — a failed subscriber handler doesn't block other subscribers

**42 event types across 8 domains:**
- Order lifecycle (8 events)
- Payment (4 events)
- Rider (3 events)
- Notifications, Restaurant/Menu, User, Service, Coupon

**Production features:**
- **Wildcard subscriptions** — `subscribe("*", handler)` for logging/debugging
- **Event log** — last 1000 events for debugging
- **Correlation ID propagation** — events carry the original request's correlation context

---

### Q7.2: What is the BaseService pattern, and why does every service extend it?

**Answer:**

```typescript
abstract class BaseService {
  protected async executeWithResilience<T>(
    operation: () => Promise<T>,
    operationName: string,
    fallback?: () => Promise<T>
  ): Promise<T> {
    const timer = metrics.startTimer(`${this.config.name}.${operationName}`);
    try {
      const result = await circuitBreaker.execute(
        () => this.withTimeout(this.withRetry(operation, retryAttempts), timeout),
        fallback
      );
      metrics.recordSuccess(`${this.config.name}.${operationName}`);
      return result;
    } catch (error) {
      metrics.recordError(`${this.config.name}.${operationName}`);
      throw error;
    } finally {
      timer.end();
    }
  }
}
```

**Every operation automatically gets:**
- ✅ Circuit breaker protection
- ✅ Retry with exponential backoff + jitter
- ✅ Timeout protection
- ✅ Metrics recording (success/failure/latency)
- ✅ Structured logging

**Design patterns involved:**
- **Template Method** — `executeWithResilience` defines the skeleton; subclasses customize the `operation`
- **Decorator** — resilience wraps around the core operation like nested decorators
- **Abstract Factory** — `checkHealth()` is abstract; each service must implement it

---

### Q7.3: How does the Service Registry enable service discovery?

**Answer:**

```typescript
class ServiceRegistry {
  private static instance: ServiceRegistry; // Singleton
  
  register(instance: ServiceInstance): void;
  deregister(name: string, instanceId: string): void;
  heartbeat(name: string, instanceId: string): void;  // Keep-alive signal
  discover(name: string): ServiceInstance[];            // Find healthy instances
  getInstance(name: string): ServiceInstance;           // Load-balanced selection
}
```

**Load balancing strategies:**
- **Round Robin** — equal distribution across healthy instances
- **Weighted** — health-aware routing (higher success rate → more traffic)

**Health management:**
- Health checks every 30 seconds
- Stale instances (no heartbeat for 90s) auto-evicted
- Status: `healthy`, `degraded`, `unhealthy`

**Currently:** In-process, same-process registration. **At scale:** Replace with Consul/etcd for distributed service discovery.

---

### Q7.4: What is the Anti-Corruption Layer pattern, and how is it used for SAP integration?

**Answer:**

The **Anti-Corruption Layer (ACL)** translates between your domain model and an external system's model, preventing external naming conventions from polluting your codebase.

```typescript
class SAPDataTransformer {
  // SAP → Domain (translate cryptic SAP field names to clean domain names)
  static transformVendor(sapVendor: SAPVendor): Vendor {
    return {
      id: sapVendor.LIFNR,      // Lieferantennummer → vendor ID
      name: sapVendor.NAME1,     // NAME1 → name
      city: sapVendor.ORT01,     // ORT01 → city
    };
  }
  
  // Domain → SAP
  static toSAPVendor(vendor: Partial<Vendor>): Partial<SAPVendor> {
    return {
      NAME1: vendor.name,
      ORT01: vendor.city,
    };
  }
}
```

**Why ACL?**
- SAP uses German abbreviations (`LIFNR`, `MATNR`, `EBELN`) — your domain shouldn't expose these
- SAP RFC calls wrapped with circuit breaker — SAP outages don't cascade to your system
- ACL is the **only** layer that knows about SAP — all other services interact with clean domain types

---

## 8. Database Design & ORM

### Q8.1: Explain the schema design decisions for a food delivery platform.

**Answer:**

**11 tables with key relationships:**
```
users ──┬──< restaurants ──┬──< menu_categories ──< menu_items
        │                  ├──< orders ──┬──< order_items
        │                  │             ├──< order_events
        │                  │             └──── reviews
        │                  └──< coupons
        ├──< delivery_partners ──< orders
        ├──< notifications
        └──── sessions
```

**Key decisions:**

1. **UUID primary keys** (`gen_random_uuid()`) — no sequence contention in distributed systems, no information leakage (sequential IDs reveal order volume)

2. **PostgreSQL enums** for finite value sets:
```typescript
pgEnum("order_status", ["pending", "confirmed", "preparing", ...])
pgEnum("user_role", ["customer", "restaurant_owner", "delivery_partner", "admin"])
```
Enums provide database-level constraint enforcement — invalid status can't be inserted.

3. **Decimal precision** — `decimal(10, 2)` for money (avoids floating-point errors), `decimal(10, 7)` for geo-coordinates (sub-meter precision)

4. **Soft deletes** — `isActive: boolean` instead of `DELETE`. Preserves referential integrity and avoids index fragmentation

5. **Idempotency key** — `orders.idempotencyKey` is `UNIQUE`, preventing duplicate order creation at the database level

---

### Q8.2: How does Drizzle ORM compare to Prisma and TypeORM?

**Answer:**

| Feature | Drizzle | Prisma | TypeORM |
|---------|---------|--------|---------|
| Runtime overhead | Zero (compiles to SQL) | ~8MB runtime (Rust query engine) | Moderate |
| Type inference | From schema definition | From generated client | Decorators |
| Query builder | SQL-like, composable | Proprietary API | QueryBuilder or Active Record |
| Zod integration | First-class (`drizzle-zod`) | Third-party | None |
| Migration | `drizzle-kit push/migrate` | `prisma migrate` | `TypeORM migrations` |
| Relations | Explicit `relations()` | Implicit from schema | Decorators |
| Raw SQL | First-class (`sql` tag) | `$queryRaw` | `query()` |
| Bundle size | ~50KB | ~8MB (engine binary) | ~200KB |

**Why Drizzle for FoodDash:**
1. **Zero runtime** — no Rust engine binary, simpler deployment
2. **`drizzle-zod`** — auto-generate Zod validation schemas from table definitions
3. **SQL-like API** — developers with SQL knowledge are immediately productive
4. **Full TypeScript inference** — `typeof table.$inferSelect` gives the exact row type

---

### Q8.3: How is the Order status transition validated? What pattern is this?

**Answer:**

This is a **Finite State Machine (FSM):**

```typescript
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending:            ["confirmed", "cancelled"],
  confirmed:          ["preparing", "cancelled"],
  preparing:          ["ready_for_pickup", "cancelled"],
  ready_for_pickup:   ["out_for_delivery", "cancelled"],
  out_for_delivery:   ["delivered", "cancelled"],
  delivered:          [],  // terminal
  cancelled:          [],  // terminal
};

function validateTransition(current: OrderStatus, next: OrderStatus): boolean {
  return VALID_TRANSITIONS[current].includes(next);
}
```

**Why FSM?**
- **Prevents invalid transitions** — can't go from "pending" to "delivered" directly
- **Self-documenting** — the transition map IS the documentation
- **Testable** — enumerate all valid/invalid transitions
- **Auditable** — combined with event sourcing, every transition is recorded

---

## 9. Caching & Performance

### Q9.1: Explain the L1/L2 caching strategy. How does it prevent the thundering herd problem?

**Answer:**

```
Read Flow:
  L1 (In-Memory) Hit → Return immediately (~0.1ms)
  L1 Miss → L2 (Redis) Hit → Populate L1, Return (~1-5ms)
  L2 Miss → Database → Populate L1 + L2, Return (~10-50ms)

Write Flow:
  Update DB → Invalidate L1 → Invalidate L2 → Pub/Sub to other nodes
```

**Thundering herd prevention:**
When a popular cache key expires, 100 concurrent requests all see a cache miss and all hit the database simultaneously.

**Solution — Distributed Lock:**
```typescript
async getOrSetWithLock<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = await this.get(key);
  if (cached) return cached;

  // Acquire distributed lock (Redis SETNX)
  const lockKey = `lock:${key}`;
  const acquired = await redis.setnx(lockKey, "1", { EX: 30 });
  
  if (acquired) {
    // Winner fetches from DB
    const value = await fetcher();
    await this.set(key, value);
    await redis.del(lockKey);
    return value;
  } else {
    // Losers wait and retry from cache
    await sleep(50);
    return this.getOrSetWithLock(key, fetcher);
  }
}
```

Only **one** request hits the database; all others wait for the cache to be populated.

---

### Q9.2: How are cache TTLs determined? What's the strategy?

**Answer:**

| Resource | TTL | Rationale |
|----------|-----|-----------|
| All restaurants | 5 min | Rarely changes, high read volume |
| Single restaurant | 5-10 min | Owner updates occasionally |
| Restaurant menu | 5 min | Menu changes are planned events |
| Single menu item | 10 min | Prices don't change frequently |
| Active coupons | 5 min | Campaign-driven, not real-time |
| Single order | 1 min | Status changes frequently during delivery |
| Order details | 30 sec | Customer refreshes tracking page often |
| Restaurant stats | 30 min | Aggregated data, eventual consistency ok |

**Strategy principles:**
1. **Inversely proportional to change frequency** — static data gets longer TTL
2. **User-facing data gets shorter TTL** — order status is time-sensitive
3. **Write-through invalidation** — don't rely only on TTL; invalidate on writes
4. **Pattern-based invalidation** — `cache.invalidatePattern("restaurant:*")` clears all restaurant cache when the list changes

---

## 10. Security & Authentication

### Q10.1: Explain the multi-provider authentication architecture.

**Answer:**

```
┌──────────┐  ┌──────────┐  ┌──────────────┐
│ Google   │  │ Phone    │  │ Keycloak     │
│ OAuth2.0 │  │ OTP      │  │ SSO (OIDC)   │
└────┬─────┘  └────┬─────┘  └──────┬───────┘
     └──────────────┼───────────────┘
                    ▼
          ┌──────────────────┐
          │ Passport.js      │
          │ Session Store    │  ← PostgreSQL-backed
          │ (connect-pg)     │
          └────────┬─────────┘
                   ▼
          ┌──────────────────┐
          │ upsertUser()     │  ← Idempotent (ON CONFLICT DO UPDATE)
          └──────────────────┘
```

**All providers converge to the same `upsertUser` flow:**
- Google OAuth: profile data → upsert
- Phone OTP: phone number → upsert
- Keycloak SSO: OIDC token claims → upsert

**Session security:**
```typescript
cookie: {
  httpOnly: true,       // No JavaScript access (XSS protection)
  secure: isProduction, // HTTPS only in production
  sameSite: "lax",      // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
}
```

---

### Q10.2: How does RBAC + ABAC work together?

**Answer:**

**RBAC (Role-Based Access Control)** — coarse-grained:
```typescript
const ROLE_PERMISSIONS = {
  customer:         [{ resource: "order", actions: ["create", "read"] }],
  restaurant_owner: [{ resource: "menu", actions: ["create", "read", "update", "delete"] }],
  delivery_partner: [{ resource: "delivery", actions: ["read", "update"] }],
  admin:            [{ resource: "*", actions: ["*"] }],
};
```

**ABAC (Attribute-Based Access Control)** — fine-grained:
```typescript
// A restaurant_owner can only update THEIR restaurant
if (resource === "restaurant" && action === "update") {
  return context.resourceOwnerId === context.userId;
}

// A delivery_partner can only update THEIR assigned delivery
if (resource === "order" && action === "update") {
  return context.assignedPartnerId === context.userId;
}
```

**RBAC answers:** "Can a restaurant_owner update menus?" → Yes
**ABAC answers:** "Can THIS restaurant_owner update THIS restaurant's menu?" → Only if they own it

---

### Q10.3: How does the system prevent common web vulnerabilities?

**Answer:**

| Vulnerability | Protection | Implementation |
|--------------|-----------|----------------|
| **SQL Injection** | Parameterized queries | Drizzle ORM (all queries are parameterized) |
| **XSS** | HttpOnly cookies, CSP | `cookie.httpOnly: true`, Content-Security-Policy headers |
| **CSRF** | SameSite cookies | `cookie.sameSite: "lax"` |
| **Brute Force** | Rate limiting | Auth: 10 requests per 15 minutes |
| **Timing Attacks** | Constant-time comparison | `crypto.timingSafeEqual()` for JWT verification |
| **Information Leakage** | Stack trace hiding | `stack` only in development mode |
| **Webhook Forgery** | Signature verification | Raw body capture for HMAC comparison |
| **Privilege Escalation** | RBAC + ABAC | Server-side role checks on every mutation |
| **Session Hijacking** | Secure cookies | `secure: true` in production (HTTPS only) |
| **Denial of Service** | Three-tier rate limiting | API, Auth, Order rate limiters |

---

## 11. Resilience Patterns

### Q11.1: Explain the Circuit Breaker state machine in detail.

**Answer:**

```
  ┌─────────┐
  │ CLOSED  │ ← Normal: all requests pass through
  └────┬────┘
       │ 5 consecutive failures
  ┌────▼────┐
  │  OPEN   │ ← Fail-fast: all requests rejected (or fallback)
  └────┬────┘
       │ After 30-second timeout
  ┌────▼────┐
  │HALF-OPEN│ ← Testing: limited requests allowed
  └────┬────┘
       │ 3 successes → CLOSED
       │ 1 failure → OPEN
```

**Configuration per service:**
- Default: threshold=5, reset=30s, halfOpenRequests=3
- Payment: threshold=3, reset=60s (more cautious — money involved)

**Fallback behavior:**
```typescript
const result = await circuitBreaker.execute(
  () => paymentService.charge(amount),    // Primary
  () => ({ status: "queued" })            // Fallback when open
);
```

**Why not just retry?**
Retries add load to a failing service. Circuit breaker **stops** sending requests, giving the downstream service time to recover.

---

### Q11.2: Why is jitter added to exponential backoff?

**Answer:**

```typescript
const baseDelay = Math.pow(2, attempt) * 100; // 200, 400, 800ms
const jitter = Math.random() * 100;            // Random 0-100ms
const delay = baseDelay + jitter;
```

**Without jitter (Thundering Herd):**
- 100 requests fail simultaneously
- All retry after exactly 200ms → 100 requests hit the server again simultaneously
- Server gets overwhelmed again → cycle repeats

**With jitter:**
- 100 requests fail simultaneously
- Retries spread across 200-300ms window → server sees ~30 requests at a time
- Much higher chance of recovery

**Types of jitter strategies:**
1. **Full jitter**: `delay = random(0, baseDelay)` — most spread, but can be very short
2. **Equal jitter**: `delay = baseDelay/2 + random(0, baseDelay/2)` — guaranteed minimum wait
3. **Decorrelated jitter** (AWS recommendation): `delay = random(baseDelay, previousDelay * 3)`

FoodDash uses additive jitter (simple, effective for this scale).

---

## 12. Real-Time Communication

### Q12.1: How does the WebSocket architecture support real-time order tracking?

**Answer:**

**Flow:**
```
Rider updates location → API endpoint
  → Store in cache (5 min TTL)
  → Publish RIDER_LOCATION_UPDATE event
    → EventBus delivers to subscriber
      → WebSocket broadcasts to customer
        → React component updates map position
```

**Multi-connection support:**
```typescript
const clients = new Map<string, Set<WebSocket>>();
// One user can have multiple connections (phone + laptop)
// Broadcasting sends to ALL connections for that user
```

**Message types:**
```json
{ "type": "order_update", "data": { "orderId": "...", "status": "preparing" } }
{ "type": "location_update", "data": { "latitude": 40.71, "longitude": -74.00, "eta": "10 min" } }
```

**Scaling challenge:** Currently in-process. At scale, use **Redis Pub/Sub** to broadcast across multiple server instances:
```
Server 1 (user connected here) ← Redis ← Server 2 (event originated here)
```

---

### Q12.2: How would you handle WebSocket reconnection and message ordering?

**Answer:**

**Client-side reconnection (not yet implemented — good interview discussion):**
```typescript
class ReconnectingWebSocket {
  private retryCount = 0;
  private maxRetries = 10;
  
  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.onclose = () => {
      if (this.retryCount < this.maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000);
        setTimeout(() => this.connect(), delay);
        this.retryCount++;
      }
    };
    this.ws.onopen = () => { this.retryCount = 0; };
  }
}
```

**Message ordering:**
- Use monotonically increasing sequence numbers per order
- Client ignores messages with older sequence numbers
- On reconnect, fetch current state via REST (single source of truth), then resume WebSocket

---

## 13. Testing & Quality Assurance

### Q13.1: What testing strategy would you implement for this system?

**Answer:**

**Testing Pyramid:**
```
         ┌─────────┐
         │  E2E    │  ← 10% — Critical user journeys (Playwright)
         │ Tests   │
        ┌┴─────────┴┐
        │Integration │  ← 30% — API contracts, DB interactions
        │   Tests    │
       ┌┴────────────┴┐
       │  Unit Tests   │  ← 60% — Service logic, validators, utilities
       └──────────────┘
```

**Unit tests (Vitest):**
- Each microservice tested with mocked `IStorage`
- Cart reducer tested with various action sequences
- Zod schema validation edge cases
- Circuit breaker state transitions
- Saga compensation flows

**Integration tests (Playwright API testing):**
- Full order creation → status update → delivery flow
- Auth flows (OAuth, OTP)
- Rate limiter behavior
- Cache invalidation correctness

**E2E tests (Playwright):**
- Customer: browse → add to cart → checkout → track order
- Restaurant owner: receive order → update status
- Delivery partner: accept order → update location → complete

---

### Q13.2: How would you test the Saga Orchestrator?

**Answer:**

```typescript
describe('SagaOrchestrator', () => {
  it('should execute all steps in order', async () => {
    const saga = createTestSaga([
      { name: 'step1', execute: jest.fn().mockResolvedValue('result1') },
      { name: 'step2', execute: jest.fn().mockResolvedValue('result2') },
    ]);
    const result = await orchestrator.execute(saga, context);
    expect(result.success).toBe(true);
    expect(saga.steps[0].execute).toHaveBeenCalledBefore(saga.steps[1].execute);
  });

  it('should compensate in reverse on failure', async () => {
    const compensations: string[] = [];
    const saga = createTestSaga([
      { name: 'step1', execute: resolve, compensate: () => compensations.push('comp1') },
      { name: 'step2', execute: resolve, compensate: () => compensations.push('comp2') },
      { name: 'step3', execute: reject('Payment failed') },
    ]);
    const result = await orchestrator.execute(saga, context);
    expect(result.success).toBe(false);
    expect(compensations).toEqual(['comp2', 'comp1']); // Reverse order
  });

  it('should handle compensation failures gracefully', async () => {
    // Even if compensation fails, remaining compensations still execute
  });

  it('should respect per-step timeouts', async () => {
    // Step with 100ms timeout + operation taking 200ms → timeout error + compensation
  });
});
```

---

## 14. DevOps, CI/CD & Deployment

### Q14.1: Explain the build pipeline for this full-stack TypeScript application.

**Answer:**

```
npm run build
  │
  ├── Step 1: rm -rf dist/
  │
  ├── Step 2: vite build → dist/public/
  │   ├── Tree-shaking (dead code elimination)
  │   ├── Code-splitting (route-based chunks)
  │   ├── Asset hashing (cache busting)
  │   └── Minification (Terser)
  │
  └── Step 3: esbuild → dist/index.cjs
      ├── Bundle server code into single file
      ├── Minification
      ├── External: node_modules not bundled (installed separately)
      └── CJS format (Node.js compatibility)
```

**Why esbuild for server?**
- **Fast** — 10-100x faster than Webpack/Rollup
- **Single file** — reduces `openat(2)` syscalls on cold start
- **Selective bundling** — only allowlisted deps bundled, rest external

---

### Q14.2: How are the Kubernetes health endpoints designed?

**Answer:**

```
GET /api/health       → Full report (all services aggregated)
GET /api/health/live  → Liveness: "is the process alive?" (200 or 503)
GET /api/health/ready → Readiness: "can it handle requests?" (200 or 503)
```

**Liveness probe:** Simple — if the endpoint responds, the process is alive. If it doesn't respond, K8s restarts the pod.

**Readiness probe:** Checks all service health:
```json
{
  "overall": "healthy",
  "services": [
    { "name": "order-service", "status": "healthy", "responseTime": 5 },
    { "name": "payment-service", "status": "degraded", "responseTime": 150 }
  ],
  "checks": {
    "totalServices": 10,
    "healthyServices": 9,
    "degradedServices": 1
  }
}
```

If `overall` is `unhealthy`, K8s removes the pod from the load balancer — no traffic until recovery.

---

## 15. Scenario-Based Questions

### Q15.1: A customer reports their order was charged twice. How would you debug this?

**Answer:**

1. **Get the correlation ID** from the customer's order confirmation (included in API responses)
2. **Search structured logs** for that correlation ID — see the complete request flow
3. **Check order_events table** — event sourcing shows every state change with timestamps
4. **Check idempotency store** — was the `idempotencyKey` different between the two charges?
5. **Check Saga execution log** — did the saga execute twice? Was compensation triggered?
6. **Root cause analysis:**
   - **Client retry** — client retried the request with a different idempotency key
   - **Saga partial failure** — payment succeeded, but order creation failed and compensation didn't refund
   - **Circuit breaker timing** — circuit opened between payment and order creation

**Prevention:** Ensure the client generates deterministic idempotency keys (e.g., `${userId}-${restaurantId}-${timestamp}`), and verify saga compensation always executes refunds.

---

### Q15.2: The restaurant search is slow during peak hours. How would you optimize it?

**Answer:**

**Current:** In-memory filtering on database query results

**Short-term (no infra changes):**
1. **Add database indexes:**
```sql
CREATE INDEX idx_restaurants_search 
  ON restaurants USING gin(to_tsvector('english', name || ' ' || cuisine || ' ' || description));
```
2. **Increase cache TTL** for search results (currently 5 min → 10 min during peak)
3. **Pre-compute popular searches** — cache "Italian", "Pizza", "Chinese" during off-peak

**Medium-term:**
4. **Elasticsearch** — dedicated search engine with:
   - Full-text search with relevance scoring
   - Faceted filters (cuisine, price range, rating)
   - Geo-spatial queries (restaurants near me)
   - Autocomplete with edge n-grams

**Long-term:**
5. **Read replica** for search queries (CQRS — writes go to primary, reads to replica)
6. **CDN-cached search results** for common queries

---

### Q15.3: How would you implement a "dark mode" toggle that persists across sessions?

**Answer (already implemented in FoodDash):**

```typescript
// ThemeProvider.tsx
function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    // 1. Check localStorage
    const saved = localStorage.getItem("theme");
    if (saved) return saved;
    
    // 2. Check system preference
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    // Apply theme to <html> element (CSS class toggle)
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

**CSS approach (TailwindCSS):**
- Uses CSS custom properties: `--background`, `--foreground`, `--primary`, etc.
- Dark mode overrides via `.dark` class on `<html>`
- No JavaScript runtime cost — pure CSS class toggle

---

### Q15.4: How would you handle a situation where the payment service is down but customers need to place orders?

**Answer:**

This is exactly what the **Circuit Breaker + Fallback** pattern handles:

1. **Circuit breaker detects failures** — after 3 payment failures, circuit opens
2. **Fallback activates** — orders are accepted with `paymentStatus: "queued"`
3. **Payment queue** — failed payments are pushed to a dead letter queue
4. **Background processor** — periodically retries queued payments
5. **Notification** — customer receives "Order confirmed, payment processing..."

```typescript
const paymentResult = await circuitBreaker.execute(
  () => paymentService.charge(amount),
  () => ({ status: "queued", message: "Payment will be processed shortly" })
);
```

**Additionally:**
- Accept **Cash on Delivery (COD)** as fallback payment method
- Send admin alert when payment circuit opens
- Show customer a transparent message: "We're processing your payment. You'll be notified once confirmed."

---

### Q15.5: A new junior developer joins the team. How would you onboard them using this codebase?

**Answer:**

**Week 1 — Understanding:**
1. Read `PRODUCT_DOCUMENTATION.md` — understand the domain (food delivery, user personas, journeys)
2. Read `TECHNICAL_ARCHITECTURE.md` — understand the stack and high-level architecture
3. Run the app locally — `npm install && npm run dev`
4. Walk through one user journey: Landing → Sign Up → Browse → Order

**Week 2 — Codebase:**
1. Read `shared/schema.ts` — database is the foundation
2. Read `server/routes.ts` — understand the REST API
3. Read `client/src/App.tsx` → `pages/Home.tsx` — frontend structure
4. Read `BEST_PRACTICES.md` — coding standards

**Week 3 — First Contribution:**
1. Add a simple feature (e.g., "mark menu item as vegetarian")
2. Touch all layers: schema → storage → route → frontend
3. Follow the `BEST_PRACTICES.md` patterns (cache invalidation, Zod validation, etc.)

**Week 4 — Deeper Patterns:**
1. Read `DETAILED_TECHNICAL_ARCHITECTURE.md` — design patterns deep dive
2. Read `REDUX_MIGRATION.md` — understand state management decisions
3. Contribute to a more complex feature (e.g., coupon validation flow)

---

## 16. Behavioral & Leadership Questions

### Q16.1: How do you decide between adding a new technology vs. using what's already in the stack?

**Answer (using FoodDash decisions as examples):**

**Framework:** I use a **"Pain vs. Gain"** matrix:

| Decision | Pain (current approach) | Gain (new tech) | Verdict |
|----------|------------------------|-----------------|---------|
| Wouter vs React Router | None (routing is simple) | 7.5x smaller bundle | ✅ Wouter |
| Redux vs Zustand | Two separate state systems | Unified DevTools, debugging | ✅ Redux migration |
| Elasticsearch vs DB search | Slow search at scale | 100x faster search | ⏳ When needed |
| Kafka vs in-memory EventBus | None (current scale is fine) | Distributed durability | ⏳ When needed |

**Principles:**
1. **Don't add complexity you don't need yet** — "You Aren't Gonna Need It" (YAGNI)
2. **But design so you CAN add it** — the EventBus interface is swappable with Kafka
3. **Measure first** — add Elasticsearch when search latency actually exceeds SLA, not preemptively
4. **Consider team expertise** — a tool everyone knows beats a "better" tool nobody knows

---

### Q16.2: How do you ensure code quality in a team setting?

**Answer:**

1. **Living documentation** — this codebase has 6 detailed docs that serve as onboarding AND reference
2. **Enforced patterns** — `BaseService` enforces health checks, resilience, and logging for every service
3. **Type safety** — TypeScript strict mode + Drizzle-Zod catches bugs at compile time
4. **Schema validation** — Zod schemas validate all API inputs, preventing invalid data at the boundary
5. **Code review checklist:** Does it follow `BEST_PRACTICES.md`? Does it invalidate cache? Does it handle errors? Does it have correlation context?
6. **Automated tooling:** ESLint + Prettier + TypeScript compiler (`npm run check`)

---

### Q16.3: Describe a time you had to make a tradeoff between performance and code maintainability.

**Answer (FoodDash example):**

**Tradeoff: In-memory caching vs. Redis from day one.**

- **Performance optimal:** Redis cluster from the start — handles distributed scenarios, survives restarts
- **Maintainability optimal:** In-memory cache with same interface — zero infrastructure, zero configuration

**Decision:** In-memory cache with a Redis-compatible interface (`DistributedCache` class). The same API (`get`, `set`, `getOrSet`, `invalidatePattern`) works with both backends.

**Why:** At the current scale (single-process monolith), in-memory is faster (no network hop) and simpler. The interface is designed so swapping to Redis requires changing one import, not refactoring every service.

**Lesson:** Always code to an interface, never to an implementation. The performance vs. maintainability tradeoff becomes a non-decision when both options implement the same contract.

---

*This Q&A document covers 60+ questions across 16 categories, designed for senior fullstack engineer interviews (6+ years). Each answer references specific FoodDash implementations with code examples and architectural reasoning.*

*For deeper exploration of any topic, refer to the corresponding documentation files in the `docs/` directory.*
