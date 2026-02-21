# 00 - Legal, Ethics, and Scope

## Core Rules
- Always get explicit authorization.
- Stay inside scope defined by program/pentest contract.
- Follow local laws and platform policies.
- Do not exfiltrate sensitive data.
- Use minimum-impact validation.

## Authorization Checklist
- Written permission is available.
- Scope list is documented.
- Out-of-scope assets are documented.
- Test windows and rate limits are known.
- Emergency/security contact exists.

## Safe Testing Principles
- Prefer read-only checks where possible.
- Never modify production data unless explicitly allowed.
- Never run destructive payloads.
- Stop and report immediately if you see real customer data.

## Typical Out-of-Scope Areas
- Social engineering unless explicitly allowed.
- Physical attacks.
- Denial-of-service.
- Spam, phishing, and service disruption.

## Severity and Risk Framing
- Use CVSS as reference, but explain business impact in plain language.
- Prioritize exploitability + impact + prevalence.
- Show clear steps to reproduce and fix.
