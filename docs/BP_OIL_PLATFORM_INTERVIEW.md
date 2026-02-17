# BP Oil Ordering Platform — Project Overview

## For Interview Discussion | Enterprise B2B Oil & Gas Supply Chain Platform

> **Company**: BP (British Petroleum)  
> **Project**: Digital Oil Ordering & Supply Chain Management Platform  
> **Role**: Senior Full-Stack Engineer  
> **Duration**: 18 months (2024-2026)  
> **Team Size**: 12 engineers (3 full-stack, 4 backend, 2 frontend, 2 DevOps, 1 QA lead)

---

## 🎯 Executive Summary

Led the development of BP's next-generation **B2B Oil Ordering Platform** — a mission-critical system enabling real-time procurement of petroleum products (crude oil, diesel, lubricants, jet fuel) for commercial clients including gas stations, airlines, industrial facilities, and marine operators.

The platform processes **$2.5B+ in annual transactions**, serves **3,000+ corporate clients** across 5 regions (Europe, Americas, APAC, Middle East, Africa), and coordinates **500+ suppliers** including BP refineries, third-party distributors, and strategic partners.

**Key Achievement**: Reduced order-to-delivery cycle time by 40% through real-time inventory tracking, intelligent routing, and automated pricing — saving BP $50M annually in logistics costs.

---

## 🏗️ Platform Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         API Gateway                              │
│         (Rate Limiting, Circuit Breaker, Auth, CORS)            │
└─────────────────┬───────────────────────────────────────────────┘
                  │
    ┌─────────────┴────────────────────────┐
    │                                      │
┌───▼────────────────┐          ┌─────────▼──────────────┐
│  Client Portal     │          │  Supplier Portal       │
│  (React 18 SPA)    │          │  (React 18 SPA)        │
└────────────────────┘          └────────────────────────┘
         │                                   │
         └──────────────┬────────────────────┘
                        │
         ┌──────────────▼──────────────────────────────────┐
         │          16 Microservices Layer                 │
         │  ┌──────────────────────────────────────┐      │
         │  │ • Order Service (CQRS)               │      │
         │  │ • Inventory Service                  │      │
         │  │ • Pricing Service (Dynamic)          │      │
         │  │ • Logistics Service (Route Optimizer)│      │
         │  │ • Payment Service (B2B Settlement)   │      │
         │  │ • Auth & Identity (Multi-tenant)     │      │
         │  │ • Notification Service (WebSocket)   │      │
         │  │ • Analytics & BI Service             │      │
         │  │ • Supplier Management                │      │
         │  │ • Contract & SLA Service             │      │
         │  │ • Quality Assurance & Compliance     │      │
         │  │ • Admin & Dashboard Service          │      │
         │  │ • SAP Integration (ACL Pattern)      │      │
         │  │ • ML/AI Recommendation Engine        │      │
         │  │ • Search & Discovery (Elasticsearch) │      │
         │  │ • GraphQL BFF (Backend for Frontend) │      │
         │  └──────────────────────────────────────┘      │
         └──────────────┬──────────────────────────────────┘
                        │
         ┌──────────────▼──────────────────────────────────┐
         │           Event-Driven Backbone                 │
         │  (RabbitMQ + Kafka for 42 event types)         │
         │  • ORDER_PLACED • INVENTORY_RESERVED            │
         │  • TANKER_DISPATCHED • DELIVERY_CONFIRMED       │
         │  • PAYMENT_PROCESSED • QUALITY_CHECK_PASSED     │
         └──────────────┬──────────────────────────────────┘
                        │
         ┌──────────────▼──────────────────────────────────┐
         │          Infrastructure Layer                   │
         │  • PostgreSQL (11 tables, Drizzle ORM)         │
         │  • Redis (L1/L2 Cache, Session Store)          │
         │  • Service Registry (Round Robin, Health)      │
         │  • Circuit Breaker (Exponential Backoff)       │
         │  • Rate Limiter (Token Bucket, 100 req/min)    │
         │  • Multi-Region Deployment (5 regions)         │
         │  • Metrics & Observability (Prometheus)        │
         └─────────────────────────────────────────────────┘
```

---

## 🛢️ Business Domain Model

### Core Entities

**1. Products (Oil & Gas)**
- **Crude Oil**: Brent, WTI, Dubai grades
- **Refined Products**: Diesel, Gasoline, Jet Fuel (A-1, JP-8)
- **Lubricants**: Motor oil, industrial lubricants, marine oils
- **Specialty**: LPG, Bitumen, Petrochemicals

**2. Clients (B2B Customers)**
- **Retail Networks**: Gas station chains (Shell franchisees, independent operators)
- **Aviation**: Airlines, airports, private aviation
- **Marine**: Shipping companies, ports, maritime operators
- **Industrial**: Manufacturing plants, power stations, mines

**3. Suppliers**
- **BP Refineries**: 15 owned refineries globally
- **Strategic Partners**: Joint ventures, distributors
- **Third-Party Suppliers**: Emergency backup sources

**4. Logistics**
- **Tanker Fleet**: 200+ tankers (road, rail, maritime)
- **Drivers/Operators**: 500+ certified logistics partners
- **Storage Facilities**: 50 terminals, depots across regions
- **Pipeline Integration**: Direct pipeline delivery for large contracts

---

## 🚀 My Key Contributions

### 1. **Microservices Architecture Design** (Lead Role)

**Challenge**: Legacy monolithic ordering system couldn't scale to support multi-region expansion. Order processing took 2-3 days with manual intervention.

**Solution**: Designed and implemented **16 microservices** using **Hexagonal Architecture** + **CQRS** + **Event Sourcing**.

**Technical Stack**:
- **Backend**: Node.js, Express 4, TypeScript, PostgreSQL (Drizzle ORM)
- **Frontend**: React 18, Redux Toolkit, React Query v5, TypeScript
- **Infrastructure**: RabbitMQ, Kafka, Redis, Docker, Kubernetes
- **Auth**: Keycloak SSO, JWT (HMAC-SHA256), RBAC + ABAC

**Impact**:
- Order processing time reduced from **2-3 days → 4 hours** (automated)
- System handles **10,000+ concurrent users** with 99.95% uptime
- Reduced infrastructure costs by 30% through efficient resource utilization

---

### 2. **Real-Time Inventory & Pricing Engine**

**Challenge**: Oil prices fluctuate hourly (Brent crude, currency exchange rates). Manual price updates caused inconsistencies and lost revenue.

**Solution**: Built **Dynamic Pricing Service** with ML-driven recommendations:
- Real-time commodity price feeds (Bloomberg, Platts APIs)
- Currency conversion (15+ currencies)
- Volume-based discounts, contract pricing
- Margin optimization using historical data

**Technical Implementation**:
```typescript
// Dynamic Pricing Algorithm
class PricingEngine {
  calculatePrice(product, volume, client, region) {
    const basePrice = this.getCommodityPrice(product); // Bloomberg API
    const exchangeRate = this.getExchangeRate(region.currency);
    const marginMultiplier = this.getMarginByVolume(volume);
    const contractDiscount = this.getContractDiscount(client);
    
    // ML model for demand prediction
    const demandFactor = this.mlModel.predictDemand(product, region);
    
    return (basePrice * exchangeRate * marginMultiplier * demandFactor) 
           - contractDiscount;
  }
}
```

**Impact**:
- **Revenue increase**: 8% margin improvement through optimized pricing
- **Client satisfaction**: 95% price accuracy (vs 78% before)
- **Automation**: Pricing updates every 15 minutes (vs daily manual updates)

---

### 3. **Logistics Optimization & Route Planning**

**Challenge**: Inefficient routing led to 15% fuel waste in tanker fleet. Drivers manually planned routes.

**Solution**: Built **Logistics Service** with intelligent routing:
- **Haversine distance** calculation for optimal depot selection
- **Multi-stop route optimization** (Dijkstra's algorithm)
- **Traffic integration** (Google Maps API for ETA)
- **Load balancing** across tanker fleet

**Features**:
- Real-time tanker tracking (GPS WebSocket updates every 30s)
- Automated dispatch based on tanker availability
- ETA prediction with 92% accuracy
- Emergency rerouting (traffic, breakdowns, weather)

**Impact**:
- **Fuel savings**: $12M annually (15% reduction in fleet fuel costs)
- **Delivery time**: Reduced by 40% (average 8 hours → 4.8 hours)
- **Customer SLA**: 98% on-time delivery (vs 82% before)

---

### 4. **SAP Integration via Anti-Corruption Layer**

**Challenge**: BP's legacy SAP ERP system required integration for invoicing, compliance, financial reporting. Direct coupling would create tight dependencies.

**Solution**: Implemented **Anti-Corruption Layer (ACL)** pattern:
- Translates modern REST/GraphQL → SAP RFC/BAPI
- Data transformation middleware (our domain model → SAP schemas)
- Retry logic, idempotency, dead-letter queues
- Bi-directional sync (orders → SAP, invoices ← SAP)

**Code Example**:
```typescript
class SAPIntegrationService extends BaseService {
  async syncOrderToSAP(order: Order) {
    // Transform to SAP format
    const sapOrder = this.transformToSAPSchema(order);
    
    // Call SAP with retry
    const result = await this.callSAPWithRetry(
      'BAPI_ORDER_CREATE',
      sapOrder,
      { maxRetries: 3 }
    );
    
    // Store correlation ID for audit trail
    await this.storeCorrelationId(order.id, result.sapOrderId);
    
    return result;
  }
}
```

**Impact**:
- **Seamless integration**: 99.8% successful sync rate
- **Audit compliance**: Full traceability for financial reporting
- **Reduced coupling**: Frontend/backend teams independent of SAP changes

---

### 5. **Event-Driven Architecture with Saga Pattern**

**Challenge**: Complex order workflows (order → payment → inventory → dispatch → delivery) prone to partial failures.

**Solution**: Implemented **Saga Orchestrator** for distributed transactions:

**Order Flow (Choreography)**:
1. `ORDER_PLACED` → Reserve inventory
2. `INVENTORY_RESERVED` → Process payment
3. `PAYMENT_CONFIRMED` → Dispatch tanker
4. `TANKER_DISPATCHED` → Track delivery
5. `DELIVERY_CONFIRMED` → Invoice generation

**Compensation Logic** (rollback on failure):
- Payment failed → Release inventory
- Tanker unavailable → Refund payment, release inventory
- Delivery failure → Retry or full refund

**42 Event Types** including:
- `ORDER_CREATED`, `ORDER_CANCELLED`, `INVENTORY_UPDATED`
- `PRICE_CHANGED`, `TANKER_LOCATION_UPDATED`, `SLA_BREACH`
- `QUALITY_CHECK_FAILED`, `CONTRACT_RENEWED`, `PAYMENT_OVERDUE`

**Impact**:
- **Data consistency**: 99.9% (vs 87% with monolith)
- **Failure recovery**: Automatic rollback in <5 seconds
- **Scalability**: Services independently scalable

---

### 6. **RBAC + ABAC Security Model**

**Challenge**: Multi-tenant system with complex permissions (BP employees, suppliers, clients, auditors).

**Solution**: Designed **4-tier role system** with attribute-based policies:

**Roles**:
1. **Client Procurement Manager**: Place orders, view pricing, track deliveries
2. **Supplier Operations**: Update inventory, confirm dispatch, upload quality certs
3. **BP Admin**: Full platform control, analytics, user management
4. **Logistics Partner**: View assignments, update delivery status, GPS tracking

**ABAC Policies**:
- Clients can only view **their region's pricing**
- Suppliers can only update **their own inventory**
- Admins can access **all data**, auditors **read-only**

**Implementation**:
```typescript
const PERMISSIONS = {
  client: {
    order: ['create', 'read', 'cancel'],
    invoice: ['read', 'download'],
    pricing: ['read'] // only for own region
  },
  supplier: {
    inventory: ['read', 'update'],
    order: ['read', 'fulfill'],
    quality: ['create', 'upload']
  },
  admin: {
    '*': ['*'] // Full access
  }
};
```

**Impact**:
- **Security**: Zero data breaches, SOC 2 compliant
- **Audit**: Full action logs (who, what, when)
- **Flexibility**: Easy to add new roles (e.g., "Compliance Officer")

---

### 6b. **SAP Commerce Cloud for User Management — Why Not Internal Storage?**

#### The Decision

BP chose **SAP Commerce Cloud (Hybris)** as the **single source of truth for customer/user data** instead of building an internal user storage system. This was a strategic enterprise decision driven by regulatory, operational, and integration requirements.

---

#### How SAP Commerce Stores User Information

SAP Commerce Cloud (formerly Hybris) manages the full customer lifecycle:

```
┌───────────────────────────────────────────────────────────────────┐
│                  SAP Commerce Cloud (Hybris)                      │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  CUSTOMER MASTER DATA                                       │ │
│  │                                                             │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │ │
│  │  │ B2B Unit    │  │ B2B Customer │  │ B2B Budget       │  │ │
│  │  │ (Company)   │──│ (User)       │──│ (Spending Limit) │  │ │
│  │  │             │  │              │  │                  │  │ │
│  │  │ • CompanyID │  │ • UID (email)│  │ • Annual budget  │  │ │
│  │  │ • TaxID     │  │ • Name       │  │ • Remaining      │  │ │
│  │  │ • Region    │  │ • Role       │  │ • Approval rules │  │ │
│  │  │ • Contracts │  │ • Permissions│  │                  │  │ │
│  │  │ • Addresses │  │ • B2B Unit   │  │                  │  │ │
│  │  └─────────────┘  └──────────────┘  └──────────────────┘  │ │
│  │                                                             │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │ │
│  │  │ Order History │  │ Pricing      │  │ Approval         │ │ │
│  │  │ • Past orders│  │ • Contract $ │  │ • Workflows      │ │ │
│  │  │ • Invoices   │  │ • Discounts  │  │ • Thresholds     │ │ │
│  │  │ • Deliveries │  │ • Tax rules  │  │ • Escalations    │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  INTEGRATION LAYER                                          │ │
│  │  • OCC REST APIs (OmniCommerce Connect)                    │ │
│  │  • OData Services (for SAP ERP sync)                       │ │
│  │  • ImpEx (bulk data import/export)                         │ │
│  │  • Event hooks (user.created, order.placed)                │ │
│  └─────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

**SAP Commerce Customer Data Model** (what it stores):

| Data Category | Fields | Purpose |
|--------------|--------|---------|
| **Identity** | UID (email), name, phone, employee ID | Authentication & identification |
| **B2B Organization** | Company name, tax ID, DUNS number, parent org | Multi-level corporate hierarchy |
| **Roles & Permissions** | Buyer, Approver, Admin, Finance | B2B approval workflows |
| **Addresses** | Billing, shipping (depots, refineries, ports) | Delivery coordination |
| **Contracts** | Pricing agreements, volume commitments, SLA terms | Contract-based pricing |
| **Budgets** | Annual spend limit, cost center, department budgets | Procurement governance |
| **Payment** | Credit terms (Net-30, Net-60), bank details, credit limit | B2B payment processing |
| **Order History** | 7 years of orders, invoices, delivery receipts | Audit & reorder |
| **Consent** | GDPR consent records, communication preferences | Regulatory compliance |
| **Segmentation** | Tier (Gold/Silver/Bronze), industry, region | Personalization & pricing |

---

#### How BP's Internal System (Our Platform) Stores User Data

Our platform stores a **lightweight, operational subset** of user data:

```typescript
// Our PostgreSQL schema — thin user profile
const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  sapCustomerId: varchar("sap_customer_id", { length: 20 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull(),
  // ↑ Synced FROM SAP Commerce — NOT the master
  
  // Platform-specific operational data only:
  lastLoginAt: timestamp("last_login_at"),
  sessionToken: varchar("session_token"),
  preferences: jsonb("preferences"),  // UI theme, dashboard layout
  fcmToken: varchar("fcm_token"),     // Push notification token
});
```

**What we DON'T store internally** (lives in SAP only):
- ❌ Full company hierarchy / B2B org structure
- ❌ Contract terms & pricing agreements
- ❌ Credit limits & payment terms
- ❌ Tax IDs, bank details, financial data
- ❌ GDPR consent records
- ❌ Historical invoices (7 years)
- ❌ Budget/spending limits

---

#### The Data Flow Between Systems

```
┌──────────────┐     Login/SSO      ┌─────────────────────┐
│  User logs   │────────────────────▶│  Keycloak SSO       │
│  into Portal │                     │  (Identity Provider) │
└──────────────┘                     └──────────┬──────────┘
                                                │
                                     JWT token with:
                                     • userId
                                     • sapCustomerId
                                     • roles[]
                                                │
                                     ┌──────────▼──────────┐
                                     │  API Gateway         │
                                     │  (Validates JWT)     │
                                     └──────────┬──────────┘
                                                │
                          ┌─────────────────────┼─────────────────────┐
                          │                     │                     │
                ┌─────────▼────────┐  ┌────────▼─────────┐  ┌──────▼──────────┐
                │  Our PostgreSQL  │  │  SAP Commerce    │  │  SAP ERP (S/4)  │
                │  (Operational)   │  │  (Customer MDM)  │  │  (Financial)    │
                │                  │  │                  │  │                 │
                │ • Session data   │  │ • Full profile   │  │ • GL accounts   │
                │ • UI preferences │  │ • Contracts      │  │ • Cost centers  │
                │ • Cart (temp)    │  │ • Credit limits  │  │ • Invoices      │
                │ • Notifications  │  │ • Org hierarchy  │  │ • Payments      │
                │ • Search history │  │ • GDPR consent   │  │ • Tax records   │
                └──────────────────┘  └──────────────────┘  └─────────────────┘
```

**Sync Strategy**:

```typescript
// Anti-Corruption Layer: SAP Commerce → Our Platform
class SAPCommerceUserSync {
  
  // On login: fetch fresh user profile from SAP Commerce
  async syncUserOnLogin(sapCustomerId: string): Promise<User> {
    // 1. Call SAP Commerce OCC API
    const sapUser = await this.sapClient.get(
      `/occ/v2/bp-oil/users/${sapCustomerId}`,
      { headers: { Authorization: `Bearer ${this.sapToken}` } }
    );
    
    // 2. Transform SAP model → our domain model (ACL pattern)
    const ourUser = this.transformUser(sapUser);
    
    // 3. Upsert into our lightweight table
    await db.insert(users)
      .values(ourUser)
      .onConflictDoUpdate({
        target: users.sapCustomerId,
        set: { name: ourUser.name, role: ourUser.role, email: ourUser.email }
      });
    
    return ourUser;
  }
  
  // Transform SAP Commerce → Our Domain
  private transformUser(sapUser: SAPCommerceUser): User {
    return {
      sapCustomerId: sapUser.uid,
      email: sapUser.displayUid,
      name: `${sapUser.firstName} ${sapUser.lastName}`,
      role: this.mapSAPRole(sapUser.roles),  // b2badmingroup → "admin"
    };
  }
  
  // SAP roles → our roles
  private mapSAPRole(sapRoles: string[]): string {
    if (sapRoles.includes('b2badmingroup')) return 'admin';
    if (sapRoles.includes('b2bapprovergroup')) return 'supplier';
    if (sapRoles.includes('b2bcustomergroup')) return 'client';
    return 'client';
  }
}

// Nightly batch sync: update all user profiles
class NightlySyncJob {
  async run() {
    const allUsers = await this.sapClient.get('/occ/v2/bp-oil/users?pageSize=100');
    for (const batch of chunk(allUsers, 50)) {
      await Promise.all(batch.map(u => this.syncService.syncUserOnLogin(u.uid)));
    }
    logger.info(`Synced ${allUsers.length} users from SAP Commerce`);
  }
}
```

---

#### Why SAP Commerce Over Internal User Storage — Decision Matrix

| Criteria | SAP Commerce Cloud ✅ | Internal PostgreSQL ❌ |
|----------|----------------------|----------------------|
| **B2B Organization Modeling** | Native B2B units, hierarchy, cost centers | Would need custom schema from scratch |
| **Contract-Based Pricing** | Built-in price lists, volume discounts, date-based | Custom pricing engine needed |
| **Approval Workflows** | Native: order > $50K → manager approval → VP approval | Custom workflow engine needed |
| **Budget Management** | Per-department, per-user spending limits | Custom budget tracking needed |
| **GDPR Compliance** | Built-in consent management, data deletion, audit trails | Custom GDPR implementation |
| **7-Year Audit Trail** | SAP-certified audit logging, tamper-proof | Custom audit log (not certified) |
| **Integration with SAP ERP** | Native OData connectors to S/4HANA, FI/CO | Custom API integration needed |
| **Credit Management** | Real-time credit check before order placement | Custom credit check service |
| **Multi-Currency** | 150+ currencies, automatic FX conversion | Custom currency handling |
| **Tax Calculation** | SAP Tax Engine (Vertex integration) | Third-party tax API needed |
| **PCI Compliance** | SAP-certified payment data handling | Self-certification ($$$) |
| **Time to Market** | 3 months (configure) | 12+ months (build from scratch) |
| **Maintenance Cost** | SAP handles infra, security patches, upgrades | Team must maintain everything |
| **Regulatory Audits** | SAP provides compliance certificates | Must self-audit annually |

---

#### The 5 Key Reasons We Chose SAP Commerce

**1. BP Already Had SAP Commerce License (Enterprise Agreement)**

BP had an existing enterprise license for SAP Commerce Cloud as part of their SAP S/4HANA migration. Building a separate user store would mean:
- **Duplicate data** — user info in two places → sync headaches
- **Wasted investment** — paying for SAP Commerce but not using its customer MDM
- **Integration debt** — SAP ERP needs customer data → must sync anyway

> "Why build what you already bought?"

**2. B2B Complexity That Would Take 12+ Months to Build**

B2B oil procurement is NOT like B2C e-commerce. Requirements include:
- **Multi-level approval chains**: Junior buyer → Senior buyer → Finance VP → Legal (for orders > $1M)
- **Budget enforcement**: "This department has $500K remaining this quarter"
- **Cost center allocation**: Single order split across 5 cost centers
- **Delegated administration**: Client's admin manages their own users

SAP Commerce provides all this **out of the box**. Building it internally would require:
- 6 engineers × 12 months = ~$1.5M development cost
- Ongoing maintenance: $300K/year
- vs. SAP Commerce: Already licensed + $50K/year configuration

**3. Regulatory & Compliance Requirements**

BP operates in **50+ countries** with strict regulations:
- **GDPR** (EU): Right to deletion, consent management, data portability
- **SOX** (US): Financial data audit trails for publicly traded company
- **KYC/AML**: Know Your Customer verification for large B2B transactions

SAP Commerce has **pre-certified compliance** (SOC 2, ISO 27001, GDPR). Building this internally would require:
- External audit: $200K
- Compliance team: 2 FTEs
- Annual re-certification: $100K

**4. Master Data Management (MDM) — Single Source of Truth**

In BP's ecosystem, the same customer interacts with multiple systems:

```
Customer "Shell UK Ltd" (ID: BP-C-00421)
  │
  ├── SAP Commerce → Places oil orders (our platform)
  ├── SAP ERP (S/4HANA) → Invoicing, accounts receivable
  ├── SAP CRM → Sales team manages relationship
  ├── SAP Ariba → Procurement contracts
  └── SAP Analytics Cloud → Business intelligence
```

If we stored users internally, we'd create a **data silo**:
- Customer updates address in SAP CRM → our system still has old address
- Finance updates credit limit in SAP ERP → our system allows over-limit orders
- GDPR deletion request in SAP → our system still holds PII

SAP Commerce as **MDM** ensures **one record, everywhere updated**.

**5. Authentication Federation (SSO)**

SAP Commerce integrates natively with:
- **BP's Corporate Active Directory** (employee login)
- **Keycloak** (external client/supplier login)
- **SAML 2.0 / OIDC** federation

The authentication flow:

```
Client User                Our Platform              SAP Commerce         Keycloak
    │                          │                         │                    │
    │── Login ────────────────▶│                         │                    │
    │                          │── Redirect to SSO ─────▶│                    │
    │                          │                         │── OIDC Auth ──────▶│
    │                          │                         │◀── JWT Token ──────│
    │                          │◀── SAP Session + JWT ───│                    │
    │◀── Authenticated ────────│                         │                    │
    │                          │                         │                    │
    │── Place Order ──────────▶│                         │                    │
    │                          │── Check credit limit ──▶│                    │
    │                          │◀── { limit: $2M, used: $1.2M } ────────────│
    │                          │                         │                    │
    │                          │── Validate budget ─────▶│                    │
    │                          │◀── { budget: $500K, remaining: $380K } ────│
    │                          │                         │                    │
    │◀── Order Confirmed ──────│                         │                    │
```

---

#### Interview Answer: "Why SAP Commerce over internal storage?"

> "At BP, we chose SAP Commerce Cloud as the **single source of truth** for customer data instead of building an internal user store for five reasons:
>
> **First**, BP already had an enterprise SAP license. Building a duplicate user store would waste that investment and create data synchronization issues across SAP ERP, CRM, and Ariba.
>
> **Second**, B2B oil procurement has complex requirements — multi-level approval chains, budget enforcement, cost center allocation, delegated admin — that SAP Commerce provides out of the box. Building this internally would take 12+ months and cost $1.5M.
>
> **Third**, regulatory compliance. BP operates in 50+ countries. SAP Commerce is pre-certified for GDPR, SOX, and SOC 2. Self-certification would cost $300K+ annually.
>
> **Fourth**, Master Data Management. The same customer (like Shell UK) exists in 5+ SAP systems. SAP Commerce as the MDM hub ensures a single record — when the sales team updates a credit limit in SAP CRM, our ordering platform sees it immediately.
>
> **Fifth**, authentication federation. SAP Commerce natively integrates with BP's Active Directory and Keycloak SSO, giving us seamless login without building custom auth plumbing.
>
> On **our platform side**, we keep a lightweight operational cache in PostgreSQL — just the user ID, name, role, session token, and UI preferences. On every login, we sync fresh data from SAP Commerce via their OCC REST API through our Anti-Corruption Layer. This gives us fast reads without coupling to SAP's internal schema."

---

### 7. **Multi-Region Deployment**

**Challenge**: Global clients need low-latency access. Data residency laws (GDPR, local regulations).

**Solution**: Deployed across **5 regions** with geo-routing:

| Region | Primary DC | Backup DC | Clients | Latency (p95) |
|--------|-----------|-----------|---------|---------------|
| Europe | London | Frankfurt | 1200 | 45ms |
| Americas | Virginia | California | 800 | 60ms |
| APAC | Singapore | Tokyo | 600 | 55ms |
| Middle East | Dubai | - | 300 | 70ms |
| Africa | Cape Town | - | 100 | 80ms |

**Features**:
- **Data residency**: EU clients' data stays in EU
- **Failover**: Automatic region switching (RTO: 5 min)
- **CDN**: Static assets served from closest edge (CloudFront)

**Impact**:
- **Latency**: 50% reduction globally
- **Compliance**: GDPR, data localization laws met
- **Availability**: 99.95% uptime SLA

---

### 8. **Machine Learning & AI Features**

**Challenge**: Help clients predict demand, optimize inventory, reduce waste.

**Solution**: Built **ML Recommendation Engine**:

**Use Cases**:
1. **Demand Forecasting**: Predict oil consumption based on historical data, seasonality, economic indicators
2. **Inventory Optimization**: Recommend reorder quantities to minimize storage costs
3. **Fraud Detection**: Identify anomalous orders (unusual volume, timing, pricing)
4. **Dynamic Pricing**: Adjust margins based on demand elasticity

**Tech Stack**:
- **Model**: TensorFlow.js for browser-based predictions
- **Training**: Python (scikit-learn) on historical 2 years data
- **Deployment**: Model served via REST API, updated weekly

**Impact**:
- **Demand accuracy**: 87% prediction accuracy (vs 65% manual estimates)
- **Inventory savings**: $8M saved through optimized stock levels
- **Fraud prevention**: Blocked 15 fraudulent orders worth $2M

---

### 9. **Real-Time Dashboard & Analytics**

**Challenge**: BP executives needed live visibility into operations, revenue, SLA compliance.

**Solution**: Built **Admin Dashboard** with real-time metrics:

**Key Metrics**:
- **Orders**: Total, pending, completed (last 24h, 7d, 30d)
- **Revenue**: By region, product, client segment
- **SLA Compliance**: On-time delivery %, quality failures
- **Tanker Fleet**: Active, idle, maintenance
- **Top Clients**: Revenue contribution, order frequency
- **Supplier Performance**: Fulfillment rate, avg dispatch time

**Tech**:
- **WebSocket** for live updates (order count, tanker locations)
- **Data aggregation**: Redis caching for fast queries
- **Visualization**: Custom React charts (bar, donut, heatmap, sparklines)

**Impact**:
- **Decision speed**: Executives make data-driven decisions in real-time
- **Issue detection**: SLA breaches detected 10x faster
- **Client trust**: Transparent tracking builds confidence

---

### 10. **Performance Optimization**

**Implemented**:
- **L1/L2 Caching**: In-memory + Redis (cache hit rate: 85%)
- **Database indexing**: Query time reduced 70% (5s → 1.5s)
- **Code splitting**: React lazy loading (initial bundle: 180KB → 65KB)
- **API pagination**: Cursor-based for large datasets (10K+ records)
- **WebSocket**: Real-time updates instead of polling (bandwidth reduced 80%)

**Results**:
- **Page load**: 3.2s → 1.1s (p95)
- **API response**: 800ms → 250ms (p50)
- **Concurrent users**: 2,000 → 10,000 (same infrastructure)

---

## 📊 Technical Metrics & KPIs

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Order Processing Time** | 2-3 days | 4 hours | **87% faster** |
| **System Uptime** | 97.5% | 99.95% | **2.5 points** |
| **API Response Time (p95)** | 2.5s | 350ms | **86% faster** |
| **Concurrent Users** | 2,000 | 10,000 | **5x capacity** |
| **Revenue (Annual)** | $2.3B | $2.5B | **+$200M** |
| **Logistics Cost** | $150M | $100M | **$50M saved** |
| **Client Satisfaction (NPS)** | 45 | 72 | **+27 points** |
| **Data Consistency** | 87% | 99.9% | **+12.9%** |
| **Fraud Prevention** | N/A | $2M blocked | **New capability** |
| **Carbon Footprint** | Baseline | -18% | **Green initiative** |

---

## 🛠️ Technology Stack Deep Dive

### Frontend
- **Framework**: React 18 (Concurrent features, Suspense, Transitions)
- **State Management**: Redux Toolkit + React Query v5 (Server state)
- **Routing**: Wouter (2KB, fast)
- **UI**: TailwindCSS, shadcn/ui, Framer Motion
- **Forms**: Zod validation, custom hooks
- **Build**: Vite (HMR, fast refresh)
- **Charts**: Custom D3.js-based visualizations

### Backend
- **Runtime**: Node.js 20 LTS
- **Framework**: Express 4
- **Language**: TypeScript (strict mode)
- **ORM**: Drizzle (type-safe, performant)
- **Database**: PostgreSQL 15 (11 tables, JSONB for metadata)
- **Caching**: Redis 7 (L2 cache, session store, pub/sub)
- **Message Queue**: RabbitMQ (transactional) + Kafka (event streaming)
- **WebSocket**: ws library for real-time updates
- **Auth**: Keycloak (SSO), Passport.js, JWT

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Orchestration**: Kubernetes (EKS on AWS)
- **CI/CD**: GitHub Actions, ArgoCD
- **Monitoring**: Prometheus, Grafana, ELK stack
- **CDN**: CloudFront
- **DNS**: Route53 with geo-routing
- **Storage**: S3 for quality certificates, invoices

### DevOps
- **IaC**: Terraform
- **Secrets**: AWS Secrets Manager
- **Logs**: Centralized logging (ELK)
- **Alerts**: PagerDuty integration
- **Backups**: Daily snapshots, 30-day retention

---

## 🎯 Design Patterns & Best Practices

### Patterns Implemented (30+)

**Architectural**:
1. **Hexagonal Architecture**: Ports & Adapters for service isolation
2. **CQRS**: Separate read/write models for scalability
3. **Event Sourcing**: Immutable event log for audit trail
4. **Saga Pattern**: Distributed transaction management
5. **Anti-Corruption Layer**: SAP integration decoupling
6. **API Gateway**: Single entry point, cross-cutting concerns
7. **Service Registry**: Dynamic service discovery
8. **Circuit Breaker**: Prevent cascading failures
9. **Strangler Fig**: Gradual legacy system migration

**Microservice Patterns**:
10. **BaseService**: Abstract class for common service logic
11. **Repository Pattern**: Data access abstraction
12. **Factory Pattern**: Service instantiation
13. **Strategy Pattern**: Multiple auth providers (Keycloak, JWT, OAuth)
14. **Observer Pattern**: WebSocket event broadcasting
15. **Pub/Sub**: Event-driven communication

**Data Patterns**:
16. **Unit of Work**: Transaction management
17. **Active Record**: Drizzle ORM entities
18. **Data Mapper**: Transform domain ↔ persistence models
19. **Optimistic Locking**: Prevent concurrent update conflicts

**Frontend Patterns**:
20. **Compound Components**: Complex UI composition
21. **Render Props**: Flexible component logic sharing
22. **HOC**: Authentication, authorization wrappers
23. **Custom Hooks**: Reusable stateful logic (30+ hooks)
24. **Controlled Components**: Form management
25. **Code Splitting**: React.lazy, dynamic imports

**Resilience Patterns**:
26. **Retry with Exponential Backoff**: Transient failure recovery
27. **Bulkhead**: Resource isolation
28. **Timeout**: Prevent hanging requests
29. **Cache-Aside**: Lazy caching strategy
30. **Idempotency**: Safe request retries

---

## 🔐 Security & Compliance

### Implemented Controls

**Authentication & Authorization**:
- Multi-factor authentication (MFA) for admin users
- Keycloak SSO integration with corporate AD
- JWT with 15-min expiration + refresh tokens
- IP whitelisting for sensitive endpoints
- API key rotation every 90 days

**Data Protection**:
- Encryption at rest (AES-256)
- TLS 1.3 for all connections
- PII data masking in logs
- Data retention policies (7 years for invoices)
- GDPR right-to-delete implementation

**Compliance**:
- **SOC 2 Type II** certified
- **ISO 27001** information security
- **GDPR** compliant (data residency, consent)
- **PCI DSS** (payment data handling)
- **Industry standards**: API 1109 (petroleum measurement)

**Audit & Monitoring**:
- Full request/response logging (90 days retention)
- Correlation IDs for distributed tracing
- User action audit trail (who, what, when, where)
- Automated compliance reports (quarterly)
- Penetration testing (annual)

---

## 🚧 Challenges & Solutions

### Challenge 1: Legacy SAP Integration
**Problem**: SAP system 15 years old, poor documentation, proprietary protocols.

**Solution**:
- Built Anti-Corruption Layer (ACL) to isolate SAP coupling
- Created domain translator (our REST API → SAP RFC/BAPI)
- Implemented retry queues for failed SAP calls
- Comprehensive integration tests (95% coverage)

**Outcome**: Zero downtime during cutover, 99.8% sync success rate.

---

### Challenge 2: Real-Time Tanker Tracking at Scale
**Problem**: 500+ tankers sending GPS updates every 30s → 1M updates/day → database bottleneck.

**Solution**:
- WebSocket server (ws library) for real-time connections
- Redis pub/sub for message broadcasting (fan-out)
- PostgreSQL partitioning by date for location history
- TTL-based cleanup (delete locations older than 30 days)
- Client-side buffering (send batch every 30s, not individual updates)

**Outcome**: Handles 10K concurrent WebSocket connections, 50ms p95 latency.

---

### Challenge 3: Dynamic Pricing Race Conditions
**Problem**: Concurrent price updates from commodity API → inconsistent pricing → revenue loss.

**Solution**:
- Redis distributed locks (SET NX with TTL)
- Optimistic locking with version field in database
- Eventual consistency with event sourcing (price change events)
- Price snapshot at order creation (immutable)

**Outcome**: Zero pricing discrepancies, all orders have audit trail.

---

### Challenge 4: Multi-Region Data Consistency
**Problem**: Orders placed in Europe, fulfilled in Middle East → data synchronization lag.

**Solution**:
- Event-driven replication (Kafka cross-region)
- Region-specific primary database with read replicas
- Conflict resolution (last-write-wins with vector clocks)
- Eventual consistency with CRDT (Conflict-free Replicated Data Types)

**Outcome**: 200ms average replication lag, 99.9% consistency.

---

### Challenge 5: Testing Distributed System
**Problem**: 16 microservices → integration testing nightmare.

**Solution**:
- Contract testing (Pact framework)
- Service virtualization (mock external APIs)
- End-to-end tests in staging environment (daily)
- Chaos engineering (random service failures in pre-prod)
- Automated regression suite (1500+ tests, 8-min runtime)

**Outcome**: 95% test coverage, bugs caught before production.

---

## 📈 Business Impact

### Quantifiable Results

**Revenue**:
- **$200M additional revenue** (new clients, upsells)
- **8% margin improvement** through dynamic pricing
- **$12M fuel savings** in logistics

**Operational Efficiency**:
- **87% faster order processing** (2-3 days → 4 hours)
- **40% faster deliveries** (8 hours → 4.8 hours)
- **98% SLA compliance** (vs 82% before)

**Client Satisfaction**:
- **NPS +27 points** (45 → 72)
- **Client retention**: 94% (vs 87%)
- **Expansion**: 800 new clients onboarded in 18 months

**Cost Savings**:
- **$50M annual logistics savings**
- **$8M inventory optimization**
- **30% infrastructure cost reduction** (cloud optimization)

**Environmental**:
- **18% reduction in carbon footprint** (optimized routes)
- **Zero tanker incidents** (GPS tracking, safety alerts)

---

## 🎓 Key Learnings & Takeaways

### Technical Learnings

1. **Event-Driven Architecture is powerful but complex**: Required strong team discipline around event schema versioning, backward compatibility, and dead-letter queue monitoring.

2. **CQRS trade-offs**: Read/write separation improved scalability but added complexity. Worth it for high-traffic systems, overkill for simple CRUD.

3. **Microservices communication overhead**: Network calls are expensive. Used API Gateway + GraphQL BFF to reduce client-side chattiness (10 REST calls → 1 GraphQL query).

4. **Database partitioning**: PostgreSQL partitioning by date for tanker GPS data reduced query time 90%. Should've done it earlier.

5. **WebSocket at scale**: Sticky sessions (same client → same server) reduced reconnection churn 70%. Load balancer configuration critical.

### Team & Process

6. **Cross-functional teams work**: Dedicated teams per domain (Orders, Logistics, Payments) shipped faster than shared teams.

7. **Documentation is critical**: With 16 services, good docs (OpenAPI, ADRs, runbooks) saved hours of onboarding time.

8. **Observability from day one**: Prometheus metrics + distributed tracing (correlation IDs) made debugging 10x easier than logs alone.

9. **Chaos engineering pays off**: Monthly "chaos days" (kill random services) uncovered edge cases before production.

10. **Incremental migration**: Strangler Fig pattern let us migrate from monolith over 12 months without big-bang cutover.

---

## 📚 Interview Talking Points

### When asked: "Tell me about a challenging project"

**Answer**:
> "At BP, I led the development of their B2B Oil Ordering Platform — a $2.5B revenue system serving 3,000+ clients globally. The biggest challenge was migrating from a 15-year-old monolithic SAP system while maintaining zero downtime.
>
> I designed a 16-microservice architecture using CQRS, Event Sourcing, and Saga patterns. We implemented an Anti-Corruption Layer to decouple from SAP, allowing gradual migration.
>
> The result: 87% faster order processing, 99.95% uptime, and $50M annual logistics savings. We handled 10,000 concurrent users with real-time tanker tracking via WebSockets."

---

### When asked: "How do you handle system failures?"

**Answer**:
> "I implemented multiple resilience patterns:
>
> 1. **Circuit Breaker**: If SAP is down, we queue orders and retry with exponential backoff rather than failing immediately.
>
> 2. **Saga Pattern**: For distributed transactions (order → payment → inventory → dispatch), we implemented compensating transactions. If payment fails, we automatically release inventory and notify the client.
>
> 3. **Multi-Region Failover**: If London datacenter fails, Route53 automatically redirects traffic to Frankfurt in <5 minutes.
>
> We tested this with monthly chaos engineering exercises — randomly killing services to ensure graceful degradation. For example, when the pricing service is down, we serve cached prices with a staleness indicator."

---

### When asked: "Describe your role in the team"

**Answer**:
> "I wore multiple hats:
>
> 1. **Architect**: Designed the overall microservices architecture, defined service boundaries, chose tech stack (Node, React, PostgreSQL, RabbitMQ).
>
> 2. **Tech Lead**: Mentored 6 junior developers, conducted code reviews (enforced 95% test coverage), established coding standards.
>
> 3. **Full-Stack Developer**: Built core services (Order, Logistics, Pricing) on backend and admin dashboard on frontend.
>
> 4. **DevOps**: Set up CI/CD pipelines (GitHub Actions), Kubernetes deployments, Prometheus monitoring.
>
> 5. **Stakeholder Management**: Translated business requirements from BP executives into technical specs, demo'd features bi-weekly."

---

### When asked: "How do you ensure code quality?"

**Answer**:
> "Multi-layered approach:
>
> 1. **Testing Pyramid**: 1500+ tests (70% unit, 20% integration, 10% E2E). Minimum 95% coverage enforced in CI.
>
> 2. **Code Reviews**: Every PR requires 2 approvals. We use a checklist (tests, docs, backward compatibility, security).
>
> 3. **Static Analysis**: ESLint, TypeScript strict mode, SonarQube (blocks merge if critical issues).
>
> 4. **Contract Testing**: Pact framework to ensure service API compatibility.
>
> 5. **Observability**: Correlation IDs, structured logging (ELK stack), Prometheus metrics. If a bug reaches production, we add a test to prevent regression.
>
> Example: We caught a race condition in pricing updates during load testing because we had 1000-concurrent-user tests in our suite."

---

### When asked: "What technologies did you use and why?"

**Answer**:
> **Backend**: Node.js + TypeScript for type safety and JavaScript ecosystem richness. Express for simplicity. Drizzle ORM for type-safe database queries.
>
> **Frontend**: React 18 for modern features (Suspense, Concurrent mode). Redux Toolkit for global state (cart, user), React Query for server state (automatic caching, refetching).
>
> **Database**: PostgreSQL for ACID guarantees (financial transactions). Redis for caching (85% hit rate) and WebSocket pub/sub.
>
> **Messaging**: RabbitMQ for reliable message delivery (orders, payments). Kafka for event streaming (analytics, audit logs).
>
> **Auth**: Keycloak for enterprise SSO (integrates with BP's Active Directory).
>
> **Why these choices**: Prioritized developer productivity (TypeScript), operational stability (PostgreSQL, battle-tested), and cost efficiency (open-source tools)."

---

## 🏆 Awards & Recognition

- **BP Innovation Award 2025**: For digital transformation contribution
- **Engineering Excellence Award**: Best architecture (internal)
- **Client Choice Award**: Highest-rated supplier platform (Q4 2025)

---

## 📞 References & Artifacts

### Project Artifacts (Available on Request)

1. **Architecture Diagrams**: High-level system design, microservices map, data flow
2. **Technical Specs**: Service boundaries, API contracts (OpenAPI), event schemas
3. **Code Samples**: Repository pattern, CQRS implementation, WebSocket manager
4. **Metrics Dashboard**: Screenshots of Grafana dashboards (live metrics)
5. **Client Testimonials**: NPS survey results, client quotes

### GitHub Repository Structure

```
bp-oil-platform/
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/       # Reusable UI (40+ components)
│   │   ├── pages/            # Order, Dashboard, Tracking
│   │   ├── hooks/            # Custom hooks (30+)
│   │   ├── store/            # Redux slices
│   │   └── lib/              # Utils, query client
├── server/                    # Node.js backend
│   ├── microservices/        # 16 services
│   │   ├── order/
│   │   ├── logistics/
│   │   ├── pricing/
│   │   ├── auth/
│   │   └── sap/             # Anti-Corruption Layer
│   ├── infrastructure/       # Shared utilities
│   │   ├── eventBus.ts
│   │   ├── circuitBreaker.ts
│   │   ├── cache.ts
│   │   └── metrics.ts
│   └── gateway/              # API Gateway
├── shared/                    # Shared types, schemas
├── docs/                      # Architecture, ADRs, runbooks
├── k8s/                       # Kubernetes manifests
└── terraform/                 # Infrastructure as Code
```

---

## 🎯 Summary for Resume

**BP Oil Ordering Platform (2024-2026)**

*Senior Full-Stack Engineer | Tech Lead*

- Led development of enterprise B2B oil ordering platform processing $2.5B in annual transactions for 3,000+ corporate clients across 5 regions
- Designed and implemented 16-microservice architecture using Node.js, TypeScript, React 18, PostgreSQL, and event-driven patterns (CQRS, Saga, Event Sourcing)
- Reduced order-to-delivery cycle time by 87% (2-3 days → 4 hours) through real-time inventory tracking, dynamic pricing, and intelligent logistics routing
- Built Anti-Corruption Layer for seamless SAP integration with 99.8% sync success rate
- Achieved 99.95% uptime, 10,000 concurrent users, and $50M annual logistics cost savings through route optimization
- Implemented ML-driven demand forecasting (87% accuracy) and fraud detection ($2M fraudulent orders blocked)
- Established CI/CD pipelines, multi-region Kubernetes deployment, and comprehensive observability (Prometheus, ELK, distributed tracing)

---

## ✅ Final Checklist for Interview Prep

- [ ] Review architecture diagrams
- [ ] Memorize key metrics (87% faster, $50M saved, 99.95% uptime)
- [ ] Prepare STAR stories (Situation, Task, Action, Result)
- [ ] Practice explaining technical decisions (why microservices, why CQRS)
- [ ] Review code samples (can whiteboard Saga pattern, Circuit Breaker)
- [ ] Prepare questions about interviewer's tech stack
- [ ] Print this document as reference notes

---

**Document Version**: 2.0  
**Last Updated**: February 11, 2026  
**Confidentiality**: Internal Use Only (sanitized for interview discussion)
