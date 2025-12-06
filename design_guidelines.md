# Design Guidelines: Food Delivery Platform

## Design Approach
**Reference-Based Approach** inspired by industry leaders: Swiggy, Zomato, Uber Eats, and DoorDash. These platforms balance visual appeal with functional efficiency, using food imagery to drive engagement while maintaining clear information hierarchy for ordering and tracking.

## Core Design Principles
1. **Visual Hierarchy Through Food**: Let restaurant and food images drive engagement
2. **Status-First Design**: Order states and tracking information always prominent
3. **Role-Adaptive Interfaces**: Each dashboard optimized for its user type
4. **Density Variation**: Sparse for browsing, dense for operational dashboards

## Typography System

**Font Families**
- Primary: Inter (UI elements, body text, data)
- Display: Outfit or Manrope (headings, restaurant names)

**Type Scale**
- Hero/Display: text-5xl to text-6xl, font-bold
- Section Headers: text-3xl, font-semibold
- Card Titles/Restaurant Names: text-xl, font-semibold
- Body/Descriptions: text-base, font-normal
- Metadata/Labels: text-sm, font-medium
- Micro-copy/Status: text-xs, font-medium uppercase tracking-wide

## Layout System

**Spacing Primitives**: Use Tailwind units of 3, 4, 6, 8, 12, 16
- Component padding: p-4, p-6
- Card spacing: gap-6, gap-8
- Section margins: mb-12, mb-16
- Dashboard panels: p-8

**Grid Structures**
- Restaurant Cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Menu Items: grid-cols-1 md:grid-cols-2
- Dashboard Metrics: grid-cols-2 md:grid-cols-4
- Order History: Single column list with expansible details

## Component Library

### Navigation
- **Customer App**: Bottom navigation (mobile) with Home, Search, Orders, Profile
- **Dashboards**: Sidebar navigation (desktop) with collapsible sections
- **Top Bar**: Logo, search, cart badge, profile dropdown

### Restaurant Discovery
- **Restaurant Cards**: Large image (aspect-ratio-16/9), restaurant name, cuisine tags, rating badge (star + number), delivery time estimate, minimum order badge
- **Search Bar**: Prominent with autocomplete, filter chips below
- **Filters**: Slide-out panel with cuisine types, ratings, delivery time, price range

### Menu & Ordering
- **Menu Grid**: Item image (square, aspect-ratio-1), name, description (truncated), price, add-to-cart button
- **Category Tabs**: Sticky horizontal scroll with active indicator
- **Cart Summary**: Fixed bottom panel (mobile) or sidebar (desktop) with itemized list

### Order Tracking
- **Status Timeline**: Vertical stepper with animated current step, timestamps for completed steps
- **Live Map**: Full-width embedded map with rider marker and route polyline
- **Delivery Details**: Card with rider photo, name, rating, contact button
- **ETA Banner**: Prominent countdown timer with pulsing indicator

### Dashboards
- **Metrics Cards**: 2x2 or 4-column grid with icon, number (text-3xl), label, trend indicator
- **Order Tables**: Striped rows, status badges (pill-shaped), action buttons (icon + label)
- **Restaurant Owner**: Order queue with accept/reject actions, menu management table
- **Delivery Partner**: Available orders list (card-based), earnings summary, active delivery card
- **Admin**: System health indicators, charts (line/bar for analytics), user management table

### Forms & Inputs
- Consistent input styling: border rounded-lg, p-3, focus:ring-2
- Labels: text-sm font-medium mb-2
- Error states: text-red-600 text-xs mt-1
- Submit buttons: Full-width on mobile, auto-width on desktop

### Status Badges
- Pill-shaped (rounded-full px-3 py-1 text-xs font-semibold)
- Semantic states: Pending, Confirmed, Preparing, Out for Delivery, Delivered, Cancelled

### Modals & Overlays
- Semi-transparent backdrop (bg-black/50)
- Modal: max-w-md to max-w-2xl depending on content, rounded-2xl
- Bottom sheets for mobile actions

## Responsive Behavior

**Mobile-First Breakpoints**
- Base (mobile): Single column, bottom nav, full-width cards
- md (tablet): 2-column grids, introduction of sidebars
- lg (desktop): 3-4 column grids, persistent sidebars, expanded data tables

**Dashboard Adaptations**
- Mobile: Hamburger menu, stacked metrics, simplified tables
- Desktop: Persistent sidebar, multi-column layouts, expanded views

## Images

### Required Images
1. **Restaurant Images**: High-quality food photography for each restaurant card (16:9 ratio)
2. **Menu Item Photos**: Square product shots for each dish (1:1 ratio)
3. **Restaurant Owner Avatars**: Circular profile photos
4. **Delivery Partner Photos**: Circular profile photos with verification badge
5. **Empty States**: Illustrations for empty cart, no orders, no results

### Hero Sections
- **Customer Home**: Large hero banner (80vh) with food photography collage, search bar overlay with blurred background backdrop for buttons/search
- **Restaurant Owner Dashboard**: No hero, immediately show order queue
- **Delivery Partner Dashboard**: No hero, show active delivery or available orders
- **Admin Dashboard**: No hero, metrics grid takes priority

## Accessibility Standards
- All interactive elements: min-height 44px (touch targets)
- Form inputs: Consistent focus indicators (ring-2)
- Status information: Color + icon + text (not color alone)
- Skip navigation links for dashboards
- ARIA labels for icon-only buttons

## Animation Strategy (Minimal)
- Status transitions: Smooth fade/slide (duration-300)
- Order tracking: Subtle pulse on active step
- Loading states: Skeleton screens (not spinners)
- Cart updates: Brief highlight animation
- **No**: Heavy scroll animations, parallax effects, elaborate transitions