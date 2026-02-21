# System Design Master Learning Guide (Complete)

## 1. Purpose
This guide is a complete end-to-end curriculum to learn system design from foundations to architect-level decision making.

It covers:
- Fundamentals (latency, scalability, consistency, reliability)
- Architecture patterns and tradeoffs
- Data and distributed systems design
- Security, observability, operations, and cost
- Domain-specific architecture thinking
- Interview strategy and practical project execution

Use this with:
- `docs/FULLSTACK_SYSTEM_DESIGN_GUIDE.md`
- `docs/FULLSTACK_SYSTEM_DESIGN_DOMAIN_PLAYBOOKS.md`
- `docs/FULLSTACK_SYSTEM_DESIGN_DIAGRAM_FIRST.md`
- `docs/SYSTEM_DESIGN_PRACTICE_WORKBOOK.md`
- `docs/SYSTEM_DESIGN_INTERVIEW_ANSWER_FRAMEWORKS.md`

---

## 2. What System Design Actually Is
System design is the discipline of creating software systems that satisfy:
- Functional requirements (what it does)
- Non-functional requirements (how well it does it)

A good design is not the most complex design.
A good design is one that is:
- Correct for the business goals
- Simple enough for the team
- Resilient under failure
- Scalable under growth
- Observable in production
- Evolvable over time

---

## 3. Prerequisites You Need

### 3.1 Engineering basics
- HTTP and networking basics
- SQL and NoSQL basics
- APIs and service design
- Basic OS and process concepts
- Caching and queues fundamentals

### 3.2 Product thinking
- User journey understanding
- Business KPI awareness
- Priority and scope management

### 3.3 Operations mindset
- Monitoring and alerting basics
- Failure analysis habits
- Release and rollback discipline

---

## 4. Learning Outcomes
By completing this material, you should be able to:
1. Clarify problem scope and ask the right questions.
2. Estimate traffic, storage, and throughput needs.
3. Produce a high-level architecture quickly.
4. Deep-dive into API, data, scaling, security, and reliability.
5. Explain tradeoffs and justify decisions.
6. Define production readiness criteria.

---

## 5. System Design Thinking Framework

### Step 1: Clarify the problem
Ask:
- Who are users?
- What are critical use cases?
- What is in scope and out of scope?
- What are success metrics?

### Step 2: Define NFRs early
Explicitly define:
- Latency targets (p50/p95/p99)
- Availability targets
- Data correctness requirements
- Security/compliance constraints
- Budget constraints

### Step 3: Capacity estimation
Estimate:
- Daily active users
- Peak QPS/RPS
- Read/write ratio
- Data growth and retention

### Step 4: High-level architecture
Draw:
- Client layer
- API layer
- Service/domain layer
- Data/storage layer
- Async/event layer
- Infra/ops layer

### Step 5: Deep dive into critical path
Pick one flow (e.g., checkout, post creation, transfer) and design:
- Request lifecycle
- State transitions
- Failure handling
- Idempotency and consistency behavior

### Step 6: Risk analysis
Identify top risks:
- Availability bottlenecks
- Data race/corruption risks
- Security attack surfaces
- Cost hot spots

### Step 7: Operability and rollout
Define:
- Metrics and alerts
- Runbooks
- Progressive rollout and rollback strategy

---

## 6. Core Concepts You Must Master

### 6.1 Latency vs throughput
- Latency: time for one request
- Throughput: amount processed per second

You can have high throughput and bad latency (queue backlog), so measure both.

### 6.2 Availability and reliability
- Availability: service reachable and usable
- Reliability: correctness over time

A system can be available but wrong. Reliability includes correctness.

### 6.3 Scalability
- Vertical scaling: bigger machine
- Horizontal scaling: more machines

Default strategy: design stateless services and scale horizontally.

### 6.4 Consistency models
- Strong consistency
- Eventual consistency
- Session/read-your-write consistency

Choose based on business impact of stale reads.

### 6.5 CAP and PACELC intuition
For distributed data:
- During partition: choose consistency or availability behavior
- Else: trade latency vs consistency/coordination

### 6.6 Fault tolerance
Design for:
- Dependency failures
- Timeout storms
- Retries causing overload
- Partial and regional outages

### 6.7 Idempotency
Mandatory for critical writes:
- Payments
- Orders
- Account mutations

### 6.8 Backpressure
System must control intake when downstream is saturated.

---

## 7. Networking and Protocol Fundamentals

### 7.1 HTTP design basics
- Proper verbs
- Status codes
- Pagination/filtering standards
- Error envelope consistency

### 7.2 REST vs GraphQL vs gRPC
- REST: simple and broad interoperability
- GraphQL: client-specific flexible reads
- gRPC: internal low-latency service communication

### 7.3 Timeouts/retries/circuit breakers
Define per dependency:
- Timeout
- Retry count with backoff+jitter
- Circuit open/half-open strategy

### 7.4 Rate limiting
Use layered limits:
- IP level
- User level
- Endpoint sensitivity level

---

## 8. Data Design Foundations

### 8.1 Data modeling workflow
1. List entities
2. Define relationships
3. Define invariants
4. Define access patterns
5. Choose storage technology

### 8.2 SQL design essentials
- Normalization vs selective denormalization
- Index strategy tied to query shape
- Transaction boundaries
- Deadlock and lock contention awareness

### 8.3 NoSQL design essentials
- Model for access pattern
- Shard key strategy
- Document growth constraints
- Secondary index tradeoffs

### 8.4 Polyglot persistence
Common production pattern:
- SQL for transactional truth
- Redis for cache/session
- Search index for discovery
- Object storage for large files

### 8.5 Migration safety
Use expand-contract:
- additive schema
- dual path
- backfill
- cutover
- cleanup

---

## 9. Caching Architecture

### 9.1 Cache layers
- Browser/CDN
- API cache
- Object cache
- Query cache

### 9.2 Invalidation strategies
- TTL based
- Event-based
- Write-through/write-around

### 9.3 Cache anti-patterns
- Cache as source of truth
- Global flush by default
- No stale data monitoring

### 9.4 Cache KPIs
- Hit ratio
- Miss penalty
- Stale-read incident rate

---

## 10. Async and Event-Driven Architecture

### 10.1 When to go async
- Non-critical side effects
- Spiky workloads
- Long-running jobs

### 10.2 Queue design essentials
- Idempotent consumers
- DLQ handling
- Retry policy by error class
- Schema versioning

### 10.3 Outbox pattern
Use outbox for reliable event publication with transactional integrity.

### 10.4 Saga pattern
For distributed workflows requiring compensation across services.

---

## 11. Security by Architecture

### 11.1 Security baseline
- Strong authN
- Fine-grained authZ
- Input validation and output encoding
- Transport encryption
- Secret management

### 11.2 Threat modeling process
- List assets and trust boundaries
- Identify threats
- Rank by likelihood/impact
- Map mitigation controls

### 11.3 Security operations
- Vulnerability scans in CI
- Key rotation policy
- Audit logs for sensitive actions

---

## 12. Reliability and SRE Foundations

### 12.1 SLO/SLA/Error budget
- SLO: internal reliability target
- SLA: external contractual target
- Error budget: allowed failure window

### 12.2 Reliability patterns
- Timeout + retry + jitter
- Circuit breaker
- Bulkhead
- Graceful degradation
- Load shedding

### 12.3 DR planning
- Define RTO/RPO
- Backup and restore drills
- Regional failover strategy

---

## 13. Observability and Operations

### 13.1 Pillars
- Logs (structured)
- Metrics (RED + saturation)
- Traces (distributed flow)

### 13.2 Production dashboard minimum
- Request rate
- Error rate
- Latency percentiles
- Queue lag
- DB health
- Resource saturation

### 13.3 Alerting principles
- Alert on user impact
- Include context and runbook
- Reduce noisy alerts

---

## 14. CI/CD and Release Design

### 14.1 Pipeline baseline
1. Lint/static checks
2. Unit tests
3. Integration tests
4. Security checks
5. Build artifact
6. Staging deploy
7. Smoke tests
8. Progressive production rollout

### 14.2 Deployment models
- Rolling
- Blue/green
- Canary

### 14.3 Safety controls
- Feature flags
- Kill switches
- Auto rollback on SLO breach

---

## 15. System Design by Domain (Quick Lens)

### E-commerce
Focus:
- Checkout correctness
- Inventory consistency
- Payment idempotency

### SaaS
Focus:
- Tenant isolation
- RBAC/ABAC
- Auditability

### Fintech
Focus:
- Ledger integrity
- Exactly-once effects
- Compliance and reconciliation

### Social
Focus:
- Feed latency and scale
- Realtime fanout
- Moderation and abuse controls

Use `docs/FULLSTACK_SYSTEM_DESIGN_DOMAIN_PLAYBOOKS.md` for deep domain versions.

---

## 16. Interview-Ready Design Process

### 16.1 45-minute interview flow
- 5 min: clarify scope and constraints
- 5 min: estimate scale and NFRs
- 10 min: draw high-level architecture
- 15 min: deep dive critical components
- 5 min: scaling + reliability + security
- 5 min: tradeoffs and evolution plan

### 16.2 Strong answer qualities
- Structured thinking
- Clear assumptions
- Honest tradeoffs
- Production realism

---

## 17. Common Mistakes and How to Avoid Them

1. Skipping NFRs
- Fix: define measurable targets first

2. Over-engineering too early
- Fix: design for current scope + clear evolution path

3. Ignoring failure paths
- Fix: include failure handling in every critical flow

4. No data integrity strategy
- Fix: define invariants and idempotency explicitly

5. No operability plan
- Fix: define metrics, alerts, runbooks before release

---

## 18. 12-Week Learning Plan (Complete)

### Weeks 1-2: Foundations
- Core concepts: latency, throughput, availability, consistency
- Practice: redesign a simple CRUD service with NFRs

### Weeks 3-4: Data + APIs
- SQL/NoSQL tradeoffs, indexing, API design
- Practice: design order + inventory + payment APIs

### Weeks 5-6: Scalability + Async
- Caching, queues, outbox, saga
- Practice: convert sync side-effects to async pipeline

### Weeks 7-8: Security + Reliability
- Threat modeling, auth models, resilience patterns
- Practice: add failure handling matrix to existing design

### Weeks 9-10: Observability + Operations
- Metrics, tracing, alerting, runbooks, CI/CD
- Practice: build release gate checklist

### Weeks 11-12: Domain Simulation + Interviews
- Domain-specific case studies
- Practice: 6 timed mock design interviews

---

## 19. Study Materials and References

### 19.1 Must-learn concepts
- Distributed systems basics
- Database internals (indexes, locking, replication)
- Caching and message queues
- Security fundamentals

### 19.2 Recommended resource types
- Engineering blogs from large-scale platforms
- Official database and cloud architecture docs
- Real postmortems and incident writeups

### 19.3 Practice style
- Time-boxed whiteboard practice
- Tradeoff-focused retrospectives
- Production incident reverse design exercises

---

## 20. Architecture Review Checklist (Reusable)

### Problem and Scope
- Is scope explicit and bounded?
- Are critical user journeys identified?

### NFRs
- Are latency/availability/cost targets measurable?

### Data and Consistency
- Are invariants explicit?
- Are transaction/idempotency boundaries clear?

### Reliability
- Are failure modes mapped to mitigations?

### Security
- Are trust boundaries and authZ checks explicit?

### Operability
- Are metrics/alerts/runbooks complete?

### Evolution
- Is there a phased migration plan?

---

## 21. Final Guidance
To truly learn system design, do not only read.

You must iterate this loop:
1. Design
2. Critique
3. Simulate failures
4. Measure
5. Improve

Architecture maturity comes from disciplined iteration under real constraints.
