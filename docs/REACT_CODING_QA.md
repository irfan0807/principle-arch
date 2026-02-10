# FoodDash — React Coding Interview Q&A (100 Questions)

## For 6+ Years Fullstack Engineer | Component Design · Hooks · State · Performance · Patterns

> **Project**: FoodDash — Production-Grade Food Delivery Platform  
> **Stack**: React 18, TypeScript, Redux Toolkit, React Query v5, Wouter, Framer Motion, TailwindCSS, shadcn/ui  
> **Architecture**: Three-Layer State (Server → Global → Local) | Provider Composition | RBAC  
> **Last Updated**: February 2026

---

## Q1: Build a complete AuthProvider with multi-strategy authentication.

**Problem:** Implement an AuthProvider that supports Google OAuth, Keycloak SSO, and Phone OTP — with session persistence and role-based access.

```tsx
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

interface User {
  id: string;
  email: string;
  name: string;
  role: "customer" | "restaurant_owner" | "delivery_partner" | "admin";
  avatar?: string;
  provider: "google" | "keycloak" | "phone";
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (provider: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: string) => boolean;
  hasPermission: (resource: string, action: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const PERMISSIONS: Record<string, Record<string, string[]>> = {
  customer: { order: ["create", "read", "cancel"], review: ["create", "read"] },
  restaurant_owner: { menu: ["create", "read", "update", "delete"], order: ["read", "update"] },
  delivery_partner: { delivery: ["read", "update"], order: ["read"] },
  admin: { "*": ["*"] },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch("/api/auth/session", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch {
        // Session expired or no session
      } finally {
        setIsLoading(false);
      }
    };
    checkSession();
  }, []);

  const login = useCallback(async (provider: string) => {
    switch (provider) {
      case "google":
        window.location.href = "/api/auth/google";
        break;
      case "keycloak":
        window.location.href = "/api/auth/keycloak";
        break;
      case "phone":
        // Handled by OTP form component
        break;
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  }, []);

  const hasRole = useCallback(
    (role: string) => user?.role === role,
    [user]
  );

  const hasPermission = useCallback(
    (resource: string, action: string) => {
      if (!user) return false;
      const perms = PERMISSIONS[user.role];
      if (!perms) return false;
      if (perms["*"]?.includes("*")) return true;
      return perms[resource]?.includes(action) ?? false;
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        hasRole,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

---

## Q2: Build a ProtectedRoute with role-based access control.

```tsx
import { useAuth } from "./AuthProvider";
import { Redirect, useLocation } from "wouter";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
  requiredPermission?: { resource: string; action: string };
  fallback?: React.ReactNode;
}

export function ProtectedRoute({
  children,
  requiredRole,
  requiredPermission,
  fallback,
}: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated, hasRole, hasPermission } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/sign-in" />;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return fallback ?? (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-2xl font-bold">403 — Access Denied</h1>
        <p className="text-muted-foreground">
          You need the <strong>{requiredRole}</strong> role to view this page.
        </p>
        <button onClick={() => setLocation("/")} className="underline">
          Go Home
        </button>
      </div>
    );
  }

  if (requiredPermission && !hasPermission(requiredPermission.resource, requiredPermission.action)) {
    return fallback ?? <div>Insufficient permissions</div>;
  }

  return <>{children}</>;
}

// Usage
function App() {
  return (
    <AuthProvider>
      <Route path="/admin">
        <ProtectedRoute requiredRole="admin">
          <AdminDashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/restaurant/dashboard">
        <ProtectedRoute requiredRole="restaurant_owner">
          <RestaurantDashboard />
        </ProtectedRoute>
      </Route>
    </AuthProvider>
  );
}
```

---

## Q3: Build a ThemeProvider with CSS variables and system preference detection.

```tsx
type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem("theme") as Theme) ?? "system";
  });

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const resolve = () => {
      const resolved =
        theme === "system"
          ? mediaQuery.matches ? "dark" : "light"
          : theme;

      setResolvedTheme(resolved);
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(resolved);

      // Set CSS variables
      document.documentElement.style.setProperty(
        "--background",
        resolved === "dark" ? "222.2 84% 4.9%" : "0 0% 100%"
      );
    };

    resolve();
    mediaQuery.addEventListener("change", resolve);
    return () => mediaQuery.removeEventListener("change", resolve);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

// ThemeToggle component
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const themes: Theme[] = ["light", "dark", "system"];

  return (
    <button
      onClick={() => {
        const next = themes[(themes.indexOf(theme) + 1) % themes.length];
        setTheme(next);
      }}
      className="p-2 rounded-md hover:bg-accent"
      aria-label={`Current theme: ${theme}`}
    >
      {theme === "light" ? "☀️" : theme === "dark" ? "🌙" : "💻"}
    </button>
  );
}
```

---

## Q4: Build a Restaurant Card component with skeleton loading.

```tsx
interface Restaurant {
  id: string;
  name: string;
  image: string;
  cuisine: string;
  rating: number;
  deliveryTime: string;
  deliveryFee: number;
  isOpen: boolean;
}

function RestaurantCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card animate-pulse">
      <div className="h-48 bg-muted rounded-t-lg" />
      <div className="p-4 space-y-3">
        <div className="h-5 bg-muted rounded w-3/4" />
        <div className="h-4 bg-muted rounded w-1/2" />
        <div className="flex gap-4">
          <div className="h-4 bg-muted rounded w-16" />
          <div className="h-4 bg-muted rounded w-20" />
        </div>
      </div>
    </div>
  );
}

function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const [, setLocation] = useLocation();
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div
      className={`rounded-lg border bg-card overflow-hidden cursor-pointer
        transition-all duration-200 hover:shadow-lg hover:-translate-y-1
        ${!restaurant.isOpen ? "opacity-60" : ""}`}
      onClick={() => setLocation(`/restaurant/${restaurant.id}`)}
      role="article"
      aria-label={`${restaurant.name} - ${restaurant.cuisine}`}
    >
      <div className="relative h-48 bg-muted">
        {!imgLoaded && <div className="absolute inset-0 animate-pulse bg-muted" />}
        <img
          src={restaurant.image}
          alt={restaurant.name}
          className={`w-full h-full object-cover transition-opacity ${imgLoaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setImgLoaded(true)}
          loading="lazy"
        />
        {!restaurant.isOpen && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-semibold text-lg">Closed</span>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-lg truncate">{restaurant.name}</h3>
        <p className="text-sm text-muted-foreground">{restaurant.cuisine}</p>
        <div className="flex items-center gap-4 mt-2 text-sm">
          <span className="flex items-center gap-1">
            ⭐ {restaurant.rating.toFixed(1)}
          </span>
          <span>{restaurant.deliveryTime}</span>
          <span>
            {restaurant.deliveryFee === 0 ? (
              <span className="text-green-600 font-medium">Free delivery</span>
            ) : (
              `$${restaurant.deliveryFee.toFixed(2)}`
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

// Usage with loading states
function RestaurantGrid() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/restaurants"],
    queryFn: () => fetch("/api/restaurants").then((r) => r.json()),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }, (_, i) => (
          <RestaurantCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {data?.map((r: Restaurant) => (
        <RestaurantCard key={r.id} restaurant={r} />
      ))}
    </div>
  );
}
```

---

## Q5: Build a Shopping Cart with Redux Toolkit.

```tsx
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  restaurantId: string;
  customizations?: string[];
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
    addItem(state, action: PayloadAction<CartItem & { restaurantName: string }>) {
      const { restaurantName, ...item } = action.payload;

      // If different restaurant, clear cart
      if (state.restaurantId && state.restaurantId !== item.restaurantId) {
        state.items = [];
      }

      state.restaurantId = item.restaurantId;
      state.restaurantName = restaurantName;

      const existing = state.items.find((i) => i.menuItemId === item.menuItemId);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        state.items.push(item);
      }
    },

    removeItem(state, action: PayloadAction<string>) {
      state.items = state.items.filter((i) => i.id !== action.payload);
      if (state.items.length === 0) {
        state.restaurantId = null;
        state.restaurantName = null;
      }
    },

    updateQuantity(state, action: PayloadAction<{ id: string; quantity: number }>) {
      const item = state.items.find((i) => i.id === action.payload.id);
      if (item) {
        if (action.payload.quantity <= 0) {
          state.items = state.items.filter((i) => i.id !== action.payload.id);
        } else {
          item.quantity = action.payload.quantity;
        }
      }
      if (state.items.length === 0) {
        state.restaurantId = null;
        state.restaurantName = null;
      }
    },

    clearCart(state) {
      state.items = [];
      state.restaurantId = null;
      state.restaurantName = null;
    },
  },
});

export const { addItem, removeItem, updateQuantity, clearCart } = cartSlice.actions;
export default cartSlice.reducer;

// Selectors
export const selectCartItems = (state: { cart: CartState }) => state.cart.items;
export const selectCartTotal = (state: { cart: CartState }) =>
  state.cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
export const selectCartItemCount = (state: { cart: CartState }) =>
  state.cart.items.reduce((sum, item) => sum + item.quantity, 0);

// Cart Component
function Cart() {
  const items = useAppSelector(selectCartItems);
  const total = useAppSelector(selectCartTotal);
  const count = useAppSelector(selectCartItemCount);
  const dispatch = useAppDispatch();

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">Your cart is empty</p>
        <p className="text-sm mt-2">Add items from a restaurant to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Your Cart ({count} items)</h2>
        <button
          onClick={() => dispatch(clearCart())}
          className="text-sm text-destructive hover:underline"
        >
          Clear All
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <CartItemRow key={item.id} item={item} />
        ))}
      </div>

      <div className="border-t pt-4">
        <div className="flex justify-between font-semibold text-lg">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>

      <button className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:bg-primary/90">
        Checkout — ${total.toFixed(2)}
      </button>
    </div>
  );
}

function CartItemRow({ item }: { item: CartItem }) {
  const dispatch = useAppDispatch();

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg border">
      <div className="flex-1">
        <p className="font-medium">{item.name}</p>
        <p className="text-sm text-muted-foreground">${item.price.toFixed(2)} each</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => dispatch(updateQuantity({ id: item.id, quantity: item.quantity - 1 }))}
          className="w-8 h-8 rounded-full border flex items-center justify-center"
        >
          −
        </button>
        <span className="w-8 text-center font-medium">{item.quantity}</span>
        <button
          onClick={() => dispatch(updateQuantity({ id: item.id, quantity: item.quantity + 1 }))}
          className="w-8 h-8 rounded-full border flex items-center justify-center"
        >
          +
        </button>
      </div>
      <p className="font-medium w-20 text-right">${(item.price * item.quantity).toFixed(2)}</p>
    </div>
  );
}
```

---

## Q6: Build a Search with debounce, autocomplete, and keyboard navigation.

```tsx
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function SearchBar() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const debouncedQuery = useDebounce(query, 300);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["/api/search", debouncedQuery],
    queryFn: () =>
      debouncedQuery.length >= 2
        ? fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`).then((r) => r.json())
        : [],
    enabled: debouncedQuery.length >= 2,
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, -1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && results[activeIndex]) {
          selectResult(results[activeIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const selectResult = (result: any) => {
    setQuery(result.name);
    setIsOpen(false);
    // Navigate to restaurant
    window.location.href = `/restaurant/${result.id}`;
  };

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  return (
    <div className="relative w-full max-w-lg">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search restaurants, cuisines..."
          className="w-full pl-10 pr-4 py-3 rounded-lg border bg-background"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `result-${activeIndex}` : undefined}
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">🔍</span>
        {isLoading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin">⏳</span>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 w-full mt-1 max-h-80 overflow-auto rounded-lg border bg-popover shadow-lg"
          role="listbox"
        >
          {results.map((result: any, index: number) => (
            <li
              key={result.id}
              id={`result-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={`px-4 py-3 cursor-pointer flex items-center gap-3 ${
                index === activeIndex ? "bg-accent" : "hover:bg-accent/50"
              }`}
              onClick={() => selectResult(result)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <img src={result.image} alt="" className="w-10 h-10 rounded object-cover" />
              <div>
                <p className="font-medium">{highlightMatch(result.name, query)}</p>
                <p className="text-sm text-muted-foreground">{result.cuisine} · ⭐ {result.rating}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Click outside to close */}
      {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
    </div>
  );
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-800">{part}</mark> : part
  );
}
```

---

## Q7: Build an Order Tracking component with real-time WebSocket updates.

```tsx
type OrderStatus =
  | "pending" | "confirmed" | "preparing"
  | "ready_for_pickup" | "out_for_delivery" | "delivered";

const STATUS_STEPS: Array<{ status: OrderStatus; label: string; icon: string }> = [
  { status: "pending", label: "Order Placed", icon: "📋" },
  { status: "confirmed", label: "Confirmed", icon: "✅" },
  { status: "preparing", label: "Preparing", icon: "👨‍🍳" },
  { status: "ready_for_pickup", label: "Ready", icon: "📦" },
  { status: "out_for_delivery", label: "On the Way", icon: "🛵" },
  { status: "delivered", label: "Delivered", icon: "🎉" },
];

function useOrderTracking(orderId: string) {
  const [order, setOrder] = useState<any>(null);
  const [riderLocation, setRiderLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Initial fetch
  const { data } = useQuery({
    queryKey: ["/api/orders", orderId],
    queryFn: () => fetch(`/api/orders/${orderId}`).then((r) => r.json()),
  });

  useEffect(() => {
    if (data) setOrder(data);
  }, [data]);

  // WebSocket for real-time updates
  useEffect(() => {
    const ws = new WebSocket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "subscribe", orderId }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case "ORDER_STATUS_UPDATED":
          setOrder((prev: any) => prev ? { ...prev, status: msg.data.status } : prev);
          break;
        case "RIDER_LOCATION":
          setRiderLocation(msg.data);
          break;
        case "ETA_UPDATED":
          setOrder((prev: any) => prev ? { ...prev, eta: msg.data.eta } : prev);
          break;
      }
    };

    ws.onclose = () => {
      // Reconnect after 3 seconds
      setTimeout(() => {}, 3000);
    };

    return () => ws.close();
  }, [orderId]);

  return { order, riderLocation };
}

function OrderTracker({ orderId }: { orderId: string }) {
  const { order, riderLocation } = useOrderTracking(orderId);

  if (!order) {
    return <div className="animate-pulse h-64 bg-muted rounded-lg" />;
  }

  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.status === order.status);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Order #{order.id.slice(0, 8)}</h2>
        {order.eta && (
          <span className="text-lg font-medium text-primary">
            ETA: {order.eta} min
          </span>
        )}
      </div>

      {/* Status Steps */}
      <div className="relative">
        {STATUS_STEPS.map((step, index) => {
          const isCompleted = index <= currentStepIndex;
          const isCurrent = index === currentStepIndex;

          return (
            <div key={step.status} className="flex items-center gap-4 mb-4">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg
                  ${isCompleted ? "bg-primary text-primary-foreground" : "bg-muted"}
                  ${isCurrent ? "ring-2 ring-primary ring-offset-2 animate-pulse" : ""}`}
              >
                {step.icon}
              </div>
              <div>
                <p className={`font-medium ${isCompleted ? "" : "text-muted-foreground"}`}>
                  {step.label}
                </p>
                {isCurrent && (
                  <p className="text-sm text-muted-foreground animate-pulse">In progress...</p>
                )}
              </div>
              {/* Connecting line */}
              {index < STATUS_STEPS.length - 1 && (
                <div
                  className={`absolute left-5 w-0.5 h-4 mt-10
                    ${index < currentStepIndex ? "bg-primary" : "bg-muted"}`}
                  style={{ top: `${index * 56 + 40}px` }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Rider Location (if out for delivery) */}
      {order.status === "out_for_delivery" && riderLocation && (
        <div className="p-4 rounded-lg border bg-accent/50">
          <p className="font-medium">🛵 Rider is on the way</p>
          <p className="text-sm text-muted-foreground">
            Location: {riderLocation.lat.toFixed(4)}, {riderLocation.lng.toFixed(4)}
          </p>
        </div>
      )}
    </div>
  );
}
```

---

## Q8: Build an Infinite Scroll list with React Query.

```tsx
function useInfiniteRestaurants(cuisine?: string) {
  return useInfiniteQuery({
    queryKey: ["/api/restaurants", { cuisine }],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({ page: String(pageParam), limit: "20" });
      if (cuisine) params.set("cuisine", cuisine);
      const res = await fetch(`/api/restaurants?${params}`);
      return res.json();
    },
    getNextPageParam: (lastPage) =>
      lastPage.metadata.hasNext ? lastPage.metadata.page + 1 : undefined,
    initialPageParam: 1,
  });
}

function InfiniteRestaurantList({ cuisine }: { cuisine?: string }) {
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteRestaurants(cuisine);

  // Intersection Observer for auto-loading
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }, (_, i) => <RestaurantCardSkeleton key={i} />)}
      </div>
    );
  }

  const restaurants = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {restaurants.map((restaurant) => (
          <RestaurantCard key={restaurant.id} restaurant={restaurant} />
        ))}
      </div>

      {/* Sentinel element */}
      <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
        {isFetchingNextPage && (
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        )}
        {!hasNextPage && restaurants.length > 0 && (
          <p className="text-muted-foreground">No more restaurants</p>
        )}
      </div>
    </div>
  );
}
```

---

## Q9: Build a Toast Notification System from scratch.

```tsx
interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: "default" | "success" | "error" | "warning";
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { ...toast, id }]);

    // Auto-dismiss
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(onDismiss, 200);
  };

  const variantStyles = {
    default: "border-border",
    success: "border-green-500 bg-green-50 dark:bg-green-950",
    error: "border-red-500 bg-red-50 dark:bg-red-950",
    warning: "border-yellow-500 bg-yellow-50 dark:bg-yellow-950",
  };

  const icons = { default: "ℹ️", success: "✅", error: "❌", warning: "⚠️" };

  return (
    <div
      className={`p-4 rounded-lg border shadow-lg bg-background flex items-start gap-3
        transition-all duration-200
        ${variantStyles[toast.variant]}
        ${isExiting ? "opacity-0 translate-x-full" : "opacity-100 translate-x-0"}
        animate-in slide-in-from-right`}
      role="alert"
    >
      <span>{icons[toast.variant]}</span>
      <div className="flex-1">
        <p className="font-medium">{toast.title}</p>
        {toast.description && (
          <p className="text-sm text-muted-foreground mt-1">{toast.description}</p>
        )}
      </div>
      <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground">✕</button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

// Usage
function PlaceOrderButton() {
  const { addToast } = useToast();

  const handlePlaceOrder = async () => {
    try {
      await placeOrder();
      addToast({ title: "Order Placed!", description: "Your food is on the way", variant: "success" });
    } catch {
      addToast({ title: "Failed", description: "Could not place order", variant: "error" });
    }
  };

  return <button onClick={handlePlaceOrder}>Place Order</button>;
}
```

---

## Q10: Build a Modal/Dialog component with portal and focus trap.

```tsx
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

function Modal({ isOpen, onClose, title, children, size = "md" }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement;

    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const modal = modalRef.current;
    if (!modal) return;

    const focusable = modal.querySelectorAll<HTMLElement>(focusableSelector);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    first?.focus();

    const handleTab = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };

    document.addEventListener("keydown", handleTab);

    // Prevent body scroll
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleTab);
      document.body.style.overflow = "";
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 animate-in fade-in" onClick={onClose} />
      {/* Modal */}
      <div
        ref={modalRef}
        className={`relative bg-background rounded-lg shadow-xl p-6 w-full mx-4
          ${sizeClasses[size]} animate-in zoom-in-95 fade-in duration-200`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id="modal-title" className="text-xl font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-accent"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

// Usage: "Switch restaurant?" confirmation
function SwitchRestaurantModal({ isOpen, onClose, onConfirm }: any) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Switch Restaurant?" size="sm">
      <p className="text-muted-foreground mb-4">
        Your cart has items from another restaurant. Switching will clear your current cart.
      </p>
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="px-4 py-2 border rounded-lg">Cancel</button>
        <button onClick={onConfirm} className="px-4 py-2 bg-primary text-white rounded-lg">
          Switch & Clear
        </button>
      </div>
    </Modal>
  );
}
```

---

## Q11: Build an Optimistic Update pattern with React Query.

```tsx
function useUpdateOrderStatus(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Update failed");
      return res.json();
    },

    // Optimistic update
    onMutate: async (newStatus) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ["/api/orders", orderId] });

      // Snapshot previous value
      const previous = queryClient.getQueryData(["/api/orders", orderId]);

      // Optimistically update
      queryClient.setQueryData(["/api/orders", orderId], (old: any) => ({
        ...old,
        status: newStatus,
      }));

      return { previous };
    },

    // Rollback on error
    onError: (_err, _newStatus, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/orders", orderId], context.previous);
      }
    },

    // Refetch after settle
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders", orderId] });
    },
  });
}

// Usage
function OrderStatusButton({ orderId, nextStatus }: { orderId: string; nextStatus: string }) {
  const { mutate, isPending } = useUpdateOrderStatus(orderId);

  return (
    <button
      onClick={() => mutate(nextStatus)}
      disabled={isPending}
      className="px-4 py-2 bg-primary text-white rounded-lg disabled:opacity-50"
    >
      {isPending ? "Updating..." : `Mark as ${nextStatus}`}
    </button>
  );
}
```

---

## Q12: Build a Form with Zod validation and real-time error display.

```tsx
import { z } from "zod";

const checkoutSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().regex(/^\+?[1-9]\d{7,14}$/, "Invalid phone number"),
  address: z.string().min(10, "Address must be at least 10 characters"),
  city: z.string().min(2, "City is required"),
  instructions: z.string().max(200, "Max 200 characters").optional(),
  paymentMethod: z.enum(["card", "cash", "upi"], {
    errorMap: () => ({ message: "Select a payment method" }),
  }),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

function CheckoutPage() {
  const [formData, setFormData] = useState<Partial<CheckoutForm>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const updateField = (field: keyof CheckoutForm, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Validate on change (after first touch)
    if (touched[field]) {
      const result = checkoutSchema.shape[field].safeParse(value);
      setErrors((prev) => ({
        ...prev,
        [field]: result.success ? "" : result.error.issues[0].message,
      }));
    }
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const value = (formData as any)[field];
    const result = (checkoutSchema.shape as any)[field].safeParse(value);
    setErrors((prev) => ({
      ...prev,
      [field]: result.success ? "" : result.error.issues[0].message,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = checkoutSchema.safeParse(formData);

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      setTouched(Object.fromEntries(Object.keys(fieldErrors).map((k) => [k, true])));
      return;
    }

    // Submit valid form
    placeOrder(result.data);
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-4" noValidate>
      <FormField
        label="Full Name"
        value={formData.name ?? ""}
        onChange={(v) => updateField("name", v)}
        onBlur={() => handleBlur("name")}
        error={touched.name ? errors.name : undefined}
        required
      />
      <FormField
        label="Phone"
        type="tel"
        value={formData.phone ?? ""}
        onChange={(v) => updateField("phone", v)}
        onBlur={() => handleBlur("phone")}
        error={touched.phone ? errors.phone : undefined}
        required
      />
      <FormField
        label="Delivery Address"
        value={formData.address ?? ""}
        onChange={(v) => updateField("address", v)}
        onBlur={() => handleBlur("address")}
        error={touched.address ? errors.address : undefined}
        multiline
        required
      />
      <FormField
        label="City"
        value={formData.city ?? ""}
        onChange={(v) => updateField("city", v)}
        onBlur={() => handleBlur("city")}
        error={touched.city ? errors.city : undefined}
        required
      />
      <FormField
        label="Special Instructions"
        value={formData.instructions ?? ""}
        onChange={(v) => updateField("instructions", v)}
        onBlur={() => handleBlur("instructions")}
        error={touched.instructions ? errors.instructions : undefined}
        multiline
      />

      <div>
        <label className="block text-sm font-medium mb-2">Payment Method</label>
        <div className="flex gap-3">
          {(["card", "cash", "upi"] as const).map((method) => (
            <button
              key={method}
              type="button"
              className={`px-4 py-2 rounded-lg border capitalize
                ${formData.paymentMethod === method ? "border-primary bg-primary/10" : ""}`}
              onClick={() => updateField("paymentMethod", method)}
            >
              {method}
            </button>
          ))}
        </div>
        {touched.paymentMethod && errors.paymentMethod && (
          <p className="text-sm text-destructive mt-1">{errors.paymentMethod}</p>
        )}
      </div>

      <button
        type="submit"
        className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium"
      >
        Place Order
      </button>
    </form>
  );
}

function FormField({
  label, value, onChange, onBlur, error, type = "text", multiline, required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  onBlur: () => void; error?: string; type?: string; multiline?: boolean; required?: boolean;
}) {
  const Component = multiline ? "textarea" : "input";
  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <Component
        type={type}
        value={value}
        onChange={(e: any) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`w-full px-3 py-2 rounded-lg border bg-background
          ${error ? "border-destructive" : "border-border"}`}
        aria-invalid={!!error}
        aria-describedby={error ? `${label}-error` : undefined}
      />
      {error && <p id={`${label}-error`} className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  );
}
```

---

## Q13: Build a Tabs component with lazy loading.

```tsx
interface TabItem {
  id: string;
  label: string;
  icon?: string;
  content: React.LazyExoticComponent<React.ComponentType> | React.ComponentType;
  badge?: number;
}

function Tabs({ tabs, defaultTab }: { tabs: TabItem[]; defaultTab?: string }) {
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.id);
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set([activeTab]));

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setLoadedTabs((prev) => new Set(prev).add(tabId));
  };

  return (
    <div>
      {/* Tab List */}
      <div className="flex border-b" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            className={`px-4 py-3 font-medium text-sm transition-colors relative
              ${activeTab === tab.id
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
              }`}
            onClick={() => handleTabChange(tab.id)}
          >
            <span className="flex items-center gap-2">
              {tab.icon && <span>{tab.icon}</span>}
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5 rounded-full">
                  {tab.badge}
                </span>
              )}
            </span>
            {/* Active indicator */}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Panels — lazy loaded, keep mounted once loaded */}
      {tabs.map((tab) => {
        if (!loadedTabs.has(tab.id)) return null;
        const Content = tab.content;
        return (
          <div
            key={tab.id}
            id={`panel-${tab.id}`}
            role="tabpanel"
            className={activeTab === tab.id ? "block" : "hidden"}
          >
            <React.Suspense
              fallback={<div className="py-8 text-center text-muted-foreground">Loading...</div>}
            >
              <Content />
            </React.Suspense>
          </div>
        );
      })}
    </div>
  );
}

// Usage: Admin Dashboard tabs
const AdminDashboardTabs: TabItem[] = [
  { id: "overview", label: "Overview", icon: "📊", content: React.lazy(() => import("./AdminOverview")) },
  { id: "restaurants", label: "Restaurants", icon: "🍕", content: React.lazy(() => import("./AdminRestaurants")) },
  { id: "orders", label: "Orders", icon: "📦", badge: 12, content: React.lazy(() => import("./AdminOrders")) },
  { id: "users", label: "Users", icon: "👥", content: React.lazy(() => import("./AdminUsers")) },
  { id: "analytics", label: "Analytics", icon: "📈", content: React.lazy(() => import("./AdminAnalytics")) },
];

function AdminDashboard() {
  return <Tabs tabs={AdminDashboardTabs} defaultTab="overview" />;
}
```

---

## Q14: Build an Image Upload component with preview, crop, and drag-and-drop.

```tsx
function ImageUpload({
  onUpload,
  maxSizeMB = 5,
  accept = "image/*",
}: {
  onUpload: (file: File) => void;
  maxSizeMB?: number;
  accept?: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return false;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File must be under ${maxSizeMB}MB`);
      return false;
    }
    setError(null);
    return true;
  };

  const handleFile = (file: File) => {
    if (!validateFile(file)) return;

    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    onUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const clearPreview = () => {
    setPreview(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors
          ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}
          ${error ? "border-destructive" : ""}`}
      >
        {preview ? (
          <div className="relative inline-block">
            <img src={preview} alt="Preview" className="max-h-48 rounded-lg mx-auto" />
            <button
              onClick={(e) => { e.stopPropagation(); clearPreview(); }}
              className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-white rounded-full text-xs"
            >
              ✕
            </button>
          </div>
        ) : (
          <div>
            <p className="text-2xl mb-2">📷</p>
            <p className="font-medium">Drop an image or click to upload</p>
            <p className="text-sm text-muted-foreground mt-1">Max {maxSizeMB}MB · JPG, PNG, WebP</p>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {uploadProgress !== null && (
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileInput}
        className="hidden"
      />
    </div>
  );
}
```

---

## Q15: Build a Notification Bell with real-time badge and dropdown.

```tsx
interface Notification {
  id: string;
  title: string;
  message: string;
  type: "order" | "promo" | "system";
  read: boolean;
  createdAt: string;
}

function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch initial notifications
  const { data } = useQuery({
    queryKey: ["/api/notifications"],
    queryFn: () => fetch("/api/notifications").then((r) => r.json()),
  });

  useEffect(() => {
    if (data) setNotifications(data);
  }, [data]);

  // WebSocket for real-time notifications
  useEffect(() => {
    const ws = new WebSocket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`);

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "NOTIFICATION") {
        setNotifications((prev) => [msg.data, ...prev]);
      }
    };

    return () => ws.close();
  }, []);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/notifications/read-all", { method: "PATCH" });
  };

  const icons = { order: "📦", promo: "🎉", system: "ℹ️" };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-accent"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="flex justify-between items-center p-3 border-b">
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-auto">
            {notifications.length === 0 ? (
              <p className="p-8 text-center text-muted-foreground">No notifications</p>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3 flex gap-3 hover:bg-accent cursor-pointer border-b last:border-0
                    ${notif.read ? "" : "bg-accent/30"}`}
                  onClick={() => markAsRead(notif.id)}
                >
                  <span className="text-lg">{icons[notif.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${notif.read ? "" : "font-medium"}`}>{notif.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{notif.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTimeAgo(notif.createdAt)}
                    </p>
                  </div>
                  {!notif.read && <div className="w-2 h-2 bg-primary rounded-full mt-2" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
```

---

## Q16: Build an Accordion/Collapsible component with animation.

```tsx
interface AccordionItem {
  id: string;
  title: string;
  content: React.ReactNode;
}

function Accordion({
  items,
  allowMultiple = false,
}: {
  items: AccordionItem[];
  allowMultiple?: boolean;
}) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(allowMultiple ? prev : []);
      if (prev.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="divide-y border rounded-lg">
      {items.map((item) => (
        <AccordionPanel
          key={item.id}
          item={item}
          isOpen={openIds.has(item.id)}
          onToggle={() => toggle(item.id)}
        />
      ))}
    </div>
  );
}

function AccordionPanel({
  item,
  isOpen,
  onToggle,
}: {
  item: AccordionItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(0);

  useEffect(() => {
    if (isOpen) {
      setHeight(contentRef.current?.scrollHeight);
    } else {
      setHeight(0);
    }
  }, [isOpen]);

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-accent/50 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="font-medium">{item.title}</span>
        <span className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>
      <div
        style={{ height: height !== undefined ? `${height}px` : "auto" }}
        className="overflow-hidden transition-[height] duration-200 ease-out"
      >
        <div ref={contentRef} className="p-4 pt-0">
          {item.content}
        </div>
      </div>
    </div>
  );
}

// Usage: FAQ section
function FAQ() {
  const items: AccordionItem[] = [
    { id: "1", title: "What are the delivery hours?", content: <p>We deliver 24/7!</p> },
    { id: "2", title: "How do I track my order?", content: <p>Go to Orders → Track</p> },
    { id: "3", title: "Can I cancel my order?", content: <p>Yes, within 5 min of placing</p> },
  ];
  return <Accordion items={items} allowMultiple />;
}
```

---

## Q17: Build a Star Rating component with half-star support.

```tsx
function StarRating({
  value,
  onChange,
  max = 5,
  size = "md",
  readOnly = false,
}: {
  value: number;
  onChange?: (rating: number) => void;
  max?: number;
  size?: "sm" | "md" | "lg";
  readOnly?: boolean;
}) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const sizes = { sm: "text-lg", md: "text-2xl", lg: "text-4xl" };
  const displayValue = hoverValue ?? value;

  return (
    <div
      className={`inline-flex gap-0.5 ${readOnly ? "" : "cursor-pointer"}`}
      onMouseLeave={() => !readOnly && setHoverValue(null)}
      role="radiogroup"
      aria-label="Rating"
    >
      {Array.from({ length: max }, (_, i) => {
        const starValue = i + 1;
        const isFull = displayValue >= starValue;
        const isHalf = !isFull && displayValue >= starValue - 0.5;

        return (
          <span
            key={i}
            className={`${sizes[size]} transition-colors select-none
              ${isFull || isHalf ? "text-yellow-400" : "text-gray-300"}`}
            onClick={() => {
              if (readOnly) return;
              // Click left half = 0.5, right half = 1.0
              onChange?.(starValue);
            }}
            onMouseMove={(e) => {
              if (readOnly) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const isLeftHalf = e.clientX - rect.left < rect.width / 2;
              setHoverValue(isLeftHalf ? starValue - 0.5 : starValue);
            }}
            role="radio"
            aria-checked={value === starValue}
            aria-label={`${starValue} star${starValue > 1 ? "s" : ""}`}
          >
            {isFull ? "★" : isHalf ? "⯪" : "☆"}
          </span>
        );
      })}
      {!readOnly && <span className="ml-2 text-sm text-muted-foreground">{displayValue}/5</span>}
    </div>
  );
}

// Usage
function ReviewForm() {
  const [rating, setRating] = useState(0);
  return (
    <div>
      <StarRating value={rating} onChange={setRating} />
      <StarRating value={4.5} readOnly size="sm" /> {/* Display only */}
    </div>
  );
}
```

---

## Q18: Build a Data Table with sorting, filtering, and pagination.

```tsx
interface Column<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  searchable?: boolean;
}

function DataTable<T extends Record<string, any>>({
  data,
  columns,
  pageSize = 10,
  searchable = true,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  // Filter
  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      columns.some((col) =>
        String(row[col.key]).toLowerCase().includes(q)
      )
    );
  }, [data, search, columns]);

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  // Paginate
  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (key: keyof T) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // Reset page on search change
  useEffect(() => setPage(1), [search]);

  return (
    <div className="space-y-4">
      {searchable && (
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border rounded-lg bg-background w-64"
        />
      )}

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={`px-4 py-3 text-left text-sm font-medium
                    ${col.sortable ? "cursor-pointer hover:bg-accent select-none" : ""}`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortKey === col.key && (
                      <span>{sortDir === "asc" ? "↑" : "↓"}</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                  No results found
                </td>
              </tr>
            ) : (
              paginated.map((row, i) => (
                <tr key={i} className="border-t hover:bg-accent/50">
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-3 text-sm">
                      {col.render ? col.render(row[col.key], row) : String(row[col.key])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {sorted.length} total · Page {page} of {totalPages || 1}
        </p>
        <div className="flex gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>
  );
}

// Usage: Admin orders table
const columns: Column<Order>[] = [
  { key: "id", label: "Order ID", sortable: true },
  { key: "customerName", label: "Customer", sortable: true },
  { key: "total", label: "Total", sortable: true, render: (v) => `$${v.toFixed(2)}` },
  { key: "status", label: "Status", sortable: true, render: (v) => <StatusBadge status={v} /> },
  { key: "createdAt", label: "Date", sortable: true, render: (v) => new Date(v).toLocaleDateString() },
];
```

---

## Q19: Build a Dropdown/Select component with multi-select support.

```tsx
interface Option {
  value: string;
  label: string;
  icon?: string;
}

function Select({
  options,
  value,
  onChange,
  placeholder = "Select...",
  multiple = false,
}: {
  options: Option[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  placeholder?: string;
  multiple?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selectedValues = Array.isArray(value) ? value : value ? [value] : [];

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (optionValue: string) => {
    if (multiple) {
      const next = selectedValues.includes(optionValue)
        ? selectedValues.filter((v) => v !== optionValue)
        : [...selectedValues, optionValue];
      onChange(next);
    } else {
      onChange(optionValue);
      setIsOpen(false);
    }
  };

  // Click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const displayText =
    selectedValues.length === 0
      ? placeholder
      : selectedValues.map((v) => options.find((o) => o.value === v)?.label ?? v).join(", ");

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 border rounded-lg bg-background text-left"
      >
        <span className={selectedValues.length === 0 ? "text-muted-foreground" : ""}>
          {displayText}
        </span>
        <span className={`transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg">
          {options.length > 5 && (
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 border-b bg-transparent text-sm"
              autoFocus
            />
          )}
          <ul className="max-h-60 overflow-auto py-1">
            {filtered.map((option) => {
              const isSelected = selectedValues.includes(option.value);
              return (
                <li
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  className={`px-3 py-2 cursor-pointer flex items-center gap-2 text-sm
                    ${isSelected ? "bg-primary/10 text-primary" : "hover:bg-accent"}`}
                >
                  {multiple && (
                    <span className={`w-4 h-4 border rounded flex items-center justify-center text-xs
                      ${isSelected ? "bg-primary text-white border-primary" : ""}`}
                    >
                      {isSelected && "✓"}
                    </span>
                  )}
                  {option.icon && <span>{option.icon}</span>}
                  {option.label}
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-3 py-4 text-center text-muted-foreground text-sm">No options</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// Usage
const cuisines: Option[] = [
  { value: "italian", label: "Italian", icon: "🍕" },
  { value: "chinese", label: "Chinese", icon: "🥡" },
  { value: "indian", label: "Indian", icon: "🍛" },
  { value: "mexican", label: "Mexican", icon: "🌮" },
];

function CuisineFilter() {
  const [selected, setSelected] = useState<string[]>([]);
  return <Select options={cuisines} value={selected} onChange={setSelected as any} multiple placeholder="Filter by cuisine" />;
}
```

---

## Q20: Build a Countdown Timer component.

```tsx
function useCountdown(targetDate: Date) {
  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeft(targetDate));

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = calculateTimeLeft(targetDate);
      setTimeLeft(remaining);
      if (remaining.total <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  return timeLeft;
}

function calculateTimeLeft(target: Date) {
  const total = Math.max(0, target.getTime() - Date.now());
  return {
    total,
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((total / (1000 * 60)) % 60),
    seconds: Math.floor((total / 1000) % 60),
  };
}

function CountdownTimer({ targetDate, label }: { targetDate: Date; label?: string }) {
  const { total, days, hours, minutes, seconds } = useCountdown(targetDate);

  if (total <= 0) return <p className="text-lg font-bold text-primary">🎉 Time's up!</p>;

  const units = [
    { value: days, label: "Days" },
    { value: hours, label: "Hours" },
    { value: minutes, label: "Min" },
    { value: seconds, label: "Sec" },
  ];

  return (
    <div className="text-center">
      {label && <p className="text-sm text-muted-foreground mb-2">{label}</p>}
      <div className="flex gap-3 justify-center">
        {units.map((unit) => (
          <div key={unit.label} className="flex flex-col items-center">
            <span className="text-3xl font-bold tabular-nums bg-accent rounded-lg w-16 h-16 flex items-center justify-center">
              {String(unit.value).padStart(2, "0")}
            </span>
            <span className="text-xs text-muted-foreground mt-1">{unit.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Usage: promo countdown
function PromoBanner() {
  const endDate = new Date("2026-02-14T23:59:59");
  return (
    <div className="bg-gradient-to-r from-pink-500 to-red-500 text-white p-6 rounded-lg">
      <h2 className="text-xl font-bold mb-4">Valentine's Day Special! 💕</h2>
      <CountdownTimer targetDate={endDate} label="Offer ends in" />
    </div>
  );
}
```

---

## Q21: Build a Carousel/Slider component.

```tsx
function Carousel({ children, autoPlay = false, interval = 4000 }: {
  children: React.ReactNode[];
  autoPlay?: boolean;
  interval?: number;
}) {
  const [current, setCurrent] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const total = React.Children.count(children);

  const goTo = (index: number) => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrent((index + total) % total);
    setTimeout(() => setIsAnimating(false), 300);
  };

  // Auto play
  useEffect(() => {
    if (!autoPlay) return;
    const timer = setInterval(() => goTo(current + 1), interval);
    return () => clearInterval(timer);
  }, [autoPlay, current, interval]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") goTo(current - 1);
    if (e.key === "ArrowRight") goTo(current + 1);
  };

  // Touch/swipe support
  const touchStart = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) goTo(current + (diff > 0 ? 1 : -1));
  };

  return (
    <div
      className="relative overflow-hidden rounded-lg"
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label="Image carousel"
    >
      <div
        className="flex transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {React.Children.map(children, (child, i) => (
          <div className="w-full flex-shrink-0" aria-hidden={i !== current}>
            {child}
          </div>
        ))}
      </div>

      {/* Navigation arrows */}
      <button
        onClick={() => goTo(current - 1)}
        className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70"
        aria-label="Previous slide"
      >←</button>
      <button
        onClick={() => goTo(current + 1)}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70"
        aria-label="Next slide"
      >→</button>

      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
        {Array.from({ length: total }, (_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`w-2 h-2 rounded-full transition-all
              ${i === current ? "bg-white w-6" : "bg-white/50"}`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## Q22: Build a Tooltip component with positioning logic.

```tsx
type Placement = "top" | "bottom" | "left" | "right";

function Tooltip({
  children,
  content,
  placement = "top",
  delay = 200,
}: {
  children: React.ReactElement;
  content: React.ReactNode;
  placement?: Placement;
  delay?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout>();

  const show = () => {
    timerRef.current = setTimeout(() => {
      setIsVisible(true);
      updatePosition();
    }, delay);
  };

  const hide = () => {
    clearTimeout(timerRef.current);
    setIsVisible(false);
  };

  const updatePosition = () => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;

    const tRect = trigger.getBoundingClientRect();
    const tipRect = tooltip.getBoundingClientRect();
    const gap = 8;

    const positions: Record<Placement, { top: number; left: number }> = {
      top: { top: tRect.top - tipRect.height - gap, left: tRect.left + tRect.width / 2 - tipRect.width / 2 },
      bottom: { top: tRect.bottom + gap, left: tRect.left + tRect.width / 2 - tipRect.width / 2 },
      left: { top: tRect.top + tRect.height / 2 - tipRect.height / 2, left: tRect.left - tipRect.width - gap },
      right: { top: tRect.top + tRect.height / 2 - tipRect.height / 2, left: tRect.right + gap },
    };

    setCoords(positions[placement]);
  };

  return (
    <>
      {React.cloneElement(children, {
        ref: triggerRef,
        onMouseEnter: show,
        onMouseLeave: hide,
        onFocus: show,
        onBlur: hide,
      })}

      {isVisible &&
        createPortal(
          <div
            ref={tooltipRef}
            className="fixed z-50 px-3 py-1.5 text-sm bg-popover border rounded-lg shadow-md animate-in fade-in zoom-in-95"
            style={{ top: coords.top, left: coords.left }}
            role="tooltip"
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}

// Usage
function DeliveryFee({ amount }: { amount: number }) {
  return (
    <Tooltip content="Includes packaging and service charge" placement="bottom">
      <span className="underline decoration-dashed cursor-help">
        Delivery: ${amount.toFixed(2)}
      </span>
    </Tooltip>
  );
}
```

---

## Q23: Build a Drag and Drop sortable list.

```tsx
function useSortable<T>(initialItems: T[]) {
  const [items, setItems] = useState(initialItems);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIndex(index);
  };

  const handleDrop = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;

    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(index, 0, moved);
      return next;
    });

    setDragIndex(null);
    setOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  return { items, setItems, dragIndex, overIndex, handleDragStart, handleDragOver, handleDrop, handleDragEnd };
}

function SortableList<T extends { id: string; name: string }>({
  initialItems,
  onReorder,
  renderItem,
}: {
  initialItems: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number) => React.ReactNode;
}) {
  const { items, dragIndex, overIndex, handleDragStart, handleDragOver, handleDrop, handleDragEnd } =
    useSortable(initialItems);

  useEffect(() => {
    onReorder(items);
  }, [items, onReorder]);

  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li
          key={item.id}
          draggable
          onDragStart={handleDragStart(index)}
          onDragOver={handleDragOver(index)}
          onDrop={handleDrop(index)}
          onDragEnd={handleDragEnd}
          className={`p-3 rounded-lg border bg-background cursor-grab active:cursor-grabbing
            transition-all
            ${dragIndex === index ? "opacity-50 scale-95" : ""}
            ${overIndex === index && dragIndex !== index ? "border-primary border-2" : ""}`}
        >
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">⠿</span>
            {renderItem(item, index)}
          </div>
        </li>
      ))}
    </ul>
  );
}

// Usage: reorder menu items
function MenuEditor() {
  const [items] = useState([
    { id: "1", name: "Margherita Pizza", price: 12.99 },
    { id: "2", name: "Pepperoni Pizza", price: 14.99 },
    { id: "3", name: "Garlic Bread", price: 5.99 },
  ]);

  return (
    <SortableList
      initialItems={items}
      onReorder={(newOrder) => console.log("New order:", newOrder)}
      renderItem={(item) => (
        <div className="flex justify-between flex-1">
          <span>{item.name}</span>
          <span className="text-muted-foreground">${item.price}</span>
        </div>
      )}
    />
  );
}
```

---

## Q24: Build a Multi-Step Wizard/Stepper component.

```tsx
interface Step {
  id: string;
  title: string;
  component: React.ComponentType<{ next: () => void; prev: () => void; data: any; setData: (d: any) => void }>;
  validate?: (data: any) => boolean;
}

function Stepper({ steps, onComplete }: { steps: Step[]; onComplete: (data: any) => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<any>({});
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const next = () => {
    const step = steps[currentStep];
    if (step.validate && !step.validate(data)) return;

    setCompletedSteps((prev) => new Set(prev).add(currentStep));

    if (currentStep < steps.length - 1) {
      setCurrentStep((p) => p + 1);
    } else {
      onComplete(data);
    }
  };

  const prev = () => {
    if (currentStep > 0) setCurrentStep((p) => p - 1);
  };

  const CurrentComponent = steps[currentStep].component;

  return (
    <div className="space-y-8">
      {/* Progress bar */}
      <div className="flex items-center">
        {steps.map((step, i) => (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                  ${i < currentStep || completedSteps.has(i)
                    ? "bg-primary text-primary-foreground"
                    : i === currentStep
                    ? "border-2 border-primary text-primary"
                    : "bg-muted text-muted-foreground"}`}
              >
                {completedSteps.has(i) ? "✓" : i + 1}
              </div>
              <span className="text-xs mt-1 text-muted-foreground">{step.title}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${i < currentStep ? "bg-primary" : "bg-muted"}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Current step content */}
      <div className="min-h-[300px]">
        <CurrentComponent next={next} prev={prev} data={data} setData={setData} />
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={prev}
          disabled={currentStep === 0}
          className="px-4 py-2 border rounded-lg disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={next}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
        >
          {currentStep === steps.length - 1 ? "Complete" : "Next"}
        </button>
      </div>
    </div>
  );
}

// Usage: Checkout wizard
const checkoutSteps: Step[] = [
  {
    id: "address",
    title: "Address",
    validate: (data) => !!data.address,
    component: ({ data, setData, next }) => (
      <div>
        <h2 className="text-lg font-semibold mb-4">Delivery Address</h2>
        <textarea
          value={data.address ?? ""}
          onChange={(e) => setData({ ...data, address: e.target.value })}
          className="w-full p-3 border rounded-lg"
          placeholder="Enter your delivery address..."
        />
      </div>
    ),
  },
  {
    id: "payment",
    title: "Payment",
    validate: (data) => !!data.paymentMethod,
    component: ({ data, setData }) => (
      <div>
        <h2 className="text-lg font-semibold mb-4">Payment Method</h2>
        {["Card", "Cash", "UPI"].map((m) => (
          <label key={m} className="flex items-center gap-2 p-3 border rounded-lg mb-2 cursor-pointer">
            <input type="radio" name="payment" checked={data.paymentMethod === m.toLowerCase()}
              onChange={() => setData({ ...data, paymentMethod: m.toLowerCase() })} />
            {m}
          </label>
        ))}
      </div>
    ),
  },
  {
    id: "review",
    title: "Review",
    component: ({ data }) => (
      <div>
        <h2 className="text-lg font-semibold mb-4">Order Review</h2>
        <p>Address: {data.address}</p>
        <p>Payment: {data.paymentMethod}</p>
      </div>
    ),
  },
];
```

---

## Q25: Build a Copy-to-Clipboard component.

```tsx
function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return true;
    }
  }, []);

  return { copied, copy };
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const { copied, copy } = useCopyToClipboard();

  return (
    <button
      onClick={() => copy(text)}
      className="px-3 py-1.5 text-sm border rounded-lg hover:bg-accent flex items-center gap-1.5 transition-colors"
    >
      {copied ? (
        <>✅ Copied!</>
      ) : (
        <>📋 {label}</>
      )}
    </button>
  );
}

// Usage: copy order ID
function OrderHeader({ orderId }: { orderId: string }) {
  return (
    <div className="flex items-center gap-2">
      <h2>Order #{orderId.slice(0, 8)}</h2>
      <CopyButton text={orderId} label="Copy ID" />
    </div>
  );
}
```

---

## Q26: Build a Skeleton Loader factory.

```tsx
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={`h-4 ${i === lines - 1 ? "w-3/4" : "w-full"}`} />
      ))}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="border rounded-lg p-4 space-y-4">
      <Skeleton className="h-48 w-full rounded-lg" />
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex gap-4">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}

function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted p-3 flex gap-4">
        {Array.from({ length: cols }, (_, i) => <Skeleton key={i} className="h-4 flex-1" />)}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="p-3 flex gap-4 border-t">
          {Array.from({ length: cols }, (_, c) => <Skeleton key={c} className="h-4 flex-1" />)}
        </div>
      ))}
    </div>
  );
}

// Usage pattern with React Query
function withSkeleton<P>(
  Component: React.ComponentType<P & { data: any }>,
  SkeletonComponent: React.ComponentType,
  queryKey: string[]
) {
  return function SkeletonWrapper(props: Omit<P, "data">) {
    const { data, isLoading } = useQuery({ queryKey });
    if (isLoading) return <SkeletonComponent />;
    return <Component {...(props as any)} data={data} />;
  };
}
```

---

## Q27: Build a Virtualized List for rendering large datasets.

```tsx
function VirtualizedList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
}: {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
}) {
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = items.length * itemHeight;
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(items.length, startIndex + visibleCount + 2 * overscan);

  const visibleItems = items.slice(startIndex, endIndex);

  return (
    <div
      style={{ height: containerHeight, overflow: "auto" }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        {visibleItems.map((item, i) => {
          const index = startIndex + i;
          return (
            <div
              key={index}
              style={{
                position: "absolute",
                top: index * itemHeight,
                height: itemHeight,
                width: "100%",
              }}
            >
              {renderItem(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Usage: render 10,000 menu items efficiently
function LargeMenuList() {
  const items = Array.from({ length: 10000 }, (_, i) => ({
    id: `item-${i}`,
    name: `Menu Item ${i + 1}`,
    price: (Math.random() * 30 + 5).toFixed(2),
  }));

  return (
    <VirtualizedList
      items={items}
      itemHeight={60}
      containerHeight={600}
      renderItem={(item) => (
        <div className="flex justify-between items-center px-4 py-2 border-b">
          <span>{item.name}</span>
          <span className="font-medium">${item.price}</span>
        </div>
      )}
    />
  );
}
```

---

## Q28: Build a Command Palette (⌘K) component.

```tsx
function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo(() => [
    { id: "home", label: "Go to Home", icon: "🏠", action: () => window.location.href = "/" },
    { id: "orders", label: "View Orders", icon: "📦", action: () => window.location.href = "/orders" },
    { id: "cart", label: "Open Cart", icon: "🛒", action: () => {} },
    { id: "profile", label: "Edit Profile", icon: "👤", action: () => {} },
    { id: "theme", label: "Toggle Theme", icon: "🎨", action: () => {} },
    { id: "logout", label: "Sign Out", icon: "🚪", action: () => fetch("/api/auth/logout", { method: "POST" }) },
  ], []);

  const filtered = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  // Keyboard shortcut: ⌘K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
    setQuery("");
    setActiveIndex(0);
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((p) => Math.min(p + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((p) => Math.max(p - 1, 0));
        break;
      case "Enter":
        filtered[activeIndex]?.action();
        setIsOpen(false);
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={() => setIsOpen(false)} />
      <div className="relative top-[20%] mx-auto max-w-lg bg-popover border rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center px-4 border-b">
          <span className="text-muted-foreground">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="w-full px-3 py-4 bg-transparent outline-none"
          />
          <kbd className="text-xs px-2 py-1 bg-muted rounded">ESC</kbd>
        </div>

        <ul className="max-h-80 overflow-auto py-2">
          {filtered.map((cmd, i) => (
            <li
              key={cmd.id}
              className={`px-4 py-3 flex items-center gap-3 cursor-pointer
                ${i === activeIndex ? "bg-accent" : "hover:bg-accent/50"}`}
              onClick={() => { cmd.action(); setIsOpen(false); }}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <span>{cmd.icon}</span>
              <span>{cmd.label}</span>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-4 py-8 text-center text-muted-foreground">No commands found</li>
          )}
        </ul>
      </div>
    </div>,
    document.body
  );
}
```

---

## Q29: Build an Error Boundary with retry and error reporting.

```tsx
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: (error: Error, retry: () => void) => React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null, retryCount: 0 };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.props.onError?.(error, errorInfo);
    // Log to error tracking service
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  retry = () => {
    this.setState((prev) => ({ hasError: false, error: null, retryCount: prev.retryCount + 1 }));
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.retry);
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="text-4xl mb-4">😔</div>
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-muted-foreground mb-4 max-w-md">{this.state.error.message}</p>
          <div className="flex gap-3">
            <button onClick={this.retry} className="px-4 py-2 bg-primary text-white rounded-lg">
              Try Again {this.state.retryCount > 0 && `(${this.state.retryCount})`}
            </button>
            <button onClick={() => window.location.reload()} className="px-4 py-2 border rounded-lg">
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Usage: wrap feature sections
function App() {
  return (
    <ErrorBoundary
      onError={(error) => {
        fetch("/api/errors", {
          method: "POST",
          body: JSON.stringify({ message: error.message, stack: error.stack }),
        });
      }}
    >
      <RestaurantPage />
    </ErrorBoundary>
  );
}
```

---

## Q30: Build a responsive Sidebar/Navigation component.

```tsx
function useMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isMobile;
}

interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
}

function Sidebar({ items }: { items: NavItem[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useMobile();
  const [location] = useLocation();

  // Close on route change (mobile)
  useEffect(() => {
    if (isMobile) setIsOpen(false);
  }, [location, isMobile]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const sidebarContent = (
    <nav className="flex flex-col gap-1 p-4" role="navigation">
      <div className="flex items-center gap-2 mb-6 px-2">
        <span className="text-2xl">🍕</span>
        <span className="text-xl font-bold">FoodDash</span>
      </div>
      {items.map((item) => {
        const isActive = location === item.href;
        return (
          <a
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
              ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground hover:text-foreground"}`}
            aria-current={isActive ? "page" : undefined}
          >
            <span>{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="bg-destructive text-white text-xs px-1.5 py-0.5 rounded-full">
                {item.badge}
              </span>
            )}
          </a>
        );
      })}
    </nav>
  );

  if (isMobile) {
    return (
      <>
        <button onClick={() => setIsOpen(true)} className="p-2 fixed top-4 left-4 z-40 bg-background border rounded-lg shadow">☰</button>
        {isOpen && (
          <>
            <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setIsOpen(false)} />
            <aside className="fixed left-0 top-0 bottom-0 w-72 bg-background border-r z-50 shadow-xl animate-in slide-in-from-left">
              {sidebarContent}
            </aside>
          </>
        )}
      </>
    );
  }

  return (
    <aside className="w-64 border-r bg-background h-screen sticky top-0 shrink-0">
      {sidebarContent}
    </aside>
  );
}

// Usage
const navItems: NavItem[] = [
  { label: "Home", href: "/", icon: "🏠" },
  { label: "Orders", href: "/orders", icon: "📦", badge: 3 },
  { label: "Restaurants", href: "/restaurants", icon: "🍕" },
  { label: "Settings", href: "/settings", icon: "⚙️" },
];
```

---

## Q31: Build a Chip/Tag input component.

```tsx
function TagInput({
  tags,
  onChange,
  placeholder = "Add tag...",
  maxTags = 10,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (tag: string) => {
    const cleaned = tag.trim().toLowerCase();
    if (!cleaned || tags.includes(cleaned) || tags.length >= maxTags) return;
    onChange([...tags, cleaned]);
    setInput("");
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    }
    if (e.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  return (
    <div
      className="flex flex-wrap gap-2 p-2 border rounded-lg min-h-[42px] cursor-text bg-background"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag) => (
        <span key={tag} className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm">
          {tag}
          <button onClick={() => removeTag(tag)} className="hover:text-destructive ml-1">✕</button>
        </span>
      ))}
      {tags.length < maxTags && (
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(input)}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] outline-none bg-transparent text-sm"
        />
      )}
    </div>
  );
}

// Usage: restaurant tags
function RestaurantTags() {
  const [tags, setTags] = useState(["pizza", "italian"]);
  return <TagInput tags={tags} onChange={setTags} placeholder="Add cuisine tags..." maxTags={5} />;
}
```

---

## Q32: Build a Date Picker component.

```tsx
function DatePicker({ value, onChange, minDate, maxDate }: {
  value?: Date;
  onChange: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value ?? new Date());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfWeek }, () => null);

  const isDisabled = (day: number) => {
    const date = new Date(year, month, day);
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const isSelected = (day: number) =>
    value?.getFullYear() === year && value?.getMonth() === month && value?.getDate() === day;

  const isToday = (day: number) => {
    const today = new Date();
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
  };

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-2 border rounded-lg bg-background flex items-center gap-2"
      >
        📅 {value ? value.toLocaleDateString() : "Select date"}
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 p-4 bg-popover border rounded-lg shadow-lg w-72">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <button onClick={() => setViewDate(new Date(year, month - 1))} className="p-1 hover:bg-accent rounded">←</button>
            <span className="font-medium">{monthNames[month]} {year}</span>
            <button onClick={() => setViewDate(new Date(year, month + 1))} className="p-1 hover:bg-accent rounded">→</button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-2">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => <span key={d}>{d}</span>)}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1">
            {blanks.map((_, i) => <div key={`b-${i}`} />)}
            {days.map((day) => (
              <button
                key={day}
                type="button"
                disabled={isDisabled(day)}
                onClick={() => { onChange(new Date(year, month, day)); setIsOpen(false); }}
                className={`w-9 h-9 rounded-full text-sm flex items-center justify-center
                  ${isSelected(day) ? "bg-primary text-white" : ""}
                  ${isToday(day) && !isSelected(day) ? "border border-primary" : ""}
                  ${isDisabled(day) ? "text-muted-foreground/30 cursor-not-allowed" : "hover:bg-accent"}`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Q33: Build a Progress Bar with animated steps.

```tsx
function ProgressBar({ value, max = 100, label, variant = "default", showValue = true }: {
  value: number;
  max?: number;
  label?: string;
  variant?: "default" | "success" | "warning" | "error";
  showValue?: boolean;
}) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const colors = {
    default: "bg-primary",
    success: "bg-green-500",
    warning: "bg-yellow-500",
    error: "bg-red-500",
  };

  return (
    <div>
      {(label || showValue) && (
        <div className="flex justify-between text-sm mb-1">
          {label && <span className="font-medium">{label}</span>}
          {showValue && <span className="text-muted-foreground">{Math.round(percentage)}%</span>}
        </div>
      )}
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden" role="progressbar"
        aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${colors[variant]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// Usage: order completion progress
function OrderProgress({ status }: { status: string }) {
  const steps = ["pending", "confirmed", "preparing", "ready_for_pickup", "out_for_delivery", "delivered"];
  const current = steps.indexOf(status);
  const value = ((current + 1) / steps.length) * 100;

  return <ProgressBar value={value} label="Order Progress" variant={value === 100 ? "success" : "default"} />;
}
```

---

## Q34: Build a Breadcrumb navigation component.

```tsx
interface BreadcrumbItem {
  label: string;
  href?: string;
}

function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="flex items-center gap-1.5">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-muted-foreground">/</span>}
              {isLast || !item.href ? (
                <span className={isLast ? "font-medium" : "text-muted-foreground"}>{item.label}</span>
              ) : (
                <a href={item.href} className="text-muted-foreground hover:text-foreground transition-colors">
                  {item.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Auto-generate from URL
function useBreadcrumbs(): BreadcrumbItem[] {
  const [location] = useLocation();
  const segments = location.split("/").filter(Boolean);

  return [
    { label: "Home", href: "/" },
    ...segments.map((seg, i) => ({
      label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " "),
      href: i < segments.length - 1 ? "/" + segments.slice(0, i + 1).join("/") : undefined,
    })),
  ];
}
```

---

## Q35: Build an Animated Number Counter.

```tsx
function AnimatedNumber({ value, duration = 1000, format }: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const start = prevValue.current;
    const diff = value - start;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = start + diff * eased;

      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        prevValue.current = value;
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  const formatted = format ? format(displayValue) : Math.round(displayValue).toLocaleString();

  return <span className="tabular-nums">{formatted}</span>;
}

// Usage: dashboard stats
function DashboardStats() {
  const { data } = useQuery({ queryKey: ["/api/admin/stats"] });

  return (
    <div className="grid grid-cols-4 gap-4">
      <StatCard label="Total Orders" value={data?.totalOrders ?? 0} icon="📦" />
      <StatCard label="Revenue" value={data?.revenue ?? 0} icon="💰"
        format={(n) => `$${n.toFixed(2)}`} />
      <StatCard label="Active Users" value={data?.activeUsers ?? 0} icon="👥" />
      <StatCard label="Avg Rating" value={data?.avgRating ?? 0} icon="⭐"
        format={(n) => n.toFixed(1)} />
    </div>
  );
}

function StatCard({ label, value, icon, format }: {
  label: string; value: number; icon: string; format?: (n: number) => string;
}) {
  return (
    <div className="p-4 border rounded-lg">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span>{icon}</span>
      </div>
      <p className="text-2xl font-bold">
        <AnimatedNumber value={value} format={format} />
      </p>
    </div>
  );
}
```

---

## Q36: Build an Undo/Redo hook.

```tsx
function useUndoRedo<T>(initialState: T) {
  const [past, setPast] = useState<T[]>([]);
  const [present, setPresent] = useState(initialState);
  const [future, setFuture] = useState<T[]>([]);

  const set = useCallback((newState: T | ((prev: T) => T)) => {
    setPresent((prev) => {
      const next = typeof newState === "function" ? (newState as (p: T) => T)(prev) : newState;
      setPast((p) => [...p, prev]);
      setFuture([]);
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setPast((prev) => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1];
      setFuture((f) => [present, ...f]);
      setPresent(previous);
      return prev.slice(0, -1);
    });
  }, [present]);

  const redo = useCallback(() => {
    setFuture((prev) => {
      if (prev.length === 0) return prev;
      const next = prev[0];
      setPast((p) => [...p, present]);
      setPresent(next);
      return prev.slice(1);
    });
  }, [present]);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  return { state: present, set, undo, redo, canUndo, canRedo };
}

// Usage: editable menu with undo
function MenuEditor() {
  const { state: items, set: setItems, undo, redo, canUndo, canRedo } = useUndoRedo([
    { id: "1", name: "Pizza", price: 12 },
    { id: "2", name: "Burger", price: 10 },
  ]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [undo, redo]);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button onClick={undo} disabled={!canUndo} className="px-3 py-1 border rounded disabled:opacity-50">↩ Undo</button>
        <button onClick={redo} disabled={!canRedo} className="px-3 py-1 border rounded disabled:opacity-50">↪ Redo</button>
      </div>
      {items.map((item) => <div key={item.id}>{item.name} — ${item.price}</div>)}
    </div>
  );
}
```

---

## Q37–Q40: Build React custom hooks collection.

```tsx
// Q37: useClickOutside
function useClickOutside(ref: React.RefObject<HTMLElement>, handler: () => void) {
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      handler();
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, [ref, handler]);
}

// Q38: useKeyPress
function useKeyPress(targetKey: string, handler: () => void) {
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === targetKey) handler();
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [targetKey, handler]);
}

// Q39: useMediaQuery
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

// Q40: useOnlineStatus
function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return isOnline;
}

// Offline banner
function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;
  return (
    <div className="fixed bottom-0 inset-x-0 bg-destructive text-white py-2 text-center text-sm z-50">
      ⚠️ You're offline. Some features may not work.
    </div>
  );
}
```

---

## Q41: Build a Lazy-loaded Image component with blur placeholder.

```tsx
function LazyImage({ src, alt, className = "", blurHash }: {
  src: string; alt: string; className?: string; blurHash?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    if (!imgRef.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
        observer.disconnect();
      }
    }, { rootMargin: "200px" });
    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef as any} className={`relative overflow-hidden ${className}`}>
      {/* Blur placeholder */}
      {!loaded && (
        <div className="absolute inset-0 bg-muted animate-pulse" style={{
          backgroundImage: blurHash ? `url(${blurHash})` : undefined,
          backgroundSize: "cover",
          filter: "blur(20px)",
          transform: "scale(1.1)",
        }} />
      )}

      {isInView && !error && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={`w-full h-full object-cover transition-opacity duration-300
            ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground">
          📷 Image unavailable
        </div>
      )}
    </div>
  );
}
```

---

## Q42: Build a Responsive Grid Layout system.

```tsx
type ColSpan = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

function Grid({ children, cols = 12, gap = 4, className = "" }: {
  children: React.ReactNode;
  cols?: number;
  gap?: number;
  className?: string;
}) {
  return (
    <div
      className={`grid ${className}`}
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gap: `${gap * 4}px`,
      }}
    >
      {children}
    </div>
  );
}

function Col({ children, span = 1, md, lg, className = "" }: {
  children: React.ReactNode;
  span?: ColSpan;
  md?: ColSpan;
  lg?: ColSpan;
  className?: string;
}) {
  const isMd = useMediaQuery("(min-width: 768px)");
  const isLg = useMediaQuery("(min-width: 1024px)");

  const effectiveSpan = isLg && lg ? lg : isMd && md ? md : span;

  return (
    <div style={{ gridColumn: `span ${effectiveSpan}` }} className={className}>
      {children}
    </div>
  );
}

// Usage
function DashboardLayout() {
  return (
    <Grid cols={12} gap={4}>
      <Col span={12} md={8} lg={9}><MainContent /></Col>
      <Col span={12} md={4} lg={3}><Sidebar /></Col>
    </Grid>
  );
}
```

---

## Q43: Build a Color Picker component.

```tsx
function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const presets = [
    "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
    "#3b82f6", "#8b5cf6", "#ec4899", "#000000", "#ffffff",
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 border rounded-lg"
      >
        <div className="w-6 h-6 rounded border" style={{ backgroundColor: value }} />
        <span className="text-sm font-mono">{value}</span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 p-4 bg-popover border rounded-lg shadow-lg w-64">
          <div className="grid grid-cols-5 gap-2 mb-4">
            {presets.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => { onChange(color); setIsOpen(false); }}
                className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110
                  ${value === color ? "border-primary ring-2 ring-primary/50" : "border-transparent"}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-10 cursor-pointer rounded"
          />
          <input
            type="text"
            value={value}
            onChange={(e) => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && onChange(e.target.value)}
            className="w-full mt-2 px-3 py-1.5 border rounded text-sm font-mono"
            placeholder="#000000"
          />
        </div>
      )}
    </div>
  );
}
```

---

## Q44: Build a Toggle/Switch component.

```tsx
function Toggle({ checked, onChange, label, disabled = false, size = "md" }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: { track: "w-8 h-4", thumb: "w-3 h-3", translate: "translate-x-4" },
    md: { track: "w-11 h-6", thumb: "w-5 h-5", translate: "translate-x-5" },
    lg: { track: "w-14 h-7", thumb: "w-6 h-6", translate: "translate-x-7" },
  };

  const s = sizes[size];

  return (
    <label className={`inline-flex items-center gap-2 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
      <button
        role="switch"
        type="button"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`${s.track} rounded-full relative transition-colors
          ${checked ? "bg-primary" : "bg-muted"}`}
      >
        <span className={`${s.thumb} bg-white rounded-full absolute top-0.5 left-0.5 transition-transform shadow
          ${checked ? s.translate : ""}`} />
      </button>
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
}

// Usage: restaurant settings
function RestaurantSettings() {
  const [isOpen, setIsOpen] = useState(true);
  const [autoAccept, setAutoAccept] = useState(false);

  return (
    <div className="space-y-4">
      <Toggle checked={isOpen} onChange={setIsOpen} label="Restaurant Open" />
      <Toggle checked={autoAccept} onChange={setAutoAccept} label="Auto-accept orders" />
    </div>
  );
}
```

---

## Q45: Build an Avatar component with fallback initials.

```tsx
function Avatar({ src, name, size = "md", className = "" }: {
  src?: string; name: string; size?: "sm" | "md" | "lg" | "xl"; className?: string;
}) {
  const [imgError, setImgError] = useState(false);
  const sizes = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-12 h-12 text-base", xl: "w-16 h-16 text-lg" };

  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  // Generate consistent color from name
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = ["bg-red-500", "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500", "bg-pink-500"];
  const bgColor = colors[hash % colors.length];

  return (
    <div className={`${sizes[size]} rounded-full overflow-hidden flex items-center justify-center shrink-0 ${className}
      ${!src || imgError ? `${bgColor} text-white font-medium` : ""}`}>
      {src && !imgError ? (
        <img src={src} alt={name} className="w-full h-full object-cover" onError={() => setImgError(true)} />
      ) : (
        initials
      )}
    </div>
  );
}

function AvatarGroup({ users, max = 4 }: { users: Array<{ name: string; avatar?: string }>; max?: number }) {
  const visible = users.slice(0, max);
  const remaining = users.length - max;

  return (
    <div className="flex -space-x-2">
      {visible.map((user, i) => (
        <Avatar key={i} src={user.avatar} name={user.name} size="sm" className="ring-2 ring-background" />
      ))}
      {remaining > 0 && (
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium ring-2 ring-background">
          +{remaining}
        </div>
      )}
    </div>
  );
}
```

---

## Q46–Q50: Build mini React components.

```tsx
// Q46: Badge component
function Badge({ children, variant = "default" }: {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "outline";
}) {
  const styles = {
    default: "bg-primary/10 text-primary",
    success: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    warning: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    error: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    outline: "border text-foreground",
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[variant]}`}>{children}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const variant = { pending: "warning", confirmed: "default", preparing: "default",
    ready_for_pickup: "success", out_for_delivery: "success", delivered: "success", cancelled: "error" }[status] ?? "default";
  return <Badge variant={variant as any}>{status.replace(/_/g, " ")}</Badge>;
}

// Q47: Empty State component
function EmptyState({ icon = "📭", title, description, action }: {
  icon?: string; title: string; description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-5xl mb-4">{icon}</span>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      {description && <p className="text-muted-foreground max-w-sm mb-4">{description}</p>}
      {action && <button onClick={action.onClick} className="px-4 py-2 bg-primary text-white rounded-lg">{action.label}</button>}
    </div>
  );
}

// Q48: Divider with text
function Divider({ children }: { children?: React.ReactNode }) {
  if (!children) return <hr className="border-border my-4" />;
  return (
    <div className="flex items-center gap-4 my-4">
      <div className="flex-1 border-t" />
      <span className="text-sm text-muted-foreground">{children}</span>
      <div className="flex-1 border-t" />
    </div>
  );
}

// Q49: Loading Button
function LoadingButton({ isLoading, children, ...props }: {
  isLoading: boolean; children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} disabled={isLoading || props.disabled}
      className={`flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg disabled:opacity-50 ${props.className ?? ""}`}>
      {isLoading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
      {children}
    </button>
  );
}

// Q50: Keyboard Shortcut display
function KBD({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex gap-1">
      {keys.map((key, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-muted-foreground">+</span>}
          <kbd className="px-1.5 py-0.5 text-xs bg-muted border rounded font-mono">{key}</kbd>
        </React.Fragment>
      ))}
    </span>
  );
}
```

---

## Q51–Q55: Build animation and transition components.

```tsx
// Q51: FadeIn wrapper
function FadeIn({ children, delay = 0, duration = 300 }: {
  children: React.ReactNode; delay?: number; duration?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setIsVisible(true);
    }, { threshold: 0.1 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} style={{
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? "translateY(0)" : "translateY(20px)",
      transition: `opacity ${duration}ms ease ${delay}ms, transform ${duration}ms ease ${delay}ms`,
    }}>{children}</div>
  );
}

// Q52: Stagger children animation
function StaggeredList({ children, staggerMs = 50 }: { children: React.ReactNode[]; staggerMs?: number }) {
  return (
    <>
      {React.Children.map(children, (child, i) => (
        <FadeIn delay={i * staggerMs}>{child}</FadeIn>
      ))}
    </>
  );
}

// Q53: Collapse/Expand animation
function Collapsible({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    setHeight(isOpen ? (ref.current?.scrollHeight ?? 0) : 0);
  }, [isOpen]);

  return (
    <div style={{ height, overflow: "hidden", transition: "height 200ms ease-out" }}>
      <div ref={ref}>{children}</div>
    </div>
  );
}

// Q54: Animated presence (mount/unmount with animation)
function AnimatedPresence({ isPresent, children }: { isPresent: boolean; children: React.ReactNode }) {
  const [shouldRender, setShouldRender] = useState(isPresent);
  const [animState, setAnimState] = useState<"entering" | "entered" | "exiting">("entering");

  useEffect(() => {
    if (isPresent) {
      setShouldRender(true);
      requestAnimationFrame(() => setAnimState("entering"));
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimState("entered")));
    } else {
      setAnimState("exiting");
      const timer = setTimeout(() => setShouldRender(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isPresent]);

  if (!shouldRender) return null;

  return (
    <div style={{
      opacity: animState === "entered" ? 1 : 0,
      transform: animState === "entered" ? "scale(1)" : "scale(0.95)",
      transition: "opacity 200ms, transform 200ms",
    }}>
      {children}
    </div>
  );
}

// Q55: Shimmer effect
function Shimmer({ width = "100%", height = "20px" }: { width?: string; height?: string }) {
  return (
    <div
      style={{ width, height }}
      className="relative overflow-hidden rounded bg-muted"
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}
```

---

## Q56–Q60: Build state management patterns.

```tsx
// Q56: React Context + useReducer pattern for complex state
interface AppState {
  user: User | null;
  cart: CartItem[];
  theme: "light" | "dark";
  notifications: Notification[];
}

type AppAction =
  | { type: "SET_USER"; payload: User | null }
  | { type: "ADD_TO_CART"; payload: CartItem }
  | { type: "SET_THEME"; payload: "light" | "dark" }
  | { type: "ADD_NOTIFICATION"; payload: Notification }
  | { type: "DISMISS_NOTIFICATION"; payload: string };

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_USER": return { ...state, user: action.payload };
    case "ADD_TO_CART": return { ...state, cart: [...state.cart, action.payload] };
    case "SET_THEME": return { ...state, theme: action.payload };
    case "ADD_NOTIFICATION": return { ...state, notifications: [action.payload, ...state.notifications] };
    case "DISMISS_NOTIFICATION": return { ...state, notifications: state.notifications.filter((n) => n.id !== action.payload) };
    default: return state;
  }
}

const AppContext = createContext<{ state: AppState; dispatch: React.Dispatch<AppAction> } | null>(null);

function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(appReducer, {
    user: null, cart: [], theme: "light", notifications: [],
  });
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

// Q57: Zustand-like store with React
function createStore<T>(initialState: T) {
  let state = initialState;
  const listeners = new Set<() => void>();

  return {
    getState: () => state,
    setState: (partial: Partial<T> | ((prev: T) => Partial<T>)) => {
      state = { ...state, ...(typeof partial === "function" ? partial(state) : partial) };
      listeners.forEach((l) => l());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    useStore: <S>(selector: (state: T) => S): S => {
      const [value, setValue] = useState(() => selector(state));
      useEffect(() => {
        const unsub = createStore.subscribe(() => {
          const newValue = selector(state);
          setValue(newValue);
        });
        return unsub;
      }, [selector]);
      return value;
    },
  };
}

// Q58: Persist state to localStorage
function usePersistentReducer<S, A>(
  reducer: React.Reducer<S, A>,
  initialState: S,
  key: string
): [S, React.Dispatch<A>] {
  const [state, dispatch] = React.useReducer(reducer, initialState, () => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initialState;
    } catch {
      return initialState;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [state, key]);

  return [state, dispatch];
}

// Q59: Immer-like produce for immutable updates
function produce<T>(state: T, recipe: (draft: T) => void): T {
  const draft = JSON.parse(JSON.stringify(state)); // deep clone
  recipe(draft);
  return draft;
}

// Usage
const nextState = produce(state, (draft) => {
  draft.cart[0].quantity++;
  draft.user!.name = "New Name";
});

// Q60: Selector with memoization for derived state
function useSelector<T, S>(store: { state: T }, selector: (state: T) => S): S {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  return useMemo(() => selectorRef.current(store.state), [store.state]);
}
```

---

## Q61–Q65: Build React patterns for performance.

```tsx
// Q61: React.memo with custom comparison
const RestaurantCard = React.memo(
  function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
    return (
      <div className="p-4 border rounded-lg">
        <h3>{restaurant.name}</h3>
        <p>⭐ {restaurant.rating}</p>
      </div>
    );
  },
  (prev, next) =>
    prev.restaurant.id === next.restaurant.id &&
    prev.restaurant.rating === next.restaurant.rating &&
    prev.restaurant.isOpen === next.restaurant.isOpen
);

// Q62: useDeferredValue for expensive renders
function RestaurantSearch() {
  const [query, setQuery] = useState("");
  const deferredQuery = React.useDeferredValue(query);
  const isStale = query !== deferredQuery;

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <div style={{ opacity: isStale ? 0.7 : 1, transition: "opacity 200ms" }}>
        <ExpensiveFilteredList query={deferredQuery} />
      </div>
    </div>
  );
}

// Q63: useTransition for non-urgent updates
function TabPanel() {
  const [tab, setTab] = useState("orders");
  const [isPending, startTransition] = React.useTransition();

  const selectTab = (newTab: string) => {
    startTransition(() => setTab(newTab));
  };

  return (
    <div>
      <div className="flex gap-2">
        {["orders", "analytics", "settings"].map((t) => (
          <button key={t} onClick={() => selectTab(t)}
            className={tab === t ? "font-bold" : ""}>{t}</button>
        ))}
      </div>
      <div style={{ opacity: isPending ? 0.6 : 1 }}>
        {tab === "orders" && <OrderList />}
        {tab === "analytics" && <AnalyticsDashboard />}
        {tab === "settings" && <Settings />}
      </div>
    </div>
  );
}

// Q64: Code splitting with React.lazy + named exports
const lazyImport = <T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) => React.lazy(factory);

const AdminDashboard = lazyImport(() => import("./pages/AdminDashboard"));
const RestaurantDashboard = lazyImport(() => import("./pages/RestaurantDashboard"));

// With preload on hover
function PreloadLink({ to, children, loadComponent }: {
  to: string; children: React.ReactNode;
  loadComponent: () => Promise<any>;
}) {
  return (
    <a href={to}
      onMouseEnter={() => loadComponent()}
      onFocus={() => loadComponent()}>
      {children}
    </a>
  );
}

// Q65: useCallback identity stability pattern
function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const ref = useRef(callback);
  ref.current = callback;
  return useCallback((...args: any[]) => ref.current(...args), []) as T;
}
```

---

## Q66–Q70: Build layout and composition components.

```tsx
// Q66: Compound component pattern
function Menu({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <MenuContext.Provider value={{ isOpen, toggle: () => setIsOpen(!isOpen), close: () => setIsOpen(false) }}>
      <div className="relative">{children}</div>
    </MenuContext.Provider>
  );
}

Menu.Trigger = function Trigger({ children }: { children: React.ReactNode }) {
  const { toggle } = useContext(MenuContext)!;
  return <div onClick={toggle}>{children}</div>;
};

Menu.Content = function Content({ children }: { children: React.ReactNode }) {
  const { isOpen, close } = useContext(MenuContext)!;
  if (!isOpen) return null;
  return (
    <div className="absolute right-0 mt-2 w-48 bg-popover border rounded-lg shadow-lg py-1 z-50">
      {children}
    </div>
  );
};

Menu.Item = function Item({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const { close } = useContext(MenuContext)!;
  return (
    <button className="w-full px-4 py-2 text-left text-sm hover:bg-accent"
      onClick={() => { onClick?.(); close(); }}>{children}</button>
  );
};

const MenuContext = createContext<{ isOpen: boolean; toggle: () => void; close: () => void } | null>(null);

// Usage
function UserMenu() {
  return (
    <Menu>
      <Menu.Trigger><Avatar name="John" size="sm" /></Menu.Trigger>
      <Menu.Content>
        <Menu.Item onClick={() => {}}>Profile</Menu.Item>
        <Menu.Item onClick={() => {}}>Settings</Menu.Item>
        <Menu.Item onClick={() => {}}>Sign Out</Menu.Item>
      </Menu.Content>
    </Menu>
  );
}

// Q67: Render Props pattern
function DataFetcher<T>({ url, children }: {
  url: string;
  children: (data: { data: T | null; isLoading: boolean; error: Error | null }) => React.ReactNode;
}) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetch(url).then((r) => r.json()).then(setData).catch(setError).finally(() => setIsLoading(false));
  }, [url]);

  return <>{children({ data, isLoading, error })}</>;
}

// Q68: HOC pattern with TypeScript
function withAuth<P extends object>(
  Component: React.ComponentType<P & { user: User }>,
  requiredRole?: string
): React.FC<Omit<P, "user">> {
  return function AuthenticatedComponent(props) {
    const { user, isLoading } = useAuth();
    if (isLoading) return <div>Loading...</div>;
    if (!user) return <Redirect to="/sign-in" />;
    if (requiredRole && user.role !== requiredRole) return <div>Forbidden</div>;
    return <Component {...(props as P)} user={user} />;
  };
}

// Q69: Slot pattern (content projection)
function Card({ children }: { children: React.ReactNode }) {
  const slots = { header: null as React.ReactNode, body: null as React.ReactNode, footer: null as React.ReactNode };

  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child)) {
      if (child.type === Card.Header) slots.header = child;
      else if (child.type === Card.Footer) slots.footer = child;
      else slots.body = child;
    } else {
      slots.body = child;
    }
  });

  return (
    <div className="border rounded-lg overflow-hidden">
      {slots.header && <div className="px-4 py-3 border-b bg-muted/50">{slots.header}</div>}
      <div className="p-4">{slots.body}</div>
      {slots.footer && <div className="px-4 py-3 border-t bg-muted/50">{slots.footer}</div>}
    </div>
  );
}
Card.Header = ({ children }: { children: React.ReactNode }) => <>{children}</>;
Card.Footer = ({ children }: { children: React.ReactNode }) => <>{children}</>;

// Q70: Polymorphic component
type AsProps<C extends React.ElementType> = {
  as?: C;
} & React.ComponentPropsWithoutRef<C>;

function Box<C extends React.ElementType = "div">({ as, children, ...props }: AsProps<C>) {
  const Component = as ?? "div";
  return <Component {...props}>{children}</Component>;
}

// Usage: <Box as="section"> <Box as="a" href="/"> <Box as={Link} to="/">
```

---

## Q71–Q75: Build accessibility-focused components.

```tsx
// Q71: Skip to content link
function SkipToContent() {
  return (
    <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-primary focus:text-white">
      Skip to main content
    </a>
  );
}

// Q72: Screen reader announcer
function useAnnounce() {
  const announce = useCallback((message: string, politeness: "polite" | "assertive" = "polite") => {
    const el = document.createElement("div");
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", politeness);
    el.className = "sr-only";
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => document.body.removeChild(el), 1000);
  }, []);
  return announce;
}

// Q73: Focus management for dynamic content
function useFocusReturn() {
  const triggerRef = useRef<HTMLElement | null>(null);

  const saveFocus = useCallback(() => {
    triggerRef.current = document.activeElement as HTMLElement;
  }, []);

  const restoreFocus = useCallback(() => {
    triggerRef.current?.focus();
  }, []);

  return { saveFocus, restoreFocus };
}

// Q74: Accessible combobox/listbox
function Listbox({ options, value, onChange, label }: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div>
      <label id="listbox-label" className="block text-sm font-medium mb-1">{label}</label>
      <button
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-labelledby="listbox-label"
        aria-haspopup="listbox"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border rounded-lg text-left flex justify-between"
      >
        {options.find((o) => o.value === value)?.label ?? "Select..."}
        <span>▾</span>
      </button>
      {isOpen && (
        <ul role="listbox" aria-labelledby="listbox-label" className="border rounded-lg mt-1 max-h-60 overflow-auto">
          {options.map((option, i) => (
            <li key={option.value} role="option" aria-selected={value === option.value}
              className={`px-3 py-2 cursor-pointer ${i === activeIndex ? "bg-accent" : ""} ${value === option.value ? "font-medium" : ""}`}
              onClick={() => { onChange(option.value); setIsOpen(false); }}
              onMouseEnter={() => setActiveIndex(i)}>
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Q75: Keyboard navigation hook
function useArrowNavigation(itemCount: number, onSelect: (index: number) => void) {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); setActiveIndex((p) => Math.min(p + 1, itemCount - 1)); break;
      case "ArrowUp": e.preventDefault(); setActiveIndex((p) => Math.max(p - 1, 0)); break;
      case "Home": e.preventDefault(); setActiveIndex(0); break;
      case "End": e.preventDefault(); setActiveIndex(itemCount - 1); break;
      case "Enter": case " ": e.preventDefault(); onSelect(activeIndex); break;
    }
  }, [itemCount, activeIndex, onSelect]);

  return { activeIndex, handleKeyDown, setActiveIndex };
}
```

---

## Q76–Q80: Build testing patterns.

```tsx
// Q76: Testing custom hook with mock
function renderHookResult<T>(hookFn: () => T): { result: { current: T } } {
  const result = { current: undefined as T };

  function TestComponent() {
    result.current = hookFn();
    return null;
  }

  // Would use @testing-library/react in practice
  // render(<TestComponent />);
  return { result };
}

// Q77: Mock API handler pattern
function createMockHandlers() {
  return {
    "GET /api/restaurants": () => [
      { id: "1", name: "Test Restaurant", rating: 4.5 },
    ],
    "POST /api/orders": (body: any) => ({
      id: "order-1", ...body, status: "pending",
    }),
    "GET /api/orders/:id": (params: any) => ({
      id: params.id, status: "confirmed",
    }),
  };
}

// Q78: Component test pattern with React Query wrapper
function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    );
  };
}

// Q79: Snapshot-like comparison for component output
function shallowCompare(prevProps: Record<string, any>, nextProps: Record<string, any>): boolean {
  const prevKeys = Object.keys(prevProps);
  const nextKeys = Object.keys(nextProps);
  if (prevKeys.length !== nextKeys.length) return false;
  return prevKeys.every((key) => Object.is(prevProps[key], nextProps[key]));
}

// Q80: Test ID utility
function testId(id: string): { "data-testid": string } {
  return process.env.NODE_ENV === "production" ? {} as any : { "data-testid": id };
}

// Usage
function OrderButton() {
  return <button {...testId("place-order-btn")}>Place Order</button>;
}
```

---

## Q81–Q85: Build advanced form patterns.

```tsx
// Q81: Multi-step form with context
const FormContext = createContext<{
  data: Record<string, any>;
  setField: (key: string, value: any) => void;
  errors: Record<string, string>;
} | null>(null);

function FormProvider({ children, onSubmit }: { children: React.ReactNode; onSubmit: (data: any) => void }) {
  const [data, setData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setField = (key: string, value: any) => setData((prev) => ({ ...prev, [key]: value }));

  return (
    <FormContext.Provider value={{ data, setField, errors }}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(data); }}>{children}</form>
    </FormContext.Provider>
  );
}

// Q82: Controlled file input with multiple file support
function FileUploadList({ maxFiles = 5, onFilesChange }: {
  maxFiles?: number; onFilesChange: (files: File[]) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (newFiles: FileList) => {
    const combined = [...files, ...Array.from(newFiles)].slice(0, maxFiles);
    setFiles(combined);
    onFilesChange(combined);
  };

  const removeFile = (index: number) => {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    onFilesChange(next);
  };

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => inputRef.current?.click()}
        className="px-4 py-2 border rounded-lg" disabled={files.length >= maxFiles}>
        Add Files ({files.length}/{maxFiles})
      </button>
      <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
      {files.map((file, i) => (
        <div key={i} className="flex items-center gap-2 p-2 border rounded">
          <span className="text-sm flex-1 truncate">{file.name}</span>
          <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)}KB</span>
          <button onClick={() => removeFile(i)} className="text-destructive text-sm">✕</button>
        </div>
      ))}
    </div>
  );
}

// Q83: Auto-saving form with debounce
function useAutoSave<T>(data: T, saveFn: (data: T) => Promise<void>, delay = 1000) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setIsSaving(true);
      try {
        await saveFn(data);
        setLastSaved(new Date());
      } catch (err) {
        console.error("Auto-save failed:", err);
      } finally {
        setIsSaving(false);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [data, delay]);

  return { isSaving, lastSaved };
}

// Q84: OTP Input
function OTPInput({ length = 6, onComplete }: { length?: number; onComplete: (otp: string) => void }) {
  const [values, setValues] = useState<string[]>(new Array(length).fill(""));
  const refs = useRef<HTMLInputElement[]>([]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...values];
    next[index] = value.slice(-1);
    setValues(next);

    if (value && index < length - 1) refs.current[index + 1]?.focus();

    const otp = next.join("");
    if (otp.length === length) onComplete(otp);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !values[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    const next = [...values];
    pasted.split("").forEach((char, i) => { next[i] = char; });
    setValues(next);
    if (pasted.length === length) onComplete(pasted);
    refs.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  return (
    <div className="flex gap-2">
      {values.map((value, i) => (
        <input key={i}
          ref={(el) => { if (el) refs.current[i] = el; }}
          type="text" inputMode="numeric" maxLength={1}
          value={value}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className="w-12 h-14 text-center text-xl font-bold border rounded-lg bg-background focus:border-primary focus:ring-1 focus:ring-primary"
        />
      ))}
    </div>
  );
}

// Q85: Address autocomplete (Google Places-like)
function AddressInput({ onSelect }: { onSelect: (address: any) => void }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery.length < 3) { setSuggestions([]); return; }
    fetch(`/api/geocode?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then(setSuggestions);
  }, [debouncedQuery]);

  return (
    <div className="relative">
      <input value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder="Enter delivery address..."
        className="w-full px-3 py-2 border rounded-lg" />
      {suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-60 overflow-auto">
          {suggestions.map((s, i) => (
            <li key={i} className="px-4 py-2 hover:bg-accent cursor-pointer text-sm"
              onClick={() => { onSelect(s); setQuery(s.formattedAddress); setSuggestions([]); }}>
              📍 {s.formattedAddress}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

---

## Q86–Q90: Build real-time and data visualization components.

```tsx
// Q86: Live order count dashboard
function LiveOrderCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const ws = new WebSocket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "ORDER_COUNT") setCount(msg.data.count);
    };
    return () => ws.close();
  }, []);

  return (
    <div className="text-center">
      <p className="text-sm text-muted-foreground">Active Orders</p>
      <p className="text-4xl font-bold text-primary">
        <AnimatedNumber value={count} />
      </p>
    </div>
  );
}

// Q87: Simple Bar Chart (no library)
function BarChart({ data, height = 200 }: {
  data: Array<{ label: string; value: number; color?: string }>;
  height?: number;
}) {
  const maxValue = Math.max(...data.map((d) => d.value));

  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((item, i) => {
        const barHeight = (item.value / maxValue) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs font-medium">{item.value}</span>
            <div
              className="w-full rounded-t transition-all duration-500"
              style={{
                height: `${barHeight}%`,
                backgroundColor: item.color ?? "hsl(var(--primary))",
                minHeight: "4px",
              }}
            />
            <span className="text-xs text-muted-foreground truncate w-full text-center">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// Q88: Donut Chart
function DonutChart({ data, size = 120 }: {
  data: Array<{ label: string; value: number; color: string }>;
  size?: number;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.4;
  let cumulative = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {data.map((item, i) => {
        const percentage = item.value / total;
        const startAngle = cumulative * 2 * Math.PI - Math.PI / 2;
        cumulative += percentage;
        const endAngle = cumulative * 2 * Math.PI - Math.PI / 2;

        const x1 = cx + radius * Math.cos(startAngle);
        const y1 = cy + radius * Math.sin(startAngle);
        const x2 = cx + radius * Math.cos(endAngle);
        const y2 = cy + radius * Math.sin(endAngle);
        const largeArc = percentage > 0.5 ? 1 : 0;

        return (
          <path key={i}
            d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
            fill={item.color} className="hover:opacity-80 cursor-pointer">
            <title>{item.label}: {item.value} ({(percentage * 100).toFixed(1)}%)</title>
          </path>
        );
      })}
      <circle cx={cx} cy={cy} r={radius * 0.6} fill="hsl(var(--background))" />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
        className="text-lg font-bold fill-foreground">{total}</text>
    </svg>
  );
}

// Q89: Activity Heatmap
function ActivityHeatmap({ data, weeks = 12 }: {
  data: Record<string, number>; // "YYYY-MM-DD" -> count
  weeks?: number;
}) {
  const days = Array.from({ length: weeks * 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (weeks * 7 - 1 - i));
    return date.toISOString().split("T")[0];
  });

  const maxCount = Math.max(...Object.values(data), 1);

  const getColor = (count: number) => {
    if (!count) return "bg-muted";
    const intensity = count / maxCount;
    if (intensity > 0.75) return "bg-green-700";
    if (intensity > 0.5) return "bg-green-500";
    if (intensity > 0.25) return "bg-green-400";
    return "bg-green-200";
  };

  return (
    <div className="flex gap-[3px]">
      {Array.from({ length: weeks }, (_, w) => (
        <div key={w} className="flex flex-col gap-[3px]">
          {Array.from({ length: 7 }, (_, d) => {
            const dateStr = days[w * 7 + d];
            const count = data[dateStr] ?? 0;
            return (
              <div key={d} title={`${dateStr}: ${count} orders`}
                className={`w-3 h-3 rounded-sm ${getColor(count)}`} />
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Q90: Sparkline chart
function Sparkline({ data, width = 100, height = 30, color = "hsl(var(--primary))" }: {
  data: number[]; width?: number; height?: number; color?: string;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  );
}
```

---

## Q91–Q95: Build responsive/mobile patterns.

```tsx
// Q91: Bottom Sheet (mobile)
function BottomSheet({ isOpen, onClose, children, title }: {
  isOpen: boolean; onClose: () => void; children: React.ReactNode; title?: string;
}) {
  const [dragY, setDragY] = useState(0);
  const startY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => { startY.current = e.touches[0].clientY; };
  const handleTouchMove = (e: React.TouchEvent) => {
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setDragY(dy);
  };
  const handleTouchEnd = () => {
    if (dragY > 100) onClose();
    setDragY(0);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="absolute bottom-0 inset-x-0 bg-background rounded-t-2xl max-h-[80vh] overflow-auto transition-transform"
        style={{ transform: `translateY(${dragY}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex justify-center py-2">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>
        {title && <h3 className="text-lg font-semibold px-4 pb-2">{title}</h3>}
        <div className="px-4 pb-6">{children}</div>
      </div>
    </div>,
    document.body
  );
}

// Q92: Pull to Refresh
function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<void>; children: React.ReactNode }) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const threshold = 80;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) { startY.current = e.touches[0].clientY; setPulling(true); }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!pulling) return;
    const dy = Math.max(0, e.touches[0].clientY - startY.current);
    setPullDistance(Math.min(dy * 0.5, 120));
  };

  const handleTouchEnd = async () => {
    if (pullDistance > threshold) {
      setRefreshing(true);
      await onRefresh();
      setRefreshing(false);
    }
    setPulling(false);
    setPullDistance(0);
  };

  return (
    <div onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <div className="flex justify-center overflow-hidden transition-all"
        style={{ height: pullDistance || (refreshing ? 40 : 0) }}>
        {refreshing ? (
          <span className="animate-spin">⏳</span>
        ) : (
          <span style={{ opacity: pullDistance / threshold, transform: `rotate(${pullDistance * 3}deg)` }}>↓</span>
        )}
      </div>
      {children}
    </div>
  );
}

// Q93: Responsive breakpoint hook
function useBreakpoint() {
  const isSm = useMediaQuery("(min-width: 640px)");
  const isMd = useMediaQuery("(min-width: 768px)");
  const isLg = useMediaQuery("(min-width: 1024px)");
  const isXl = useMediaQuery("(min-width: 1280px)");

  if (isXl) return "xl";
  if (isLg) return "lg";
  if (isMd) return "md";
  if (isSm) return "sm";
  return "xs";
}

// Q94: Swipeable card (Tinder-like for restaurant discovery)
function SwipeableCard({ children, onSwipeLeft, onSwipeRight }: {
  children: React.ReactNode;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const startPos = useRef({ x: 0, y: 0 });

  const handleStart = (x: number, y: number) => {
    setIsDragging(true);
    startPos.current = { x, y };
  };

  const handleMove = (x: number, y: number) => {
    if (!isDragging) return;
    setOffset({ x: x - startPos.current.x, y: y - startPos.current.y });
  };

  const handleEnd = () => {
    setIsDragging(false);
    if (offset.x > 100) onSwipeRight();
    else if (offset.x < -100) onSwipeLeft();
    setOffset({ x: 0, y: 0 });
  };

  const rotation = offset.x * 0.1;

  return (
    <div
      className="touch-none select-none"
      onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
      onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
      onMouseUp={handleEnd}
      onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchEnd={handleEnd}
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg)`,
        transition: isDragging ? "none" : "transform 300ms",
      }}
    >
      {children}
      {Math.abs(offset.x) > 50 && (
        <div className={`absolute top-4 ${offset.x > 0 ? "left-4" : "right-4"} text-2xl font-bold
          ${offset.x > 0 ? "text-green-500" : "text-red-500"}`}>
          {offset.x > 0 ? "YES ✓" : "NOPE ✕"}
        </div>
      )}
    </div>
  );
}

// Q95: Responsive image with srcset
function ResponsiveImage({ src, alt, sizes }: {
  src: string; alt: string;
  sizes?: { sm: string; md: string; lg: string };
}) {
  const srcSet = sizes
    ? `${sizes.sm} 640w, ${sizes.md} 768w, ${sizes.lg} 1024w`
    : undefined;

  return (
    <picture>
      {sizes && (
        <>
          <source media="(min-width: 1024px)" srcSet={sizes.lg} />
          <source media="(min-width: 768px)" srcSet={sizes.md} />
          <source media="(min-width: 640px)" srcSet={sizes.sm} />
        </>
      )}
      <img src={src} alt={alt} loading="lazy" className="w-full h-full object-cover" />
    </picture>
  );
}
```

---

## Q96–Q100: Build complete page-level components.

```tsx
// Q96: Landing page hero section
function HeroSection() {
  return (
    <section className="relative min-h-[80vh] flex items-center">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-primary/70 z-10" />
      <div className="relative z-20 container mx-auto px-4 text-white">
        <FadeIn>
          <h1 className="text-5xl md:text-7xl font-bold mb-4">
            Delicious food,<br />delivered fast 🍕
          </h1>
        </FadeIn>
        <FadeIn delay={200}>
          <p className="text-xl mb-8 max-w-lg opacity-90">
            Order from 1000+ restaurants near you. Fresh meals at your doorstep in 30 minutes.
          </p>
        </FadeIn>
        <FadeIn delay={400}>
          <SearchBar />
        </FadeIn>
      </div>
    </section>
  );
}

// Q97: 404 Not Found page
function NotFoundPage() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <span className="text-8xl mb-4">🍔</span>
      <h1 className="text-4xl font-bold mb-2">404</h1>
      <p className="text-xl text-muted-foreground mb-8">
        This page went out for delivery and never came back
      </p>
      <button onClick={() => setLocation("/")} className="px-6 py-3 bg-primary text-white rounded-lg">
        Back to Home
      </button>
    </div>
  );
}

// Q98: Loading/Splash screen
function SplashScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-primary text-white">
      <div className="text-6xl mb-4 animate-bounce">🍕</div>
      <h1 className="text-3xl font-bold mb-2">FoodDash</h1>
      <div className="flex gap-1 mt-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-3 h-3 bg-white/80 rounded-full animate-pulse"
            style={{ animationDelay: `${i * 200}ms` }} />
        ))}
      </div>
    </div>
  );
}

// Q99: Complete Provider composition (entry point)
function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
            retry: (failureCount, error: any) => {
              if (error?.status === 404 || error?.status === 401) return false;
              return failureCount < 3;
            },
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 1,
          },
        },
      }),
    []
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Provider store={reduxStore}>
        <AuthProvider>
          <ThemeProvider>
            <ToastProvider>
              <ErrorBoundary>
                {children}
                <OfflineBanner />
                <CommandPalette />
              </ErrorBoundary>
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
      </Provider>
    </QueryClientProvider>
  );
}

// Q100: Complete App routing with code splitting
const Home = React.lazy(() => import("./pages/Home"));
const Restaurant = React.lazy(() => import("./pages/Restaurant"));
const Orders = React.lazy(() => import("./pages/Orders"));
const OrderTracking = React.lazy(() => import("./pages/OrderTracking"));
const Checkout = React.lazy(() => import("./pages/Checkout"));
const AdminDashboard = React.lazy(() => import("./pages/AdminDashboard"));
const RestaurantDashboard = React.lazy(() => import("./pages/RestaurantDashboard"));
const DeliveryDashboard = React.lazy(() => import("./pages/DeliveryDashboard"));
const SignIn = React.lazy(() => import("./pages/SignIn"));
const SignUp = React.lazy(() => import("./pages/SignUp"));
const NotFound = React.lazy(() => import("./pages/not-found"));

function App() {
  const { isLoading } = useAuth();

  if (isLoading) return <SplashScreen />;

  return (
    <React.Suspense fallback={<SplashScreen />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/sign-in" component={SignIn} />
        <Route path="/sign-up" component={SignUp} />
        <Route path="/restaurant/:id" component={Restaurant} />
        <Route path="/checkout">
          <ProtectedRoute><Checkout /></ProtectedRoute>
        </Route>
        <Route path="/orders">
          <ProtectedRoute><Orders /></ProtectedRoute>
        </Route>
        <Route path="/orders/:id/track">
          <ProtectedRoute><OrderTracking /></ProtectedRoute>
        </Route>
        <Route path="/admin">
          <ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>
        </Route>
        <Route path="/restaurant/dashboard">
          <ProtectedRoute requiredRole="restaurant_owner"><RestaurantDashboard /></ProtectedRoute>
        </Route>
        <Route path="/delivery">
          <ProtectedRoute requiredRole="delivery_partner"><DeliveryDashboard /></ProtectedRoute>
        </Route>
        <Route component={NotFound} />
      </Switch>
    </React.Suspense>
  );
}

export default function Root() {
  return (
    <Providers>
      <App />
    </Providers>
  );
}
```

---

## Summary

| Category | Questions | Key Topics |
|----------|-----------|------------|
| **Auth & Routing** | Q1–Q2 | AuthProvider, ProtectedRoute, RBAC, multi-strategy login |
| **Theming** | Q3 | ThemeProvider, CSS variables, system preference, toggle |
| **Data Display** | Q4, Q26–Q27 | Restaurant cards, skeleton loaders, virtualized list |
| **State (Redux)** | Q5 | Cart slice, selectors, typed hooks, Immer |
| **Search & Input** | Q6, Q19, Q31–Q32 | Debounced search, keyboard nav, autocomplete, multi-select, tags, date picker |
| **Real-time** | Q7, Q15, Q86 | WebSocket tracking, notification bell, live counters |
| **Data Fetching** | Q8, Q11 | Infinite scroll, optimistic updates, React Query |
| **Feedback** | Q9, Q29, Q33 | Toast system, error boundaries, progress bars |
| **Overlays** | Q10, Q22, Q28 | Modal/dialog, tooltip, command palette (⌘K) |
| **Forms** | Q12, Q74, Q81–Q85 | Zod validation, useReducer forms, OTP input, file upload, auto-save, address autocomplete |
| **Navigation** | Q13, Q21, Q30, Q34 | Tabs, carousel, sidebar, breadcrumbs |
| **Media** | Q14, Q41 | Image upload, lazy images with blur |
| **UI Components** | Q16–Q17, Q20, Q23–Q25, Q35, Q43–Q50 | Accordion, stars, countdown, drag-drop, stepper, copy, color picker, toggle, avatar, badge, empty state, divider, loading button, KBD |
| **Hooks** | Q36–Q40 | Undo/redo, click outside, key press, media query, online status |
| **Animation** | Q51–Q55 | FadeIn, stagger, collapse, animated presence, shimmer |
| **State Patterns** | Q56–Q60 | Context+reducer, Zustand-like, persist, produce, selectors |
| **Performance** | Q61–Q65 | React.memo, useDeferredValue, useTransition, code splitting, stable callbacks |
| **Composition** | Q66–Q70 | Compound components, render props, HOC, slots, polymorphic |
| **Accessibility** | Q71–Q75 | Skip links, announcer, focus management, listbox, arrow nav |
| **Testing** | Q76–Q80 | Hook testing, mock API, query wrapper, snapshot, test IDs |
| **Visualization** | Q87–Q90 | Bar chart, donut chart, heatmap, sparkline |
| **Mobile** | Q91–Q95 | Bottom sheet, pull-to-refresh, breakpoints, swipeable, responsive image |
| **Full Pages** | Q96–Q100 | Hero, 404, splash, provider composition, complete app routing |

---

**🎉 ALL 9 TOPICS COMPLETE — 550 Q&A Total**

| # | Topic | File | Questions |
|---|-------|------|-----------|
| 1 | React.js | `1000_INTERVIEW_QA.md` | 50 |
| 2 | Node.js | `NODEJS_INTERVIEW_QA.md` | 50 |
| 3 | JavaScript | `JAVASCRIPT_QA.md` | 50 |
| 4 | Redux | `REDUX_QA.md` | 50 |
| 5 | System Design | `SYSTEM_DESIGN_QA.md` | 50 |
| 6 | HLD | `HLD_QA.md` | 50 |
| 7 | LLD | `LLD_QA.md` | 50 |
| 8 | Machine Coding | `MACHINE_CODING_QA.md` | 100 |
| 9 | React Coding | `REACT_CODING_QA.md` | 100 |
