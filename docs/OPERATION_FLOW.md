# FoodDash Operation Flow

## Scope
This document describes the implemented operational flow of the platform from user authentication to order completion, based on current code in:
- `server/customAuth.ts`
- `server/routes.ts`
- `server/storage.ts`
- `shared/schema.ts`
- `client/src/pages/*`

## System Components
- Client app: React + Wouter + TanStack Query + Redux (`client/src`)
- API layer: Express routes (`server/routes.ts`)
- Auth layer: Session + Passport + Google OAuth + Phone OTP + Keycloak SSO (`server/customAuth.ts`, `server/keycloak.ts`)
- Data layer: Drizzle ORM + PostgreSQL (`server/storage.ts`, `shared/schema.ts`)
- Realtime layer: WebSocket + event bus (`/ws`, `server/infrastructure/eventBus.ts`)
- Cross-cutting: rate limiting, correlation IDs, in-memory caching

## Data Model

### Core enums
- `user_role`: `customer | restaurant_owner | delivery_partner | admin`
- `order_status`: `pending | confirmed | preparing | ready_for_pickup | out_for_delivery | delivered | cancelled`
- `payment_status`: `pending | completed | failed | refunded`
- `delivery_partner_status`: `available | busy | offline`

### Primary entities

1. `users`
- PK: `id`
- Fields: profile, contact, geo location, `role`
- Used by all actor types (customer, owner, rider, admin)

2. `restaurants`
- PK: `id`
- FK: `ownerId -> users.id`
- Fields: identity, cuisine, address, rating, delivery config, active/opening status

3. `menu_categories`
- PK: `id`
- FK: `restaurantId -> restaurants.id`
- Fields: `name`, `sortOrder`, `isActive`

4. `menu_items`
- PK: `id`
- FK: `restaurantId -> restaurants.id`
- FK: `categoryId -> menu_categories.id` (nullable)
- Fields: price, dietary flags, prep time, availability, popularity

5. `delivery_partners`
- PK: `id`
- FK: `userId -> users.id`
- Fields: vehicle + license info, status, live coordinates, rating, earnings

6. `orders`
- PK: `id`
- FK: `customerId -> users.id`
- FK: `restaurantId -> restaurants.id`
- FK: `deliveryPartnerId -> delivery_partners.id` (nullable)
- FK: `couponId -> coupons.id` (nullable)
- Fields: status, monetary breakdown, delivery address/geo, payment, `idempotencyKey`

7. `order_items`
- PK: `id`
- FK: `orderId -> orders.id`
- FK: `menuItemId -> menu_items.id`
- Fields: quantity, price snapshot, special instructions

8. `coupons`
- PK: `id`
- Optional FK: `restaurantId -> restaurants.id`
- Fields: code, discount config, validity window, limits, usage counters

9. `notifications`
- PK: `id`
- FK: `userId -> users.id`
- Fields: title, message, type, read flag, metadata

10. `order_events`
- PK: `id`
- FK: `orderId -> orders.id`
- Fields: event type, metadata payload, optional location, timestamp

11. `reviews`
- PK: `id`
- FK: `orderId -> orders.id`
- FK: `customerId -> users.id`
- FK: `restaurantId -> restaurants.id`
- FK: `deliveryPartnerId -> delivery_partners.id` (nullable)

### Relationship summary
- One user can own many restaurants.
- One restaurant has many categories, menu items, and orders.
- One order has many order items and order events.
- One delivery partner can be assigned many orders over time.
- Coupons and reviews are linked to the order lifecycle.

## Operational Flow

### 1. Authentication and session establishment

1. User opens sign-in/sign-up page.
2. User chooses one of these implemented methods:
- Google OAuth: `/api/auth/google`
- SSO (Keycloak): `/api/auth/sso/login` then callback `/api/auth/keycloak/callback`
- Phone OTP: `/api/auth/phone/send-otp` -> `/api/auth/phone/verify-otp`
3. On successful auth:
- user profile is upserted in `users`
- session is established (`express-session`, stored in Postgres `sessions`)
- user is redirected to `/home`
4. Client bootstrap calls `/api/auth/me` via Redux thunk (`AuthInitializer`) to hydrate auth state.

### 2. Restaurant discovery and menu browsing

1. Home page queries:
- `/api/restaurants` for full list (cached server-side)
- `/api/restaurants/search?q=...` for filtered search
2. User opens a restaurant:
- `/api/restaurants/:id`
- `/api/restaurants/:restaurantId/categories`
- `/api/restaurants/:restaurantId/menu`
3. User adds items to cart (Redux cart state):
- Cart is constrained to a single restaurant at a time.

### 3. Checkout and order creation

1. Checkout loads cart state (items + restaurant context).
2. Optional coupon check:
- `POST /api/coupons/validate` with `{ code, subtotal }`
3. Place order:
- `POST /api/orders` with items, address, coupon code, `idempotencyKey`
4. Server-side order creation steps:
- validate restaurant + menu item ownership
- compute subtotal, delivery fee, discount, total
- create `orders` row (`status=pending`, `paymentStatus=pending`)
- create `order_items` rows
- increment coupon usage (if applied)
- append `order_events` with `order_created`
- create notification for restaurant owner
- publish `order.created` event

### 4. Restaurant order processing

1. Restaurant owner dashboard reads `/api/orders` (role-filtered on backend).
2. Owner transitions status:
- `pending -> confirmed`
- `confirmed -> preparing`
- `preparing -> ready_for_pickup`
- optional `pending -> cancelled`
3. Each status change (`PATCH /api/orders/:id/status`) triggers:
- `orders` update
- new `order_events` entry (`status_*`)
- customer notification
- `order.status_changed` event for realtime broadcast

### 5. Delivery assignment and fulfillment

1. For `ready_for_pickup` order:
- owner/admin calls `POST /api/orders/:id/assign-delivery`
2. Backend:
- picks first available partner
- assigns `deliveryPartnerId`
- marks partner `busy`
- sends partner notification
- publishes `rider.assigned`
3. Delivery partner flow:
- toggle availability via `PATCH /api/delivery-partner`
- push live location via `POST /api/delivery-partner/location`
- move order `ready_for_pickup -> out_for_delivery -> delivered`

### 6. Customer realtime tracking

1. Customer order screen opens WebSocket:
- `/ws?userId=<customerId>`
2. Backend publishes to connected user sessions on:
- `order.status_changed` -> `order_update`
- `rider.location_update` -> `location_update`
3. Client combines polling (`/api/orders/:id`) + WebSocket events for timeline updates.

### 7. Post-delivery review

1. Customer submits review:
- `POST /api/orders/:orderId/review`
2. Validation rules:
- must be order owner
- order status must be `delivered`
3. Backend:
- creates `reviews`
- recalculates and updates restaurant rating + rating count
- invalidates restaurant caches

## Role-Based Access Control

- `customer`
  - browse restaurants/menu, place order, view own orders, review delivered orders
- `restaurant_owner`
  - manage own restaurants/menu/categories, process orders, assign delivery
- `delivery_partner`
  - update partner status/location, update assigned order delivery status
- `admin`
  - full visibility and privileged actions on restaurants/orders

Role checks are enforced with `requireRole(...)` middleware in `server/customAuth.ts`.

## Supporting Technical Controls

- Rate limiting
  - global `/api`: 100 req/min
  - order routes: 10 req/min
- Caching
  - restaurants, restaurant details, menus (in-memory TTL cache)
- Idempotency
  - duplicate order protection via `orders.idempotencyKey`
- Auditability
  - order timeline persisted in `order_events`
- Correlation and observability
  - correlation ID middleware and API logging

## Current Implementation Notes (Important)

1. Route mismatch in order detail navigation:
- Client navigates to `/orders/:id` from checkout/orders list.
- Router defines detail route as `/order/:id`.
- Affects post-checkout and order-card navigation.

2. `Restaurant.tsx` references undefined functions:
- Uses `getItemCount()` and `getSubtotal()` instead of existing `itemCount` and `subtotal` selectors.

3. Delivery role check mismatch in `Home.tsx`:
- UI checks for `user.role === "delivery"` but backend enum uses `"delivery_partner"`.

4. Auth endpoint inconsistency:
- Redux auth flow uses `/api/auth/me`.
- `useAuth` hook uses `/api/auth/user`.
- Current pages primarily use Redux flow.

5. Legacy auth link on landing:
- CTA uses `/api/login` (from `replitAuth.ts` flow), but active startup wiring uses `setupCustomAuth`.

## Quick Sequence (Customer to Delivery)

1. Sign in -> session created -> `/home`
2. Browse restaurants -> open restaurant -> add items
3. Checkout -> apply coupon (optional) -> place order
4. Order created (`pending`) + owner notified
5. Owner accepts/prepares order
6. Delivery assigned -> rider picks up -> rider updates location
7. Customer tracks order live -> order marked delivered
8. Customer submits review
