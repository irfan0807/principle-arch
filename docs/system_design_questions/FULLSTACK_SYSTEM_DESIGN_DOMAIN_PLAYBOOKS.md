# Fullstack System Design: Domain Playbooks

## 1. How to Use This Playbook
This guide provides domain-specific architecture blueprints for:
- E-commerce
- SaaS (B2B multi-tenant)
- Fintech
- Social platform

For each domain, use this structure:
1. Product goals and critical journeys
2. NFR targets
3. Recommended architecture
4. Data model and consistency choices
5. Security and compliance controls
6. Observability and release gates
7. Common failure modes and mitigation

---

## 2. E-commerce Playbook

### 2.1 Critical User Journeys
- Browse/search product catalog
- Add to cart
- Checkout and payment
- Order tracking and returns

### 2.2 NFR Targets (Typical)
- Product page p95 < 300ms
- Checkout API p95 < 400ms
- Order creation availability >= 99.95%
- No duplicate order creation

### 2.3 Recommended Architecture
- Frontend: SSR/ISR for SEO-heavy catalog pages + CSR for account/order flows
- Backend: modular monolith or domain services (Catalog, Cart, Checkout, Payment, Order, Inventory)
- Data:
  - SQL for orders/payments/inventory
  - Search engine for product discovery
  - Redis for cart/session/cache
- Async:
  - Event bus for order events, emails, analytics, fulfillment triggers

### 2.4 Data and Consistency
- Inventory reservation before payment capture (or vice versa by policy)
- Idempotency key required for `POST /checkout` and payment actions
- Order state machine: `PENDING -> CONFIRMED -> FULFILLED -> DELIVERED / CANCELLED / RETURNED`

### 2.5 Security and Risk Controls
- PCI scope minimization via payment provider tokenization
- Strong anti-fraud controls at checkout (rules + risk scoring)
- Price/tax calculation integrity checks server-side

### 2.6 Observability
- Funnel metrics: view -> cart -> checkout -> payment success
- Technical: checkout p95/p99, payment failure reason distribution
- Alerting: payment failure spike, inventory mismatch spike

### 2.7 Common Failure Modes
- Duplicate orders due to retry without idempotency
- Inventory drift from race conditions
- Search/catalog stale data mismatch
- Payment callback out-of-order handling

### 2.8 Mitigations
- Idempotency with persistent key store
- Transactional inventory operations or reservation ledger
- Outbox pattern for reliable event publication
- Reconciliation jobs for payment and order state alignment

---

## 3. SaaS (B2B Multi-Tenant) Playbook

### 3.1 Critical User Journeys
- Tenant onboarding
- Admin/user management
- Core workflow execution (tickets/projects/docs)
- Reporting and exports

### 3.2 NFR Targets (Typical)
- API p95 < 250ms for core CRUD
- Tenant isolation incident count: 0
- Availability >= 99.9% (or by enterprise SLA tier)

### 3.3 Recommended Architecture
- Frontend: SPA + role-based UI policy loading
- Backend domains: Identity, Tenant, Authorization, Core Domain, Billing, Audit
- Multi-tenant model options:
  - Shared DB + tenant_id (fast start)
  - Schema-per-tenant (mid isolation)
  - DB-per-tenant (high isolation)

### 3.4 Data and Access Model
- Every domain entity scoped by tenant boundary
- Central policy layer for RBAC + ABAC
- Immutable audit log for privileged actions

### 3.5 Security and Compliance
- SSO (SAML/OIDC), SCIM provisioning for enterprise
- Fine-grained authorization checks server-side
- Data retention and deletion policy per contract
- Encryption and key management policy by tenant tier

### 3.6 Observability
- Per-tenant latency/error dashboards
- Noisy-tenant detection and throttling metrics
- Authorization denial analytics

### 3.7 Common Failure Modes
- Missing tenant filter in query leading to data leakage
- Permission drift due to hard-coded role logic
- Long-running reports degrading shared resources

### 3.8 Mitigations
- Mandatory tenant-scope middleware and query guardrails
- Centralized authorization service/policy engine
- Async report generation queues + rate limits + quotas

---

## 4. Fintech Playbook

### 4.1 Critical User Journeys
- Account onboarding and KYC
- Wallet/account balance operations
- Transfers/payments
- Statement and compliance reporting

### 4.2 NFR Targets (Typical)
- Monetary operation correctness > latency
- Exactly-once business effect for debit/credit intents
- Auditability: complete immutable trail
- High availability for payment rails

### 4.3 Recommended Architecture
- Service domains: Identity/KYC, Ledger, Payments, Risk, Compliance, Notifications
- Data:
  - Strong SQL transactions for ledger and balances
  - Event store or immutable journal for audit
- Async:
  - Outbox + saga for cross-service money movement workflows

### 4.4 Data and Consistency
- Ledger-first model (double-entry strongly recommended)
- No direct balance mutation without ledger entries
- Transfer state machine with compensations

### 4.5 Security and Compliance
- MFA for sensitive actions
- HSM/secure key handling where applicable
- AML/fraud screening hooks
- Region-specific compliance reporting

### 4.6 Observability
- Money movement reconciliation dashboards
- Failed transfer reason analytics
- Duplicate request blocked metrics

### 4.7 Common Failure Modes
- Duplicate debit under retries
- Inconsistent ledger and balance snapshots
- Webhook replay and ordering issues

### 4.8 Mitigations
- Mandatory idempotency for all money intents
- Double-entry validation and periodic reconciliation
- Signed webhook verification and replay protection

---

## 5. Social Platform Playbook

### 5.1 Critical User Journeys
- Feed consumption
- Post creation and media upload
- Likes/comments/shares
- Follow graph updates
- Realtime chat/notifications

### 5.2 NFR Targets (Typical)
- Feed load p95 < 250ms
- Post publish latency p95 < 400ms
- Realtime delivery latency p95 < 1s

### 5.3 Recommended Architecture
- Frontend: app shell with feed hydration and optimistic interactions
- Backend domains: Identity, Graph, Feed, Content, Media, Notifications, Moderation
- Data:
  - Graph store or optimized relational model for follow edges
  - Document/object storage for posts/media metadata
  - Cache for feed timelines and hot content
- Async:
  - Event pipeline for fanout, moderation, ranking, and notifications

### 5.4 Data and Consistency
- Eventual consistency acceptable for likes/comments counters in many flows
- Strong consistency required for moderation state and access control decisions

### 5.5 Safety and Abuse Controls
- Content moderation pipeline
- Rate limiting for spam/bot control
- Abuse detection and account trust scoring

### 5.6 Observability
- Feed quality metrics (CTR, dwell, diversity)
- Technical metrics (fanout lag, cache hit ratio, queue lag)
- Abuse metrics (spam attempt volume, false positive rate)

### 5.7 Common Failure Modes
- Feed fanout lag causing stale timelines
- Hot key cache pressure from viral content
- Notification storms from bad dedupe

### 5.8 Mitigations
- Hybrid fanout strategy (fanout-on-write + fanout-on-read fallback)
- Hot-key sharding and adaptive caching
- Notification dedupe keys and event throttling

---

## 6. Cross-Domain Decision Matrix

| Dimension | E-commerce | SaaS | Fintech | Social |
|---|---|---|---|---|
| Consistency priority | High on checkout/inventory | High on tenant/authz | Very high on money ledger | Mixed (strong + eventual) |
| Latency priority | High | High | Medium-high with correctness first | Very high |
| Compliance pressure | Medium-high | Medium-high | Very high | Medium |
| Data model complexity | Medium-high | High (tenant + roles) | High (ledger) | Very high (graph + feed) |
| Real-time needs | Medium | Medium | Medium | High |

---

## 7. Domain-Specific Review Checklist

### 7.1 Problem and Scope
- Are critical journeys explicitly prioritized?
- Are NFRs measurable and realistic?

### 7.2 Data and Integrity
- Are invariants explicit and testable?
- Is idempotency required and implemented where needed?

### 7.3 Security and Compliance
- Are auth/authz boundaries defined?
- Are compliance obligations mapped to controls and evidence?

### 7.4 Operability
- Are alerts tied to user-impact KPIs?
- Are runbooks prepared for top incidents?

### 7.5 Evolution
- Is there a migration strategy for scale and domain growth?
- Are architecture decisions recorded with ADRs?

---

## 8. Implementation Plan Template (Any Domain)

### Phase 1: Core Flows
- Ship critical journeys with correctness-first controls.
- Add baseline observability and error handling.

### Phase 2: Resilience and Scale
- Add caching, async offloading, and bottleneck fixes.
- Introduce targeted fault-injection and load testing.

### Phase 3: Governance and Optimization
- Add policy automation, cost controls, and release gates.
- Improve architecture with data from production trends.

---

## 9. Final Guidance
Use these playbooks as starting architectures, not fixed rules.

Architectural quality is achieved when:
- decisions are explicit,
- tradeoffs are measured,
- operations are reliable,
- and evolution paths are clear.
