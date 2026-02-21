# 03 - Bug Bounty Playbook

## Program Selection
- Prefer mature programs with clear scope and triage history.
- Start with one platform and one target domain.
- Avoid spreading effort across too many programs initially.

## Recon Pipeline
- Asset discovery
- Subdomain discovery
- Tech stack fingerprinting
- Endpoint harvesting
- Historical URL collection
- Parameter mining

## Triage and Prioritization
- Prioritize auth, money flow, admin panels, and integrations.
- Score findings by impact and confidence.
- Avoid duplicate-heavy patterns without new angle.

## Daily Hunting Workflow
1. 20% recon and mapping.
2. 60% hypothesis-driven testing.
3. 20% reporting and knowledge capture.

## Finding Lifecycle
- Hypothesis
- Discovery
- Validation
- Impact statement
- Reproduction steps
- Fix recommendation
- Retest logic

## Avoiding Common Beginner Mistakes
- Submitting weak informational issues.
- Missing clear proof-of-impact.
- Over-automating without manual reasoning.
- Ignoring business logic paths.

## Metrics to Track
- Hours hunted per week
- Unique endpoints tested
- High-confidence findings
- Submission acceptance rate
- Time from finding to report ready
