# Fullstack System Design: Diagram-First Guide

## 1. How to Use This Guide
This guide presents architecture patterns as diagrams first, then explains why and when to use each.

Each pattern includes:
- Component diagram
- Sequence diagram
- Key tradeoffs
- Failure considerations

All diagrams use Mermaid.

---

## 2. Pattern: BFF + Domain Services

### 2.1 Component Diagram
```mermaid
graph TD
  U[Web/Mobile Client] --> BFF[BFF / API Gateway]
  BFF --> Auth[Auth Service]
  BFF --> Catalog[Catalog Service]
  BFF --> Order[Order Service]
  BFF --> Payment[Payment Service]
  Catalog --> CDB[(Catalog DB)]
  Order --> ODB[(Order DB)]
  Payment --> PDB[(Payment DB)]
```

### 2.2 Sequence Diagram (Checkout)
```mermaid
sequenceDiagram
  participant C as Client
  participant B as BFF
  participant O as Order Service
  participant P as Payment Service
  participant DB as Order DB

  C->>B: POST /checkout
  B->>O: validate + create order intent
  O->>DB: insert pending order
  O-->>B: orderIntentId
  B->>P: create payment intent
  P-->>B: paymentIntent
  B-->>C: 200 + orderIntentId + paymentIntent
```

### 2.3 Use When
- Multiple clients need tailored API payloads
- You want to keep domain services client-agnostic

### 2.4 Risks
- BFF can become a monolith if business logic leaks into it

---

## 3. Pattern: Event-Driven Async Side Effects

### 3.1 Component Diagram
```mermaid
graph LR
  O[Order Service] --> OUT[(Outbox Table)]
  OUT --> PUB[Outbox Publisher]
  PUB --> BUS[(Event Bus)]
  BUS --> N[Notification Service]
  BUS --> A[Analytics Service]
  BUS --> S[Search Indexer]
```

### 3.2 Sequence Diagram (Order Created)
```mermaid
sequenceDiagram
  participant O as Order Service
  participant DB as Order DB
  participant OP as Outbox Publisher
  participant BUS as Event Bus
  participant N as Notification

  O->>DB: tx: create order + outbox row
  DB-->>O: commit
  OP->>DB: read unpublished outbox rows
  OP->>BUS: publish order.created
  BUS->>N: consume order.created
  N-->>BUS: ack
```

### 3.3 Use When
- Side effects should not block critical path
- Reliability of event publishing matters

### 3.4 Risks
- Consumer idempotency must be enforced
- Outbox lag must be monitored

---

## 4. Pattern: Saga for Distributed Transactions

### 4.1 Component Diagram
```mermaid
graph TD
  ORCH[Saga Orchestrator] --> INV[Inventory Service]
  ORCH --> PAY[Payment Service]
  ORCH --> ORD[Order Service]
  ORCH --> NOTI[Notification Service]
```

### 4.2 Sequence Diagram (Happy + Compensation)
```mermaid
sequenceDiagram
  participant S as Saga
  participant I as Inventory
  participant P as Payment
  participant O as Order

  S->>I: reserve items
  I-->>S: reserved
  S->>P: charge customer
  P-->>S: failed
  S->>I: compensate release reservation
  I-->>S: released
  S-->>O: mark order failed
```

### 4.3 Use When
- Business transaction spans multiple services

### 4.4 Risks
- Complex state transitions and compensation logic

---

## 5. Pattern: CQRS Read/Write Separation

### 5.1 Component Diagram
```mermaid
graph LR
  C[Client] --> API[API]
  API --> W[Write Model]
  W --> WDB[(Write DB)]
  W --> BUS[(Event Bus)]
  BUS --> R[Read Projection]
  R --> RDB[(Read DB)]
  API --> R
```

### 5.2 Sequence Diagram
```mermaid
sequenceDiagram
  participant C as Client
  participant API as API
  participant W as Write Model
  participant BUS as Event Bus
  participant R as Read Model

  C->>API: POST command
  API->>W: execute command
  W->>BUS: publish domain event
  BUS->>R: update projection
  C->>API: GET query
  API->>R: fetch read model
  R-->>API: projection data
  API-->>C: response
```

### 5.3 Use When
- Read and write workload patterns differ significantly

### 5.4 Risks
- Eventual consistency between write and read views

---

## 6. Pattern: Multi-Tenant SaaS Isolation

### 6.1 Component Diagram
```mermaid
graph TD
  U[User] --> API[API Layer]
  API --> AUTHZ[Policy Engine]
  API --> APP[App Service]
  APP --> DB[(Tenant Data)]
  APP --> AUDIT[(Audit Log)]
```

### 6.2 Sequence Diagram (Tenant-scoped Access)
```mermaid
sequenceDiagram
  participant U as User
  participant API as API
  participant P as Policy
  participant S as Service
  participant DB as DB

  U->>API: GET /tenant/{id}/resource
  API->>P: authorize(user, tenant, action)
  P-->>API: allow
  API->>S: fetch tenant resource
  S->>DB: query with tenant_id filter
  DB-->>S: rows
  S-->>API: data
  API-->>U: response
```

### 6.3 Use When
- B2B product with strict tenant isolation requirements

### 6.4 Risks
- Missing tenant filter can cause cross-tenant leaks

---

## 7. Pattern: Cache-Aside with Invalidation

### 7.1 Component Diagram
```mermaid
graph LR
  C[Client] --> API[API]
  API --> CACHE[(Redis Cache)]
  API --> DB[(Primary DB)]
  DB --> EVT[(Change Event)]
  EVT --> CACHE
```

### 7.2 Sequence Diagram
```mermaid
sequenceDiagram
  participant API
  participant Cache
  participant DB

  API->>Cache: GET key
  alt hit
    Cache-->>API: value
  else miss
    API->>DB: query
    DB-->>API: value
    API->>Cache: SET key TTL
  end
```

### 7.3 Use When
- Read-heavy paths with tolerable staleness windows

### 7.4 Risks
- Stale data if invalidation is weak

---

## 8. Pattern: Realtime Updates via WebSocket + Event Bus

### 8.1 Component Diagram
```mermaid
graph TD
  C[Client] <--> WS[WebSocket Gateway]
  WS --> BUS[(Event Bus)]
  SVC[Domain Service] --> BUS
  BUS --> WS
```

### 8.2 Sequence Diagram
```mermaid
sequenceDiagram
  participant C as Client
  participant WS as WebSocket Gateway
  participant S as Service
  participant BUS as Event Bus

  C->>WS: connect + auth
  S->>BUS: publish status.updated
  BUS->>WS: event
  WS-->>C: push update
```

### 8.3 Use When
- Live tracking/chat/collaboration is required

### 8.4 Risks
- Connection state scaling, reconnect storms, and backpressure

---

## 9. Pattern: Fullstack AuthN/AuthZ

### 9.1 Component Diagram
```mermaid
graph TD
  U[User] --> FE[Frontend]
  FE --> API[Backend API]
  API --> IDP[Identity Provider]
  API --> POL[Authorization Policy Service]
  API --> APP[Domain Services]
```

### 9.2 Sequence Diagram
```mermaid
sequenceDiagram
  participant U as User
  participant FE as Frontend
  participant API as API
  participant IDP as Identity
  participant POL as Policy

  U->>FE: sign in
  FE->>IDP: auth flow
  IDP-->>FE: token/session
  FE->>API: request + credential
  API->>IDP: validate
  API->>POL: authorize(resource, action)
  POL-->>API: allow/deny
  API-->>FE: response
```

### 9.3 Use When
- Fine-grained access and strong auditing are required

### 9.4 Risks
- Frontend-only auth checks are insufficient

---

## 10. Pattern: Observability-Centered Operations

### 10.1 Component Diagram
```mermaid
graph LR
  APP[Services] --> LOGS[(Log Store)]
  APP --> MET[(Metrics Store)]
  APP --> TRACE[(Trace Backend)]
  MET --> ALERT[Alert Manager]
  ALERT --> ONCALL[On-call Team]
```

### 10.2 Sequence Diagram (Incident)
```mermaid
sequenceDiagram
  participant S as Service
  participant M as Metrics
  participant A as Alerting
  participant O as On-call

  S->>M: error_rate + latency metrics
  M->>A: threshold breach
  A-->>O: page
  O->>S: runbook-guided mitigation
```

### 10.3 Use When
- Production reliability and fast MTTR are priorities

### 10.4 Risks
- Noisy alerts and poor runbooks increase downtime

---

## 11. Pattern: Blue/Green + Feature Flags

### 11.1 Component Diagram
```mermaid
graph TD
  U[Users] --> LB[Load Balancer]
  LB --> BLUE[Blue Environment]
  LB --> GREEN[Green Environment]
  FF[Feature Flag Service] --> BLUE
  FF --> GREEN
```

### 11.2 Sequence Diagram
```mermaid
sequenceDiagram
  participant CI as CI/CD
  participant LB as Load Balancer
  participant G as Green Env
  participant FF as Feature Flags

  CI->>G: deploy new version
  CI->>LB: shift 5% traffic to green
  CI->>FF: enable feature for canary cohort
  Note over CI,LB: monitor KPIs, rollback if SLO breach
```

### 11.3 Use When
- You need low-risk production rollout

### 11.4 Risks
- Flag sprawl and unclear ownership

---

## 12. Pattern Mapping by Domain

### E-commerce
- BFF + domain services
- Saga for checkout
- Cache-aside for catalog
- Event-driven notifications

### SaaS
- Multi-tenant isolation
- Centralized policy service
- Audit trail architecture

### Fintech
- Saga + outbox + strong ledger consistency
- Idempotent money intents
- Strict observability and reconciliation

### Social
- Realtime WebSocket updates
- Event-driven fanout
- Hybrid consistency and hot-key cache controls

---

## 13. Diagram Review Checklist

- Do component boundaries align with ownership?
- Are critical flows represented with failure paths?
- Are state transitions explicit for write operations?
- Are consistency assumptions documented?
- Are security checks shown at boundaries?
- Are observability hooks represented?
- Is rollback path explicit in rollout diagrams?

---

## 14. Final Notes
A diagram is useful only if it captures:
- ownership,
- contracts,
- state transitions,
- and failure behavior.

Keep diagrams versioned with ADRs and update them whenever architecture changes materially.
