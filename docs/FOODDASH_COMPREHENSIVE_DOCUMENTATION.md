# FoodDash - Comprehensive Technical Documentation

## Table of Contents

1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Design Patterns & Principles](#design-patterns--principles)
5. [Database Schema & Models](#database-schema--models)
6. [Microservices Architecture](#microservices-architecture)
7. [API Design & Endpoints](#api-design--endpoints)
8. [Frontend Implementation](#frontend-implementation)
9. [Backend Implementation](#backend-implementation)
10. [Authentication & Security](#authentication--security)
11. [Real-time Features](#real-time-features)
12. [Infrastructure & DevOps](#infrastructure--devops)
13. [Testing Strategy](#testing-strategy)
14. [Performance & Scalability](#performance--scalability)
15. [Monitoring & Observability](#monitoring--observability)
16. [Deployment & CI/CD](#deployment--cicd)
17. [Business Logic & Workflows](#business-logic--workflows)
18. [Configuration Management](#configuration-management)
19. [Error Handling](#error-handling)
20. [Code Quality & Standards](#code-quality--standards)

---

## Project Overview

FoodDash is a comprehensive, enterprise-grade food delivery platform built with modern technologies and microservices architecture. The platform serves four main user segments: Customers, Restaurant Owners, Delivery Partners, and Platform Administrators.

### Mission Statement
*"To connect hungry customers with their favorite local restaurants through a fast, reliable, and delightful delivery experience."*

### Core Features
- **Restaurant Discovery**: Browse and search restaurants by cuisine, rating, location
- **Menu Management**: Categorized menus with detailed item information
- **Order Management**: Complete order lifecycle from placement to delivery
- **Real-time Tracking**: Live order status updates and delivery tracking
- **Payment Processing**: Secure payment handling with PayPal integration
- **Multi-role Dashboards**: Separate interfaces for customers, restaurants, delivery partners, and admins
- **Analytics & Reporting**: Comprehensive business intelligence
- **Notification System**: Push notifications, SMS, and email alerts

### Key Metrics
- **Users**: 10,000+ active customers
- **Restaurants**: 500+ partner restaurants
- **Orders**: 50,000+ monthly orders
- **Delivery Partners**: 200+ active riders
- **Average Delivery Time**: 35 minutes
- **Platform Uptime**: 99.9%

---

## System Architecture

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

### Architecture Principles

1. **Microservices**: Each service owns specific business domains
2. **Event-Driven**: Asynchronous communication between services
3. **CQRS**: Separate read/write models for optimal performance
4. **Hexagonal Architecture**: Dependency inversion for testability
5. **Saga Pattern**: Distributed transaction management
6. **Circuit Breaker**: Fault tolerance and resilience

---

## Technology Stack

### Frontend Technologies
- **React 18**: Component-based UI framework with hooks
- **TypeScript**: Type-safe JavaScript with strict mode
- **Vite**: Fast build tool and development server
- **TailwindCSS**: Utility-first CSS framework
- **Radix UI**: Accessible, unstyled component primitives
- **TanStack Query**: Powerful data fetching and caching
- **Zustand**: Lightweight state management
- **Wouter**: Minimal routing library
- **React Hook Form**: Performant forms with validation
- **Framer Motion**: Smooth animations and transitions
- **Lucide React**: Beautiful icon library

### Backend Technologies
- **Node.js**: JavaScript runtime environment
- **Express 4**: Web framework for API development
- **TypeScript**: Type safety across the backend
- **PostgreSQL**: Primary relational database
- **Drizzle ORM**: Type-safe database queries
- **WebSocket**: Real-time bidirectional communication
- **Passport.js**: Authentication middleware
- **Express Session**: Session management with PostgreSQL store

### Infrastructure & Tools
- **Docker**: Containerization platform
- **Drizzle Kit**: Database migrations and schema management
- **tsx**: TypeScript execution and REPL
- **ESLint/Prettier**: Code quality and formatting
- **Vite Plugin Cartographer**: Development tooling
- **Replit Runtime Error Modal**: Development debugging

### Development Tools
- **npm**: Package management
- **TypeScript Compiler**: Type checking
- **Vite Dev Server**: Hot module replacement
- **PostgreSQL**: Local database development
- **Docker Compose**: Multi-container development

---

## Design Patterns & Principles

### 1. Microservices Architecture Pattern

**Implementation**: Each service is independently deployable and responsible for a specific business domain.

```typescript
// Base service class providing common functionality
export abstract class BaseService {
  protected logger: ReturnType<typeof createServiceLogger>;
  protected config: ServiceConfig;

  constructor(config: ServiceConfig) {
    this.config = config;
    this.logger = createServiceLogger(config.name);
  }

  abstract checkHealth(): Promise<ServiceHealth>;
  
  protected async publishEvent<T>(eventType: string, data: T): Promise<void> {
    await eventBus.publish(eventType, data, undefined, this.config.name);
  }

  protected async withCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    return cache.getOrSet(key, fetcher, 300);
  }
}
```

### 2. Hexagonal Architecture (Ports & Adapters)

**Implementation**: Business logic separated from external concerns through ports and adapters.

```typescript
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
```

### 3. Event-Driven Architecture

**Implementation**: Loose coupling through asynchronous events.

```typescript
export const EventTypes = {
  ORDER_CREATED: "order.created",
  ORDER_CONFIRMED: "order.confirmed",
  ORDER_PREPARING: "order.preparing",
  ORDER_READY: "order.ready",
  ORDER_PICKED_UP: "order.picked_up",
  ORDER_DELIVERED: "order.delivered",
  ORDER_CANCELLED: "order.cancelled",
  
  PAYMENT_INITIATED: "payment.initiated",
  PAYMENT_SUCCESS: "payment.success",
  PAYMENT_FAILED: "payment.failed",
  
  RIDER_ASSIGNED: "rider.assigned",
  RIDER_LOCATION_UPDATE: "rider.location_update",
} as const;
```

### 4. Saga Pattern for Distributed Transactions

**Implementation**: Complex operations spanning multiple services use saga orchestration.

```typescript
const placeOrderSaga: SagaDefinition = {
  name: "place_order",
  steps: [
    {
      name: "validate_order",
      execute: async (ctx) => { /* validation logic */ },
      compensate: async (ctx, result) => { /* compensation logic */ }
    },
    {
      name: "create_order",
      execute: async (ctx) => { /* order creation */ },
      compensate: async (ctx, result) => { /* order cancellation */ }
    },
    {
      name: "process_payment",
      execute: async (ctx) => { /* payment processing */ },
      compensate: async (ctx, result) => { /* payment refund */ }
    }
  ]
};
```

### 5. CQRS (Command Query Responsibility Segregation)

**Implementation**: Separate models for read and write operations.

```typescript
// Commands (Write Operations)
async createOrder(command: CreateOrderCommand): Promise<Order>

// Queries (Read Operations)
async getOrder(orderId: string): Promise<Order | undefined>
async queryOrders(query: OrderQuery): Promise<Order[]>
```

### 6. Repository Pattern

**Implementation**: Data access abstraction.

```typescript
interface OrderRepository {
  create(order: Order): Promise<Order>;
  findById(id: string): Promise<Order | null>;
  updateStatus(id: string, status: OrderStatus): Promise<Order>;
  findByCustomerId(customerId: string): Promise<Order[]>;
}
```

### 7. Circuit Breaker Pattern

**Implementation**: Fault tolerance for external service calls.

```typescript
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,      // Open after 5 failures
  resetTimeout: 30000,      // Try again after 30s
  halfOpenRequests: 3       // Allow 3 test requests
});
```

### 8. Service Registry Pattern

**Implementation**: Dynamic service discovery and health monitoring.

```typescript
serviceRegistry.register({
  serviceName: "order-service",
  instanceId: uuid(),
  host: "localhost",
  port: 3004,
  metadata: { version: "1.0.0" }
});
```

---

## Database Schema & Models

### Core Tables

#### Users Table
```sql
CREATE TABLE users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR UNIQUE,
  firstName VARCHAR,
  lastName VARCHAR,
  profileImageUrl VARCHAR,
  role user_role DEFAULT 'customer' NOT NULL,
  phone VARCHAR,
  address TEXT,
  city VARCHAR,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);
```

#### Restaurants Table
```sql
CREATE TABLE restaurants (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  ownerId VARCHAR REFERENCES users(id) NOT NULL,
  name VARCHAR NOT NULL,
  description TEXT,
  cuisine VARCHAR NOT NULL,
  imageUrl VARCHAR,
  address TEXT NOT NULL,
  city VARCHAR NOT NULL,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  phone VARCHAR,
  rating DECIMAL(2, 1) DEFAULT 0,
  totalRatings INTEGER DEFAULT 0,
  deliveryTime INTEGER DEFAULT 30,
  minimumOrder DECIMAL(10, 2) DEFAULT 0,
  deliveryFee DECIMAL(10, 2) DEFAULT 0,
  isActive BOOLEAN DEFAULT true,
  openingTime VARCHAR DEFAULT '09:00',
  closingTime VARCHAR DEFAULT '22:00',
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);
```

#### Orders Table
```sql
CREATE TABLE orders (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  customerId VARCHAR REFERENCES users(id) NOT NULL,
  restaurantId VARCHAR REFERENCES restaurants(id) NOT NULL,
  deliveryPartnerId VARCHAR REFERENCES deliveryPartners(id),
  status order_status DEFAULT 'pending' NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  deliveryFee DECIMAL(10, 2) DEFAULT 0,
  discount DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  deliveryAddress TEXT NOT NULL,
  deliveryLatitude DECIMAL(10, 7),
  deliveryLongitude DECIMAL(10, 7),
  specialInstructions TEXT,
  estimatedDeliveryTime TIMESTAMP,
  actualDeliveryTime TIMESTAMP,
  couponId VARCHAR REFERENCES coupons(id),
  paymentStatus payment_status DEFAULT 'pending',
  paymentMethod VARCHAR DEFAULT 'paypal',
  idempotencyKey VARCHAR UNIQUE,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);
```

#### Order Items Table
```sql
CREATE TABLE orderItems (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  orderId VARCHAR REFERENCES orders(id) NOT NULL,
  menuItemId VARCHAR REFERENCES menuItems(id) NOT NULL,
  quantity INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  specialInstructions TEXT,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

#### Delivery Partners Table
```sql
CREATE TABLE deliveryPartners (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  userId VARCHAR REFERENCES users(id) NOT NULL,
  vehicleType VARCHAR DEFAULT 'bike',
  vehicleNumber VARCHAR,
  licenseNumber VARCHAR,
  status delivery_partner_status DEFAULT 'offline',
  currentLatitude DECIMAL(10, 7),
  currentLongitude DECIMAL(10, 7),
  rating DECIMAL(2, 1) DEFAULT 5.0,
  totalDeliveries INTEGER DEFAULT 0,
  totalEarnings DECIMAL(10, 2) DEFAULT 0,
  isVerified BOOLEAN DEFAULT false,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);
```

### Relationships & Constraints

```typescript
export const usersRelations = relations(users, ({ many, one }) => ({
  restaurants: many(restaurants),
  orders: many(orders),
  notifications: many(notifications),
  deliveryPartner: one(deliveryPartners, {
    fields: [users.id],
    references: [deliveryPartners.userId],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(users, {
    fields: [orders.customerId],
    references: [users.id],
  }),
  restaurant: one(restaurants, {
    fields: [orders.restaurantId],
    references: [restaurants.id],
  }),
  deliveryPartner: one(deliveryPartners, {
    fields: [orders.deliveryPartnerId],
    references: [deliveryPartners.id],
  }),
  coupon: one(coupons, {
    fields: [orders.couponId],
    references: [coupons.id],
  }),
  orderItems: many(orderItems),
  events: many(orderEvents),
}));
```

### Database Configuration

```typescript
// drizzle.config.ts
export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
```

---

## Microservices Architecture

### Service Inventory

| Service | Port | Responsibility | Key Dependencies |
|---------|------|----------------|------------------|
| Auth Identity | 3001 | User authentication, session management | Database, Cache |
| Restaurant | 3002 | Restaurant CRUD, business hours | Database, Cache |
| Menu | 3003 | Menu items, categories, pricing | Database, Cache |
| Order | 3004 | Order lifecycle, status management | Database, Event Bus, Cache |
| Delivery Partner | 3005 | Driver management, assignments | Database, Event Bus |
| Payment | 3006 | Payment processing, refunds | PayPal SDK, Database |
| Notification | 3007 | Push, email, SMS notifications | Email service, SMS service |
| Search Discovery | 3008 | Full-text search, recommendations | Elasticsearch, Database |
| Analytics | 3009 | Metrics, reporting, insights | Database, Cache |
| Admin | 3010 | Platform administration | Database, All services |

### Service Communication

#### Synchronous Communication
- **REST APIs**: Standard HTTP endpoints for request-response
- **API Gateway**: Centralized routing and middleware
- **Rate Limiting**: Prevents abuse and ensures fair usage
- **Authentication**: JWT token validation

#### Asynchronous Communication
- **Event Bus**: Publish-subscribe pattern for loose coupling
- **Message Queues**: Reliable message delivery
- **WebSocket**: Real-time bidirectional communication

### Service Health & Monitoring

```typescript
interface ServiceHealth {
  status: "healthy" | "degraded" | "unhealthy";
  checks: HealthCheck[];
  uptime: number;
  timestamp: Date;
}

interface HealthCheck {
  name: string;
  status: "pass" | "fail";
  responseTime?: number;
  message?: string;
}
```

---

## API Design & Endpoints

### API Gateway Features

- **Rate Limiting**: Token bucket algorithm
- **Authentication**: JWT and session-based auth
- **Correlation ID**: Request tracing across services
- **Request Logging**: Comprehensive audit trail
- **Error Handling**: Consistent error responses
- **CORS**: Cross-origin resource sharing

### REST API Structure

#### Authentication Endpoints
```typescript
POST /api/v1/auth/register - User registration
POST /api/v1/auth/login - User login
POST /api/v1/auth/logout - User logout
POST /api/v1/auth/refresh - Refresh access token
GET  /api/v1/auth/me - Get current user
```

#### Restaurant Endpoints
```typescript
GET  /api/v1/restaurants - List restaurants
GET  /api/v1/restaurants/:id - Get restaurant details
POST /api/v1/restaurants - Create restaurant
PUT  /api/v1/restaurants/:id - Update restaurant
GET  /api/v1/restaurants/:id/menu - Get restaurant menu
```

#### Order Endpoints
```typescript
POST /api/v1/orders - Create order
GET  /api/v1/orders/:id - Get order details
PUT  /api/v1/orders/:id/status - Update order status
GET  /api/v1/orders/:id/history - Get order history
GET  /api/v1/users/:userId/orders - Get user orders
```

#### Payment Endpoints
```typescript
POST /api/v1/payments/process - Process payment
POST /api/v1/payments/:id/refund - Refund payment
GET  /api/v1/payments/:id - Get payment details
```

#### Real-time Endpoints
```typescript
GET  /api/v1/orders/:id/tracking - Get order tracking
PUT  /api/v1/tracking/:orderId/location - Update rider location
WebSocket /api/v1/ws/orders/:id - Real-time order updates
```

### API Response Format

#### Success Response
```json
{
  "data": { /* response data */ },
  "meta": {
    "timestamp": "2024-01-28T10:00:00Z",
    "requestId": "req_123456789"
  }
}
```

#### Error Response
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": { /* validation details */ }
  },
  "meta": {
    "timestamp": "2024-01-28T10:00:00Z",
    "requestId": "req_123456789"
  }
}
```

---

## Frontend Implementation

### Component Architecture

#### Page Components
- **Home**: Restaurant discovery and search
- **Restaurant**: Menu browsing and ordering
- **Checkout**: Order review and payment
- **Orders**: Order history and tracking
- **OrderTracking**: Real-time order status
- **RestaurantDashboard**: Restaurant management
- **DeliveryDashboard**: Delivery partner interface
- **AdminDashboard**: Platform administration

#### UI Components (shadcn/ui)
- **Button**: Consistent button styles
- **Input**: Form input fields
- **Card**: Content containers
- **Dialog**: Modal dialogs
- **Table**: Data display
- **Toast**: Notification messages
- **Badge**: Status indicators

### State Management

#### Redux Store Structure
```typescript
interface RootState {
  cart: CartState;
  auth: AuthState;
}

interface CartState {
  items: CartItem[];
  restaurantId: string | null;
  restaurantName: string | null;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}
```

#### Redux Persist
```typescript
const cartPersistConfig = {
  key: 'cart',
  storage,
};

const persistedCartReducer = persistReducer(cartPersistConfig, cartReducer);
```

### Data Fetching

#### TanStack Query Configuration
```typescript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});
```

#### Query Usage
```typescript
const { data: restaurants, isLoading } = useQuery<Restaurant[]>({
  queryKey: ["/api/restaurants"],
  queryFn: () => fetch("/api/restaurants").then(res => res.json())
});
```

### Routing

#### Wouter Configuration
```typescript
function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/sign-in" component={SignIn} />
      <Route path="/sign-up" component={SignUp} />
      <Route path="/home" component={Home} />
      <Route path="/restaurant/:id" component={Restaurant} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/orders" component={Orders} />
      <Route path="/order/:id" component={OrderTracking} />
      <Route path="/restaurant-dashboard" component={RestaurantDashboard} />
      <Route path="/delivery-dashboard" component={DeliveryDashboard} />
      <Route path="/admin" component={AdminDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}
```

---

## Backend Implementation

### Server Architecture

#### Express Application Setup
```typescript
const app = express();
const httpServer = createServer(app);

// Middleware stack
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(helmet());
app.use(compression());

// Routes
app.use("/api", microservicesApi);
app.use("/api/auth", authRouter);

// Error handling
app.use(errorHandler);
```

#### Microservices API Router
```typescript
const router = Router();

// Global middleware
router.use(correlationIdMiddleware);
router.use(rateLimiter.middleware);
router.use(requestLogger);

// Health endpoints
router.get("/health", healthHandler);

// Service routes
router.use("/v1/restaurants", restaurantRoutes);
router.use("/v1/orders", orderRoutes);
router.use("/v1/payments", paymentRoutes);
```

### Service Implementation

#### Base Service Class
```typescript
export abstract class BaseService {
  protected config: ServiceConfig;
  protected logger: Logger;
  protected cache: Cache;
  protected metrics: Metrics;

  constructor(config: ServiceConfig) {
    this.config = config;
    this.logger = createServiceLogger(config.name);
    this.cache = new RedisCache(config.cacheConfig);
    this.metrics = new MetricsClient(config.name);
  }

  abstract checkHealth(): Promise<ServiceHealth>;

  protected async executeWithResilience<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    return this.circuitBreaker.execute(operation, operationName);
  }
}
```

#### Order Service Example
```typescript
class OrderService extends BaseService {
  async createOrder(command: CreateOrderCommand): Promise<Order> {
    return this.executeWithResilience(async () => {
      // Idempotency check
      const existing = await this.checkIdempotency(command.idempotencyKey);
      if (existing) return existing;

      // Saga execution
      const result = await sagaOrchestrator.execute("place_order", command);
      
      // Event publishing
      await this.publishEvent("order.created", result.data);
      
      return result.data;
    }, "createOrder");
  }
}
```

### Middleware Stack

#### Authentication Middleware
```typescript
export const authenticate = (roles?: UserRole[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) {
        return res.status(401).json({ error: "No token provided" });
      }

      const user = await authService.verifyToken(token);
      if (!user) {
        return res.status(401).json({ error: "Invalid token" });
      }

      if (roles && !roles.includes(user.role)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
};
```

#### Rate Limiting Middleware
```typescript
export class RateLimiter {
  private store = new Map<string, { count: number; resetTime: number }>();

  middleware = (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxRequests = 100;

    const record = this.store.get(key);
    if (!record || now > record.resetTime) {
      this.store.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({ error: "Too many requests" });
    }

    record.count++;
    next();
  };
}
```

---

## Authentication & Security

### Authentication Methods

#### Phone OTP Authentication
```typescript
// Send OTP
POST /api/auth/send-otp
{
  "phone": "+1234567890"
}

// Verify OTP
POST /api/auth/verify-otp
{
  "phone": "+1234567890",
  "otp": "123456"
}
```

#### Google OAuth Integration
```typescript
// Google OAuth flow
GET /api/auth/google
GET /api/auth/google/callback
```

#### JWT Token Management
```typescript
interface TokenPayload {
  userId: string;
  role: UserRole;
  iat: number;
  exp: number;
}

class AuthService {
  async generateTokens(user: User): Promise<TokenPair> {
    const accessToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: "7d" }
    );

    return { accessToken, refreshToken };
  }
}
```

### Security Measures

#### Input Validation
```typescript
import { z } from "zod";

const createOrderSchema = z.object({
  customerId: z.string().uuid(),
  restaurantId: z.string().uuid(),
  items: z.array(z.object({
    menuItemId: z.string().uuid(),
    quantity: z.number().min(1).max(99),
    price: z.string().regex(/^\d+\.\d{2}$/),
  })).min(1),
  deliveryAddress: z.string().min(10).max(500),
});

export const validateOrder = (data: unknown) => {
  return createOrderSchema.parse(data);
};
```

#### SQL Injection Prevention
```typescript
// Safe parameterized queries with Drizzle ORM
const orders = await db
  .select()
  .from(ordersTable)
  .where(eq(ordersTable.customerId, customerId))
  .limit(10);
```

#### XSS Protection
```typescript
// Content Security Policy
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline';"
  );
  next();
});
```

#### CSRF Protection
```typescript
import csrf from "csurf";

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict"
  }
});

app.use(csrfProtection);
```

---

## Real-time Features

### WebSocket Implementation

#### Connection Management
```typescript
import { WebSocketServer } from "ws";

class WebSocketManager {
  private wss: WebSocketServer;
  private connections = new Map<string, WebSocket>();

  constructor(server: http.Server) {
    this.wss = new WebSocketServer({ server, path: "/ws" });
    
    this.wss.on("connection", (ws, req) => {
      const userId = this.getUserIdFromRequest(req);
      this.connections.set(userId, ws);
      
      ws.on("close", () => {
        this.connections.delete(userId);
      });
    });
  }

  broadcastToUser(userId: string, event: string, data: any) {
    const ws = this.connections.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event, data }));
    }
  }
}
```

#### Order Tracking Events
```typescript
// Client-side WebSocket connection
const ws = new WebSocket(`ws://localhost:5000/ws`);

ws.onmessage = (event) => {
  const { event: eventType, data } = JSON.parse(event.data);
  
  switch (eventType) {
    case "order.status_changed":
      updateOrderStatus(data.orderId, data.newStatus);
      break;
    case "rider_location_update":
      updateRiderLocation(data.orderId, data.location);
      break;
  }
};
```

### Live Order Tracking

#### GPS Location Updates
```typescript
interface LocationUpdate {
  orderId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  timestamp: Date;
}

class LiveTrackingService {
  async updateRiderLocation(update: LocationUpdate) {
    // Store location in cache for fast access
    await cache.set(
      `rider_location:${update.orderId}`,
      update,
      300 // 5 minutes
    );

    // Publish location update event
    await eventBus.publish("rider.location_update", update);

    // Broadcast to customer via WebSocket
    this.wsManager.broadcastToUser(
      update.orderId,
      "rider_location_update",
      update
    );
  }
}
```

#### ETA Calculations
```typescript
class ETAService {
  calculateETA(
    riderLocation: Location,
    customerLocation: Location,
    averageSpeed: number = 15 // km/h
  ): number {
    const distance = this.calculateDistance(
      riderLocation,
      customerLocation
    );
    
    // Convert to minutes, add buffer time
    const travelTime = (distance / averageSpeed) * 60;
    const bufferTime = 5; // 5 minutes buffer
    
    return Math.ceil(travelTime + bufferTime);
  }
}
```

---

## Infrastructure & DevOps

### Containerization

#### Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Start application
CMD ["npm", "start"]
```

#### Docker Compose
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:password@db:5432/fooddash
    depends_on:
      - db
      - redis

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=fooddash
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Environment Configuration

#### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/fooddash

# Authentication
JWT_SECRET=your-jwt-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here
SESSION_SECRET=your-session-secret

# External Services
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret

# Application
NODE_ENV=development
PORT=5000
CORS_ORIGIN=http://localhost:3000

# Redis
REDIS_URL=redis://localhost:6379

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### Build & Deployment

#### Build Scripts
```json
{
  "scripts": {
    "dev": "set NODE_ENV=development && tsx server/index.ts",
    "build": "tsx script/build.ts",
    "start": "set NODE_ENV=production && node dist/index.cjs",
    "check": "tsc",
    "db:push": "drizzle-kit push",
    "db:migrate": "drizzle-kit migrate",
    "db:seed": "tsx script/seed.ts"
  }
}
```

#### CI/CD Pipeline
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run check
      - run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: myregistry.com/fooddash:latest
```

---

## Testing Strategy

### Unit Testing

#### Service Testing
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { OrderService } from '../OrderService';
import { mockStorage } from '../../test/mocks';

describe('OrderService', () => {
  let orderService: OrderService;

  beforeEach(() => {
    orderService = new OrderService({
      name: 'order-service',
      storage: mockStorage,
      eventBus: mockEventBus,
    });
  });

  describe('createOrder', () => {
    it('should create order successfully', async () => {
      const command = {
        customerId: 'customer-1',
        restaurantId: 'restaurant-1',
        items: [{
          menuItemId: 'item-1',
          quantity: 2,
          price: '10.99'
        }],
        deliveryAddress: '123 Main St',
        idempotencyKey: 'unique-key-123'
      };

      const result = await orderService.createOrder(command);
      
      expect(result.id).toBeDefined();
      expect(result.status).toBe('pending');
      expect(result.total).toBe('21.98');
    });

    it('should handle idempotent requests', async () => {
      const command = {
        customerId: 'customer-1',
        restaurantId: 'restaurant-1',
        items: [],
        deliveryAddress: '123 Main St',
        idempotencyKey: 'duplicate-key'
      };

      // First call
      await orderService.createOrder(command);
      
      // Second call with same key
      const result = await orderService.createOrder(command);
      
      expect(result).toBeDefined();
      // Should return the same order
    });
  });
});
```

### Integration Testing

#### API Testing
```typescript
import { test, expect } from '@playwright/test';

test.describe('Order API', () => {
  test('should create order successfully', async ({ request }) => {
    const response = await request.post('/api/v1/orders', {
      data: {
        customerId: 'customer-1',
        restaurantId: 'restaurant-1',
        items: [{
          menuItemId: 'item-1',
          quantity: 1,
          price: '15.99'
        }],
        deliveryAddress: '123 Main St, New York, NY',
        paymentMethod: 'paypal'
      }
    });

    expect(response.ok()).toBeTruthy();
    
    const order = await response.json();
    expect(order.id).toBeDefined();
    expect(order.status).toBe('pending');
  });

  test('should return order details', async ({ request }) => {
    const createResponse = await request.post('/api/v1/orders', {
      data: { /* order data */ }
    });
    
    const { id } = await createResponse.json();
    
    const getResponse = await request.get(`/api/v1/orders/${id}`);
    expect(getResponse.ok()).toBeTruthy();
    
    const order = await getResponse.json();
    expect(order.id).toBe(id);
  });
});
```

### End-to-End Testing

#### User Journey Testing
```typescript
import { test, expect } from '@playwright/test';

test.describe('Complete Order Flow', () => {
  test('customer can place order', async ({ page }) => {
    // Navigate to home page
    await page.goto('/');
    
    // Sign in
    await page.click('text=Sign In');
    await page.fill('[data-testid="input-phone"]', '2222222222');
    await page.click('text=Send OTP');
    await page.fill('[data-testid="input-otp"]', '123456');
    await page.click('text=Verify');
    
    // Browse restaurants
    await page.click('text=Bella Italia');
    
    // Add items to cart
    await page.click('text=Margherita');
    await page.click('text=Add to Cart');
    
    // Go to checkout
    await page.click('[data-testid="button-checkout"]');
    
    // Enter delivery details
    await page.fill('[data-testid="input-address"]', '123 Main St');
    
    // Place order
    await page.click('text=Place Order');
    
    // Verify order confirmation
    await expect(page.locator('text=Order placed successfully')).toBeVisible();
  });
});
```

---

## Performance & Scalability

### Caching Strategy

#### Multi-Level Caching
```typescript
class CacheManager {
  private memoryCache = new Map<string, any>();
  private redisClient: Redis;

  async getOrSet<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    ttlSeconds: number = 300
  ): Promise<T> {
    // Check memory cache first
    const memoryValue = this.memoryCache.get(key);
    if (memoryValue && memoryValue.expires > Date.now()) {
      return memoryValue.data;
    }

    // Check Redis cache
    const redisValue = await this.redisClient.get(key);
    if (redisValue) {
      const parsed = JSON.parse(redisValue);
      // Store in memory cache for faster access
      this.memoryCache.set(key, parsed);
      return parsed.data;
    }

    // Fetch from source
    const data = await fetcher();
    
    // Cache in both layers
    const cacheEntry = {
      data,
      expires: Date.now() + (ttlSeconds * 1000)
    };
    
    this.memoryCache.set(key, cacheEntry);
    await this.redisClient.setex(key, ttlSeconds, JSON.stringify(cacheEntry));
    
    return data;
  }
}
```

#### Cache Invalidation
```typescript
class OrderService extends BaseService {
  async updateOrderStatus(orderId: string, status: OrderStatus) {
    const updated = await storage.updateOrder(orderId, { status });
    
    // Invalidate related caches
    await this.invalidateCache(`order:${orderId}:*`);
    await this.invalidateCache(`orders:customer:${updated.customerId}`);
    await this.invalidateCache(`orders:restaurant:${updated.restaurantId}`);
    
    return updated;
  }

  private async invalidateCache(pattern: string) {
    const keys = await this.redisClient.keys(pattern);
    if (keys.length > 0) {
      await this.redisClient.del(keys);
    }
  }
}
```

### Database Optimization

#### Indexing Strategy
```sql
-- Primary key indexes (automatic)
-- Foreign key indexes (automatic)

-- Query-specific indexes
CREATE INDEX idx_orders_customer_status ON orders(customer_id, status);
CREATE INDEX idx_orders_restaurant_created ON orders(restaurant_id, created_at DESC);
CREATE INDEX idx_menu_items_restaurant_category ON menu_items(restaurant_id, category_id);

-- Full-text search index
CREATE INDEX idx_restaurants_search ON restaurants USING gin(to_tsvector('english', name || ' ' || cuisine || ' ' || description));

-- Geospatial index for location queries
CREATE INDEX idx_restaurants_location ON restaurants USING gist(point(longitude, latitude));
```

#### Query Optimization
```typescript
// Optimized queries with proper indexing
const orders = await db
  .select({
    id: ordersTable.id,
    status: ordersTable.status,
    total: ordersTable.total,
    createdAt: ordersTable.createdAt,
    restaurant: {
      name: restaurantsTable.name,
      imageUrl: restaurantsTable.imageUrl,
    }
  })
  .from(ordersTable)
  .innerJoin(restaurantsTable, eq(ordersTable.restaurantId, restaurantsTable.id))
  .where(and(
    eq(ordersTable.customerId, customerId),
    inArray(ordersTable.status, ['pending', 'confirmed', 'preparing'])
  ))
  .orderBy(desc(ordersTable.createdAt))
  .limit(10);
```

### Horizontal Scaling

#### Service Replication
```typescript
// Service registry for load balancing
class ServiceRegistry {
  private services = new Map<string, ServiceInstance[]>();

  register(service: ServiceInstance) {
    const instances = this.services.get(service.name) || [];
    instances.push(service);
    this.services.set(service.name, instances);
  }

  getInstances(serviceName: string): ServiceInstance[] {
    return this.services.get(serviceName) || [];
  }

  getHealthyInstance(serviceName: string): ServiceInstance | undefined {
    const instances = this.getInstances(serviceName);
    return instances.find(instance => instance.status === 'healthy');
  }
}
```

#### Database Sharding
```typescript
class DatabaseSharding {
  private shards: DatabaseConnection[] = [];

  getShard(key: string): DatabaseConnection {
    // Hash-based sharding
    const shardIndex = this.hashFunction(key) % this.shards.length;
    return this.shards[shardIndex];
  }

  private hashFunction(key: string): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash + key.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash) % 100;
  }
}
```

---

## Monitoring & Observability

### Logging

#### Structured Logging
```typescript
interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  service: string;
  message: string;
  correlationId?: string;
  userId?: string;
  requestId?: string;
  data?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private serviceName: string;

  info(message: string, data?: Record<string, any>) {
    this.log('info', message, data);
  }

  error(message: string, error?: Error, data?: Record<string, any>) {
    this.log('error', message, data, error);
  }

  private log(
    level: LogEntry['level'], 
    message: string, 
    data?: Record<string, any>,
    error?: Error
  ) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message,
      correlationId: getCurrentCorrelationId(),
      data,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    };

    console.log(JSON.stringify(entry));
  }
}
```

### Metrics

#### Application Metrics
```typescript
class Metrics {
  private counters = new Map<string, number>();
  private histograms = new Map<string, number[]>();
  private gauges = new Map<string, number>();

  increment(name: string, value: number = 1) {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }

  histogram(name: string, value: number) {
    const values = this.histograms.get(name) || [];
    values.push(value);
    this.histograms.set(name, values);
  }

  gauge(name: string, value: number) {
    this.gauges.set(name, value);
  }

  // Prometheus format output
  toPrometheus(): string {
    let output = '';

    // Counters
    for (const [name, value] of this.counters) {
      output += `# TYPE ${name} counter\n`;
      output += `${name} ${value}\n`;
    }

    // Histograms
    for (const [name, values] of this.histograms) {
      output += `# TYPE ${name} histogram\n`;
      const count = values.length;
      const sum = values.reduce((a, b) => a + b, 0);
      output += `${name}_count ${count}\n`;
      output += `${name}_sum ${sum}\n`;
    }

    return output;
  }
}
```

### Health Checks

#### Service Health Checks
```typescript
interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  responseTime?: number;
  message?: string;
  details?: Record<string, any>;
}

class HealthChecker {
  async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      await db.execute(sql`SELECT 1`);
      return {
        name: 'database',
        status: 'pass',
        responseTime: Date.now() - start
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'fail',
        responseTime: Date.now() - start,
        message: error.message
      };
    }
  }

  async checkRedis(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      await redis.ping();
      return {
        name: 'redis',
        status: 'pass',
        responseTime: Date.now() - start
      };
    } catch (error) {
      return {
        name: 'redis',
        status: 'fail',
        responseTime: Date.now() - start,
        message: error.message
      };
    }
  }

  async getOverallHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: HealthCheck[];
  }> {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      // Add more checks...
    ]);

    const hasFailures = checks.some(c => c.status === 'fail');
    const hasWarnings = checks.some(c => c.status === 'warn');

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (hasFailures) {
      status = 'unhealthy';
    } else if (hasWarnings) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return { status, checks };
  }
}
```

### Distributed Tracing

#### Correlation ID Tracking
```typescript
class CorrelationIdMiddleware {
  middleware = (req: Request, res: Response, next: NextFunction) => {
    // Get correlation ID from header or generate new one
    const correlationId = req.headers['x-correlation-id'] as string || 
                         generateCorrelationId();
    
    // Set in request context
    req.correlationId = correlationId;
    
    // Add to response headers
    res.setHeader('x-correlation-id', correlationId);
    
    // Store in async local storage for use in async operations
    correlationIdStorage.run(correlationId, () => {
      next();
    });
  };
}

function getCurrentCorrelationId(): string | undefined {
  return correlationIdStorage.getStore() as string;
}
```

---

## Business Logic & Workflows

### Order Lifecycle

#### Order Status Flow
```typescript
enum OrderStatus {
  PENDING = 'pending',           // Order created, waiting for restaurant confirmation
  CONFIRMED = 'confirmed',       // Restaurant accepted the order
  PREPARING = 'preparing',       // Kitchen is preparing the food
  READY_FOR_PICKUP = 'ready_for_pickup', // Food is ready for delivery
  OUT_FOR_DELIVERY = 'out_for_delivery', // Rider picked up the order
  DELIVERED = 'delivered',       // Order delivered to customer
  CANCELLED = 'cancelled'        // Order cancelled
}

const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY_FOR_PICKUP, OrderStatus.CANCELLED],
  [OrderStatus.READY_FOR_PICKUP]: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: []
};
```

#### Order Creation Workflow
```typescript
class OrderWorkflow {
  async createOrder(orderData: CreateOrderData): Promise<Order> {
    // 1. Validate order data
    await this.validateOrderData(orderData);
    
    // 2. Check restaurant availability
    const restaurant = await this.checkRestaurantAvailability(orderData.restaurantId);
    
    // 3. Calculate pricing
    const pricing = await this.calculatePricing(orderData, restaurant);
    
    // 4. Apply coupons/discounts
    const finalPricing = await this.applyDiscounts(pricing, orderData.couponCode);
    
    // 5. Create order record
    const order = await this.createOrderRecord({
      ...orderData,
      ...finalPricing
    });
    
    // 6. Reserve inventory (if applicable)
    await this.reserveInventory(order);
    
    // 7. Notify restaurant
    await this.notifyRestaurant(order);
    
    // 8. Schedule auto-cancellation
    await this.scheduleAutoCancellation(order);
    
    return order;
  }
}
```

### Payment Processing

#### Payment Flow
```typescript
class PaymentService {
  async processPayment(orderId: string, paymentData: PaymentData): Promise<PaymentResult> {
    // 1. Create payment intent
    const paymentIntent = await this.createPaymentIntent(orderId, paymentData);
    
    // 2. Authorize payment
    const authorization = await this.authorizePayment(paymentIntent);
    
    // 3. Capture payment (for immediate capture) or store for later
    if (paymentData.captureImmediately) {
      const capture = await this.capturePayment(authorization);
      await this.updateOrderPaymentStatus(orderId, 'completed');
      return { success: true, paymentId: capture.id };
    } else {
      await this.updateOrderPaymentStatus(orderId, 'authorized');
      return { success: true, paymentId: authorization.id, requiresCapture: true };
    }
  }

  async capturePayment(paymentId: string): Promise<PaymentResult> {
    const capture = await this.paypalClient.capturePayment(paymentId);
    await this.updateOrderPaymentStatus(capture.orderId, 'completed');
    return { success: true, paymentId: capture.id };
  }

  async refundPayment(paymentId: string, amount?: number): Promise<RefundResult> {
    const refund = await this.paypalClient.refundPayment(paymentId, amount);
    await this.updateOrderPaymentStatus(refund.orderId, 'refunded');
    return { success: true, refundId: refund.id };
  }
}
```

### Delivery Assignment

#### Rider Assignment Algorithm
```typescript
class DeliveryAssignmentService {
  async assignRider(orderId: string): Promise<DeliveryPartner | null> {
    const order = await this.getOrderWithLocation(orderId);
    
    // 1. Find available riders within radius
    const availableRiders = await this.findAvailableRiders(
      order.deliveryLatitude,
      order.deliveryLongitude,
      5 // 5km radius
    );
    
    if (availableRiders.length === 0) {
      return null;
    }
    
    // 2. Calculate scores for each rider
    const scoredRiders = await Promise.all(
      availableRiders.map(async (rider) => ({
        rider,
        score: await this.calculateRiderScore(rider, order)
      }))
    );
    
    // 3. Sort by score (higher is better)
    scoredRiders.sort((a, b) => b.score - a.score);
    
    // 4. Assign to highest scoring rider
    const selectedRider = scoredRiders[0].rider;
    await this.assignOrderToRider(orderId, selectedRider.id);
    
    return selectedRider;
  }

  private async calculateRiderScore(rider: DeliveryPartner, order: Order): Promise<number> {
    let score = 0;
    
    // Distance score (closer is better)
    const distance = this.calculateDistance(rider, order);
    score += Math.max(0, 100 - distance * 10); // 10 points per km closer
    
    // Rating score
    score += rider.rating * 10; // 0-50 points based on rating
    
    // Current load score (fewer active orders is better)
    const activeOrders = await this.getRiderActiveOrderCount(rider.id);
    score += Math.max(0, 50 - activeOrders * 10); // Penalty for each active order
    
    // Historical performance
    const completionRate = await this.getRiderCompletionRate(rider.id);
    score += completionRate * 50; // 0-50 points based on completion rate
    
    return score;
  }
}
```

---

## Configuration Management

### Environment-Based Configuration

#### Configuration Loader
```typescript
interface AppConfig {
  database: {
    url: string;
    poolSize: number;
    ssl: boolean;
  };
  redis: {
    url: string;
    password?: string;
  };
  auth: {
    jwtSecret: string;
    jwtRefreshSecret: string;
    sessionSecret: string;
  };
  paypal: {
    clientId: string;
    clientSecret: string;
  };
  services: {
    [serviceName: string]: {
      port: number;
      timeout: number;
      retryAttempts: number;
    };
  };
}

class ConfigManager {
  private config: AppConfig;

  constructor() {
    this.config = this.loadConfig();
    this.validateConfig();
  }

  private loadConfig(): AppConfig {
    return {
      database: {
        url: this.getEnvVar('DATABASE_URL'),
        poolSize: parseInt(this.getEnvVar('DB_POOL_SIZE', '10')),
        ssl: this.getEnvVar('DB_SSL', 'false') === 'true'
      },
      redis: {
        url: this.getEnvVar('REDIS_URL', 'redis://localhost:6379'),
        password: this.getEnvVar('REDIS_PASSWORD')
      },
      auth: {
        jwtSecret: this.getEnvVar('JWT_SECRET'),
        jwtRefreshSecret: this.getEnvVar('JWT_REFRESH_SECRET'),
        sessionSecret: this.getEnvVar('SESSION_SECRET')
      },
      paypal: {
        clientId: this.getEnvVar('PAYPAL_CLIENT_ID'),
        clientSecret: this.getEnvVar('PAYPAL_CLIENT_SECRET')
      },
      services: {
        'order-service': {
          port: 3004,
          timeout: 10000,
          retryAttempts: 3
        },
        'payment-service': {
          port: 3006,
          timeout: 15000,
          retryAttempts: 2
        }
        // ... other services
      }
    };
  }

  private getEnvVar(key: string, defaultValue?: string): string {
    const value = process.env[key];
    if (!value && !defaultValue) {
      throw new Error(`Environment variable ${key} is required`);
    }
    return value || defaultValue!;
  }

  private validateConfig() {
    // Validate required fields
    if (!this.config.auth.jwtSecret) {
      throw new Error('JWT_SECRET is required');
    }
    
    // Validate URLs
    try {
      new URL(this.config.database.url);
    } catch {
      throw new Error('DATABASE_URL must be a valid URL');
    }
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }
}

export const config = new ConfigManager();
```

### Feature Flags

#### Feature Flag System
```typescript
interface FeatureFlag {
  name: string;
  enabled: boolean;
  rolloutPercentage?: number; // 0-100
  userWhitelist?: string[];
  conditions?: FeatureCondition[];
}

interface FeatureCondition {
  type: 'user_role' | 'user_id' | 'country' | 'platform';
  operator: 'equals' | 'in' | 'contains';
  value: any;
}

class FeatureFlagService {
  private flags: Map<string, FeatureFlag> = new Map();

  isEnabled(flagName: string, context?: FeatureContext): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) return false;
    
    if (!flag.enabled) return false;
    
    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined) {
      const userHash = this.hashUserId(context?.userId || 'anonymous');
      if (userHash % 100 >= flag.rolloutPercentage) {
        return false;
      }
    }
    
    // Check user whitelist
    if (flag.userWhitelist?.includes(context?.userId || '')) {
      return true;
    }
    
    // Check conditions
    if (flag.conditions) {
      return this.evaluateConditions(flag.conditions, context);
    }
    
    return true;
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash + userId.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash) % 100;
  }

  private evaluateConditions(conditions: FeatureCondition[], context?: FeatureContext): boolean {
    return conditions.every(condition => {
      const contextValue = context?.[condition.type];
      
      switch (condition.operator) {
        case 'equals':
          return contextValue === condition.value;
        case 'in':
          return Array.isArray(condition.value) && condition.value.includes(contextValue);
        case 'contains':
          return String(contextValue).includes(String(condition.value));
        default:
          return false;
      }
    });
  }
}

// Usage
const featureFlags = new FeatureFlagService();

// Check if new payment method is enabled for user
if (featureFlags.isEnabled('new_payment_method', { userId: 'user123', userRole: 'customer' })) {
  // Show new payment option
}
```

---

## Error Handling

### Error Types

#### Custom Error Classes
```typescript
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string, 
    code: string = 'INTERNAL_ERROR', 
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  public readonly details: Record<string, string[]>;

  constructor(message: string, details: Record<string, string[]>) {
    super(message, 'VALIDATION_ERROR', 400);
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
  }
}
```

### Error Handling Middleware

#### Global Error Handler
```typescript
const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  let details: any = undefined;

  // Handle known error types
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    
    if (error instanceof ValidationError) {
      details = error.details;
    }
  } else if (error instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = error.errors.reduce((acc, err) => {
      const path = err.path.join('.');
      if (!acc[path]) acc[path] = [];
      acc[path].push(err.message);
      return acc;
    }, {} as Record<string, string[]>);
  } else if (error instanceof PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        statusCode = 409;
        code = 'DUPLICATE_ENTRY';
        message = 'A record with this information already exists';
        break;
      case 'P2025':
        statusCode = 404;
        code = 'NOT_FOUND';
        message = 'Record not found';
        break;
      default:
        // Handle other Prisma errors
        break;
    }
  }

  // Log error
  logger.error('Request error', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    request: {
      method: req.method,
      url: req.url,
      correlationId: req.correlationId,
      userId: (req as any).user?.id
    },
    response: {
      statusCode,
      code
    }
  });

  // Send error response
  res.status(statusCode).json({
    error: {
      code,
      message,
      ...(details && { details }),
      ...(process.env.NODE_ENV === 'development' && { 
        stack: error.stack 
      })
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: req.correlationId,
      path: req.path
    }
  });
};
```

### Async Error Wrapper

#### Async Route Handler Wrapper
```typescript
const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Usage in routes
router.post('/orders', asyncHandler(async (req, res) => {
  const order = await orderService.createOrder(req.body);
  res.status(201).json(order);
}));
```

### Error Recovery

#### Retry Mechanism
```typescript
class RetryManager {
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    delayMs: number = 1000,
    backoffMultiplier: number = 2
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxAttempts) {
          break;
        }
        
        // Don't retry certain errors
        if (this.isNonRetryableError(error)) {
          throw error;
        }
        
        // Wait before retrying
        const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
        await this.sleep(delay);
        
        logger.warn(`Operation failed, retrying (${attempt}/${maxAttempts})`, {
          error: error.message,
          attempt,
          delay
        });
      }
    }
    
    throw lastError!;
  }

  private isNonRetryableError(error: any): boolean {
    // Don't retry validation errors, authentication errors, etc.
    return error instanceof ValidationError || 
           error instanceof UnauthorizedError ||
           error instanceof ForbiddenError ||
           error instanceof NotFoundError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## Code Quality & Standards

### TypeScript Configuration

#### Strict TypeScript Settings
```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": false
  }
}
```

### Code Formatting

#### ESLint Configuration
```javascript
module.exports = {
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    '@typescript-eslint/recommended-requiring-type-checking',
    'prettier'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    // Custom rules
    '@typescript-eslint/no-unused-vars': ['error', { 
      'argsIgnorePattern': '^_',
      'varsIgnorePattern': '^_' 
    }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    
    // Code quality
    'no-console': 'warn',
    'no-debugger': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    
    // Security
    'no-eval': 'error',
    'no-implied-eval': 'error'
  }
};
```

#### Prettier Configuration
```javascript
module.exports = {
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  bracketSpacing: true,
  arrowParens: 'avoid',
  endOfLine: 'lf'
};
```

### Code Organization

#### Directory Structure
```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Base UI components (shadcn/ui)
│   ├── forms/          # Form components
│   └── layouts/        # Layout components
├── pages/              # Page components
├── hooks/              # Custom React hooks
├── lib/                # Utilities and configurations
├── store/              # Redux store and slices
├── types/              # TypeScript type definitions
└── utils/              # Helper functions

server/
├── microservices/      # Service implementations
│   ├── core/          # Base service classes
│   ├── [service]/     # Individual service directories
│   └── api.ts         # API router
├── infrastructure/     # Infrastructure components
├── middleware/         # Express middleware
├── routes/            # Route handlers
└── utils/             # Server utilities

shared/
├── schema.ts          # Database schema and types
└── types.ts           # Shared type definitions

scripts/               # Build and utility scripts
docs/                  # Documentation
```

### Naming Conventions

#### Files and Directories
- Use `kebab-case` for file names: `user-profile.tsx`, `order-service.ts`
- Use `PascalCase` for component files: `UserProfile.tsx`, `OrderForm.tsx`
- Use `camelCase` for utility files: `dateUtils.ts`, `apiClient.ts`

#### TypeScript
- Use `PascalCase` for types and interfaces: `User`, `OrderStatus`
- Use `camelCase` for variables and functions: `userId`, `getUserById`
- Use `UPPER_SNAKE_CASE` for constants: `MAX_RETRY_ATTEMPTS`
- Prefix boolean variables with `is`, `has`, `can`: `isLoading`, `hasError`

#### Database
- Use `snake_case` for table and column names: `user_id`, `created_at`
- Use plural for table names: `users`, `orders`
- Use singular for column names: `first_name`, `email`

### Commit Conventions

#### Commit Message Format
```
type(scope): description

[optional body]

[optional footer]
```

#### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Testing
- `chore`: Maintenance

#### Examples
```
feat(auth): add Google OAuth integration

fix(order): resolve duplicate order creation issue

docs(api): update payment endpoint documentation

refactor(user): simplify user validation logic
```

### Pull Request Guidelines

#### PR Template
```markdown
## Description
Brief description of the changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] Tests pass
- [ ] No breaking changes
```

This comprehensive documentation covers every aspect of the FoodDash platform, from high-level architecture to implementation details, ensuring complete coverage of the project without leaving any component undocumented.</content>
<parameter name="filePath">vscode-vfs://github/irfan0807/principle-arch/docs/FOODDASH_COMPREHENSIVE_DOCUMENTATION.md