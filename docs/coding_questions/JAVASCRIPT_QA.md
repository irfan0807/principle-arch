# FoodDash — JavaScript Interview Q&A (50 Questions)

## For 6+ Years Fullstack Engineer | Advanced JavaScript Concepts

> **Project**: FoodDash — Production-Grade Food Delivery Platform  
> **Stack**: TypeScript (Full-Stack), Node.js, React 18, Express.js  
> **Last Updated**: February 2026

---

## Q1: Explain the JavaScript Event Loop. How does it handle async operations in FoodDash's Node.js server?

**Answer:**

The Event Loop is a single-threaded mechanism that processes tasks from multiple queues in a specific order:

```
   ┌───────────────────────────┐
┌─►│        Call Stack          │  (Synchronous code executes here)
│  └───────────┬───────────────┘
│              │ empty?
│  ┌───────────▼───────────────┐
│  │   Microtask Queue          │  (Promise.then, queueMicrotask, MutationObserver)
│  │   ► ALL microtasks drain   │
│  └───────────┬───────────────┘
│              │ empty?
│  ┌───────────▼───────────────┐
│  │   Macrotask Queue          │  (setTimeout, setInterval, I/O callbacks, setImmediate)
│  │   ► ONE macrotask          │
│  └───────────┬───────────────┘
│              │
└──────────────┘  (loop back to microtasks)
```

**Order of execution:**
1. Execute all synchronous code on the call stack.
2. Drain the **entire microtask queue** (Promises, `queueMicrotask`).
3. Execute **one** macrotask (`setTimeout`, I/O).
4. Go back to step 2.

**FoodDash example:**
```javascript
console.log("1. Sync — route handler starts");

setTimeout(() => console.log("4. Macrotask — timeout"), 0);

Promise.resolve().then(() => console.log("2. Microtask — promise"));

queueMicrotask(() => console.log("3. Microtask — queueMicrotask"));

console.log("1b. Sync — route handler ends");

// Output: 1. Sync, 1b. Sync, 2. Microtask, 3. Microtask, 4. Macrotask
```

**Why this matters for FoodDash's server:** When the Order Service receives a request, it:
1. Validates input (sync on call stack).
2. Awaits DB query (I/O — offloaded to libuv thread pool).
3. `await` yields control — event loop can handle other requests.
4. DB response triggers a microtask (Promise resolution) — order processing resumes.

This is how a single-threaded Node.js server handles 1000+ concurrent order requests.

---

## Q2: What are closures? How does FoodDash use them in critical patterns?

**Answer:**

A closure is a function that retains access to its outer (lexical) scope's variables even after the outer function has returned.

```javascript
function createCounter() {
  let count = 0; // Enclosed variable
  return {
    increment: () => ++count,
    getCount: () => count,
  };
}

const counter = createCounter();
counter.increment(); // 1
counter.increment(); // 2
counter.getCount();  // 2
// `count` is not accessible directly — it's enclosed
```

**FoodDash closure patterns:**

1. **Rate Limiter — closure over request store:**
```javascript
function createRateLimiter({ windowMs, maxRequests }) {
  const store = new Map(); // Enclosed — private state

  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (entry.count >= maxRequests) {
      return res.status(429).json({ error: "Too many requests" });
    }
    entry.count++;
    next();
  };
}
```

2. **Circuit Breaker — closure over failure state:**
```javascript
function createCircuitBreaker({ failureThreshold, resetTimeout }) {
  let failures = 0;       // Enclosed
  let state = "closed";   // Enclosed
  let nextAttempt = null;  // Enclosed

  return async function execute(operation, fallback) {
    if (state === "open") {
      if (Date.now() < nextAttempt) return fallback?.();
      state = "half-open";
    }
    try {
      const result = await operation();
      onSuccess();
      return result;
    } catch (error) {
      onFailure();
      throw error;
    }
  };
}
```

3. **Cache getOrSet — closure over cache Map:**
```javascript
function createCache() {
  const cache = new Map(); // Enclosed

  return {
    getOrSet: async (key, fetcher, ttlSeconds) => {
      const cached = cache.get(key);
      if (cached && cached.expiresAt > Date.now()) return cached.value;
      const value = await fetcher();
      cache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
      return value;
    },
  };
}
```

**Why closures matter:** They provide **encapsulation** without classes. The rate limiter's `store`, circuit breaker's `failures`, and cache's `Map` are all private — no external code can mutate them directly.

---

## Q3: Explain `this` binding in JavaScript. What are the 4 rules?

**Answer:**

The value of `this` is determined by **how a function is called**, not where it's defined:

| Rule | Priority | `this` Value | Example |
|------|----------|-------------|---------|
| **`new` binding** | 1 (highest) | Newly created object | `new OrderService()` |
| **Explicit binding** | 2 | Specified object | `fn.call(obj)`, `fn.apply(obj)`, `fn.bind(obj)` |
| **Implicit binding** | 3 | Object before the dot | `orderService.createOrder()` |
| **Default binding** | 4 (lowest) | `undefined` (strict) / `globalThis` (sloppy) | `fn()` |

**Arrow functions — no own `this`:**
```javascript
class OrderService {
  constructor() {
    this.orders = [];
  }

  // ❌ Regular function — loses `this` when passed as callback
  processOrder() {
    setTimeout(function() {
      this.orders.push(newOrder); // TypeError: Cannot read property 'push' of undefined
    }, 100);
  }

  // ✅ Arrow function — inherits `this` from lexical scope
  processOrder() {
    setTimeout(() => {
      this.orders.push(newOrder); // Works! `this` is the OrderService instance
    }, 100);
  }
}
```

**FoodDash patterns:**
- **Express middleware** uses arrow functions so `this` isn't a concern.
- **Event handlers** in the EventBus use arrow functions to capture the service context.
- **Passport.js callbacks** use arrow functions to access `req`/`res` from the closure.

---

## Q4: What is the difference between `var`, `let`, and `const`? Why does FoodDash use `const` almost exclusively?

**Answer:**

| Feature | `var` | `let` | `const` |
|---------|-------|-------|---------|
| Scope | Function | Block | Block |
| Hoisting | Yes (initialized as `undefined`) | Yes (TDZ — not accessible) | Yes (TDZ) |
| Reassignment | ✅ | ✅ | ❌ |
| Redeclaration | ✅ | ❌ | ❌ |

**Temporal Dead Zone (TDZ):**
```javascript
console.log(a); // undefined (var hoisted)
console.log(b); // ReferenceError: Cannot access 'b' before initialization
var a = 1;
let b = 2;
```

**Why FoodDash uses `const` almost exclusively:**

1. **Immutability signal** — `const` tells other developers "this binding never changes". Reduces cognitive load.
2. **Bug prevention** — Accidental reassignment is caught immediately by the compiler.
3. **Object mutation is still allowed:**
```javascript
const order = { status: "pending" };
order.status = "confirmed";  // ✅ Works — mutating property, not reassigning binding
order = {};                  // ❌ TypeError — cannot reassign const
```
4. **TypeScript's `as const`** further deepens immutability:
```javascript
const ORDER_STATUSES = ["pending", "confirmed", "preparing"] as const;
// Type: readonly ["pending", "confirmed", "preparing"]
// Not string[] — each element has a literal type
```

**When `let` is used in FoodDash:** Loop variables (`for (let i = ...)`), retry counters, and state that genuinely changes (circuit breaker failure count).

---

## Q5: Explain Promises, async/await, and error handling patterns in FoodDash.

**Answer:**

**Promise states:** pending → fulfilled / rejected (settled). Settled is final — cannot change.

**FoodDash's async patterns:**

1. **async/await with try-catch (most common):**
```javascript
async function createOrder(data) {
  try {
    const order = await db.insert(orders).values(data).returning();
    await eventBus.publish("ORDER_CREATED", order);
    return order;
  } catch (error) {
    logger.error("Order creation failed", { error: error.message });
    throw error; // Re-throw for caller to handle
  }
}
```

2. **Promise.race for timeouts:**
```javascript
async function withTimeout(operation, timeoutMs) {
  return Promise.race([
    operation,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}
// Used in BaseService — every operation has a 10s default timeout
```

3. **Promise.all for parallel operations:**
```javascript
// Health check — query all services simultaneously
const [dbHealth, cacheHealth, eventBusHealth] = await Promise.all([
  checkDatabase(),
  checkCache(),
  checkEventBus(),
]);
```

4. **Promise.allSettled for resilient aggregation:**
```javascript
// Aggregate health from 10+ microservices — don't fail if one is down
const results = await Promise.allSettled(
  services.map(service => service.checkHealth())
);
const healthReport = results.map((result, i) => ({
  service: services[i].name,
  status: result.status === "fulfilled" ? result.value.status : "unhealthy",
  error: result.status === "rejected" ? result.reason.message : null,
}));
```

**Anti-pattern avoided:**
```javascript
// ❌ Forgetting to await — fire and forget (event lost if it fails)
eventBus.publish("ORDER_CREATED", data);

// ✅ Awaited — errors propagate
await eventBus.publish("ORDER_CREATED", data);
```

---

## Q6: What is prototypal inheritance? How does it differ from classical inheritance?

**Answer:**

JavaScript uses **prototypal inheritance** — objects inherit directly from other objects via a prototype chain.

```javascript
// Every object has a hidden [[Prototype]] link
const animal = { breathe: () => "breathing" };
const dog = Object.create(animal);
dog.bark = () => "woof";

dog.bark();    // "woof" — own property
dog.breathe(); // "breathing" — found on prototype chain

// Prototype chain: dog → animal → Object.prototype → null
```

**Classical (class syntax) is syntactic sugar over prototypes:**
```javascript
class BaseService {
  async executeWithResilience(operation) { /* ... */ }
}

class OrderService extends BaseService {
  async createOrder(data) {
    return this.executeWithResilience(() => { /* ... */ });
  }
}

// Under the hood:
// OrderService.prototype.__proto__ === BaseService.prototype
```

**FoodDash uses class syntax because:**
1. **TypeScript `abstract` classes** — `BaseService` is abstract with mandatory `checkHealth()`.
2. **Familiarity** — Class syntax is more readable for developers from OOP backgrounds.
3. **Protected methods** — TypeScript's `protected` keyword works with classes.

**But the prototype chain is still there:**
```javascript
const orderService = new OrderService(config);
orderService instanceof BaseService; // true
orderService instanceof Object;      // true
OrderService.prototype.checkHealth;   // exists on prototype
```

---

## Q7: What are generators and iterators? Where would FoodDash use them?

**Answer:**

**Iterator protocol:** An object with a `next()` method that returns `{ value, done }`.

**Generator function:** A function that can pause (`yield`) and resume, producing values lazily.

```javascript
function* orderStatusSequence() {
  yield "pending";
  yield "confirmed";
  yield "preparing";
  yield "ready_for_pickup";
  yield "out_for_delivery";
  yield "delivered";
}

const stateMachine = orderStatusSequence();
stateMachine.next(); // { value: "pending", done: false }
stateMachine.next(); // { value: "confirmed", done: false }
// ...
stateMachine.next(); // { value: "delivered", done: false }
stateMachine.next(); // { value: undefined, done: true }
```

**FoodDash use cases:**

1. **Paginated data streaming:**
```javascript
async function* paginateOrders(userId, pageSize = 20) {
  let page = 0;
  while (true) {
    const orders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.customerId, userId))
      .limit(pageSize)
      .offset(page * pageSize);

    if (orders.length === 0) return;
    yield orders;
    page++;
  }
}

// Consume lazily
for await (const batch of paginateOrders("user-123")) {
  processBatch(batch);
}
```

2. **Retry with backoff (generates delay values):**
```javascript
function* exponentialBackoff(baseMs = 100, maxAttempts = 5) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const delay = Math.pow(2, attempt) * baseMs + Math.random() * 100;
    yield delay;
  }
}
```

3. **ID generators:**
```javascript
function* idGenerator(prefix = "order") {
  let counter = 0;
  while (true) {
    yield `${prefix}_${Date.now()}_${counter++}`;
  }
}
```

---

## Q8: Explain `Map` vs plain Object and `Set` vs Array. Where does FoodDash use them?

**Answer:**

**Map vs Object:**

| Feature | Map | Object |
|---------|-----|--------|
| Key types | Any (objects, functions, primitives) | String / Symbol only |
| Key order | Insertion order guaranteed | Not guaranteed (numbers sorted) |
| Size | `.size` property | `Object.keys(obj).length` |
| Iteration | `for...of`, `.forEach` | `for...in`, `Object.entries` |
| Performance | Optimized for frequent add/delete | Optimized for static shape |
| Prototype | No inherited keys | Has `toString`, `hasOwnProperty`, etc. |

**FoodDash uses Map for:**
```javascript
// Rate limiter — IP addresses as keys, frequent add/delete
const store = new Map<string, { count: number; resetAt: number }>();

// Circuit breaker — operation names mapped to failure counts
const circuits = new Map<string, CircuitState>();

// WebSocket connections — userId → Set<WebSocket>
const clients = new Map<string, Set<WebSocket>>();

// Event Bus subscriptions — eventType → handler[]
const subscriptions = new Map<string, EventSubscription[]>();

// Cache — keys with TTL
const cache = new Map<string, { value: any; expiresAt: number }>();
```

**Set vs Array:**

| Feature | Set | Array |
|---------|-----|-------|
| Duplicates | ❌ No | ✅ Yes |
| Lookup | O(1) `.has()` | O(n) `.includes()` |
| Order | Insertion order | Index order |

**FoodDash uses Set for:**
```javascript
// WebSocket — multiple connections per user (tabs/devices)
const clients = new Map<string, Set<WebSocket>>();
clients.get(userId).add(ws);       // No duplicates
clients.get(userId).delete(ws);    // O(1) removal

// Idempotency — track processed keys
const processedKeys = new Set<string>();
if (processedKeys.has(idempotencyKey)) return existingResult;
processedKeys.add(idempotencyKey);
```

---

## Q9: What is the difference between `==` and `===`? Why does FoodDash always use `===`?

**Answer:**

- **`==` (abstract equality)** — performs type coercion before comparison.
- **`===` (strict equality)** — no type coercion; both value and type must match.

**Dangerous coercion examples:**
```javascript
0 == ""          // true (both coerce to 0)
0 == "0"         // true
"" == "0"        // false (inconsistent!)
null == undefined // true
false == "0"     // true
[] == false      // true
[] == ![]        // true (!)
```

**FoodDash uses `===` exclusively because:**
1. **TypeScript** — Strict type checking already prevents mixed-type comparisons. `===` is a safety net.
2. **Predictability** — No hidden coercion surprises. `order.status === "pending"` only matches the string `"pending"`.
3. **ESLint rule** — `eqeqeq: "error"` enforces `===` project-wide.

**One exception — `== null`:**
```javascript
// Checks both null AND undefined in one expression
if (value == null) { /* value is null or undefined */ }
// Equivalent to: if (value === null || value === undefined)
```

FoodDash prefers explicit `=== null || === undefined` for clarity, but `== null` is acceptable per the style guide.

---

## Q10: Explain the Spread operator and Rest parameters. How does FoodDash use them?

**Answer:**

**Spread (`...`)** — Expands an iterable into individual elements.
**Rest (`...`)** — Collects remaining arguments into an array.

**FoodDash patterns:**

1. **Object spread for immutable updates (Redux reducers):**
```javascript
// cartSlice.ts — immutable state update
case "addItem":
  return {
    ...state,                      // Spread existing state
    items: [...state.items, action.payload],  // Spread + append
    restaurantId: action.payload.restaurantId,
  };
```

2. **Rest for omitting properties (schema validation):**
```javascript
// Remove internal fields before sending to client
const { password, sessionToken, ...safeUser } = user;
res.json(safeUser);

// Drizzle-Zod: omit auto-generated fields
const insertOrderSchema = createInsertSchema(orders)
  .omit({ id: true, createdAt: true, updatedAt: true });
```

3. **Spread for merging config:**
```javascript
const defaultConfig = { timeout: 10000, retries: 3, cache: true };
const serviceConfig = { ...defaultConfig, ...userConfig }; // userConfig overrides
```

4. **Rest parameters for flexible functions:**
```javascript
function log(level, message, ...data) {
  console.log(`[${level}] ${message}`, ...data);
}
log("INFO", "Order created", { orderId: "123" }, { userId: "456" });
```

**Important:** Spread creates a **shallow copy**. Nested objects are still references:
```javascript
const original = { order: { status: "pending" } };
const copy = { ...original };
copy.order.status = "confirmed";
original.order.status; // "confirmed" — shared reference!

// Deep copy: structuredClone(original) or JSON.parse(JSON.stringify(original))
```

---

## Q11: What is destructuring? Show advanced patterns used in FoodDash.

**Answer:**

**Basic destructuring:**
```javascript
// Object
const { id, status, total } = order;

// Array
const [first, second, ...rest] = items;
```

**Advanced FoodDash patterns:**

1. **Nested destructuring:**
```javascript
const {
  data: { orderId, status },
  meta: { correlationId },
} = apiResponse;
```

2. **Default values:**
```javascript
const {
  page = 1,
  limit = 20,
  sortBy = "createdAt",
  order: sortOrder = "desc",  // Renamed + default
} = req.query;
```

3. **Parameter destructuring:**
```javascript
function createService({ name, port, timeout = 10000 }: ServiceConfig) {
  // name, port, timeout available directly
}
```

4. **Computed property destructuring:**
```javascript
const field = "email";
const { [field]: email } = user; // Extracts user.email into `email`
```

5. **Swap variables:**
```javascript
let a = "primary";
let b = "fallback";
[a, b] = [b, a]; // a = "fallback", b = "primary"
```

6. **Ignore elements:**
```javascript
const [, , thirdOrder] = orders; // Skip first two
```

7. **Function return destructuring:**
```javascript
const [isPending, startTransition] = useTransition();
const { data, isLoading, error } = useQuery({ queryKey: ["/api/orders"] });
```

---

## Q12: What are WeakMap and WeakRef? When are they useful?

**Answer:**

**WeakMap** — Like Map, but keys must be objects and are held **weakly** (garbage collected if no other reference exists).

**WeakRef** — Holds a weak reference to an object — doesn't prevent garbage collection.

```javascript
// WeakMap — keys are garbage collected when object is gone
const metadata = new WeakMap();

function processOrder(order) {
  metadata.set(order, { processedAt: Date.now(), retryCount: 0 });
}

// When `order` goes out of scope, both the key and value are GC'd
// No memory leak!
```

**FoodDash use cases:**

1. **Private data per service instance (WeakMap):**
```javascript
const privateData = new WeakMap();

class OrderService {
  constructor(config) {
    privateData.set(this, { secretKey: config.apiKey, cache: new Map() });
  }

  getSecret() {
    return privateData.get(this).secretKey;
  }
}
// When the service instance is GC'd, private data is also GC'd
```

2. **Caching DOM nodes without preventing GC (WeakRef):**
```javascript
class ComponentCache {
  #cache = new Map();

  set(key, component) {
    this.#cache.set(key, new WeakRef(component));
  }

  get(key) {
    const ref = this.#cache.get(key);
    return ref?.deref(); // Returns undefined if GC'd
  }
}
```

**When NOT to use:** If you need to iterate over entries (WeakMap/WeakSet are not iterable), or if you need the data to persist (weak references can be collected at any time).

---

## Q13: Explain the Module system — CommonJS vs ES Modules. What does FoodDash use?

**Answer:**

| Feature | CommonJS (CJS) | ES Modules (ESM) |
|---------|---------------|-----------------|
| Syntax | `require()` / `module.exports` | `import` / `export` |
| Loading | Synchronous | Asynchronous |
| Binding | Copy of value | Live binding (reference) |
| Evaluation | Runtime | Static (compile-time analyzable) |
| Tree-shaking | ❌ Not possible | ✅ Dead code elimination |
| Top-level await | ❌ No | ✅ Yes |
| Default in Node | ✅ (historically) | ✅ (with `"type": "module"`) |

**FoodDash uses both:**

- **Source code (TypeScript)** → ES Modules (`import`/`export`):
```typescript
import express from "express";
import { db } from "./db";
export class OrderService extends BaseService { }
```

- **Production build** → CommonJS (bundled by esbuild):
```javascript
// script/build.ts
await esbuild({
  format: "cjs",  // Output as CommonJS
  // ...
});
// Output: dist/index.cjs
```

**Why CJS for production?**
- esbuild bundles everything into a single `dist/index.cjs` file.
- CJS has slightly faster cold-start in Node.js (no async module loading).
- Better compatibility with older Node.js dependencies.

**ESM live binding:**
```javascript
// counter.mjs
export let count = 0;
export function increment() { count++; }

// main.mjs
import { count, increment } from "./counter.mjs";
console.log(count); // 0
increment();
console.log(count); // 1 (live binding — sees the update!)

// CJS equivalent would still show 0 (copy of value at require time)
```

---

## Q14: What are Symbols and what are they used for?

**Answer:**

A `Symbol` is a unique, immutable primitive value used primarily as object property keys.

```javascript
const id = Symbol("id");
const anotherId = Symbol("id");
id === anotherId; // false — every Symbol is unique

const order = {
  [id]: "order-123",       // Symbol key — not visible in for...in or JSON.stringify
  status: "pending",       // Regular key
};

Object.keys(order);        // ["status"] — Symbol not included
JSON.stringify(order);     // '{"status":"pending"}' — Symbol not serialized
Object.getOwnPropertySymbols(order); // [Symbol(id)]
```

**Well-known Symbols:**

| Symbol | Purpose | FoodDash Relevance |
|--------|---------|-------------------|
| `Symbol.iterator` | Makes object iterable with `for...of` | Custom iterators for paginated data |
| `Symbol.asyncIterator` | Makes object async iterable | Streaming order events |
| `Symbol.toPrimitive` | Custom type conversion | Money formatting |
| `Symbol.hasInstance` | Customize `instanceof` | Service type checking |

**FoodDash example — Custom iterable for event log:**
```javascript
class EventLog {
  #events = [];

  push(event) { this.#events.push(event); }

  [Symbol.iterator]() {
    let index = 0;
    const events = this.#events;
    return {
      next() {
        return index < events.length
          ? { value: events[index++], done: false }
          : { done: true };
      },
    };
  }
}

const log = new EventLog();
log.push({ type: "ORDER_CREATED" });
log.push({ type: "ORDER_CONFIRMED" });
for (const event of log) console.log(event.type);
```

---

## Q15: What is `Object.freeze()` vs `Object.seal()` vs `Object.preventExtensions()`?

**Answer:**

| Method | Add props | Delete props | Modify values | Reconfigure |
|--------|----------|-------------|--------------|-------------|
| `Object.preventExtensions()` | ❌ | ✅ | ✅ | ✅ |
| `Object.seal()` | ❌ | ❌ | ✅ | ❌ |
| `Object.freeze()` | ❌ | ❌ | ❌ | ❌ |

**FoodDash uses `Object.freeze` for immutable config:**
```javascript
const ORDER_STATUS_TRANSITIONS = Object.freeze({
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready_for_pickup", "cancelled"],
  ready_for_pickup: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
});

// Cannot accidentally mutate:
ORDER_STATUS_TRANSITIONS.pending.push("delivered"); // ❌ throws in strict mode
// BUT: freeze is shallow — inner arrays are NOT frozen
// Deep freeze requires recursion
```

**Deep freeze:**
```javascript
function deepFreeze(obj) {
  Object.freeze(obj);
  Object.values(obj).forEach(val => {
    if (typeof val === "object" && val !== null && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  });
  return obj;
}
```

---

## Q16: Explain `Proxy` and `Reflect`. Where could FoodDash use them?

**Answer:**

`Proxy` wraps an object and intercepts fundamental operations (get, set, delete, etc.).
`Reflect` provides default implementations of those operations.

```javascript
const handler = {
  get(target, prop, receiver) {
    console.log(`Accessing ${String(prop)}`);
    return Reflect.get(target, prop, receiver);
  },
  set(target, prop, value, receiver) {
    console.log(`Setting ${String(prop)} = ${value}`);
    return Reflect.set(target, prop, value, receiver);
  },
};

const order = new Proxy({ status: "pending" }, handler);
order.status;           // Logs: "Accessing status"
order.status = "confirmed"; // Logs: "Setting status = confirmed"
```

**FoodDash use cases:**

1. **Observable config — auto-invalidate cache on change:**
```javascript
function createReactiveConfig(config, onConfigChange) {
  return new Proxy(config, {
    set(target, prop, value) {
      const oldValue = target[prop];
      target[prop] = value;
      if (oldValue !== value) {
        onConfigChange(prop, oldValue, value);
      }
      return true;
    },
  });
}

const config = createReactiveConfig(
  { cacheTTL: 300, maxRetries: 3 },
  (prop, old, newVal) => {
    logger.info(`Config changed: ${prop} ${old} → ${newVal}`);
    cache.invalidatePattern("*"); // Clear all cache on config change
  }
);
```

2. **Validation proxy — validate property assignments:**
```javascript
const validatedOrder = new Proxy(order, {
  set(target, prop, value) {
    if (prop === "status") {
      const allowed = ORDER_STATUS_TRANSITIONS[target.status];
      if (!allowed.includes(value)) {
        throw new Error(`Invalid transition: ${target.status} → ${value}`);
      }
    }
    return Reflect.set(target, prop, value);
  },
});
```

3. **Lazy loading service — initialize on first access:**
```javascript
const lazyServices = new Proxy({}, {
  get(target, serviceName) {
    if (!target[serviceName]) {
      target[serviceName] = new ServiceRegistry().createService(serviceName);
    }
    return target[serviceName];
  },
});
```

---

## Q17: What is the difference between shallow copy and deep copy? How does FoodDash handle immutability?

**Answer:**

**Shallow copy** — Copies the first level. Nested objects are still shared references.
**Deep copy** — Recursively copies everything. No shared references.

```javascript
// Shallow copy methods
const shallow1 = { ...original };
const shallow2 = Object.assign({}, original);
const shallow3 = Array.from(original);

// Deep copy methods
const deep1 = structuredClone(original);      // Native (Node 17+, browsers)
const deep2 = JSON.parse(JSON.stringify(original)); // Lossy (no functions, dates)
```

**FoodDash immutability patterns:**

1. **Redux Toolkit uses Immer** — writes "mutable" code that produces immutable updates:
```javascript
// cartSlice.ts — looks mutable, but Immer creates new objects
reducers: {
  addItem: (state, action) => {
    state.items.push(action.payload);        // Immer intercepts .push()
    state.restaurantId = action.payload.rid; // Immer creates new state object
  },
}
```

2. **Event sourcing — events are immutable records:**
```javascript
const orderEvent = Object.freeze({
  eventType: "ORDER_CREATED",
  orderId: "order-123",
  timestamp: new Date().toISOString(),
  data: Object.freeze({ items: Object.freeze([...]) }),
});
```

3. **Cache invalidation uses new objects, never mutates:**
```javascript
// ✅ Replace cache entry entirely
cache.set(key, { ...updatedData });

// ❌ Never mutate cached objects
// const cached = cache.get(key);
// cached.status = "new"; // Would corrupt other readers!
```

---

## Q18: What are tagged template literals? How would FoodDash use them?

**Answer:**

Tagged templates let you parse template literals with a function:

```javascript
function sql(strings, ...values) {
  // strings: ["SELECT * FROM orders WHERE status = ", " AND customer_id = ", ""]
  // values: ["pending", "user-123"]
  return {
    text: strings.join("$"),  // Parameterized query
    params: values,
  };
}

const query = sql`SELECT * FROM orders WHERE status = ${"pending"} AND customer_id = ${"user-123"}`;
// { text: "SELECT * FROM orders WHERE status = $ AND customer_id = $", params: ["pending", "user-123"] }
```

**FoodDash uses tagged templates via Drizzle ORM:**
```javascript
import { sql } from "drizzle-orm";

// Parameterized query — SQL injection safe
const result = await db.execute(sql`SELECT 1`); // Health check

// Dynamic conditions
const orders = await db.execute(
  sql`SELECT * FROM orders WHERE customer_id = ${customerId} AND status = ${status}`
);
// Drizzle automatically parameterizes — no SQL injection possible
```

**Other use cases:**
- **CSS-in-JS** libraries (styled-components): `` styled.div`color: red;` ``
- **GraphQL** queries: `` gql`query { restaurants { name } }` ``
- **Logging** with structured data: `` log`Order ${orderId} status changed to ${status}` ``

---

## Q19: Explain `async` iterators and `for await...of`. Where does FoodDash use them?

**Answer:**

Async iterators produce values asynchronously. `for await...of` consumes them:

```javascript
// Async generator
async function* streamOrderEvents(orderId) {
  const eventStream = eventBus.subscribe(`order:${orderId}`);
  try {
    while (true) {
      const event = await eventStream.next();
      if (event.type === "ORDER_DELIVERED" || event.type === "ORDER_CANCELLED") {
        yield event;
        return; // Terminal event — stop streaming
      }
      yield event;
    }
  } finally {
    eventStream.unsubscribe();
  }
}

// Consuming
for await (const event of streamOrderEvents("order-123")) {
  console.log(`Status: ${event.data.status}`);
  broadcastToCustomer(event);
}
```

**FoodDash use cases:**

1. **Paginated database reads:**
```javascript
async function* paginateAllOrders(pageSize = 100) {
  let offset = 0;
  while (true) {
    const batch = await db.select().from(orders).limit(pageSize).offset(offset);
    if (batch.length === 0) return;
    yield batch;
    offset += pageSize;
  }
}
```

2. **Processing message queue messages:**
```javascript
async function* consumeQueue(topic) {
  while (true) {
    const message = await messageQueue.receive(topic);
    yield message;
    await message.ack();
  }
}
```

3. **WebSocket message stream:**
```javascript
async function* websocketMessages(ws) {
  const buffer = [];
  ws.on("message", (data) => buffer.push(data));
  while (ws.readyState === WebSocket.OPEN) {
    if (buffer.length > 0) {
      yield JSON.parse(buffer.shift());
    } else {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
}
```

---

## Q20: What is event delegation and event bubbling? How does it affect FoodDash?

**Answer:**

**Event Bubbling:** When an event fires on an element, it bubbles up through the DOM tree to the root.

**Event Delegation:** Attach a single listener to a parent instead of individual listeners on each child.

```javascript
// ❌ Without delegation — 100 listeners for 100 menu items
menuItems.forEach(item => {
  item.addEventListener("click", handleItemClick);
});

// ✅ With delegation — 1 listener
menuContainer.addEventListener("click", (e) => {
  const item = e.target.closest("[data-menu-item-id]");
  if (item) {
    handleItemClick(item.dataset.menuItemId);
  }
});
```

**React handles delegation automatically:**
- React 17+ attaches all listeners to the React root container (`#root`), not individual DOM nodes.
- React's `SyntheticEvent` wraps native events and normalizes browser differences.
- When you write `onClick={handler}` on 100 list items, React creates ONE delegated listener.

**FoodDash implication:**
- The restaurant menu with 50+ items has only one click handler at the root.
- `e.stopPropagation()` stops React's synthetic event bubbling, not the native DOM event.
- Use `e.nativeEvent.stopImmediatePropagation()` for native event stopping.

**Event phases:**
1. **Capture** (top → target) — React: `onClickCapture`
2. **Target** — the element that fired the event
3. **Bubble** (target → top) — React: `onClick`

---

## Q21: Explain `call`, `apply`, and `bind`. How do they differ?

**Answer:**

All three explicitly set the `this` context of a function:

```javascript
function greet(greeting, punctuation) {
  return `${greeting}, ${this.name}${punctuation}`;
}

const user = { name: "Alex" };

// call — args as comma-separated
greet.call(user, "Hello", "!");       // "Hello, Alex!"

// apply — args as array
greet.apply(user, ["Hello", "!"]);    // "Hello, Alex!"

// bind — returns a NEW function with bound this
const boundGreet = greet.bind(user);
boundGreet("Hello", "!");             // "Hello, Alex!"
```

| Method | Invokes immediately? | Arguments | Returns |
|--------|---------------------|-----------|---------|
| `call` | ✅ | Comma-separated | Return value |
| `apply` | ✅ | Array | Return value |
| `bind` | ❌ | Comma-separated (partial) | New bound function |

**FoodDash patterns:**

1. **Bind for method passing:**
```javascript
class EventBus {
  constructor() {
    // Bind so `this` is correct when handler is called by setTimeout
    this.processEvent = this.processEvent.bind(this);
  }
}
```

2. **Apply for variadic functions:**
```javascript
// Math.max doesn't accept arrays
const maxRating = Math.max.apply(null, restaurants.map(r => r.rating));
// Modern: Math.max(...restaurants.map(r => r.rating))
```

3. **Partial application with bind:**
```javascript
const logInfo = logger.log.bind(logger, "INFO");
logInfo("Order created");  // Same as logger.log("INFO", "Order created")
```

**Modern preference:** Arrow functions capture `this` lexically, reducing the need for `bind`. FoodDash uses arrow functions in most cases.

---

## Q22: What is the Temporal Dead Zone (TDZ)? How can it cause bugs?

**Answer:**

The TDZ is the period between entering a scope and the declaration being initialized. Accessing a `let`/`const` variable in its TDZ throws a `ReferenceError`.

```javascript
{
  // TDZ starts for `x`
  console.log(x);  // ReferenceError: Cannot access 'x' before initialization
  let x = 10;      // TDZ ends for `x`
}
```

**Subtle TDZ bugs:**

```javascript
// 1. Function parameter defaults
function createOrder(
  restaurantId,
  items = defaultItems, // ReferenceError — defaultItems not yet declared
  defaultItems = []
) { }

// 2. Class fields
class Service {
  name = this.config.name; // ReferenceError if config is declared below
  config = { name: "OrderService" };
}

// 3. typeof still throws in TDZ
{
  typeof myVar;  // ReferenceError (unlike var, which returns "undefined")
  let myVar = 1;
}
```

**Why TDZ exists:** It catches bugs where you accidentally use a variable before it's initialized. With `var`, the variable would be `undefined` — a silent bug. With `let`/`const`, you get an immediate error.

---

## Q23: What are the differences between `for...in` and `for...of`?

**Answer:**

| Feature | `for...in` | `for...of` |
|---------|-----------|-----------|
| Iterates over | Enumerable property **keys** | Iterable **values** |
| Works on | Objects, arrays | Arrays, strings, Maps, Sets, generators |
| Includes prototype? | ✅ Yes (use `hasOwnProperty` to filter) | ❌ No |
| Order | Not guaranteed for objects | Insertion order |

```javascript
// for...in — object keys
const order = { id: "123", status: "pending", total: 25.99 };
for (const key in order) {
  console.log(key); // "id", "status", "total"
}

// for...of — iterable values
const statuses = ["pending", "confirmed", "preparing"];
for (const status of statuses) {
  console.log(status); // "pending", "confirmed", "preparing"
}

// for...of on Map
const serviceHealth = new Map([["order", "healthy"], ["payment", "degraded"]]);
for (const [name, status] of serviceHealth) {
  console.log(`${name}: ${status}`);
}
```

**FoodDash guideline:**
- Use `for...of` for arrays, Maps, Sets.
- Use `Object.entries()` + `for...of` for objects (safer than `for...in`).
- Use `for...in` only when you specifically need prototype chain properties (rare).

---

## Q24: What is debouncing and throttling? Where does FoodDash use them?

**Answer:**

**Debounce** — Waits until the user stops triggering the event for X ms, then executes once.
**Throttle** — Executes at most once every X ms, regardless of how many times the event fires.

```javascript
// Debounce implementation
function debounce(fn, delayMs) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}

// Throttle implementation
function throttle(fn, intervalMs) {
  let lastCall = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastCall >= intervalMs) {
      lastCall = now;
      fn(...args);
    }
  };
}
```

**FoodDash usage:**

| Pattern | Use Case | Why |
|---------|---------|-----|
| **Debounce** | Restaurant search input | Don't query API on every keystroke — wait 300ms after user stops typing |
| **Debounce** | Delivery address autocomplete | Reduce API calls to geocoding service |
| **Throttle** | Rider location updates | Send GPS position at most once every 5 seconds, not every 100ms |
| **Throttle** | Scroll event on menu page | "Back to top" button visibility check at most every 200ms |
| **Throttle** | WebSocket reconnection | Rate-limit reconnection attempts |

```javascript
// Search debounce in FoodDash
const debouncedSearch = debounce((query) => {
  queryClient.invalidateQueries({ queryKey: ["/api/search", query] });
}, 300);

<Input onChange={(e) => debouncedSearch(e.target.value)} />
```

---

## Q25: Explain `Promise.race`, `Promise.all`, `Promise.allSettled`, and `Promise.any`.

**Answer:**

| Method | Resolves when | Rejects when | FoodDash use case |
|--------|--------------|-------------|-------------------|
| `Promise.all` | ALL fulfill | ANY rejects | Parallel DB + cache + event health checks |
| `Promise.allSettled` | ALL settle (fulfilled or rejected) | Never rejects | Aggregate 10+ microservice health statuses |
| `Promise.race` | FIRST settles | FIRST rejects | Timeout pattern (`operation` vs `timeout`) |
| `Promise.any` | FIRST fulfills | ALL reject (`AggregateError`) | Try multiple payment providers, use first success |

```javascript
// Promise.race — Timeout pattern (used in BaseService)
const result = await Promise.race([
  orderService.createOrder(data),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Timeout")), 10000)
  ),
]);

// Promise.all — Parallel operations
const [restaurant, menu, reviews] = await Promise.all([
  getRestaurant(id),
  getMenu(id),
  getReviews(id),
]);

// Promise.allSettled — Health check aggregation
const healthResults = await Promise.allSettled([
  authService.checkHealth(),
  orderService.checkHealth(),
  paymentService.checkHealth(),
]);
// Always returns all results, even if some services are down

// Promise.any — First successful payment provider
const payment = await Promise.any([
  paypalProvider.charge(amount),
  stripeProvider.charge(amount),
  razorpayProvider.charge(amount),
]);
```

---

## Q26: What is the `structuredClone` API? How does it compare to other cloning methods?

**Answer:**

`structuredClone` (Node 17+ / all modern browsers) creates a true deep clone:

| Method | Deep? | Handles circular refs? | Copies special types? | Speed |
|--------|-------|----------------------|---------------------|-------|
| `{ ...obj }` | ❌ Shallow | N/A | N/A | Fastest |
| `Object.assign()` | ❌ Shallow | N/A | N/A | Fast |
| `JSON.parse(JSON.stringify())` | ✅ Deep | ❌ Throws | ❌ Loses Date, RegExp, undefined, functions | Medium |
| `structuredClone()` | ✅ Deep | ✅ Yes | ✅ Date, RegExp, Map, Set, ArrayBuffer | Slow |

```javascript
// JSON method loses types
const original = { date: new Date(), regex: /test/i, nested: { value: 1 } };
const jsonClone = JSON.parse(JSON.stringify(original));
jsonClone.date; // "2026-02-10T..." — STRING, not Date!
jsonClone.regex; // {} — empty object!

// structuredClone preserves types
const clone = structuredClone(original);
clone.date instanceof Date;   // true
clone.regex instanceof RegExp; // true
clone.nested.value = 99;
original.nested.value;         // 1 — no shared reference
```

**FoodDash use case:** Deep-cloning order objects before passing to Saga compensations — each step gets its own copy that can't be corrupted by concurrent modifications.

**Cannot clone:** Functions, DOM nodes, Symbols, WeakMap/WeakRef.

---

## Q27: What is currying and partial application? Show practical FoodDash examples.

**Answer:**

**Currying** — Transform a function with N arguments into N nested functions of 1 argument each.
**Partial application** — Fix some arguments of a function, returning a new function expecting the rest.

```javascript
// Currying
const multiply = (a) => (b) => a * b;
const double = multiply(2);
double(5);  // 10
double(10); // 20

// Partial application
const log = (level, service, message) =>
  console.log(`[${level}] [${service}] ${message}`);

const orderLog = log.bind(null, "INFO", "OrderService");
orderLog("Order created"); // [INFO] [OrderService] Order created
```

**FoodDash patterns:**

1. **Typed cache key generators:**
```javascript
const CacheKeys = {
  user: (id) => `user:${id}`,
  restaurant: (id) => `restaurant:${id}`,
  restaurantMenu: (id) => `restaurant:${id}:menu`,
};
// CacheKeys.restaurant is a curried/partial function
```

2. **Middleware factory:**
```javascript
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Forbidden" });
  next();
};
// requireRole("admin") returns a middleware function
// requireRole("admin", "restaurant_owner") returns a different middleware
```

3. **Query function factory (React Query):**
```javascript
const getQueryFn = ({ on401 }) => async ({ queryKey }) => {
  // on401 is partially applied — the returned function only needs queryKey
};
```

4. **Event handler factory:**
```javascript
const createEventHandler = (eventType) => (data) => {
  logger.info(`Handling ${eventType}`, data);
  metrics.increment(`events.${eventType}`);
};

eventBus.subscribe("ORDER_CREATED", createEventHandler("ORDER_CREATED"));
eventBus.subscribe("PAYMENT_SUCCESS", createEventHandler("PAYMENT_SUCCESS"));
```

---

## Q28: What is the optional chaining (`?.`) and nullish coalescing (`??`) operator?

**Answer:**

**Optional chaining (`?.`)** — Short-circuits to `undefined` if the left side is `null`/`undefined`:
```javascript
const city = order?.restaurant?.address?.city; // undefined if any level is null
const firstItem = order?.items?.[0];           // Array access
const result = order?.calculateTotal?.();       // Method call
```

**Nullish coalescing (`??`)** — Returns right side ONLY if left is `null`/`undefined` (not `0`, `""`, `false`):
```javascript
const deliveryFee = order.deliveryFee ?? 2.99;  // 0 stays as 0
const deliveryFee2 = order.deliveryFee || 2.99; // 0 becomes 2.99 (bug!)
```

**FoodDash critical distinction:**
```javascript
// Rating of 0 is valid — restaurant hasn't been rated yet
const rating = restaurant.rating ?? 0;    // ✅ Keeps 0 as 0
const rating2 = restaurant.rating || 5;   // ❌ Replaces 0 with 5!

// Minimum order of 0 means no minimum
const minOrder = restaurant.minimumOrder ?? 0;  // ✅ Correct
const minOrder2 = restaurant.minimumOrder || 10; // ❌ Bug: 0 becomes 10

// Discount of 0 means no discount applied
const discount = order.discount ?? 0;  // ✅ Correct
```

**Combined pattern:**
```javascript
const userName = user?.firstName ?? "Guest";
// If user is null → "Guest"
// If user.firstName is null → "Guest"
// If user.firstName is "" → "" (empty string preserved)
```

---

## Q29: What is `Object.entries()`, `Object.keys()`, `Object.values()`, and `Object.fromEntries()`?

**Answer:**

```javascript
const restaurant = { name: "Bella Italia", cuisine: "Italian", rating: 4.5 };

Object.keys(restaurant);    // ["name", "cuisine", "rating"]
Object.values(restaurant);  // ["Bella Italia", "Italian", 4.5]
Object.entries(restaurant);
// [["name", "Bella Italia"], ["cuisine", "Italian"], ["rating", 4.5]]
```

**`Object.fromEntries` — reverse of `Object.entries`:**
```javascript
// Transform object values
const uppercased = Object.fromEntries(
  Object.entries(restaurant).map(([key, val]) =>
    [key, typeof val === "string" ? val.toUpperCase() : val]
  )
);
// { name: "BELLA ITALIA", cuisine: "ITALIAN", rating: 4.5 }
```

**FoodDash patterns:**

1. **Filter object properties:**
```javascript
// Remove null/undefined values before DB insert
const cleanData = Object.fromEntries(
  Object.entries(formData).filter(([_, v]) => v != null)
);
```

2. **Metrics aggregation:**
```javascript
// Convert Map to object for JSON serialization
const metricsObj = Object.fromEntries(metrics.counters);
res.json(metricsObj);
```

3. **Rename object keys (SAP Anti-Corruption Layer):**
```javascript
const fieldMapping = { LIFNR: "id", NAME1: "name", ORT01: "city" };
const vendor = Object.fromEntries(
  Object.entries(sapVendor).map(([sapKey, val]) =>
    [fieldMapping[sapKey] || sapKey, val]
  )
);
```

4. **Group by:**
```javascript
const ordersByStatus = Object.groupBy(orders, order => order.status);
// { pending: [...], confirmed: [...], delivered: [...] }
```

---

## Q30: Explain the `try...catch...finally` pattern and error types in JavaScript.

**Answer:**

```javascript
try {
  const order = await orderService.createOrder(data);
} catch (error) {
  if (error instanceof ValidationError) {
    res.status(400).json({ error: error.message, details: error.details });
  } else if (error instanceof NotFoundError) {
    res.status(404).json({ error: error.message });
  } else {
    res.status(500).json({ error: "Internal server error" });
  }
} finally {
  // Always runs — even if catch re-throws
  metrics.increment("order.create.attempts");
  timer.end(); // Record duration regardless of success/failure
}
```

**Built-in error types:**

| Error Type | When It Occurs |
|-----------|---------------|
| `TypeError` | Wrong type: `null.property`, calling non-function |
| `ReferenceError` | Accessing undeclared variable, TDZ |
| `SyntaxError` | Parse error (usually caught at compile time) |
| `RangeError` | Invalid range: `new Array(-1)`, infinite recursion |
| `URIError` | Invalid URI encoding |
| `EvalError` | (Deprecated) `eval()` misuse |

**FoodDash custom errors:**
```javascript
class AppError extends Error {
  constructor(message, code, statusCode, isOperational = true) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details) { super(message, "VALIDATION_ERROR", 400); this.details = details; }
}
class NotFoundError extends AppError {
  constructor(resource) { super(`${resource} not found`, "NOT_FOUND", 404); }
}
class UnauthorizedError extends AppError {
  constructor() { super("Unauthorized", "UNAUTHORIZED", 401); }
}
```

**`isOperational` flag:** Operational errors (user input, network timeout) are expected and handled. Programming errors (null reference, type error) should crash the process and be fixed.

---

## Q31: What is the event emitter pattern? How does FoodDash's EventBus implement it?

**Answer:**

The event emitter pattern (Observer pattern) allows objects to subscribe to and publish named events:

```javascript
// Node.js built-in
const EventEmitter = require("events");
const emitter = new EventEmitter();

emitter.on("orderCreated", (data) => console.log("Order:", data));
emitter.emit("orderCreated", { orderId: "123" });
```

**FoodDash's custom EventBus extends this pattern with:**

```javascript
class EventBus {
  private subscriptions = new Map();
  private eventLog = [];

  subscribe(eventType, handler) {
    const id = randomUUID();
    const subs = this.subscriptions.get(eventType) || [];
    subs.push({ id, handler });
    this.subscriptions.set(eventType, subs);
    return id; // Return subscription ID for later unsubscribe
  }

  async publish(eventType, data, correlationId, source) {
    const event = {
      id: randomUUID(),
      type: eventType,
      data,
      correlationId,
      source,
      timestamp: new Date(),
    };

    // Log for debugging (last 1000 events)
    this.eventLog.push(event);
    if (this.eventLog.length > 1000) this.eventLog.shift();

    // Fan out to all subscribers
    const handlers = this.subscriptions.get(eventType) || [];
    const wildcardHandlers = this.subscriptions.get("*") || [];

    await Promise.allSettled(
      [...handlers, ...wildcardHandlers].map(sub =>
        sub.handler(data, { correlationId, source, timestamp: event.timestamp })
      )
    );
  }

  unsubscribe(subscriptionId) { /* remove by ID */ }
}
```

**Key enhancements over basic EventEmitter:**
1. **`Promise.allSettled`** — Failed handlers don't block other subscribers.
2. **Wildcard `*`** — Subscribe to ALL events (useful for logging/metrics).
3. **Correlation ID propagation** — Events carry request context for tracing.
4. **Event log** — Last 1000 events stored for debugging.
5. **Subscription IDs** — Returned for cleanup (unlike `.on()` which requires the exact function reference).

---

## Q32: What is `JSON.stringify` replacer and `JSON.parse` reviver?

**Answer:**

**Replacer** — Controls which values are serialized:
```javascript
// Filter sensitive data
const safeOrder = JSON.stringify(order, (key, value) => {
  if (key === "paymentToken") return undefined;  // Exclude
  if (key === "phone") return "***REDACTED***";   // Mask
  return value;
});

// Only include specific keys
const summary = JSON.stringify(order, ["id", "status", "total"]);
```

**Reviver** — Transform values during parsing:
```javascript
// Restore Date objects from JSON
const order = JSON.parse(jsonString, (key, value) => {
  if (key === "createdAt" || key === "updatedAt") {
    return new Date(value); // Convert ISO string to Date
  }
  return value;
});
```

**FoodDash usage:**

1. **Structured logging — redact sensitive data:**
```javascript
function safeStringify(obj) {
  return JSON.stringify(obj, (key, value) => {
    if (["password", "token", "secret", "apiKey"].includes(key)) {
      return "[REDACTED]";
    }
    if (value instanceof Error) {
      return { message: value.message, stack: value.stack };
    }
    return value;
  });
}
```

2. **Cache serialization — preserve Date objects:**
```javascript
class Cache {
  set(key, value, ttl) {
    const serialized = JSON.stringify(value);
    this.store.set(key, { data: serialized, expiresAt: Date.now() + ttl });
  }

  get(key) {
    const entry = this.store.get(key);
    return JSON.parse(entry.data, (k, v) => {
      // Restore dates
      if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
        return new Date(v);
      }
      return v;
    });
  }
}
```

---

## Q33: What is `AbortController` and how does it cancel async operations?

**Answer:**

`AbortController` creates a signal that can abort one or more async operations:

```javascript
const controller = new AbortController();
const { signal } = controller;

// Pass signal to fetch
fetch("/api/restaurants", { signal })
  .then(res => res.json())
  .catch(err => {
    if (err.name === "AbortError") {
      console.log("Fetch cancelled");
    }
  });

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);
```

**FoodDash use cases:**

1. **Cancel stale search requests:**
```javascript
function useRestaurantSearch(query) {
  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/search?q=${query}`, { signal: controller.signal })
      .then(res => res.json())
      .then(setResults)
      .catch(err => {
        if (err.name !== "AbortError") throw err;
      });

    // Cleanup: abort previous request when query changes
    return () => controller.abort();
  }, [query]);
}
```

2. **Request timeout (alternative to Promise.race):**
```javascript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000);

try {
  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(timeoutId);
  return response;
} catch (err) {
  if (err.name === "AbortError") throw new Error("Request timed out");
  throw err;
}
```

3. **Cancel multiple parallel requests:**
```javascript
const controller = new AbortController();
const results = await Promise.all([
  fetch("/api/restaurant/1", { signal: controller.signal }),
  fetch("/api/restaurant/1/menu", { signal: controller.signal }),
  fetch("/api/restaurant/1/reviews", { signal: controller.signal }),
]);
// controller.abort() cancels ALL three
```

---

## Q34: What is `queueMicrotask` and how does it differ from `setTimeout(..., 0)`?

**Answer:**

```javascript
console.log("1");
setTimeout(() => console.log("4 - macrotask"), 0);
queueMicrotask(() => console.log("2 - microtask"));
Promise.resolve().then(() => console.log("3 - microtask (promise)"));
console.log("1b");

// Output: 1, 1b, 2, 3, 4
```

| Feature | `queueMicrotask` | `setTimeout(..., 0)` |
|---------|-----------------|---------------------|
| Queue | Microtask queue | Macrotask queue |
| Timing | After current task, before any macrotask | After current microtasks + current macrotask |
| Priority | Higher | Lower |
| Minimum delay | None | ~4ms in browsers (nested > 5) |

**FoodDash use case:**

```javascript
// Process event bus subscribers with microtask priority
async publish(eventType, data) {
  const handlers = this.subscriptions.get(eventType) || [];
  handlers.forEach(handler => {
    queueMicrotask(() => handler(data)); // Execute after current code, before I/O
  });
}
```

**Why not always microtasks?** Microtasks starve the macrotask queue. If you recursively queue microtasks, the event loop never moves to I/O, timers, or rendering — effectively freezing the application.

---

## Q35: Explain `Object.defineProperty` and property descriptors.

**Answer:**

Every object property has a **descriptor** with configurable attributes:

```javascript
// Data descriptor
Object.defineProperty(obj, "status", {
  value: "pending",
  writable: false,      // Cannot reassign
  enumerable: true,     // Appears in for...in / Object.keys
  configurable: false,  // Cannot delete or reconfigure
});

// Accessor descriptor (getter/setter)
Object.defineProperty(order, "total", {
  get() {
    return this.subtotal + this.deliveryFee - this.discount;
  },
  set(value) {
    throw new Error("Total is computed — cannot set directly");
  },
  enumerable: true,
  configurable: false,
});
```

**FoodDash patterns:**

1. **Computed properties on order objects:**
```javascript
class Order {
  constructor(data) {
    Object.assign(this, data);

    // Read-only computed total
    Object.defineProperty(this, "total", {
      get: () => this.subtotal + this.deliveryFee - this.discount,
      enumerable: true,
    });
  }
}
```

2. **Non-enumerable metadata:**
```javascript
// Attach internal metadata that doesn't appear in JSON.stringify
Object.defineProperty(event, "_internal", {
  value: { processedAt: Date.now(), retryCount: 0 },
  enumerable: false, // Hidden from serialization
});
```

3. **TypeScript's `readonly` compiles to this:**
```typescript
readonly id: string;
// Equivalent at runtime (when enforced):
Object.defineProperty(this, "id", { writable: false });
```

---

## Q36: What are `WeakSet` and when should you use it?

**Answer:**

`WeakSet` stores objects weakly — they're garbage collected when no other references exist.

| Feature | Set | WeakSet |
|---------|-----|---------|
| Value types | Any | Objects only |
| GC'd | ❌ Prevents GC | ✅ Values are GC'd |
| Iterable | ✅ | ❌ |
| `.size` | ✅ | ❌ |

**FoodDash use case — Track processed orders without memory leak:**
```javascript
const processedOrders = new WeakSet();

function processOrder(order) {
  if (processedOrders.has(order)) {
    return; // Already processed — idempotent
  }
  processedOrders.add(order);

  // Process...
}
// When `order` object is GC'd, it's automatically removed from WeakSet
```

**Another use — prevent circular reference issues:**
```javascript
function deepClone(obj, seen = new WeakSet()) {
  if (obj === null || typeof obj !== "object") return obj;
  if (seen.has(obj)) return "[Circular]";
  seen.add(obj);

  const clone = Array.isArray(obj) ? [] : {};
  for (const key of Object.keys(obj)) {
    clone[key] = deepClone(obj[key], seen);
  }
  return clone;
}
```

---

## Q37: What is the difference between `null` and `undefined`?

**Answer:**

| Aspect | `undefined` | `null` |
|--------|-----------|--------|
| Type | `typeof undefined === "undefined"` | `typeof null === "object"` (historic bug) |
| Meaning | Variable declared but not assigned | Intentional absence of value |
| JSON | `JSON.stringify({ a: undefined })` → `{}` (omitted) | `JSON.stringify({ a: null })` → `{"a":null}` |
| Default params | Triggers default: `fn(undefined)` | Does NOT trigger: `fn(null)` |
| `==` comparison | `null == undefined` → `true` | `undefined == null` → `true` |
| Arithmetic | `undefined + 1` → `NaN` | `null + 1` → `1` (coerces to 0) |

**FoodDash conventions:**
```javascript
// Database: null means "no value" — explicit
const order = {
  deliveryPartnerId: null,   // Not yet assigned
  actualDeliveryTime: null,  // Not yet delivered
  couponId: null,            // No coupon applied
};

// TypeScript: undefined means "optional" — may not exist
interface Order {
  specialInstructions?: string; // undefined if not provided
}

// API responses: null for explicit absence
res.json({ order: null }); // "We looked, there is no order"
// vs
res.json({});               // "We didn't include order info"
```

---

## Q38: What is `globalThis` and why was it introduced?

**Answer:**

`globalThis` provides a standardized way to access the global object across all environments:

| Environment | Old Way | New Way |
|-------------|---------|---------|
| Browser | `window` | `globalThis` |
| Node.js | `global` | `globalThis` |
| Web Workers | `self` | `globalThis` |
| Deno | `globalThis` | `globalThis` |

```javascript
// Cross-environment code
globalThis.setTimeout;  // Works everywhere
globalThis.process;     // Only exists in Node.js
globalThis.window;      // Only exists in browsers
```

**FoodDash relevance:** Since FoodDash shares code between server (Node.js) and client (browser) via the `shared/` directory, `globalThis` could be used for environment-agnostic utility functions. In practice, FoodDash uses environment checks:

```javascript
const isServer = typeof window === "undefined";
const isProduction = globalThis.process?.env?.NODE_ENV === "production";
```

---

## Q39: Explain `Array.prototype` methods — `map`, `filter`, `reduce`, `find`, `some`, `every`, `flatMap`.

**Answer:**

| Method | Returns | Mutates? | Short-circuits? |
|--------|---------|---------|-----------------|
| `map` | New array (same length) | ❌ | ❌ |
| `filter` | New array (≤ length) | ❌ | ❌ |
| `reduce` | Single value | ❌ | ❌ |
| `find` | First match or `undefined` | ❌ | ✅ |
| `some` | Boolean (any match?) | ❌ | ✅ |
| `every` | Boolean (all match?) | ❌ | ✅ |
| `flatMap` | New array (mapped + flattened 1 level) | ❌ | ❌ |

**FoodDash examples:**

```javascript
// map — transform orders to summaries
const summaries = orders.map(o => ({ id: o.id, total: o.total, status: o.status }));

// filter — active restaurants only
const active = restaurants.filter(r => r.isActive && r.rating >= 3.5);

// reduce — calculate cart total
const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

// find — get order by idempotency key
const existing = orders.find(o => o.idempotencyKey === key);

// some — check if any order is pending
const hasPending = orders.some(o => o.status === "pending");

// every — check if all health checks passed
const allHealthy = healthChecks.every(check => check.status === "pass");

// flatMap — flatten menu categories into items
const allItems = categories.flatMap(cat => cat.items);
// Equivalent to: categories.map(c => c.items).flat()
```

**Performance tip:** Use `find`/`some`/`every` when you can short-circuit. Don't use `filter(...)[0]` when `find()` does the same with early exit.

---

## Q40: What is memoization? Implement a generic memoize function.

**Answer:**

Memoization caches function results based on arguments — if the same args are called again, return the cached result.

```javascript
function memoize(fn) {
  const cache = new Map();

  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);

    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

// Usage
const calculateDistance = memoize((lat1, lon1, lat2, lon2) => {
  // Haversine formula — expensive math
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  // ... full calculation
  return distance;
});

// First call: computes. Subsequent same-args calls: instant.
calculateDistance(40.71, -74.00, 34.05, -118.24); // Computes
calculateDistance(40.71, -74.00, 34.05, -118.24); // Cache hit!
```

**FoodDash applications:**

1. **Memoized selectors (Redux `reselect`):**
```javascript
const selectCartTotal = createSelector(
  [selectCartItems],
  (items) => items.reduce((sum, item) => sum + item.price * item.quantity, 0)
);
// Only recomputes when items actually change
```

2. **Memoized React components:** `React.memo` memoizes by props (shallow comparison).

3. **Cache-aside pattern** is essentially memoization at the infrastructure level:
```javascript
const restaurants = await cache.getOrSet(
  "restaurants:all",
  () => db.select().from(restaurantsTable), // Only called on cache miss
  300
);
```

**Caveats:** Don't memoize functions with side effects or where args produce too many unique keys (unbounded cache growth). Use LRU cache for bounded memory.

---

## Q41: What are `Private class fields` (`#`) and how do they differ from TypeScript's `private`?

**Answer:**

| Feature | `#` (Runtime private) | `private` (TypeScript only) |
|---------|---------------------|---------------------------|
| Enforcement | Runtime — truly inaccessible | Compile-time only — accessible at runtime |
| Access from outside | `TypeError` at runtime | TS error at compile, works at runtime |
| Inheritance | Not accessible in subclasses | Accessible in subclasses (TypeScript quirk) |
| Performance | Slightly slower (V8 optimization) | No runtime cost |

```javascript
class CircuitBreaker {
  #failures = 0;         // Runtime private — truly hidden
  #state = "closed";
  #nextAttempt = null;

  async execute(operation) {
    if (this.#state === "open") {
      if (Date.now() < this.#nextAttempt) throw new Error("Circuit open");
      this.#state = "half-open";
    }
    // ...
  }

  get state() { return this.#state; }        // Controlled access
  get failures() { return this.#failures; }  // Read-only exposure
}

const cb = new CircuitBreaker();
cb.#failures; // SyntaxError: Private field '#failures' must be declared in an enclosing class
cb.state;     // "closed" — via getter
```

**FoodDash uses TypeScript `private`** because:
1. The codebase is TypeScript-only — compile-time enforcement is sufficient.
2. No runtime cost.
3. Better IDE support (autocomplete, refactoring).
4. `#` syntax has edge cases with Proxy, serialization, and testing.

---

## Q42: What is `Object.is()` and how does it differ from `===`?

**Answer:**

`Object.is()` is like `===` but handles two edge cases differently:

```javascript
// Case 1: NaN
NaN === NaN;           // false (IEEE 754 spec)
Object.is(NaN, NaN);  // true ✅

// Case 2: Signed zeros
+0 === -0;             // true
Object.is(+0, -0);    // false ✅

// Everything else is the same
Object.is(1, 1);      // true (same as ===)
Object.is("a", "a");  // true (same as ===)
Object.is(null, undefined); // false (same as ===)
```

**React uses `Object.is` internally** for:
- `useState` — determines if state has changed (skip re-render if `Object.is(oldState, newState)`).
- `useMemo`/`useCallback` — dependency comparison.
- `React.memo` — shallow prop comparison.

**FoodDash implication:**
```javascript
// ❌ This won't trigger a re-render because Object.is([], []) is false
// but Object.is(sameRef, sameRef) is true
const [items, setItems] = useState([]);
setItems(items); // Same reference — no re-render
items.push(newItem);
setItems(items); // Same reference — no re-render!

// ✅ Create new array
setItems([...items, newItem]); // New reference — re-renders
```

---

## Q43: What is tail call optimization (TCO) and does JavaScript support it?

**Answer:**

TCO allows recursive functions to execute in constant stack space if the recursive call is the last operation (tail position):

```javascript
// Without TCO — each call adds to the stack
function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1); // Not tail position: multiplication happens AFTER recursion
}
factorial(100000); // Stack overflow!

// With TCO — tail-recursive (accumulator pattern)
function factorial(n, acc = 1) {
  if (n <= 1) return acc;
  return factorial(n - 1, n * acc); // Tail position: nothing happens after recursion
}
```

**JavaScript TCO status:**
- **Specified** in ES2015 (ES6).
- **Only Safari** implements it.
- **V8 (Node.js/Chrome) does NOT implement TCO** — they removed it, citing debugging difficulty.

**FoodDash workaround — trampoline pattern:**
```javascript
function trampoline(fn) {
  return (...args) => {
    let result = fn(...args);
    while (typeof result === "function") {
      result = result();
    }
    return result;
  };
}

const factorial = trampoline(function f(n, acc = 1) {
  if (n <= 1) return acc;
  return () => f(n - 1, n * acc); // Return thunk instead of recursing
});

factorial(100000); // Works! No stack overflow.
```

**In practice**, FoodDash uses iterative approaches (`for`, `while`) instead of recursion for performance-critical code like tree traversals and retry logic.

---

## Q44: What are `Intl` APIs and how does FoodDash use them for formatting?

**Answer:**

The `Intl` namespace provides internationalization utilities:

```javascript
// Number formatting (prices)
const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
formatter.format(25.99); // "$25.99"

// Date formatting
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});
dateFormatter.format(new Date()); // "Feb 10, 2026, 2:30 PM"

// Relative time
const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
rtf.format(-5, "minutes"); // "5 minutes ago"
rtf.format(1, "hour");     // "in 1 hour"

// List formatting
const listFormatter = new Intl.ListFormat("en", { type: "conjunction" });
listFormatter.format(["Italian", "Indian", "Chinese"]); // "Italian, Indian, and Chinese"

// Plural rules
const pluralRules = new Intl.PluralRules("en");
function pluralize(count, singular, plural) {
  return `${count} ${pluralRules.select(count) === "one" ? singular : plural}`;
}
pluralize(1, "order", "orders"); // "1 order"
pluralize(5, "order", "orders"); // "5 orders"
```

**FoodDash uses these for:**
- Order totals displayed as `$25.99`.
- "Order placed 5 minutes ago" on the tracking page.
- ETA display: "Arriving in 15 minutes".
- Restaurant cuisines listed as "Italian, Indian, and Chinese".

---

## Q45: What is the difference between synchronous and asynchronous error handling?

**Answer:**

**Synchronous errors** — Caught by `try...catch`:
```javascript
try {
  JSON.parse("invalid json");
} catch (error) {
  // ✅ Caught — SyntaxError
}
```

**Asynchronous errors — Promises:**
```javascript
// ❌ try...catch does NOT catch promise rejections
try {
  fetch("/api/orders"); // Returns a Promise, doesn't throw
} catch (error) {
  // Never reached!
}

// ✅ Correct — use .catch() or await
try {
  const res = await fetch("/api/orders");
} catch (error) {
  // ✅ Caught — network error
}

// ✅ Or promise chain
fetch("/api/orders")
  .then(res => res.json())
  .catch(error => console.error("Fetch failed:", error));
```

**Unhandled rejections in Node.js:**
```javascript
// FoodDash global handler
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Promise rejection", {
    reason: reason?.message || reason,
    stack: reason?.stack,
  });
  // In production: alert monitoring, but don't crash
  // process.exit(1); // Optional: crash to restart cleanly
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", { error: error.message, stack: error.stack });
  process.exit(1); // Must exit — state is corrupted
});
```

**Key difference:** `uncaughtException` means corrupted state — you MUST exit. `unhandledRejection` is often a forgotten `.catch()` — you can log and continue.

---

## Q46: What is `eval()` and why should it never be used?

**Answer:**

`eval()` executes a string as JavaScript code:

```javascript
eval("2 + 2"); // 4
eval("alert('hacked')"); // Executes arbitrary code!
```

**Why FoodDash NEVER uses `eval()`:**

1. **Security** — Arbitrary code execution. If user input reaches `eval`, it's a critical vulnerability:
```javascript
// ❌ DANGEROUS
const sortBy = req.query.sort;
eval(`orders.sort((a, b) => a.${sortBy} - b.${sortBy})`);
// Attacker sends: sort=id); require("child_process").exec("rm -rf /"); (
```

2. **Performance** — V8 cannot optimize `eval` code. It disables many JIT optimizations.

3. **Debugging** — `eval` code doesn't appear in stack traces properly.

4. **ESLint** — `no-eval: "error"` and `no-implied-eval: "error"` rules are enforced.

**FoodDash alternatives:**
```javascript
// Dynamic property access
const value = order[sortBy]; // Safe — only accesses existing properties

// Dynamic function execution
const operations = { add: (a, b) => a + b, subtract: (a, b) => a - b };
operations[operationName]?.(x, y); // Safe — only calls predefined functions

// JSON parsing (not eval!)
const data = JSON.parse(jsonString); // Safe — only produces data, never executes code
```

---

## Q47: Explain `requestAnimationFrame` and `requestIdleCallback`.

**Answer:**

**`requestAnimationFrame(callback)`** — Runs callback before the next repaint (~60fps = every 16.6ms):
```javascript
// Smooth animation
function animate() {
  element.style.left = `${position++}px`;
  if (position < 500) {
    requestAnimationFrame(animate); // Schedule next frame
  }
}
requestAnimationFrame(animate);
```

**`requestIdleCallback(callback)`** — Runs callback when the browser is idle (no urgent work):
```javascript
// Non-urgent work — analytics, prefetching
requestIdleCallback((deadline) => {
  while (deadline.timeRemaining() > 0 && queue.length > 0) {
    processAnalyticsEvent(queue.shift());
  }
}, { timeout: 2000 }); // Max wait time
```

| API | When it runs | Use case | FoodDash example |
|-----|-------------|---------|-----------------|
| `rAF` | Before repaint | Animations, DOM measurements | Scroll-based restaurant card animations |
| `rIC` | When idle | Non-urgent background work | Prefetching next page data, analytics |

**FoodDash example — Lazy-load restaurant images:**
```javascript
requestIdleCallback(() => {
  // Prefetch restaurant images during idle time
  const offscreenImages = document.querySelectorAll("[data-src]");
  offscreenImages.forEach(img => {
    img.src = img.dataset.src;
  });
});
```

**Note:** `rIC` is not available in all environments. FoodDash uses a polyfill: `setTimeout(callback, 1)`.

---

## Q48: What are JavaScript decorators (Stage 3)?

**Answer:**

Decorators are a proposal (Stage 3 — nearly finalized) for wrapping classes, methods, and fields:

```javascript
// Method decorator — logging
function logged(originalMethod, context) {
  return function (...args) {
    console.log(`Calling ${context.name} with`, args);
    const result = originalMethod.apply(this, args);
    console.log(`${context.name} returned`, result);
    return result;
  };
}

class OrderService {
  @logged
  createOrder(data) {
    return db.insert(orders).values(data);
  }
}
```

**FoodDash-relevant decorator patterns (via TypeScript experimental decorators):**

1. **@Retry — automatic retry logic:**
```javascript
function Retry(maxAttempts = 3) {
  return function (target, context) {
    return async function (...args) {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await target.apply(this, args);
        } catch (e) {
          if (attempt === maxAttempts) throw e;
          await new Promise(r => setTimeout(r, 2 ** attempt * 100));
        }
      }
    };
  };
}
```

2. **@Cached — cache-aside pattern:**
```javascript
function Cached(ttlSeconds = 300) {
  return function (target, context) {
    const cache = new Map();
    return async function (...args) {
      const key = JSON.stringify(args);
      if (cache.has(key)) return cache.get(key);
      const result = await target.apply(this, args);
      cache.set(key, result);
      setTimeout(() => cache.delete(key), ttlSeconds * 1000);
      return result;
    };
  };
}
```

3. **@Timed — metrics collection:**
```javascript
function Timed(target, context) {
  return async function (...args) {
    const start = Date.now();
    try {
      return await target.apply(this, args);
    } finally {
      metrics.observe(`${context.name}.duration_ms`, Date.now() - start);
    }
  };
}
```

**FoodDash currently uses BaseService's `executeWithResilience()` instead of decorators** because decorators are still a proposal.

---

## Q49: Explain `Error.captureStackTrace` and custom stack traces.

**Answer:**

`Error.captureStackTrace` (V8/Node.js specific) creates a `.stack` property on an object, excluding frames above a given function:

```javascript
class AppError extends Error {
  constructor(message, code, statusCode) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;

    // Remove the AppError constructor frame from the stack trace
    // Stack trace starts from where AppError was called, not where it's defined
    Error.captureStackTrace(this, this.constructor);
  }
}

// Without captureStackTrace:
// Error: Not found
//   at new AppError (errors.js:5)      ← Internal noise
//   at new NotFoundError (errors.js:12) ← Internal noise
//   at getOrder (orderService.js:42)    ← Useful
//   at router.get (routes.js:15)        ← Useful

// With captureStackTrace(this, this.constructor):
// Error: Not found
//   at getOrder (orderService.js:42)    ← Starts here (useful!)
//   at router.get (routes.js:15)
```

**FoodDash uses this in all custom error classes:**
```javascript
class NotFoundError extends AppError {
  constructor(resource) {
    super(`${resource} not found`, "NOT_FOUND", 404);
    // Stack trace starts from caller, not NotFoundError constructor
  }
}

class ValidationError extends AppError {
  constructor(message, details) {
    super(message, "VALIDATION_ERROR", 400);
    this.details = details;
  }
}
```

**Also useful for `Error.prepareStackTrace`** — customize stack trace formatting for structured logging:
```javascript
Error.prepareStackTrace = (error, structuredStackTrace) => {
  return structuredStackTrace.map(frame => ({
    file: frame.getFileName(),
    line: frame.getLineNumber(),
    function: frame.getFunctionName(),
  }));
};
```

---

## Q50: What is the `FinalizationRegistry` and when would you use it?

**Answer:**

`FinalizationRegistry` lets you register a callback that fires when an object is garbage collected:

```javascript
const registry = new FinalizationRegistry((heldValue) => {
  console.log(`Object with ID ${heldValue} was garbage collected`);
  // Cleanup: close file handle, release resource, etc.
});

function createConnection(id) {
  const connection = { id, socket: openSocket() };
  registry.register(connection, id); // When `connection` is GC'd, callback fires with `id`
  return connection;
}

let conn = createConnection("conn-1");
conn = null; // Eligible for GC
// Eventually: "Object with ID conn-1 was garbage collected"
```

**FoodDash use case — Detect resource leaks:**

```javascript
// In development: detect unclosed WebSocket connections
const wsRegistry = new FinalizationRegistry((userId) => {
  logger.warn(`WebSocket for ${userId} was GC'd without being closed — potential leak!`);
  metrics.increment("ws.leaks");
});

function trackWebSocket(ws, userId) {
  wsRegistry.register(ws, userId);
}
```

**Important caveats:**
1. **Timing is unpredictable** — GC may never run (short-lived process) or run much later.
2. **Don't rely on it for critical cleanup** — Use explicit `.close()` / `.dispose()` methods.
3. **Use only for diagnostics and debugging** — Detecting leaks, logging, metrics.

**FoodDash uses explicit cleanup** (WebSocket `close` event, EventBus `unsubscribe`, cache TTL expiration) rather than relying on GC callbacks. `FinalizationRegistry` is only used in development for leak detection.

---
