# FoodDash - Food Delivery Platform

## Overview

FoodDash is a comprehensive, enterprise-grade food delivery platform built with modern technologies and microservices architecture. It provides a complete solution for customers, restaurant owners, delivery partners, and administrators.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Documentation](#documentation)

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Docker (optional, for database)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd Principal-Architect

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start PostgreSQL (using Docker)
docker run --name food-delivery-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=food_delivery -p 5432:5432 -d postgres:15

# Push database schema
npm run db:push

# Seed the database with sample data
npx tsx script/seed.ts

# (Optional) Set up SSO with Keycloak
# See SSO_SETUP.md for detailed instructions
docker-compose -f docker-compose.keycloak.yml up -d

# Start development server
npm run dev
```

The application will be available at `http://localhost:5000`

## Features

### Core Features
- 🔐 **Multi-Authentication**: Google OAuth, Phone OTP, and SSO (Keycloak)
- 🔍 Browse and search restaurants by cuisine, rating, location
- 🍽️ View restaurant menus with categories
- 🛒 Add items to cart with quantity management
- 💳 Secure checkout with coupon support
- 📦 Real-time order tracking
- ⭐ Rate and review restaurants

### For Restaurant Owners
- 📊 Dashboard with order management
- 📝 Menu management (categories, items, prices)
- ✅ Accept/reject incoming orders
- 📈 Analytics and revenue tracking

### For Delivery Partners
- 🚴 Real-time order assignments
- 📍 GPS-based location tracking
- 💰 Earnings dashboard
- 🔄 Online/offline status toggle

### For Administrators
- 👥 User management
- 🏪 Restaurant approvals
- 📊 Platform-wide analytics
- 🔧 System configuration

## Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **Radix UI** - Accessible components
- **TanStack Query** - Data fetching
- **Zustand** - State management
- **Wouter** - Routing

### Backend
- **Node.js** - Runtime
- **Express 4** - Web framework
- **TypeScript** - Type safety
- **PostgreSQL** - Database
- **Drizzle ORM** - Database queries
- **WebSocket** - Real-time updates

### Architecture
- **Microservices** - 10+ independent services
- **Event-Driven** - Async communication
- **Saga Pattern** - Distributed transactions
- **Circuit Breaker** - Fault tolerance
- **API Gateway** - Rate limiting, auth

## Project Structure

```
Principal-Architect/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Utilities and helpers
├── server/                 # Express backend
│   ├── microservices/      # Service implementations
│   ├── infrastructure/     # Shared infrastructure
│   └── gateway/            # API gateway components
├── shared/                 # Shared code (schema, types)
├── script/                 # Build and seed scripts
└── docs/                   # Documentation
```

## Documentation

- [Technical Architecture](./TECHNICAL_ARCHITECTURE.md) - Detailed technical documentation
- [Product Documentation](./PRODUCT_DOCUMENTATION.md) - Product management resources

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/food_delivery

# Authentication
SESSION_SECRET=your-session-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Application
NODE_ENV=development
PORT=5000
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run db:push` | Push schema to database |
| `npm run check` | TypeScript type checking |

## License

MIT License - See LICENSE file for details
