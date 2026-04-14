# Masumi SaaS Security Audit: Remediation Plan

- Audit date: 2026-04-14
- Target commit: `64345b1a48b12bd570a78f0f8e067aa8156de3fa`

## Immediate Blockers

### 1. Lock the OIDC bridge to browser-session auth only

- Covers: `MAS-SEC-001`
- Scope:
  - `apps/web/src/app/api/oidc/spacetimedb/token/route.ts`
  - tests for bridge auth-method rejection
- Implementation:
  - Reject `authContext.authMethod !== "session"`.
  - Return `403` with a clear error for API key and OIDC bearer callers.
  - Update docs/OpenAPI text to match actual behavior.
- Acceptance criteria:
  - Cookie-backed session succeeds.
  - API key and OIDC access token both fail.
  - Existing browser client flow keeps working.

### 2. Add SSRF defenses around agent verification fetches

- Covers: `MAS-SEC-002`
- Scope:
  - `apps/web/src/lib/agent-verification.ts`
  - any helper introduced for outbound URL validation
  - routes that invoke agent verification
- Implementation:
  - Validate scheme and host before fetch.
  - Resolve DNS and block loopback, RFC1918, link-local, unique-local IPv6, and metadata addresses.
  - Re-run validation after resolution if redirects are allowed; ideally disable redirects or validate each hop.
  - Keep short outbound timeouts.
- Acceptance criteria:
  - Public internet hosts still work.
  - Localhost, private ranges, and metadata targets are blocked.
  - Error path is explicit and testable.

## Short-Term Hardening

### 3. Narrow production `trustedOrigins`

- Covers: `MAS-SEC-005`
- Scope:
  - `apps/web/src/lib/auth/auth.ts`
- Implementation:
  - Move localhost origins behind a development-only branch.
  - Keep production origins sourced from env-backed configuration only.
- Acceptance criteria:
  - Production-mode config excludes localhost.
  - Development-mode config still supports local auth flows.

### 4. Add a repo-owned browser security header baseline

- Covers: `MAS-SEC-004`
- Scope:
  - `apps/web/next.config.ts` or middleware/proxy layer
  - tests for page and route headers
- Implementation:
  - Define CSP, HSTS for production, Referrer-Policy, X-Content-Type-Options, Permissions-Policy, and framing policy.
  - Treat embedded docs routes separately if they need exceptions.
- Acceptance criteria:
  - Authenticated app pages and auth pages consistently emit the header set.
  - Any deliberate exception is isolated and documented.

### 5. Remove misleading OIDC algorithm metadata

- Covers: `MAS-SEC-008`
- Scope:
  - `apps/web/src/lib/config/oidc.config.ts`
- Implementation:
  - Advertise only the signing algorithms the issuer really supports.
- Acceptance criteria:
  - Discovery endpoint no longer lists `none` unless intentionally supported.

### 6. Make malformed Sumsub signatures fail closed with `401`

- Covers: `MAS-SEC-009`
- Scope:
  - `apps/web/src/lib/sumsub/client.ts`
  - `apps/web/src/app/api/webhooks/sumsub/route.ts`
- Implementation:
  - Validate signature format and expected length before calling `timingSafeEqual`.
  - Always return `401` for malformed or invalid signatures.
- Acceptance criteria:
  - Malformed signatures no longer cause `500`.

## Structural Data and Secret Hardening

### 7. Reduce plaintext bearer material in the database

- Covers: `MAS-SEC-003`
- Scope:
  - auth storage strategy, Prisma schema expectations, and any framework adapters or wrappers
- Implementation:
  - Prefer hashed storage for session tokens, API keys, and OIDC access/refresh tokens where runtime support exists.
  - Encrypt provider tokens that must remain retrievable.
  - Minimize lifetime of verification rows and document retained raw values that cannot yet be changed.
  - If framework limits block a complete change, write a compensating-control document and track the remaining risk explicitly.
- Acceptance criteria:
  - New token storage design is documented.
  - Any migration path is defined before rollout.
  - Residual plaintext cases are justified and time-bounded.

### 8. Make distributed rate limiting a production requirement

- Covers: `MAS-SEC-006`
- Scope:
  - `apps/web/src/lib/api/rate-limit.ts`
  - deployment docs / env examples
- Implementation:
  - Decide whether production should fail startup or emit a hard warning when Upstash config is missing.
  - Update docs and examples so multi-instance deployments do not silently rely on in-memory rate limiting.
- Acceptance criteria:
  - Production policy is explicit and tested.
  - Operators cannot miss the shared-store requirement.

## CI and Supply-Chain Hygiene

### 9. Add security automation and harden workflows

- Covers: `MAS-SEC-007`
- Scope:
  - `.github/workflows/*`
  - `.github/dependabot.yml` if added
- Implementation:
  - Add Dependabot for npm and GitHub Actions.
  - Add CodeQL or equivalent SAST.
  - Pin third-party actions to commit SHAs.
  - Set explicit workflow permissions in each workflow.
  - Review `claude.yml` for minimum required trust and document why it needs any elevated capability.
- Acceptance criteria:
  - Security workflows are present and green.
  - Floating third-party action tags are removed.

## Validation and Rollout

### Repo-first validation

- Run `pnpm lint`.
- Run the route and unit tests added for each remediation.
- Re-run the relevant smoke suite in a local or staging environment with Node 24, not the current Node 25 sandbox.

### Staging follow-up required

These checks are intentionally deferred until a staging target exists:

- Browser-session OIDC bridge flow with real cookies and first-party clients
- SSRF egress validation from an environment that matches production networking
- End-to-end webhook verification with non-production Sumsub credentials
- Rate-limit behavior across multiple instances
- Security-header verification through the real CDN / reverse-proxy chain
- Dependency advisory scanning against live registries

### Required staging inputs

- Node 24 runtime
- Staging URL
- Seeded non-production user accounts, orgs, agents, and API keys
- Non-production credentials for payment node, registry service, Veridian, Sumsub, and Postmark

## Suggested Order of Execution

1. `MAS-SEC-001` bridge auth restriction
2. `MAS-SEC-002` SSRF controls
3. `MAS-SEC-005` trusted-origin cleanup
4. `MAS-SEC-004` security headers
5. `MAS-SEC-009` Sumsub failure-mode cleanup
6. `MAS-SEC-008` OIDC metadata cleanup
7. `MAS-SEC-006` shared-rate-limit production policy
8. `MAS-SEC-007` workflow automation and pinning
9. `MAS-SEC-003` token-storage redesign and migration plan

## Completion Standard

- High findings are either fixed or have an explicit, time-bounded exception.
- Every merged remediation ships with a regression test or static policy check.
- Staging validation tasks are queued with required credentials and environment details.
