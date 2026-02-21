# System Design Interview Answer Frameworks

## 1. Universal 7-Step Answer Structure
Use this for almost every design question:

1. Clarify requirements and scope
2. Define NFRs and constraints
3. Estimate scale
4. Present high-level architecture
5. Deep dive critical components
6. Cover scaling/reliability/security
7. Summarize tradeoffs and roadmap

This keeps answers structured and complete.

---

## 2. Clarifying Question Bank
Ask early:
- Who are the primary users?
- What are core user journeys?
- Is this global or regional?
- What is expected peak traffic?
- Which data requires strong consistency?
- What are compliance/security constraints?
- What is acceptable downtime?

---

## 3. NFR Statement Templates

### Latency template
"For critical endpoint X, target p95 latency under Y ms at Z peak RPS."

### Availability template
"Target availability is A% monthly for customer-facing APIs."

### Consistency template
"Operation X requires strong consistency; operation Y can be eventual."

### Recovery template
"RTO is X minutes and RPO is Y minutes for primary datastore."

---

## 4. Estimation Template (Speak Out Loud)

"Assume 5M DAU, 10% peak concurrency over 1 hour, average 2 actions/min active user.
Peak RPS ~= (500,000 * 2) / 60 ~= 16,600 RPS.
I’ll design for 20k RPS with headroom."

Always show:
- assumptions
- math
- headroom

---

## 5. High-Level Architecture Script

Use this script:
"I’ll split architecture into client, API gateway/BFF, domain services, storage, async/event layer, and operations stack.
Critical path is X.
Non-critical side effects go async through queue/event bus."

---

## 6. Deep Dive Script (Critical Flow)

Example:
"For checkout flow:
1. Validate request
2. Reserve inventory
3. Create order intent with idempotency key
4. Create payment intent
5. Commit transaction
6. Publish outbox event for side effects"

Then add:
- failure branch
- retry behavior
- compensation behavior

---

## 7. Tradeoff Language Templates

Use sentences like:
- "I’m choosing strong consistency here because duplicate/incorrect outcome has financial impact."
- "I’m accepting eventual consistency for feed counters to preserve throughput."
- "I’d start with modular monolith due to team size and extract services at scaling boundaries."
- "I’m using cache-aside because read pattern is dominant and stale window is acceptable."

---

## 8. Domain-Specific Answer Frames

### 8.1 E-commerce
Always mention:
- idempotent checkout
- inventory consistency
- payment callback ordering
- reconciliation jobs

### 8.2 SaaS
Always mention:
- tenant isolation
- authz policy engine
- audit logging
- per-tenant observability

### 8.3 Fintech
Always mention:
- ledger immutability
- exactly-once business effect
- reconciliation
- compliance logs

### 8.4 Social
Always mention:
- feed fanout tradeoff
- realtime delivery
- moderation and abuse controls
- hot-key mitigation

---

## 9. Failure-Mode Discussion Framework
For each critical dependency:
- What if it is slow?
- What if it is down?
- What if responses are duplicated/out-of-order?
- What if partial writes occur?

Then state:
- timeout
- retry/backoff
- fallback
- user-visible behavior

---

## 10. Security Discussion Framework
Mention at least:
- authN and authZ boundaries
- encryption in transit/at rest
- rate limiting and abuse controls
- auditability for sensitive operations

If domain is fintech/health/enterprise, mention compliance explicitly.

---

## 11. Observability Discussion Framework
At minimum mention:
- structured logs + trace IDs
- endpoint latency percentiles
- error rates by type
- dependency health metrics
- alerting with runbooks

---

## 12. Rollout and Migration Framework
Always include:
- canary or phased rollout
- feature flag control
- rollback criteria
- post-deploy validation metrics

---

## 13. 45-Minute Interview Time Management
- 0-5 min: clarify + NFR
- 5-10 min: estimate scale
- 10-20 min: high-level architecture
- 20-35 min: deep dive critical path + data model
- 35-42 min: reliability/security/ops
- 42-45 min: tradeoffs + phased evolution

---

## 14. Common Interview Mistakes
1. Jumping to architecture before requirements
2. No scale estimation
3. No failure handling
4. Ignoring security/compliance
5. No tradeoff explanation
6. No rollout strategy

---

## 15. Mock Interview Prompts
1. Design a global e-commerce checkout platform.
2. Design a multi-tenant B2B SaaS with RBAC.
3. Design a realtime chat + notification service.
4. Design a payment transfer system with audit compliance.
5. Design a social feed at massive scale.

For each prompt, use the 7-step structure.

---

## 16. Final Answer Closing Template
End with:
"To summarize, this design prioritizes X and accepts Y tradeoff.
It meets target NFRs by A/B/C mechanisms.
I’d implement in phases: MVP, scale hardening, and operational optimization,
while monitoring key KPIs and enforcing rollback gates."

This gives a strong architect-level close.
