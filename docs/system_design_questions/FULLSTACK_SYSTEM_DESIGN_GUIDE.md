# Fullstack System Design Guide for Software Architects

## 1. Why This Guide Exists
This guide is a practical, end-to-end handbook for designing, reviewing, and evolving fullstack systems in production.

It is written for architects and senior engineers who own:
- Product architecture decisions
- Scalability and reliability outcomes
- Security and compliance posture
- Delivery speed and engineering governance

It focuses on decisions you must make before writing code, while writing code, and during production operations.

## 2. Architect Mindset
A fullstack architect is accountable for tradeoffs across:
- User experience
- Backend correctness
- Data integrity
- Operational reliability
- Security and compliance
- Team productivity
- Cost

Your job is not to find a perfect design. Your job is to find a design that is:
- Correct for the business context
- Evaluable with metrics
- Operable by the current team
- Evolvable without repeated rewrites

## 3. End-to-End Design Workflow

### Step 1: Frame the Problem
Capture:
- Business goals
- User personas
- Critical user journeys
- Success metrics (business + technical)
- Constraints (timeline, team, regulatory)

### Step 2: Define Functional Scope
Write a scoped list of capabilities:
- Must-have features (MVP)
- Should-have features
- Future extensions

### Step 3: Define Non-Functional Requirements (NFRs)
At minimum define:
- Latency targets (p50/p95/p99)
- Availability targets
- Data correctness requirements
- Security requirements
- Compliance obligations
- Cost boundaries

### Step 4: Model Domain and Data
Create:
- Domain entities
- State transitions
- Ownership boundaries
- Invariants (what must never break)

### Step 5: Design Architecture
Pick:
- System style (modular monolith / microservices)
- API style (REST/GraphQL/gRPC)
- Data architecture (SQL/NoSQL/cache/search)
- Async patterns (queues/events)

### Step 6: Define Operability
Specify:
- Logging/metrics/tracing
- Alerting and runbooks
- Failure handling and rollback
- On-call ownership model

### Step 7: Validate Through Risk Review
Run structured review:
- Security risks
- Scalability risks
- Data integrity risks
- Delivery risks

## 4. Requirements Engineering for Architects

### 4.1 Functional Requirements
Each requirement should include:
- Trigger/action
- Preconditions
- Expected behavior
- Failure behavior

Bad requirement:
- "System should be fast"

Good requirement:
- "Checkout API p95 latency must be under 300ms at 1,000 RPS with 95% cache hit ratio"

### 4.2 NFRs as First-Class Citizens
You must make NFRs measurable and testable.

Example NFR set:
- Availability: 99.9% monthly for user-facing APIs
- Read latency: p95 < 200ms
- Write latency: p95 < 350ms
- Data loss tolerance: RPO <= 5 minutes
- Recovery time objective: RTO <= 30 minutes

### 4.3 Constraint Catalog
Track explicit constraints:
- Team skill profile
- Legacy dependencies
- Region and data residency rules
- Third-party integration limitations

## 5. Capacity Planning and Estimation

### 5.1 Throughput Estimation
Estimate:
- Daily active users
- Peak concurrent users
- Requests per user per minute

Formula:
- Peak RPS = Peak users * avg requests per second per user

### 5.2 Storage Estimation
Estimate:
- Record size
- Writes per day
- Retention duration
- Index overhead

Formula:
- Yearly storage ~= write_per_day * avg_record_size * 365 * growth_factor

### 5.3 Bandwidth Estimation
Estimate by endpoint:
- request payload size
- response payload size
- peak RPS

### 5.4 Headroom Policy
Always plan:
- 2x short-term burst headroom
- 3x migration/sale-event headroom for critical systems

## 6. Architecture Style Decisions

### 6.1 Modular Monolith vs Microservices

Use modular monolith when:
- Team size is small/medium
- Domain is still evolving
- Operational maturity is low

Use microservices when:
- Team ownership boundaries are clear
- Independent scaling/deployment is required
- Platform tooling is mature

### 6.2 Recommended Default
Start modular with strict boundaries.
Extract services only when one of these is true:
- Clear scaling bottleneck
- Distinct release cadence
- Hard boundary needed for security/compliance

### 6.3 Domain Decomposition
Use domain-driven boundaries:
- Identity/Auth
- Catalog
- Orders
- Payments
- Notifications
- Analytics

Avoid decomposition by technical layers only.

## 7. API Design Strategy

### 7.1 REST Design Rules
- Resource-oriented endpoints
- Proper HTTP semantics
- Idempotency where needed
- Consistent error format

Example error envelope:
```json
{
  "code": "ORDER_VALIDATION_FAILED",
  "message": "Delivery address is required",
  "traceId": "...",
  "details": [{"field": "deliveryAddress", "reason": "missing"}]
}
```

### 7.2 GraphQL Use Cases
Prefer GraphQL when:
- UI needs flexible aggregation across entities
- Multiple clients require shape-specific responses

Risks:
- Query cost explosion
- Complex authorization logic

### 7.3 API Versioning
Choose a strategy:
- URI versioning (`/v1/...`)
- Header versioning

Rules:
- No silent breaking changes
- Deprecation window with migration guide

### 7.4 Idempotency
Critical write endpoints must support idempotency keys:
- Payments
- Order creation
- Inventory reservations

## 8. Frontend Architecture

### 8.1 Boundary Model
Separate:
- Server state (remote API data)
- Client app state (auth/session/cart/preferences)
- Local UI state (modals, input text)

### 8.2 Frontend System Design Checklist
- Routing strategy
- Design system/component library
- Error boundaries
- Loading/skeleton policies
- Accessibility requirements
- Internationalization plan

### 8.3 Rendering Strategy
Choose based on use case:
- CSR for authenticated app flows
- SSR/SSG for SEO-sensitive public pages
- Streaming SSR for fast first paint on heavy pages

### 8.4 Frontend Performance Budget
Set and enforce:
- JS bundle size budget
- Time to interactive
- Largest contentful paint
- Interaction latency

### 8.5 Frontend Security
- CSP policy
- XSS-safe rendering rules
- CSRF controls
- Secure token/session storage strategy

## 9. Backend Service Architecture

### 9.1 Service Layering
Recommended logical layers:
- Transport layer (controllers)
- Application layer (use cases)
- Domain layer (rules/invariants)
- Infrastructure layer (DB, cache, brokers)

### 9.2 Request Lifecycle Pattern
1. Validate request
2. Authorize action
3. Execute domain operation
4. Persist state
5. Publish side effects
6. Return deterministic response

### 9.3 Concurrency Control
Use:
- Optimistic locking for low-contention entities
- Pessimistic locking for high-contention critical paths
- Queue serialization where appropriate

### 9.4 Timeouts and Retries
Define for each dependency:
- Timeout
- Retry count
- Backoff policy
- Circuit breaker behavior

## 10. Data Architecture

### 10.1 SQL vs NoSQL Decision
Choose SQL when:
- Strong consistency and joins are core
- Transactions are critical

Choose NoSQL when:
- High-scale flexible schema use case
- Access patterns are document/key based

### 10.2 Polyglot Persistence Pattern
Common architecture:
- SQL for transactions
- Redis for cache/session
- Search index for text queries
- Object storage for files/media

### 10.3 Schema Evolution
Use expand-contract:
1. Add backward-compatible schema
2. Dual-read/write if needed
3. Backfill
4. Cut over
5. Remove legacy path

### 10.4 Data Integrity Rules
Define invariants explicitly:
- Order total must equal item totals + charges - discounts
- Payment status transitions are monotonic
- Inventory cannot go below zero (unless backorder policy exists)

## 11. Caching Strategy

### 11.1 Cache Layers
- CDN edge cache
- API response cache
- Data object cache
- Query cache

### 11.2 Invalidation Patterns
- TTL-based
- Event-based invalidation
- Write-through / write-around

### 11.3 Anti-Patterns
- Cache as source of truth
- Global cache flush for local change
- No observability on cache hit/miss

### 11.4 Cache KPI Targets
- Hit ratio by endpoint
- Stale read incidents
- Cache rebuild latency

## 12. Asynchronous Architecture

### 12.1 Use Cases
- Notifications
- Analytics events
- Report generation
- Search indexing
- Fraud checks (non-blocking path)

### 12.2 Delivery Semantics
- At-most-once
- At-least-once
- Effectively-once (via idempotency)

### 12.3 Queue Design Rules
- Message schema versioning
- Dead-letter queues
- Retry and poison-message policy
- Consumer idempotency guarantees

### 12.4 Event-Driven Contracts
Treat events as public contracts:
- schema registry
- backward compatibility rules
- ownership and lifecycle

## 13. Real-Time System Design

### 13.1 When to Use WebSockets
Use for:
- Live tracking
- Collaboration
- Market/live feed dashboards

### 13.2 Real-Time Architecture Concerns
- Connection scaling
- Stateful session mapping
- Fanout model
- Backpressure
- Reconnect behavior

### 13.3 Fallback Strategy
Always provide fallback:
- polling / long polling
- cached latest state

## 14. Security Architecture

### 14.1 Threat Modeling Baseline
Model threats by STRIDE or equivalent:
- Spoofing
- Tampering
- Repudiation
- Information disclosure
- Denial of service
- Elevation of privilege

### 14.2 AuthN and AuthZ
- Authentication model: session vs token
- Authorization model: RBAC + ABAC for resource constraints
- Privileged operation auditing

### 14.3 Secrets and Key Management
- Never hardcode secrets
- Use centralized secret manager
- Rotate credentials
- Scope least privilege

### 14.4 Data Protection
- Encrypt in transit (TLS)
- Encrypt at rest where needed
- PII minimization
- Data retention and deletion policy

### 14.5 AppSec Controls
- Input validation
- Output encoding
- Rate limits
- WAF where appropriate
- Dependency vulnerability scanning

## 15. Reliability and Resilience

### 15.1 Failure Modes You Must Design For
- Dependency outage
- Partial network partitions
- Slow dependency (tail latency)
- Message backlog growth
- Corrupt data and replay anomalies

### 15.2 Resilience Patterns
- Circuit breaker
- Bulkhead isolation
- Timeout + retry with jitter
- Graceful degradation
- Load shedding

### 15.3 Data Recovery Strategy
- Backups with restore drills
- Replication/failover
- Regional DR strategy
- RTO/RPO validation

## 16. Observability and Operability

### 16.1 Three Pillars
- Logs: structured, queryable, trace-linked
- Metrics: RED + saturation
- Traces: cross-service latency visibility

### 16.2 Minimum Production Dashboard
- Request rate
- Error rate by endpoint/code
- Latency p50/p95/p99
- CPU/memory saturation
- Queue depth/lag
- DB health and connection utilization

### 16.3 Alerting Rules
- Alert on user impact, not noise
- Define severity tiers
- Include runbook links

### 16.4 Runbooks
Each critical service must have:
- top incidents
- triage sequence
- rollback steps
- escalation contacts

## 17. Delivery Architecture (CI/CD)

### 17.1 Pipeline Stages
1. Lint/static checks
2. Unit tests
3. Integration tests
4. Security scans
5. Build artifact
6. Deploy to staging
7. Smoke tests
8. Progressive production rollout

### 17.2 Deployment Strategies
- Blue/green
- Canary
- Rolling

### 17.3 Release Controls
- Feature flags
- Kill switches
- Automated rollback on SLO breach

## 18. Testing Strategy for Fullstack Systems

### 18.1 Testing Pyramid
- Unit tests (fast, many)
- Integration tests (moderate)
- E2E tests (few, critical journeys)

### 18.2 Contract Testing
- Provider/consumer contract validation
- Schema and version checks

### 18.3 Non-functional Test Suites
- Load tests
- Stress tests
- Soak tests
- Chaos/failure-injection tests

### 18.4 Release Test Gates
Define gates per milestone:
- Functional coverage threshold
- Regression pass threshold
- Non-functional KPI threshold

## 19. Performance Engineering

### 19.1 Performance Triage Workflow
1. Identify top slow endpoints
2. Analyze query and dependency time
3. Remove unnecessary work
4. Add caching/index/async where justified
5. Re-benchmark and compare

### 19.2 Backend Optimization Levers
- DB index tuning
- Query plan optimization
- Payload reduction
- Async offloading

### 19.3 Frontend Optimization Levers
- Code splitting
- Prefetch and caching
- Image optimization
- Render path reduction

## 20. Cost Architecture

### 20.1 Cost Drivers
- Compute runtime
- Database IOPS/storage
- Egress traffic
- Third-party API usage
- Logging/observability ingestion volume

### 20.2 Cost Controls
- Right-size infra
- Tiered storage lifecycle
- Sampling for verbose telemetry
- API call deduplication and batching

### 20.3 Cost Reviews
Run monthly architecture cost review:
- Cost per user/request
- Unused resources
- Regression since last review

## 21. Migration and Modernization

### 21.1 Legacy Decomposition Strategy
- Strangler pattern
- Interface adapters
- Incremental capability extraction

### 21.2 Data Migration Safety
- Expand-contract schema
- Backfill with checkpoints
- Rollback strategy

### 21.3 Modernization Risk Controls
- Shadow traffic validation
- Feature-flagged cutover
- Side-by-side metric comparison

## 22. Design Review Template (Use This)

### 22.1 Problem Statement
- What problem are we solving?
- Why now?

### 22.2 Scope
- In scope
- Out of scope

### 22.3 Requirements
- Functional requirements
- NFR targets

### 22.4 Architecture Proposal
- Component diagram
- Data flow
- Sequence diagram for critical path

### 22.5 Data Model
- Entities and ownership
- Transaction boundaries
- Consistency model

### 22.6 Failure and Security Analysis
- Top failure modes
- Threat model summary
- Mitigation plan

### 22.7 Operability Plan
- Metrics and alerts
- Runbooks
- On-call ownership

### 22.8 Delivery Plan
- Milestones
- Migration approach
- Rollout plan

### 22.9 Decision Log
- Alternatives considered
- Why chosen
- Tradeoffs accepted

## 23. Architecture Decision Record (ADR) Template

```md
# ADR-XXX: <Decision Title>
Date: YYYY-MM-DD
Status: Proposed | Accepted | Superseded

## Context
<Problem context and constraints>

## Decision
<What was decided>

## Alternatives
1. <Alternative A>
2. <Alternative B>

## Consequences
- Positive:
- Negative:

## Rollback/Exit Strategy
<How to change this later safely>
```

## 24. Fullstack Architecture Blueprint (Reference)

### 24.1 Reference Topology
- Web frontend + mobile app
- API gateway/BFF
- Domain services
- SQL transactional DB
- Redis cache/session
- Message broker
- Search index
- Object storage
- Observability stack

### 24.2 Request Path Example (Checkout)
1. Client submits checkout
2. API validates + authorizes
3. Order service creates order with idempotency key
4. Payment intent initiated
5. Transactional data committed
6. Event published (`order.created`)
7. Async consumers trigger notifications, analytics, indexing
8. Client gets deterministic response

### 24.3 Failure Behavior Example
If payment provider times out:
- return pending status (if business allows)
- queue reconciliation task
- notify user with status semantics
- never duplicate charge on retry

## 25. Domain-Specific Checklists

### 25.1 E-commerce / Ordering Systems
- Inventory consistency strategy
- Payment idempotency
- Order state machine correctness
- Refund/reversal semantics

### 25.2 SaaS B2B Systems
- Tenant isolation model
- RBAC/ABAC policy model
- Audit trail coverage
- Data residency handling

### 25.3 Real-Time Collaboration Systems
- Presence and session mapping
- Conflict resolution model
- Event ordering guarantees
- Offline conflict sync strategy

## 26. Common Architecture Pitfalls

1. Building microservices too early
2. No measurable NFRs
3. Missing idempotency in critical writes
4. Cache strategy without invalidation ownership
5. Incomplete threat model
6. No contract testing
7. Weak observability and no runbooks
8. Release without objective gates

## 27. What “Good” Looks Like in Production

A mature fullstack architecture shows:
- Stable latency and error budgets
- Fast incident detection and recovery
- Low defect leakage
- Predictable release cadence
- Clear ownership boundaries
- Controlled cloud cost trajectory

## 28. 90-Day Architect Improvement Plan

### Days 1-30
- Audit current architecture and NFRs
- Build service dependency map
- Define top 10 production risks

### Days 31-60
- Implement observability gaps
- Add release gates and ADR discipline
- Fix highest-risk data/security patterns

### Days 61-90
- Improve one critical journey end-to-end
- Establish architecture review routine
- Publish architecture standards playbook

## 29. Interview Use: How to Answer System Design Questions

Use this sequence:
1. Clarify scope and constraints
2. Define functional + NFR targets
3. Provide high-level architecture
4. Dive into data model and critical flows
5. Explain scaling, reliability, and security
6. Explain tradeoffs and phased rollout
7. Close with observability and operations

## 30. Final Notes
A fullstack architect succeeds by balancing business speed with engineering correctness.

Keep every major decision:
- Explicit
- Measurable
- Traceable
- Reversible

If a design cannot be operated confidently, it is incomplete.
