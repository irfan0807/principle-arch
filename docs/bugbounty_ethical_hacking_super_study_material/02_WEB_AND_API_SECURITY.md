# 02 - Web and API Security (Deep Focus)

## Primary Vulnerability Domains
- Access control (IDOR/BOLA, privilege escalation)
- Injection (SQLi, command injection, template injection)
- XSS (stored, reflected, DOM)
- CSRF
- SSRF
- XXE
- Authentication flaws
- Session management flaws
- Business logic abuse
- File upload issues
- Insecure deserialization
- Security misconfiguration

## API Security Focus
- Broken object-level authorization
- Broken function-level authorization
- Mass assignment
- Excessive data exposure
- Rate limiting and anti-automation gaps
- Token lifecycle weaknesses

## Testing Workflow Per Endpoint
1. Capture baseline request and response.
2. Map identity, role, and object ownership.
3. Mutate identifiers, methods, and parameters.
4. Test auth bypass and privilege transitions.
5. Validate impact using minimum-safe proof.
6. Document exact repro and fix guidance.

## Web Testing Heuristics
- Every user-controlled input is suspicious.
- Every ID can be tampered.
- Every trust decision must be server-side.
- Every hidden feature likely has alternate paths.

## Verification Standards
- Reproducible from clean session.
- Not dependent on unstable environment behavior.
- Impact clear in one sentence.
- Fix recommendation practical and prioritized.
