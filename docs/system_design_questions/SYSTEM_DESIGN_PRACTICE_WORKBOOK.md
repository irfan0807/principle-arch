# System Design Practice Workbook (Hands-on)

## 1. How to Use This Workbook
For each exercise:
1. Spend 10 minutes clarifying requirements and assumptions.
2. Spend 10 minutes estimating scale and NFRs.
3. Spend 15 minutes drawing architecture.
4. Spend 10 minutes deep-diving data + failure handling.
5. Spend 5 minutes tradeoffs and rollout plan.

Deliverable per exercise:
- 1 architecture diagram
- 1 critical sequence flow
- 1 data model summary
- 1 risk register
- 1 release readiness checklist

---

## 2. Foundational Exercises

### Exercise 1: URL Shortener
Focus:
- Key generation strategy
- Read-heavy optimization
- Cache and DB consistency

### Exercise 2: Rate Limiter Service
Focus:
- Token bucket/sliding window
- Distributed state storage
- Accuracy vs performance tradeoffs

### Exercise 3: Notification Service
Focus:
- Queue-based fanout
- Retry and DLQ
- Channel abstraction (email/SMS/push)

### Exercise 4: File Upload Service
Focus:
- Pre-signed URLs
- Virus scan pipeline
- Metadata consistency

### Exercise 5: Search Suggest API
Focus:
- Index freshness
- Prefix/typo tolerance
- Cache invalidation strategy

---

## 3. Intermediate Fullstack Exercises

### Exercise 6: E-commerce Checkout
Focus:
- Order state machine
- Payment idempotency
- Inventory reservation strategy

### Exercise 7: Multi-tenant SaaS RBAC
Focus:
- Tenant boundary enforcement
- Policy engine design
- Audit log design

### Exercise 8: Real-time Order Tracking
Focus:
- WebSocket scaling
- Event ordering
- Reconnect/resync model

### Exercise 9: Chat System
Focus:
- Message delivery semantics
- Presence tracking
- Storage partitioning

### Exercise 10: Analytics Pipeline
Focus:
- Event ingestion
- Stream processing
- Late/out-of-order events

---

## 4. Advanced Exercises

### Exercise 11: Fintech Transfer Platform
Focus:
- Ledger consistency
- Saga compensation
- Reconciliation design

### Exercise 12: Feature Flag Platform
Focus:
- Rule evaluation latency
- Consistency of config propagation
- Blast radius controls

### Exercise 13: Distributed Job Scheduler
Focus:
- Exactly-once vs at-least-once tradeoffs
- Leasing and worker heartbeats
- Retry and backoff behavior

### Exercise 14: Global Content Delivery System
Focus:
- Multi-region strategy
- CDN caching policy
- Data residency constraints

### Exercise 15: Social Feed Architecture
Focus:
- Fanout-on-write vs fanout-on-read
- Ranking and freshness
- Hot key mitigation

---

## 5. Review Rubric (Score 1-5)

### Problem Framing
- Clear scope and assumptions
- Correct prioritization of user journeys

### NFR Definition
- Measurable latency/availability targets
- Realistic scale assumptions

### Architecture Quality
- Correct component boundaries
- Good data and async design choices

### Reliability/Security
- Failure modes addressed
- Auth/security boundaries explicit

### Operability
- Metrics, alerts, runbooks covered
- Rollout and rollback defined

### Tradeoff Clarity
- Alternatives discussed
- Final choices justified

---

## 6. Failure Injection Prompts
Use these in every exercise:
1. Database unavailable for 30s
2. Cache cluster degraded
3. Message broker lag spike
4. Third-party API timeout surge
5. Duplicate client retries
6. Partial region outage
7. Sudden 10x traffic burst

For each prompt answer:
- How system behaves
- User impact
- Mitigation path
- Recovery timeline

---

## 7. Capacity Estimation Practice Sheet
For each design estimate:
- Peak RPS
- Read/write split
- Data per record
- Daily writes
- Yearly storage growth
- Cache memory needs
- Queue throughput and lag budget

---

## 8. Weekly Practice Plan (8 Weeks)

### Week 1
- 2 foundational exercises
- focus on clean requirement clarifications

### Week 2
- 2 foundational exercises
- focus on scaling calculations

### Week 3
- 2 intermediate exercises
- focus on data model and consistency

### Week 4
- 2 intermediate exercises
- focus on failure handling

### Week 5
- 2 advanced exercises
- focus on security and compliance

### Week 6
- 2 advanced exercises
- focus on observability and rollout

### Week 7
- 3 timed mock sessions (45 minutes each)

### Week 8
- redesign two older solutions after critique

---

## 9. Portfolio Output Template
For each completed design keep:
- 1-page problem statement
- architecture diagram
- sequence diagram
- key tradeoff table
- incident/failure plan
- final review score

This becomes your system design portfolio.

---

## 10. Final Guidance
Practice quality matters more than quantity.

A strong answer is:
- structured,
- explicit on assumptions,
- resilient under failures,
- and measurable in production.
