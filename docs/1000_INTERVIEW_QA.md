# FoodDash — 1000 Interview Questions & Answers

## For 6+ Years Fullstack Engineer | React.js · Node.js · JavaScript · Redux · System Design · HLD · LLD · Machine Coding · React Coding

> **Project**: FoodDash — Production-Grade Food Delivery Platform  
> **Stack**: TypeScript (Full-Stack), React 18, Express.js, PostgreSQL, Drizzle ORM, Redux Toolkit, Zustand, React Query, Wouter, Framer Motion, shadcn/ui, TailwindCSS  
> **Architecture**: Microservices + Event-Driven + CQRS + Saga Pattern + Hexagonal Architecture  
> **Last Updated**: February 2026

---

# PART 1 — REACT.JS (50 Questions)

---

## Q1: What is the Virtual DOM and how does React 18's reconciliation differ from earlier versions?

**Answer:**

The Virtual DOM is a lightweight in-memory representation of the real DOM. When state changes, React creates a new Virtual DOM tree, diffs it against the previous one (reconciliation), and applies only the minimal set of changes to the real DOM.

**React 18 key differences:**
- **Concurrent Rendering**: React 18 introduced concurrent features that allow rendering to be interruptible. The reconciler can pause work on a low-priority update to handle a high-priority one (like user input).
- **Automatic Batching**: In React 17, batching only worked inside React event handlers. React 18 batches state updates inside `setTimeout`, promises, and native event handlers too.
- **Transitions API** (`useTransition`, `startTransition`): Lets you mark certain updates as non-urgent, so the UI stays responsive.

```typescript
// React 18 automatic batching — both setState calls result in ONE re-render
setTimeout(() => {
  setCount(c => c + 1);
  setFlag(f => !f);
  // In React 17: 2 re-renders. In React 18: 1 re-render (batched)
}, 1000);
```

**In FoodDash**, React 18 concurrent features ensure that real-time order tracking updates (WebSocket events) don't block the user from interacting with the cart or navigating the menu.

---

## Q2: Explain the three-layer state management architecture used in FoodDash. Why not just use Redux for everything?

**Answer:**

FoodDash uses three distinct state management layers:

| Layer | Technology | Manages | Why |
|-------|-----------|---------|-----|
| **Server State** | React Query (TanStack Query v5) | API data — restaurants, orders, user profile | Auto-caching, background refetch, deduplication, stale-while-revalidate |
| **Global Client State** | Redux Toolkit + redux-persist | Auth state, Cart state | Predictable updates, DevTools, survives page refresh via localStorage |
| **Local UI State** | `useState` / Zustand | Modals, tooltips, theme, form inputs | Ephemeral, component-scoped, no persistence needed |

**Why not Redux for everything:**

1. **Server state is fundamentally different** — it's async, has TTLs, needs background refetching, and requires deduplication. React Query handles this declaratively in ~3 lines. With Redux, you'd write 30+ lines (action types, thunks, reducer cases for loading/success/error, selectors).

2. **Performance** — Redux notifies ALL connected components on any store change (unless carefully memoized with `reselect`). React Query only re-renders components subscribed to the specific `queryKey` that changed.

3. **Separation of concerns** — Server state follows REST/cache semantics (stale, fresh, invalidation). Client state follows user-action semantics (add to cart, toggle theme). Mixing them in one store creates confusion.

4. **Cart uses Redux because** it must persist across page refreshes (`redux-persist`), needs predictable add/remove/update transitions, and benefits from Redux DevTools.

---

## Q3: How does React Query's `staleTime: Infinity` configuration work and why does FoodDash use it?

**Answer:**

```typescript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,           // Data never automatically becomes stale
      refetchOnWindowFocus: false,   // No refetch on tab switch
      refetchInterval: false,        // No polling
      retry: false,                  // No automatic retry
    },
  },
});
```

**`staleTime: Infinity` means:**
- Cached data is considered "fresh" forever — React Query will never automatically refetch in the background.
- Data is only re-fetched when you explicitly call `queryClient.invalidateQueries()` or when the component remounts without cached data.

**Why FoodDash uses it:**
1. **Explicit cache control** — The app uses mutation callbacks (`onSuccess`) to manually invalidate relevant queries after writes. This gives precise control over when data refreshes.
2. **Reduced server load** — No unnecessary background refetches for restaurant menus that rarely change.
3. **Predictable UX** — Users see consistent data without sudden UI shifts from background updates.
4. **WebSocket-driven updates** — Real-time data (order status, driver location) comes via WebSocket events, not polling. So React Query doesn't need to refetch.

**Tradeoff:** If another user modifies a restaurant's menu, the current user won't see updates until they navigate away and back (or trigger a manual refresh). This is acceptable for a food delivery app where menus don't change second-to-second.

---

## Q4: What is the Provider nesting order in FoodDash's App component and why does it matter?

**Answer:**

```tsx
<Provider store={store}>                              {/* 1 */}
  <PersistGate loading={null} persistor={persistor}>  {/* 2 */}
    <ThemeProvider>                                    {/* 3 */}
      <AuthInitializer />                              {/* 4 */}
      <QueryClientProvider client={queryClient}>       {/* 5 */}
        <TooltipProvider>                              {/* 6 */}
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </PersistGate>
</Provider>
```

**Order matters critically:**

1. **Redux Provider first** — `AuthInitializer` calls `useAppDispatch()`, so Redux must be its ancestor.
2. **PersistGate second** — Blocks rendering until persisted cart state is rehydrated from `localStorage`. Without this, the cart count would flash "0" then jump to the real count.
3. **ThemeProvider third** — Theme context (dark/light) must be available before any UI renders.
4. **AuthInitializer fourth** — Dispatches `fetchUser()` thunk on mount. Must be inside Redux Provider but before `QueryClientProvider` so auth is bootstrapped early.
5. **QueryClientProvider fifth** — All page components use `useQuery`, so the client must wrap the Router.
6. **TooltipProvider innermost** — Pure UI utility with no upstream dependencies.

**Common mistake:** Placing `QueryClientProvider` outside `Provider` — then you can't access Redux state for auth tokens inside `queryFn`.

---

## Q5: What is the `AuthInitializer` component pattern and why is it a separate component?

**Answer:**

```typescript
function AuthInitializer() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(fetchUser());
  }, [dispatch]);
  return null; // Renders nothing
}
```

This is the **Initializer Component** pattern — a component whose sole purpose is executing side effects on mount with zero DOM output.

**Why separate:**
1. **Separation of Concerns** — Auth initialization is a side effect, not UI. Embedding it in `App.tsx` mixes rendering logic with bootstrapping.
2. **Single Responsibility** — If auth logic changes (token refresh, SSO negotiation), only this component changes.
3. **Render-free** — Returns `null`, zero DOM impact. It's purely a side-effect orchestrator.
4. **Redux lifecycle bridge** — Without it, components render without user data, causing a flash of unauthenticated UI before the thunk resolves.

---

## Q6: How does the ProtectedRoute component work? Is it a security boundary?

**Answer:**

```typescript
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
- **Loading guard** — Prevents flash of sign-in page while `fetchUser` is in-flight.
- **Role-based gating** — `allowedRoles` enables route-level authorization for `admin`, `restaurant_owner`, `delivery_partner`.
- **Redux-driven** — Uses centralized Redux selectors for consistent auth state.

**No, it is NOT a security boundary.** It's a UX guard only. True authorization happens server-side via the `requireRole()` Express middleware + RBAC/ABAC permission checks. A malicious user could bypass client-side route guards by directly calling API endpoints. Server-side validation is the actual security layer.

---

## Q7: Why was Wouter chosen over React Router? What are the tradeoffs?

**Answer:**

| Aspect | Wouter (2KB) | React Router (15KB+) |
|--------|-------------|---------------------|
| Bundle size | ~2KB gzipped | ~15KB gzipped |
| API surface | Minimal: `Route`, `Switch`, `Link`, `useLocation` | Full: loaders, actions, nested routes, data APIs |
| Data loading | Not included (use React Query) | Built-in loaders/actions (v6.4+) |
| Nested routing | Manual | First-class support |
| SSR | Basic | Full support |

**Why Wouter for FoodDash:**
- **Client-side SPA** — no SSR needed.
- **React Query handles data loading** — no need for React Router's loaders.
- **Flat route structure** — 11 routes, no deep nesting.
- **7.5x smaller bundle** for identical functionality.

**Tradeoff accepted:** If FoodDash needed SSR or complex nested layouts, React Router would be the better choice.

---

## Q8: How does `useQuery` work with the centralized `getQueryFn` in FoodDash?

**Answer:**

```typescript
export const getQueryFn = ({ on401 }) => async ({ queryKey }) => {
  const res = await fetch(queryKey.join("/"), { credentials: "include" });
  if (on401 === "returnNull" && res.status === 401) return null;
  await throwIfResNotOk(res);
  return await res.json();
};
```

**How it works:**
1. **queryKey as URL** — React Query's `queryKey` (e.g., `["/api/restaurants"]`) is joined and used as the fetch URL. This is a convention that eliminates duplicate URL strings.
2. **Credentials included** — `credentials: "include"` sends session cookies with every request for authentication.
3. **401 handling** — `on401: "returnNull"` gracefully handles unauthenticated state (returns `null` instead of throwing). Used by the `useAuth` hook so the app doesn't crash when the user isn't logged in.
4. **Error propagation** — `throwIfResNotOk` throws for non-2xx responses, which React Query catches and surfaces via `error` in the hook.

**Why this pattern?**
- **DRY** — One place to configure fetch behavior (credentials, headers, error handling).
- **Consistent 401 handling** — All queries behave the same way when the session expires.
- **Testable** — Easy to mock the query function in tests.

---

## Q9: What are React hooks rules and why do they exist? How would violating them cause bugs in FoodDash?

**Answer:**

**The two rules:**
1. **Only call hooks at the top level** — Never inside loops, conditions, or nested functions.
2. **Only call hooks from React functions** — Only from functional components or custom hooks.

**Why they exist:** React tracks hooks by their call order (index). If a hook is conditionally called, the indices shift on re-render, causing React to return the wrong state for the wrong hook.

**FoodDash example bug:**
```typescript
// ❌ WRONG — conditional hook
function Restaurant({ id }) {
  if (!id) return <NotFound />;
  const { data } = useQuery({ queryKey: ["/api/restaurants", id] }); // Hook after early return!
}

// ✅ CORRECT
function Restaurant({ id }) {
  const { data } = useQuery({
    queryKey: ["/api/restaurants", id],
    enabled: !!id,  // Conditionally enable, not conditionally call
  });
  if (!id) return <NotFound />;
}
```

The `enabled` option in React Query is specifically designed to handle conditional fetching without violating hook rules.

---

## Q10: Explain `useMemo` and `useCallback`. When should you NOT use them?

**Answer:**

- **`useMemo(fn, deps)`** — Memoizes a computed value. Only recomputes when dependencies change.
- **`useCallback(fn, deps)`** — Memoizes a function reference. Returns the same function instance when dependencies haven't changed.

**When to use in FoodDash:**
```typescript
// useMemo — expensive sort on restaurant list
const sortedRestaurants = useMemo(() => {
  return restaurants.sort((a, b) => b.rating - a.rating);
}, [restaurants]);

// useCallback — stable reference passed to child component
const handleAddToCart = useCallback((item) => {
  dispatch(addItem({ menuItem: item, restaurantId, restaurantName }));
}, [dispatch, restaurantId, restaurantName]);
```

**When NOT to use:**
1. **Cheap computations** — `useMemo` for `a + b` is slower than just computing it (memo overhead > computation cost).
2. **Primitives** — Strings, numbers are compared by value. Memoizing `"hello"` is pointless.
3. **No child components** — If no child receives the callback as prop, `useCallback` prevents nothing.
4. **Single-render components** — Components that mount once and never re-render gain nothing from memoization.

**Rule of thumb:** Profile first, memoize only when you've identified an actual performance problem.

---

## Q11: What is the difference between controlled and uncontrolled components? Which approach does FoodDash use?

**Answer:**

| Aspect | Controlled | Uncontrolled |
|--------|-----------|-------------|
| State owner | React (via `useState`) | DOM (via `ref`) |
| Value access | `value={state}` + `onChange` | `ref.current.value` |
| Validation | On every keystroke | On submit |
| Re-renders | Every keystroke | Only on submit |

**FoodDash uses controlled components** because:
1. **shadcn/ui + Radix** — The component library is built on controlled patterns. Inputs receive `value` and `onChange`.
2. **Real-time validation** — Delivery address, phone number, and coupon code fields validate as the user types.
3. **Redux integration** — Cart quantity inputs sync directly with Redux state.

```typescript
// Controlled input in Checkout page
<Input
  value={deliveryAddress}
  onChange={(e) => setDeliveryAddress(e.target.value)}
  placeholder="Enter delivery address"
/>
```

**Uncontrolled would be used** for file uploads or integrating with non-React libraries where React shouldn't own the value.

---

## Q12: How does React's Context API work internally? Why did FoodDash move away from Context for auth state?

**Answer:**

**How Context works:**
1. `createContext()` creates a Provider-Consumer pair.
2. Provider holds a value. When the value changes, ALL consumers re-render.
3. There's no built-in selector mechanism — you can't subscribe to a slice of context.

**Why FoodDash migrated auth from Context to Redux:**
1. **Re-render problem** — Context triggers re-renders for ALL consumers when ANY part of the value changes. If `user` object is in context, updating `user.lastLogin` re-renders every component that consumes auth context — even those that only need `user.role`.
2. **No built-in persistence** — Context values reset on page refresh. Redux + `redux-persist` automatically saves to `localStorage`.
3. **No DevTools** — Context changes are invisible in development. Redux DevTools show every action, state diff, and time-travel debugging.
4. **No middleware** — With Redux, `createAsyncThunk` handles async operations (API calls for login/logout). With Context, you'd write custom async logic inside `useEffect`.

**Context is still used** for the ThemeProvider (dark/light mode) because it's simple, rarely changes, and doesn't benefit from DevTools.

---

## Q13: What is prop drilling and how does FoodDash avoid it?

**Answer:**

**Prop drilling** = passing props through multiple intermediate components that don't use them, just to reach a deeply nested child.

```typescript
// ❌ Prop drilling
<App user={user}>
  <Layout user={user}>
    <Sidebar user={user}>
      <UserAvatar user={user} />  // Only this component needs user!
    </Sidebar>
  </Layout>
</App>
```

**FoodDash avoids it with:**

1. **Redux selectors** — Any component at any depth can call `useAppSelector(selectUser)` directly.
2. **React Query** — Any component calls `useQuery({ queryKey: ["/api/restaurants"] })`. No need to pass restaurant data down.
3. **Context** — Theme is available everywhere via `useTheme()`.
4. **Composition** — Passing children as props instead of data:

```typescript
// ✅ Composition pattern
<Layout>
  <Sidebar>
    <UserAvatar />  {/* UserAvatar fetches its own data via Redux */}
  </Sidebar>
</Layout>
```

---

## Q14: Explain React's `useEffect` cleanup function. Where is it critical in FoodDash?

**Answer:**

The cleanup function returned by `useEffect` runs when: (a) the component unmounts, or (b) before the effect re-runs due to dependency changes.

**Critical in FoodDash for WebSocket connections:**

```typescript
useEffect(() => {
  const ws = new WebSocket(`ws://localhost:5000/ws?userId=${userId}`);

  ws.onmessage = (event) => {
    const { type, data } = JSON.parse(event.data);
    if (type === "order_update") updateOrderStatus(data);
    if (type === "location_update") updateRiderLocation(data);
  };

  // Cleanup: close WebSocket on unmount
  return () => {
    ws.close();
  };
}, [userId]);
```

**Without cleanup:**
- WebSocket connections accumulate as users navigate between pages.
- Memory leaks from orphaned event listeners.
- Stale closures receive events meant for different order tracking sessions.
- Server wastes resources maintaining dead connections.

**Other FoodDash cleanup needs:**
- Clearing `setInterval` for auto-refresh timers.
- Aborting in-flight `fetch` requests when the user navigates away.
- Unsubscribing from EventBus subscriptions.

---

## Q15: What are React Error Boundaries? How would you implement one for FoodDash?

**Answer:**

Error Boundaries catch JavaScript errors in the component tree during rendering, lifecycle methods, and constructors. They **cannot** catch errors in event handlers, async code, or SSR.

```typescript
class ErrorBoundary extends React.Component<Props, State> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to monitoring service (e.g., Sentry)
    logger.error("UI Error", { error: error.message, componentStack: errorInfo.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <Button onClick={() => this.setState({ hasError: false })}>
            Try Again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**FoodDash usage strategy:**
- **Global boundary** wrapping `<Router />` — catches catastrophic failures.
- **Feature-level boundaries** around OrderTracking, AdminDashboard — isolated features shouldn't crash the entire app.
- **Error boundaries are class components** — this is one of the few remaining use cases for class components in React 18.

---

## Q16: What is React.memo and when should you use it?

**Answer:**

`React.memo` is a higher-order component that prevents re-renders if props haven't changed (shallow comparison).

```typescript
// Without memo — re-renders every time parent re-renders
const MenuItemCard = ({ item, onAdd }) => { /* ... */ };

// With memo — only re-renders if item or onAdd change
const MenuItemCard = React.memo(({ item, onAdd }) => { /* ... */ });
```

**When to use in FoodDash:**
1. **Restaurant list items** — When the parent Home page re-renders (e.g., filter change), restaurant cards that haven't changed shouldn't re-render.
2. **Menu item cards** — On the Restaurant page, 50+ menu items render. Memoizing prevents unnecessary re-renders when only the cart state changes.

**When NOT to use:**
1. **Components that always receive new props** — If a parent passes inline objects or arrow functions, `React.memo` is useless because `{} !== {}` on every render. Combine with `useMemo`/`useCallback`.
2. **Simple components** — The overhead of shallow comparison can exceed the cost of just re-rendering a `<span>`.

---

## Q17: How does the `useAppSelector` and `useAppDispatch` typed hooks pattern work?

**Answer:**

```typescript
// store/hooks.ts
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from './store';

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

**Why typed hooks:**
1. **Type inference** — `useAppSelector(state => state.cart.items)` automatically infers the return type as `CartItem[]`. Plain `useSelector` returns `unknown`.
2. **Dispatch typing** — `useAppDispatch` knows about thunks. You can `dispatch(fetchUser())` where `fetchUser` is a `createAsyncThunk` — plain `useDispatch` wouldn't type-check async thunks.
3. **DRY** — You type `RootState` and `AppDispatch` once, then every component gets full type safety for free.
4. **Refactoring safety** — If you rename a slice or change state shape, TypeScript immediately flags all consuming components.

---

## Q18: Explain `useRef` vs `useState`. When would you use `useRef` for a value in FoodDash?

**Answer:**

| Feature | `useState` | `useRef` |
|---------|-----------|---------|
| Triggers re-render on change | ✅ Yes | ❌ No |
| Persists across renders | ✅ Yes | ✅ Yes |
| Synchronous access | ❌ (batched) | ✅ `.current` |
| DOM access | ❌ | ✅ `ref={myRef}` |

**Use `useRef` in FoodDash for:**

1. **WebSocket instance** — Store the WebSocket connection without triggering re-renders on every message:
```typescript
const wsRef = useRef<WebSocket | null>(null);
useEffect(() => {
  wsRef.current = new WebSocket(url);
  return () => wsRef.current?.close();
}, []);
```

2. **Previous value tracking** — Compare current order status with previous:
```typescript
const prevStatusRef = useRef(order.status);
useEffect(() => {
  if (prevStatusRef.current !== order.status) {
    showStatusChangeAnimation();
  }
  prevStatusRef.current = order.status;
}, [order.status]);
```

3. **Timer IDs** — Store `setInterval` IDs for cleanup without re-rendering.

4. **Scroll position** — Track scroll position on the restaurant menu page for "Back to Top" button visibility.

---

## Q19: What is the difference between `useEffect` and `useLayoutEffect`? When would you use `useLayoutEffect` in FoodDash?

**Answer:**

| Aspect | `useEffect` | `useLayoutEffect` |
|--------|------------|-------------------|
| Timing | After paint (asynchronous) | Before paint (synchronous) |
| Blocks rendering | No | Yes |
| Use case | Data fetching, subscriptions | DOM measurements, scroll position |

**`useLayoutEffect` in FoodDash:**

```typescript
// Measure tooltip position before the browser paints
useLayoutEffect(() => {
  const rect = tooltipRef.current?.getBoundingClientRect();
  if (rect) {
    setPosition({ top: rect.bottom, left: rect.left });
  }
}, [isOpen]);
```

**Why not always `useLayoutEffect`?** It's synchronous and blocks the paint. Using it for data fetching would freeze the UI. FoodDash uses it only for:
- **Tooltip positioning** (shadcn/ui Radix primitives).
- **Animation measurements** (Framer Motion layout transitions).
- **Scroll restoration** when navigating back to the restaurant list.

99% of effects in FoodDash use `useEffect`.

---

## Q20: How does React's key prop work? What happens if you use array index as key?

**Answer:**

The `key` prop helps React identify which items in a list have changed, been added, or removed. It's used by the reconciler to match old and new tree nodes.

**Index as key is dangerous when the list can reorder:**

```typescript
// ❌ Problem: Using index as key for cart items
{cartItems.map((item, index) => (
  <CartItemRow key={index} item={item} />
))}
// If user removes item 0, all subsequent items shift index.
// React thinks item 1 became item 0 — it reuses the wrong DOM nodes.
// Input fields (quantity) retain stale values.

// ✅ Correct: Use stable unique ID
{cartItems.map((item) => (
  <CartItemRow key={item.menuItemId} item={item} />
))}
```

**FoodDash uses:**
- `restaurant.id` for restaurant list keys.
- `menuItem.id` for menu item keys.
- `order.id` for order history keys.
- `orderEvent.id` for event sourcing timeline entries.

**Index is okay ONLY when:** The list is static, never reordered, and never filtered (e.g., a fixed navigation menu).

---

## Q21: What is code-splitting in React and how does FoodDash implement it?

**Answer:**

Code-splitting breaks the JavaScript bundle into smaller chunks that are loaded on demand, reducing the initial load time.

**FoodDash implements code-splitting via:**

1. **Vite's automatic code-splitting** — Each route is a separate chunk:
```typescript
// Vite + dynamic imports = automatic code splitting
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const RestaurantDashboard = lazy(() => import("./pages/RestaurantDashboard"));
const DeliveryDashboard = lazy(() => import("./pages/DeliveryDashboard"));
```

2. **Route-based splitting with Wouter:**
```typescript
<Suspense fallback={<LoadingSpinner />}>
  <Switch>
    <Route path="/admin" component={AdminDashboard} />
    <Route path="/restaurant-dashboard" component={RestaurantDashboard} />
  </Switch>
</Suspense>
```

3. **Vite's tree-shaking** — Unused code from shadcn/ui components is eliminated at build time. Only imported components are bundled.

**Benefits for FoodDash:**
- Customer landing page loads fast — admin/restaurant/delivery dashboards are separate chunks.
- Vite generates hashed filenames for long-term browser caching.
- `React.lazy` + `Suspense` shows a loading spinner while the chunk downloads.

---

## Q22: Explain React's Strict Mode. What does it do and why is it useful?

**Answer:**

`<React.StrictMode>` is a development-only tool that:

1. **Double-invokes effects** — Calls `useEffect` setup + cleanup + setup to detect missing cleanup logic.
2. **Double-renders components** — Renders twice to detect impure renders (side effects during render).
3. **Warns about deprecated APIs** — Flags `componentWillMount`, `findDOMNode`, etc.

**Why it's useful for FoodDash:**
- Catches WebSocket connections that aren't properly closed (effect without cleanup).
- Detects mutations during render (e.g., sorting the restaurant array in-place instead of creating a copy).
- Identifies legacy patterns before they become bugs in concurrent mode.

**Note:** Strict Mode doesn't run in production. The double-invocations only happen in development.

---

## Q23: How does `useReducer` differ from `useState` and when would you use it?

**Answer:**

```typescript
// useState — simple state transitions
const [count, setCount] = useState(0);

// useReducer — complex state logic with defined actions
const [state, dispatch] = useReducer(reducer, initialState);
```

**Use `useReducer` when:**
1. **State depends on previous state with multiple fields** — e.g., a form with 10 fields and validation.
2. **State transitions are complex** — Like an order status FSM (pending → confirmed → preparing → ...).
3. **You need to pass dispatch down** — `dispatch` identity is stable (unlike `setState` closures), so children wrapped in `React.memo` won't re-render.

**FoodDash example — Checkout form:**
```typescript
type CheckoutAction =
  | { type: "SET_ADDRESS"; payload: string }
  | { type: "APPLY_COUPON"; payload: string }
  | { type: "SET_PAYMENT_METHOD"; payload: string }
  | { type: "SUBMIT" }
  | { type: "ERROR"; payload: string };

function checkoutReducer(state: CheckoutState, action: CheckoutAction) {
  switch (action.type) {
    case "SET_ADDRESS":
      return { ...state, address: action.payload, error: null };
    case "APPLY_COUPON":
      return { ...state, couponCode: action.payload };
    // ...
  }
}
```

**In practice**, FoodDash uses Redux Toolkit's `createSlice` (which uses Immer under the hood) instead of raw `useReducer` for global state, because it's less boilerplate and provides DevTools.

---

## Q24: What is the React component lifecycle in functional components?

**Answer:**

Functional components don't have lifecycle methods, but hooks map to the same phases:

| Class Lifecycle | Functional Equivalent | FoodDash Example |
|----------------|----------------------|-----------------|
| `constructor` | `useState` / `useRef` initial value | Initial cart state |
| `componentDidMount` | `useEffect(() => {}, [])` | `AuthInitializer` dispatches `fetchUser()` |
| `componentDidUpdate` | `useEffect(() => {}, [dep])` | Re-fetch menu when `restaurantId` changes |
| `componentWillUnmount` | `useEffect` return cleanup | Close WebSocket connection |
| `shouldComponentUpdate` | `React.memo` | Memoize `MenuItemCard` |
| `getDerivedStateFromError` | Error Boundary (class only) | Global error boundary |

**Important nuances:**
- `useEffect` runs after paint, not synchronously like `componentDidMount`.
- There's no `componentWillMount` equivalent — and you shouldn't need one. Initialize in `useState` or `useRef`.
- `useEffect` with deps combines `componentDidMount` AND `componentDidUpdate` — be careful not to accidentally run mount-only logic on updates.

---

## Q25: How does Framer Motion integrate with React for animations in FoodDash?

**Answer:**

Framer Motion provides declarative animation components that work with React's component model:

```typescript
import { motion, AnimatePresence } from "framer-motion";

// Animate on mount
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
  <RestaurantCard restaurant={restaurant} />
</motion.div>

// Animate on unmount (requires AnimatePresence)
<AnimatePresence>
  {isCartOpen && (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25 }}
    >
      <CartDrawer />
    </motion.div>
  )}
</AnimatePresence>
```

**FoodDash uses Framer Motion for:**
1. **Page transitions** — Fade-in when navigating between routes.
2. **Cart drawer** — Slide-in/slide-out animation.
3. **Order status updates** — Pulse animation when status changes.
4. **Restaurant list** — Staggered entrance animation for cards.
5. **Loading skeletons** — Shimmer effect while data loads.

**Why Framer Motion over CSS animations:**
- **AnimatePresence** handles exit animations (CSS can't animate unmounting components).
- **Layout animations** automatically animate between layout changes.
- **Gesture support** — drag, tap, hover variants.
- **Spring physics** — more natural feeling than CSS easing functions.

---

## Q26: What are Higher-Order Components (HOCs) and why has FoodDash moved away from them?

**Answer:**

An HOC is a function that takes a component and returns a new component with enhanced behavior:

```typescript
// Traditional HOC pattern
function withAuth(WrappedComponent) {
  return function AuthenticatedComponent(props) {
    const user = useAuth();
    if (!user) return <Redirect to="/sign-in" />;
    return <WrappedComponent {...props} user={user} />;
  };
}

const ProtectedDashboard = withAuth(AdminDashboard);
```

**Why FoodDash uses hooks instead:**
1. **Composability** — Multiple hooks compose linearly. Multiple HOCs create a "wrapper hell" in DevTools.
2. **TypeScript** — HOCs have terrible TypeScript support. The wrapped component's props need complex generic gymnastics. Hooks naturally infer types.
3. **Transparency** — With hooks, you see exactly what data a component uses. With HOCs, injected props are implicit.
4. **Testing** — Components using hooks are tested directly. HOC-wrapped components require unwrapping or rendering the full wrapper.

**FoodDash's hook-based equivalent:**
```typescript
// Custom hook — cleaner than HOC
function AdminDashboard() {
  const { user, isAuthenticated } = useAppSelector(selectAuth);
  // Component owns its data dependencies explicitly
}
```

**One remaining HOC:** `React.memo` is technically an HOC, and FoodDash still uses it for performance optimization.

---

## Q27: How does the CSS design system work with TailwindCSS and shadcn/ui in FoodDash?

**Answer:**

FoodDash uses a three-layer design system:

**Layer 1 — CSS Custom Properties (Design Tokens):**
```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  --secondary: 210 40% 96.1%;
  --destructive: 0 84.2% 60.2%;
  --radius: 0.5rem;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
}
```

**Layer 2 — Tailwind configured with CSS vars:**
```typescript
// tailwind.config.ts
colors: {
  primary: {
    DEFAULT: "hsl(var(--primary))",
    foreground: "hsl(var(--primary-foreground))",
  },
}
```

**Layer 3 — shadcn/ui components using Tailwind classes:**
```typescript
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground",
        outline: "border border-input bg-background hover:bg-accent",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
      },
    },
  }
);
```

**Theme switching:** Toggle `dark` class on `<html>` element. All CSS vars update automatically. Persisted to `localStorage`.

---

## Q28: What is the `apiRequest` utility and why does FoodDash centralize API calls?

**Answer:**

```typescript
export async function apiRequest(method: string, url: string, data?: unknown): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",  // Always send session cookies
  });
  await throwIfResNotOk(res);
  return res;
}
```

**Why centralize:**
1. **Credentials** — `credentials: "include"` is required for session-based auth. Forgetting it in one fetch call breaks authentication silently.
2. **Error handling** — `throwIfResNotOk` ensures non-2xx responses throw errors that React Query catches. Without it, `fetch` resolves successfully on 404/500.
3. **Headers** — `Content-Type: application/json` is only set when data exists. GET requests shouldn't have this header.
4. **Single point of change** — If you add auth tokens, CSRF headers, or request logging, you change one function.
5. **Consistency** — Every component uses the same error format, header strategy, and credential policy.

---

## Q29: How does React's reconciliation algorithm work? What is the diffing heuristic?

**Answer:**

React uses a heuristic O(n) diffing algorithm (instead of the theoretical O(n³) tree-diff):

**Two assumptions:**
1. **Different types produce different trees** — If a `<div>` becomes a `<span>`, React destroys the entire old subtree and builds a new one (no attempt to reuse).
2. **Keys identify stable elements** — Among siblings, `key` tells React which items are the same across renders.

**Diffing process:**
1. **Same type** → Keeps the DOM node, updates changed attributes, then recurses on children.
2. **Different type** → Unmounts old, mounts new (all child state is lost).
3. **Lists without keys** → Compares by index (inefficient for reorders).
4. **Lists with keys** → Matches old and new by key (efficient inserts, deletes, reorders).

**FoodDash implication:** On the Home page, filtering restaurants by cuisine doesn't unmount/remount all cards — React matches them by `key={restaurant.id}` and only updates the ones that changed.

---

## Q30: What is `React.lazy` and how does it relate to `Suspense`?

**Answer:**

`React.lazy` enables dynamic import of components. `Suspense` provides a fallback UI while the lazy component loads.

```typescript
const AdminDashboard = React.lazy(() => import("./pages/AdminDashboard"));

function App() {
  return (
    <Suspense fallback={<div className="animate-pulse">Loading...</div>}>
      <Route path="/admin" component={AdminDashboard} />
    </Suspense>
  );
}
```

**How it works:**
1. `React.lazy` wraps a dynamic `import()` call that returns a module with a default export.
2. On first render, the import is triggered — the component is "suspended".
3. `Suspense` catches the suspension and renders its `fallback`.
4. When the import resolves, React re-renders with the loaded component.

**FoodDash uses this for:**
- Admin, Restaurant, and Delivery dashboards — These are role-specific pages that most users never visit. No need to include them in the main bundle.
- Results in 3 separate JS chunks instead of one monolithic bundle.

---

## Q31: How does conditional rendering work in React and what patterns does FoodDash use?

**Answer:**

**5 patterns used in FoodDash:**

```typescript
// 1. Short-circuit (&&) — render or nothing
{isAuthenticated && <UserAvatar user={user} />}

// 2. Ternary — render A or B
{isLoading ? <Skeleton /> : <RestaurantList restaurants={data} />}

// 3. Early return — guard clause
if (!order) return <NotFound />;
return <OrderDetails order={order} />;

// 4. Switch/object map — multiple conditions
const statusBadge = {
  pending: <Badge variant="outline">Pending</Badge>,
  confirmed: <Badge variant="default">Confirmed</Badge>,
  preparing: <Badge className="bg-yellow-500">Preparing</Badge>,
  delivered: <Badge className="bg-green-500">Delivered</Badge>,
}[order.status];

// 5. Component map — role-based rendering
const dashboards: Record<UserRole, React.ComponentType> = {
  customer: Home,
  restaurant_owner: RestaurantDashboard,
  delivery_partner: DeliveryDashboard,
  admin: AdminDashboard,
};
const Dashboard = dashboards[user.role];
return <Dashboard />;
```

**Anti-pattern to avoid:**
```typescript
// ❌ Falsy gotcha with numbers
{items.length && <ItemList items={items} />}
// When items.length === 0, renders "0" on screen!

// ✅ Correct
{items.length > 0 && <ItemList items={items} />}
```

---

## Q32: What are React Portals and when would FoodDash use them?

**Answer:**

Portals render children into a DOM node that exists outside the parent component's DOM hierarchy:

```typescript
import { createPortal } from "react-dom";

function Modal({ children, isOpen }) {
  if (!isOpen) return null;
  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      {children}
    </div>,
    document.body
  );
}
```

**FoodDash use cases:**
1. **Modal dialogs** — shadcn/ui's `Dialog` component uses Radix's Portal internally to render at `document.body`. This prevents CSS `overflow: hidden` or `z-index` issues from parent containers.
2. **Toast notifications** — `Toaster` component renders toasts in a portal so they overlay all other content.
3. **Tooltip popups** — Radix `Tooltip` uses portals to escape parent clipping boundaries.

**Key point:** Even though the DOM node is rendered outside the parent, React event bubbling still works through the component tree (not the DOM tree). A click inside a portaled Modal still bubbles to the React parent.

---

## Q33: How does the FoodDash Checkout page manage complex form state?

**Answer:**

The Checkout page manages multiple interconnected state pieces:

```typescript
function Checkout() {
  // Cart state from Redux
  const cartItems = useAppSelector(selectCartItems);
  const cartTotal = useAppSelector(selectCartTotal);
  const dispatch = useAppDispatch();

  // Local form state
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("paypal");

  // Server mutation
  const createOrder = useMutation({
    mutationFn: (orderData) => apiRequest("POST", "/api/orders", orderData),
    onSuccess: () => {
      dispatch(clearCart());
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      navigate("/orders");
    },
  });

  const handleSubmit = () => {
    createOrder.mutate({
      restaurantId: cartItems[0]?.restaurantId,
      items: cartItems.map(item => ({
        menuItemId: item.id,
        quantity: item.quantity,
        price: item.price,
      })),
      deliveryAddress,
      specialInstructions,
      couponCode,
      paymentMethod,
      idempotencyKey: `order-${Date.now()}-${userId}`,
    });
  };
}
```

**Key patterns:**
1. **Dual state sources** — Cart from Redux (persistent), form fields from `useState` (ephemeral).
2. **Optimistic flow** — `clearCart()` dispatched on success, not before.
3. **Idempotency key** — Prevents duplicate orders if the user double-clicks submit.
4. **Cache invalidation** — `invalidateQueries` for orders list after creation.

---

## Q34: What is the `useTransition` hook in React 18?

**Answer:**

`useTransition` marks state updates as non-urgent, letting React keep the UI responsive during expensive re-renders:

```typescript
const [isPending, startTransition] = useTransition();

function handleSearchChange(e) {
  // Urgent: update the input field immediately
  setInputValue(e.target.value);

  // Non-urgent: filter the restaurant list (can be deferred)
  startTransition(() => {
    setFilteredRestaurants(
      restaurants.filter(r =>
        r.name.toLowerCase().includes(e.target.value.toLowerCase())
      )
    );
  });
}

return (
  <>
    <Input value={inputValue} onChange={handleSearchChange} />
    {isPending ? <Spinner /> : <RestaurantList restaurants={filteredRestaurants} />}
  </>
);
```

**How it helps FoodDash:**
- Typing in the restaurant search box remains snappy.
- The restaurant list re-filtering (which might involve 100+ items) is deferred.
- `isPending` lets you show a subtle loading indicator without blocking the input.

**Key difference from `setTimeout`:** React's scheduler is smarter — it can interrupt the deferred work if a new urgent update arrives. `setTimeout` would queue the work blindly.

---

## Q35: How does `useDeferredValue` work and when would you use it?

**Answer:**

`useDeferredValue` returns a deferred version of a value that "lags behind" the current value during heavy renders:

```typescript
function RestaurantSearch({ query }) {
  const deferredQuery = useDeferredValue(query);
  
  // This filters using the deferred (potentially stale) query
  const results = useMemo(() => {
    return restaurants.filter(r => r.name.includes(deferredQuery));
  }, [deferredQuery]);

  return (
    <div style={{ opacity: query !== deferredQuery ? 0.7 : 1 }}>
      <RestaurantList restaurants={results} />
    </div>
  );
}
```

**Difference from `useTransition`:**
- `useTransition` — you control WHEN to start the transition. Used with `setState`.
- `useDeferredValue` — you pass a VALUE and React defers it. Used when you don't control the state update (e.g., it comes from a parent prop).

**FoodDash use case:** When the Home page receives a search query from a URL parameter, you can't wrap the parent's state update in `startTransition`. Instead, defer the received value.

---

## Q36: What is the React Fiber architecture?

**Answer:**

Fiber is React's internal reconciliation engine (introduced in React 16, enhanced in React 18). It replaces the old stack-based reconciler with a linked-list-based approach that supports:

1. **Incremental rendering** — Work can be split into chunks and spread across multiple frames.
2. **Prioritization** — User interactions get higher priority than data fetching.
3. **Pause/resume** — React can pause rendering work to handle urgent updates.
4. **Abort** — Work that's no longer needed can be discarded.

**How it works internally:**
- Each React element is represented as a **Fiber node** (a JavaScript object).
- Fiber nodes form a linked list (child → sibling → return/parent).
- React walks this tree in two phases:
  - **Render phase** (interruptible) — Computes the new tree, finds changes. No side effects.
  - **Commit phase** (synchronous) — Applies changes to the DOM. Cannot be interrupted.

**FoodDash benefit:** When a WebSocket pushes a live order tracking update while the user is scrolling through the restaurant menu, Fiber prioritizes the scroll interaction and defers the tracking update to the next frame.

---

## Q37: How do you handle forms with Zod validation on the frontend?

**Answer:**

FoodDash uses Zod schemas that are auto-generated from the Drizzle ORM schema, ensuring frontend and backend use identical validation:

```typescript
// Shared Zod schema (generated from Drizzle)
export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Frontend form validation
function CheckoutForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (formData: unknown) => {
    const result = insertOrderSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors = result.error.issues.reduce((acc, issue) => {
        acc[issue.path.join(".")] = issue.message;
        return acc;
      }, {} as Record<string, string>);
      setErrors(fieldErrors);
      return;
    }
    // result.data is fully typed and validated
    createOrder.mutate(result.data);
  };
}
```

**Benefits:**
1. **Shared validation** — Same schema validates on client (immediate feedback) and server (security).
2. **Type inference** — `z.infer<typeof insertOrderSchema>` gives you the TypeScript type for free.
3. **Structured errors** — `safeParse` returns per-field error messages for inline form validation.

---

## Q38: How does React Query's `useMutation` work for creating orders in FoodDash?

**Answer:**

```typescript
const createOrderMutation = useMutation({
  mutationFn: async (orderData: CreateOrderInput) => {
    const res = await apiRequest("POST", "/api/v1/orders", orderData);
    return await res.json();
  },
  onSuccess: (data) => {
    // 1. Clear the cart
    dispatch(clearCart());
    // 2. Invalidate orders cache so the list refreshes
    queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
    // 3. Show success toast
    toast({ title: "Order placed!", description: `Order #${data.id}` });
    // 4. Navigate to tracking page
    navigate(`/order/${data.id}`);
  },
  onError: (error) => {
    toast({ variant: "destructive", title: "Order failed", description: error.message });
  },
});

// Trigger
<Button
  onClick={() => createOrderMutation.mutate(orderPayload)}
  disabled={createOrderMutation.isPending}
>
  {createOrderMutation.isPending ? "Placing Order..." : "Place Order"}
</Button>
```

**Key features of `useMutation`:**
- **`isPending`** — Disables the button to prevent double-submission.
- **`onSuccess` callbacks** — Chain side effects (clear cart → invalidate cache → toast → navigate).
- **`onError`** — User-friendly error feedback.
- **No caching** — Unlike queries, mutations don't cache results (they're one-time actions).

---

## Q39: What is the difference between `React.Fragment` and `<div>` wrapper?

**Answer:**

```typescript
// Fragment — no extra DOM node
<>
  <OrderHeader />
  <OrderItems />
  <OrderTotal />
</>

// div — adds an extra DOM node
<div>
  <OrderHeader />
  <OrderItems />
  <OrderTotal />
</div>
```

**Why Fragments matter in FoodDash:**
1. **Table rows** — `<tr>` can only be a direct child of `<tbody>`. A `<div>` wrapper breaks the table structure. Fragment solves this for the Orders table.
2. **Flexbox/Grid layout** — Extra `<div>` wrappers break CSS layouts by adding unexpected flex/grid items.
3. **Performance** — Fewer DOM nodes = faster renders, less memory.
4. **Semantic HTML** — Screen readers and accessibility tools get cleaner markup.

**Keyed Fragments** — When you need a key on a fragment (list rendering):
```typescript
{orders.map(order => (
  <React.Fragment key={order.id}>
    <OrderRow order={order} />
    <OrderDivider />
  </React.Fragment>
))}
```

---

## Q40: How does the Theme system work in FoodDash? How does dark mode toggle?

**Answer:**

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
    // Toggle class on <html> element
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

**How it works end-to-end:**
1. **CSS Variables** — `:root` defines light theme values. `.dark` class overrides them.
2. **TailwindCSS** — Uses `hsl(var(--primary))` so all components automatically adapt.
3. **Toggle** — `ThemeToggle` component calls `toggleTheme()` which adds/removes `.dark` class.
4. **Persistence** — Theme saved to `localStorage`, restored on next visit.
5. **System preference fallback** — Uses `prefers-color-scheme` media query when no localStorage value exists.

**No FOUC (Flash of Unstyled Content):** The theme is applied before first paint because it's read from `localStorage` synchronously in `useState` initializer.

---

## Q41: What are Custom Hooks and what rules must they follow?

**Answer:**

Custom Hooks are functions prefixed with `use` that encapsulate reusable stateful logic.

**Rules:**
1. Must start with `use` — enables React's linter to enforce hook rules.
2. Can call other hooks — `useState`, `useEffect`, `useContext`, other custom hooks.
3. Follow the same rules as built-in hooks — only call at top level, only from React functions.

**FoodDash custom hooks:**

```typescript
// useAuth — encapsulates authentication state
function useAuth() {
  const { data: user, isLoading } = useQuery({ queryKey: ["/api/auth/user"] });
  return { user, isLoading, isAuthenticated: !!user };
}

// useMobile — responsive breakpoint detection
function useMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

// useToast — notification system
function useToast() {
  const [toasts, setToasts] = useState([]);
  const toast = (config) => setToasts(prev => [...prev, { id: genId(), ...config }]);
  const dismiss = (id) => setToasts(prev => prev.filter(t => t.id !== id));
  return { toasts, toast, dismiss };
}
```

**Why custom hooks are powerful:**
- **Testable** — Test the hook independently from any component using `renderHook`.
- **Composable** — `useAuth` can internally use `useQuery` which uses `useContext`.
- **Shareable** — Extract common patterns once, use everywhere.

---

## Q42: How does React handle synthetic events? What are the performance implications?

**Answer:**

React wraps native DOM events in `SyntheticEvent` objects that:
1. **Normalize cross-browser differences** — Same API across all browsers.
2. **Pool events** (React ≤16) — Events were reused for performance. In React 17+, pooling was removed.
3. **Delegate to root** — React 17+ attaches event listeners to the root container, not `document`.

**Performance implications for FoodDash:**

```typescript
// Event delegation means 1 listener handles all clicks on 100 menu items
<div onClick={(e) => {
  const itemId = e.target.dataset.itemId;
  if (itemId) handleAddToCart(itemId);
}}>
  {menuItems.map(item => (
    <MenuItemCard key={item.id} data-item-id={item.id} />
  ))}
</div>
```

**React 17+ change:** Events are attached to the React root (`#root`) instead of `document`. This means multiple React apps on the same page don't interfere with each other's events.

**`e.stopPropagation()`** stops propagation within the React tree. To stop a native event, use `e.nativeEvent.stopImmediatePropagation()`.

---

## Q43: What are render props and how do they compare to hooks?

**Answer:**

Render props is a pattern where a component receives a function as prop that returns React elements:

```typescript
// Render prop pattern
<DataFetcher url="/api/restaurants">
  {({ data, isLoading }) => (
    isLoading ? <Skeleton /> : <RestaurantList restaurants={data} />
  )}
</DataFetcher>

// Hook equivalent (preferred in modern React)
function RestaurantPage() {
  const { data, isLoading } = useQuery({ queryKey: ["/api/restaurants"] });
  return isLoading ? <Skeleton /> : <RestaurantList restaurants={data} />;
}
```

**Hooks replaced render props because:**
1. **No nesting** — Render props create deeply nested JSX. Multiple render props = "pyramid of doom".
2. **Better composition** — Hooks compose linearly (`const a = useX(); const b = useY(a);`).
3. **TypeScript** — Hooks infer types naturally. Render props need explicit generic annotations.
4. **Performance** — Render prop functions create new closures on every render.

**Still useful when:** You need to share behavior with the JSX structure itself (e.g., Radix UI's `Slot` pattern, headless UI libraries).

---

## Q44: How does React handle batching of state updates? What changed in React 18?

**Answer:**

**React 17:**
- Batching ONLY inside React event handlers:
```typescript
function handleClick() {
  setA(1);  // No re-render yet
  setB(2);  // Still no re-render
  // ONE re-render with both updates
}

setTimeout(() => {
  setA(1);  // Re-render!
  setB(2);  // Re-render again! (2 total)
}, 100);
```

**React 18 (Automatic Batching):**
- Batching everywhere — event handlers, `setTimeout`, promises, native events:
```typescript
setTimeout(() => {
  setA(1);  // No re-render yet
  setB(2);  // ONE re-render (batched!)
}, 100);

fetch("/api/orders").then(() => {
  setOrders(data);     // No re-render yet
  setIsLoading(false); // ONE re-render (batched!)
});
```

**FoodDash benefit:** When a WebSocket message arrives with order status + rider location, both state updates batch into one re-render instead of two.

**Opt out:** Use `flushSync` if you need immediate re-render (rare):
```typescript
import { flushSync } from "react-dom";
flushSync(() => setCount(1)); // Forces immediate re-render
```

---

## Q45: What is React Server Components (RSC) and how does it relate to FoodDash's architecture?

**Answer:**

React Server Components (RSC) are components that render on the server and send the result as a serialized format (not HTML) to the client. They can directly access databases, file systems, and APIs without exposing them to the client bundle.

**FoodDash does NOT use RSC because:**
1. **Vite-based SPA** — FoodDash uses Vite (client-side build tool), not a framework that supports RSC (like Next.js).
2. **Express.js backend** — The server is Express with REST APIs, not a React server framework.
3. **WebSocket-heavy** — Real-time features need client-side interactivity that RSC can't provide.

**If FoodDash migrated to RSC:**
- Restaurant list page could be a Server Component (data fetched directly from DB, zero client JS).
- Menu page could mix: Server Component for static menu data + Client Component for cart interactions.
- OrderTracking MUST stay client-side (WebSocket, real-time updates).

**RSC vs SSR:** SSR renders React to HTML strings. RSC renders to a special stream format that preserves React's component tree, enabling partial updates without full page reloads.

---

## Q46: How would you implement optimistic updates in FoodDash?

**Answer:**

Optimistic updates update the UI immediately before the server confirms, then rollback on error:

```typescript
const updateOrderStatus = useMutation({
  mutationFn: (data) => apiRequest("PATCH", `/api/orders/${data.id}/status`, data),

  // Optimistic update
  onMutate: async (newData) => {
    // 1. Cancel in-flight queries to prevent race conditions
    await queryClient.cancelQueries({ queryKey: ["/api/orders", newData.id] });

    // 2. Snapshot the previous value
    const previousOrder = queryClient.getQueryData(["/api/orders", newData.id]);

    // 3. Optimistically update the cache
    queryClient.setQueryData(["/api/orders", newData.id], (old) => ({
      ...old,
      status: newData.status,
    }));

    // 4. Return snapshot for rollback
    return { previousOrder };
  },

  // Rollback on error
  onError: (err, newData, context) => {
    queryClient.setQueryData(
      ["/api/orders", newData.id],
      context.previousOrder
    );
    toast({ variant: "destructive", title: "Update failed" });
  },

  // Refetch to ensure server truth
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
  },
});
```

**FoodDash uses optimistic updates for:**
- Cart add/remove (instant UI feedback).
- Restaurant owner accepting orders (status changes immediately).
- Delivery partner toggling online/offline status.

---

## Q47: What is the `children` prop pattern and how does FoodDash use composition?

**Answer:**

The `children` prop enables component composition — passing JSX as children:

```typescript
// Layout composition
function DashboardLayout({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto py-6">
        <h1 className="text-2xl font-bold mb-4">{title}</h1>
        {children}
      </main>
    </div>
  );
}

// Usage
<DashboardLayout title="My Orders">
  <OrderList />        {/* children */}
  <OrderFilters />     {/* children */}
</DashboardLayout>
```

**FoodDash composition patterns:**

1. **Layout composition** — `DashboardLayout` wraps different dashboard views.
2. **Provider composition** — Nested providers compose context layers.
3. **Slot pattern** — shadcn/ui components accept children to fill content slots:
```typescript
<Card>
  <CardHeader>
    <CardTitle>Order #123</CardTitle>
  </CardHeader>
  <CardContent>{/* order details */}</CardContent>
  <CardFooter>{/* action buttons */}</CardFooter>
</Card>
```

**Why composition over inheritance:** React recommends composition because it's more flexible. You can pass any JSX as children, including other composed components. Inheritance creates rigid hierarchies.

---

## Q48: How do you debug React performance issues? What tools does FoodDash use?

**Answer:**

**Tools and techniques:**

1. **React DevTools Profiler:**
   - Records render timings per component.
   - Highlights "why did this render?" (prop changes, state changes, parent render).
   - Shows flame chart of render durations.

2. **React DevTools Components tab:**
   - Inspect component tree, props, state, hooks.
   - Search for components by name.
   - Highlight re-renders in real-time.

3. **Redux DevTools:**
   - Time-travel debugging for cart and auth state.
   - Action log shows every dispatch.
   - State diff shows exactly what changed.

4. **Chrome Performance tab:**
   - Record JavaScript execution timeline.
   - Identify long tasks blocking the main thread.
   - Analyze paint/layout events.

5. **`why-did-you-render` library:**
   ```typescript
   // In development only
   import whyDidYouRender from "@welldone-software/why-did-you-render";
   whyDidYouRender(React, { trackAllPureComponents: true });
   ```

**Common FoodDash performance fixes:**
- `React.memo` on `MenuItemCard` (50+ items in list).
- `useCallback` for event handlers passed to memoized children.
- `useMemo` for sorted/filtered restaurant lists.
- Virtualized lists for order history with 1000+ entries.

---

## Q49: What is Concurrent Mode in React 18 and how does it affect FoodDash?

**Answer:**

Concurrent Mode (now called Concurrent Features) allows React to prepare multiple UI updates simultaneously and prioritize them:

**Key capabilities:**
1. **Interruptible rendering** — React can pause rendering a large list to handle a user click.
2. **Priority scheduling** — User input > animations > data updates.
3. **Transitions** — Mark certain updates as non-urgent with `startTransition`.
4. **Suspense for data** — Components can suspend while waiting for data (experimental).

**How it affects FoodDash:**

```typescript
// Scenario: User types in search while restaurant list is rendering
function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSearch = (value: string) => {
    setSearchQuery(value);  // Urgent: update input
    startTransition(() => {
      setFilterQuery(value);  // Non-urgent: filter list
    });
  };
  
  // searchQuery updates immediately (responsive input)
  // filterQuery updates when React has time (no jank)
}
```

**Without Concurrent Features:** Filtering 500 restaurants blocks the main thread, making the search input feel laggy. With transitions, the input stays snappy.

---

## Q50: Compare class components vs functional components. Why does FoodDash use only functional components (except Error Boundaries)?

**Answer:**

| Feature | Class Components | Functional Components |
|---------|-----------------|----------------------|
| State | `this.state` + `setState` | `useState`, `useReducer` |
| Side effects | `componentDidMount`, `componentDidUpdate` | `useEffect` |
| Context | `static contextType` or Consumer | `useContext` |
| Refs | `createRef` | `useRef` |
| Performance | `shouldComponentUpdate`, `PureComponent` | `React.memo` |
| Code reuse | HOCs, Mixins (deprecated) | Custom Hooks |
| TypeScript | Complex generic patterns for props/state | Natural prop type inference |
| Bundle size | Slightly larger (class overhead) | Slightly smaller |
| Concurrent features | Limited support | Full support |

**Why FoodDash uses functional components:**

1. **Hooks composability** — `useAuth()`, `useAppSelector()`, `useQuery()` compose naturally. Class equivalents require HOC wrapping.
2. **Less boilerplate** — No `constructor`, `this.bind`, `render()` method.
3. **Better TypeScript** — Props are just function parameters. No `React.Component<Props, State>` generic.
4. **Concurrent features** — `useTransition`, `useDeferredValue` only work with functional components.
5. **Team convention** — Consistent codebase where every component follows the same pattern.

**Exception — Error Boundaries:** React doesn't have a hook equivalent for `componentDidCatch` / `getDerivedStateFromError`. This is the one remaining use case for class components.

---
