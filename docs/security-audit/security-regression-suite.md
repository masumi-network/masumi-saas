# Masumi SaaS Security Audit: Security Regression Suite

- Audit date: 2026-04-14
- Target commit: `64345b1a48b12bd570a78f0f8e067aa8156de3fa`

## Current Baseline

- `pnpm lint` passed during the audit.
- `pnpm test` was not a clean baseline in this sandbox because many smoke and e2e tests require localhost access to `127.0.0.1:2999`, which is blocked here.
- Regression work should therefore be added in the repo now, then executed in a normal Node 24 local or staging environment.

## Test Matrix by Finding

### MAS-SEC-001: OIDC bridge auth-method restriction

Add route tests for `apps/web/src/app/api/oidc/spacetimedb/token/route.ts`:

- session cookie auth returns `200`
- API key auth returns `403`
- OIDC bearer auth returns `403`
- unauthenticated request returns `401`
- validation failures still return the expected CORS headers for allowed origins

### MAS-SEC-002: SSRF protections on agent verification fetches

Add unit tests around a new outbound URL validator:

- reject `http://127.0.0.1`
- reject `http://localhost`
- reject `http://[::1]`
- reject RFC1918 IPv4 ranges
- reject IPv6 unique-local/link-local ranges
- reject `169.254.169.254`
- reject DNS names that resolve to blocked ranges
- allow known-safe public hosts

Add route tests for:

- `/api/agents/[agentId]/test-verification-endpoint`
- `/api/credentials/issue`

Expected behavior:

- blocked targets return a deterministic `4xx`
- allowed public targets still reach the fetch helper

### MAS-SEC-003: Token storage hardening

If token storage changes:

- migration tests for old rows to new representation
- positive lookup tests proving hashed or encrypted tokens still authenticate correctly
- negative tests proving raw leaked token material is not stored where hashing is expected
- cleanup tests for expired verification rows if retention changes

### MAS-SEC-004: Browser security headers

Add integration tests covering:

- authenticated app page
- auth page
- public API route
- embedded docs route if it has exceptions

Assert:

- `Content-Security-Policy`
- `Referrer-Policy`
- `X-Content-Type-Options`
- `Permissions-Policy`
- framing policy
- `Strict-Transport-Security` in production-mode tests

### MAS-SEC-005: Trusted-origin narrowing

Add config tests that:

- production config excludes `http://localhost:2999`
- production config excludes `http://127.0.0.1:2999`
- development config can still include local origins
- configured OIDC redirect origins remain allowed

### MAS-SEC-006: Rate-limit policy

Add unit/config tests that:

- production mode without Upstash follows the chosen policy
- if fail-closed: startup/config test throws
- if warn-and-degrade: warning is emitted exactly once and documented
- multi-policy cache keys do not collide across route classes

Add route tests for public surfaces:

- `/api/register/email`
- `/api/v1/agents`
- `/api/v1/agents/[agentId]`
- `/api/v1/agents/verify`
- `/api/health`

Assert:

- rate-limit headers are present
- over-limit behavior is `429`
- invalid pagination or input no longer silently falls back if tightened

### MAS-SEC-007: CI and workflow hygiene

Add repository policy checks for:

- no floating third-party GitHub action tags
- required security workflows present
- explicit workflow permissions present
- Dependabot config present

### MAS-SEC-008: OIDC discovery metadata

Add discovery tests asserting:

- `id_token_signing_alg_values_supported` only advertises intended algorithms
- `code_challenge_methods_supported` matches actual behavior

### MAS-SEC-009: Sumsub webhook malformed signatures

Add route tests for `/api/webhooks/sumsub`:

- missing signature returns `401`
- wrong-length signature returns `401`
- malformed hex returns `401`
- expired timestamp returns `401`
- valid signature and fresh timestamp proceed

## Route Classification Coverage Checklist

The protected surface to keep covered as changes land:

- `/api/agents*`
- `/api/activity*`
- `/api/dashboard/overview`
- `/api/earnings`
- `/api/credits`
- `/api/credentials/*`
- `/api/api-key-status`
- `/api/admin/agents`
- `/api/registry-discovery/*`
- `/api/oidc/spacetimedb/token`
- authenticated `/api/v1/*` proxy routes
- public `/api/v1/agents*`, `/api/v1/openapi`
- `/api/register/email`
- `/api/health`
- `/api/webhooks/sumsub`

## Staging Abuse-Case Suite

Run this only once a staging target exists:

1. Attempt API-key auth against `/api/oidc/spacetimedb/token`.
2. Attempt OIDC bearer auth against `/api/oidc/spacetimedb/token`.
3. Register an agent whose `apiUrl` points to blocked internal targets and confirm SSRF controls hold.
4. Verify security headers through the real ingress and CDN.
5. Exercise public API rate limits across more than one app instance.
6. Replay Sumsub webhooks with expired timestamps and malformed signatures.
7. Verify OIDC discovery metadata against a real relying-party client.
8. Run dependency advisory scanning in CI or a network-enabled environment.

## Execution Notes

- Use Node 24 for reproducible test behavior.
- Treat the current Node 25 sandbox and blocked localhost access as environmental noise, not as a release-quality signal.
- Tie each new regression case back to a finding ID in its test name or comments so the audit trail stays clear.
