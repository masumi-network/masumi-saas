# Masumi SaaS Security Audit: Findings

- Audit date: 2026-04-14
- Target commit: `64345b1a48b12bd570a78f0f8e067aa8156de3fa`
- Scope: repo, CI, and secret-handling review only

## Severity Summary

- Critical: 0
- High: 3
- Medium: 4
- Low: 2

## Findings

### MAS-SEC-001: OIDC bridge accepts API-key-backed authentication and can mint first-party token sets

- Severity: High
- Affected assets: `POST /api/oidc/spacetimedb/token`, Better Auth API key plugin, first-party OIDC clients
- Evidence:
  - `apps/web/src/app/api/oidc/spacetimedb/token/route.ts` authenticates with `getAuthenticatedOrThrow(request)` and does not require `authMethod === "session"`.
  - `apps/web/src/lib/auth/auth.ts` enables `enableSessionForAPIKeys: true`.
  - `apps/web/src/lib/auth/oidc-flow.ts` forwards `authorization`, `cookie`, and `x-api-key` headers into the internal OIDC authorize/token exchange.
  - README text describes this bridge as a browser-session flow, not an API-key flow.
- Exploitability:
  - Any valid Masumi SaaS API key for an email-verified user can likely be exchanged into a first-party OIDC token set, including `offline_access`, because the bridge accepts generic authenticated context and forwards API-key headers into the OIDC exchange path.
- Impact:
  - Expands a server-to-server credential into a different credential class with refresh semantics and first-party client context.
  - Weakens credential separation between browser session auth and API-key auth.
  - Makes revocation and least-privilege reasoning harder because one credential type can bootstrap another.
- Recommended remediation:
  - Restrict `/api/oidc/spacetimedb/token` to browser-session auth only.
  - Explicitly reject `authMethod === "apiKey"` and `authMethod === "oidcAccessToken"`.
  - Keep the bridge scoped to cookie-backed session flows unless a separate, documented machine-to-machine token exchange is intentionally introduced.
- Regression test recommendation:
  - Add route tests proving session auth succeeds while API key and OIDC bearer auth both return `403`.

### MAS-SEC-002: User-controlled agent URLs are fetched server-side without SSRF protections

- Severity: High
- Affected assets: agent verification and credential issuance flows
- Evidence:
  - `apps/web/src/lib/schemas/agent.ts` accepts any `http://` or `https://` `apiUrl`.
  - `apps/web/src/lib/agent-verification.ts` builds `GET {apiUrl}/get-credential` and fetches it directly.
  - `apps/web/src/app/api/agents/[agentId]/test-verification-endpoint/route.ts` and `apps/web/src/app/api/credentials/issue/route.ts` both invoke this fetch path.
- Exploitability:
  - Any authenticated user who can register an agent can point `apiUrl` at internal RFC1918, loopback, link-local, metadata, or otherwise sensitive endpoints and force the server to fetch them.
- Impact:
  - Internal network probing from the application runtime.
  - Possible metadata-service access, internal admin endpoint reachability checks, or lateral movement depending on deployment egress.
  - Server-side access patterns become attacker-controlled.
- Recommended remediation:
  - Add outbound URL validation before fetch:
    - block loopback, RFC1918, link-local, unique-local IPv6, and cloud metadata targets
    - resolve DNS and validate the resolved addresses, not just the original hostname
    - consider an explicit allowlist or a dedicated egress proxy for agent verification
  - Keep short timeouts, but do not treat timeouts as the primary SSRF control.
- Regression test recommendation:
  - Add unit tests for URL validation that reject `127.0.0.1`, `::1`, `10.0.0.0/8`, `192.168.0.0/16`, `169.254.169.254`, and DNS names resolving to those ranges.

### MAS-SEC-003: Sensitive auth tokens are stored in plaintext across multiple database tables

- Severity: High
- Affected assets: auth/session/OIDC/API-key tables in PostgreSQL
- Evidence:
  - `packages/database/prisma/schema.prisma` stores raw values in:
    - `Session.token`
    - `Apikey.key`
    - `OauthAccessToken.accessToken`
    - `OauthAccessToken.refreshToken`
    - `Account.accessToken`
    - `Account.refreshToken`
    - `Account.idToken`
    - `Verification.value`
  - The repo does show encryption for payment-node keys via `User.paymentNodeApiKeyEncrypted`, which highlights the contrast.
- Exploitability:
  - A database read exposure would immediately expose reusable bearer material, not just metadata.
- Impact:
  - Session takeover, API-key misuse, refresh-token replay, and compromise of magic-link or OTP state.
  - Larger blast radius for any SQL injection, backup leak, admin-console mishandling, or read-only DB compromise.
- Recommended remediation:
  - Prefer hashed-at-rest storage for session tokens, API keys, and OIDC access/refresh tokens where framework support allows.
  - Encrypt provider tokens that must remain retrievable.
  - Minimize retention for OTP / verification rows and document why any raw token must remain decryptable.
  - If Better Auth runtime limits full hashing, add compensating controls and a hardening note documenting the residual risk.
- Regression test recommendation:
  - Add schema and service-level tests around any new hashing/encryption layer, plus a migration test if existing rows need rollover.

### MAS-SEC-004: Standard browser security headers are not enforced globally

- Severity: Medium
- Affected assets: browser UI, authenticated app pages, auth pages, docs embeds
- Evidence:
  - `apps/web/next.config.ts` defines redirects and server-action limits but no `async headers()` policy.
  - `apps/web/src/proxy.ts` is effectively a no-op and does not add security headers.
  - Repo search found no global `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options` or `frame-ancestors`, `Referrer-Policy`, or `Permissions-Policy` enforcement.
- Exploitability:
  - Depends on hosting tier and existing CDN controls, but the repo itself does not guarantee clickjacking, mixed-origin framing, or script-source hardening.
- Impact:
  - Increased exposure to clickjacking and XSS impact amplification.
  - No repo-level guarantee that authenticated pages are shipped with a defensive header baseline.
- Recommended remediation:
  - Define a repo-owned header baseline in `next.config.ts` or middleware:
    - `Content-Security-Policy`
    - `Strict-Transport-Security` for production
    - `Referrer-Policy`
    - `X-Content-Type-Options`
    - `Permissions-Policy`
    - `frame-ancestors 'none'` or an equivalent framing policy where possible
  - Handle Swagger/embed routes deliberately if they require looser framing.
- Regression test recommendation:
  - Add integration tests asserting the header set on authenticated pages, auth pages, and public APIs where applicable.

### MAS-SEC-005: Production auth trust list includes hardcoded localhost origins

- Severity: Medium
- Affected assets: Better Auth origin trust boundary
- Evidence:
  - `apps/web/src/lib/auth/auth.ts` always includes:
    - `http://localhost:2999`
    - `http://127.0.0.1:2999`
      in `trustedOrigins`, regardless of environment.
- Exploitability:
  - If Better Auth treats trusted origins as eligible cross-origin callers, production keeps development-local origins permanently trusted.
- Impact:
  - Needlessly widens the origin trust boundary in production.
  - Makes it harder to reason about which sites are allowed to initiate auth-sensitive cross-origin requests.
- Recommended remediation:
  - Gate localhost origins behind `NODE_ENV !== "production"` or a dedicated explicit development flag.
  - Keep production trust limited to configured public origins only.
- Regression test recommendation:
  - Add a config/unit test asserting localhost origins are absent in production-mode configuration.

### MAS-SEC-006: Public-route rate limits silently degrade to per-process memory when Upstash is missing

- Severity: Medium
- Affected assets: public API, registration, and health endpoints
- Evidence:
  - `apps/web/src/lib/api/rate-limit.ts` falls back to an in-memory `Map` when Upstash env vars are missing.
  - Public routes like `/api/register/email`, `/api/v1/agents*`, and `/api/health` rely on `checkRateLimitOrRespond`.
  - The repo does not enforce shared-store presence for production.
- Exploitability:
  - On a multi-instance deployment, a client can bypass effective rate limits by spreading requests across instances or restarts.
- Impact:
  - Weaker brute-force and enumeration protection for public endpoints.
  - Production behavior may differ sharply from single-node testing.
- Recommended remediation:
  - Fail closed or warn loudly in production when public-route rate limiting is configured without a shared store.
  - Document Upstash or an equivalent distributed limiter as a production requirement.
- Regression test recommendation:
  - Add config tests that fail in production mode without `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, or explicitly assert the intended fallback policy.

### MAS-SEC-007: CI supply-chain and security-automation coverage is thin

- Severity: Medium
- Affected assets: GitHub Actions and repository security hygiene
- Evidence:
  - Only two workflows are present: `.github/workflows/pr-check.yml` and `.github/workflows/claude.yml`.
  - No `dependabot.yml`, no CodeQL workflow, and no repo-level secret-scanning or workflow-hardening automation is present in the repository.
  - Third-party actions are pinned to moving tags such as `actions/checkout@v4`, `actions/setup-node@v4`, `pnpm/action-setup@v4`, and `anthropics/claude-code-action@beta`.
- Exploitability:
  - Moving tags and sparse automation increase supply-chain drift risk and reduce early detection of vulnerable or unsafe changes.
- Impact:
  - Slower detection of dependency issues, workflow compromise, or secret leakage.
  - Larger trust surface for mutable third-party GitHub actions.
- Recommended remediation:
  - Add Dependabot for npm and GitHub Actions updates.
  - Add CodeQL or an equivalent code-scanning workflow.
  - Pin third-party actions to commit SHAs.
  - Set explicit workflow permissions and review any workflow that can access secrets or mint identity tokens.
- Regression test recommendation:
  - Add repository policy checks or CI linting that rejects unpinned third-party actions and validates the presence of the security workflows.

### MAS-SEC-008: OIDC metadata advertises `none` as a supported ID-token signing algorithm

- Severity: Low
- Affected assets: OIDC discovery metadata and relying-party compatibility
- Evidence:
  - `apps/web/src/lib/config/oidc.config.ts` sets `id_token_signing_alg_values_supported` to `[ES256, "none"]`.
  - The rest of the repo config is centered on `OIDC_ID_TOKEN_SIGNING_ALG = "ES256"`.
- Exploitability:
  - This is primarily a client-compatibility and policy-hardening issue rather than a direct exploit shown in repo.
- Impact:
  - Metadata overstates supported algorithms and can mislead clients or reviewers about acceptable token formats.
- Recommended remediation:
  - Remove `"none"` from advertised supported algorithms unless unsigned ID tokens are intentionally supported end to end.
- Regression test recommendation:
  - Add a discovery-metadata test asserting only intended algorithms are advertised.

### MAS-SEC-009: Sumsub signature failures can produce 500s instead of clean 401s

- Severity: Low
- Affected assets: `/api/webhooks/sumsub`
- Evidence:
  - `apps/web/src/lib/sumsub/client.ts` calls `crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))`.
  - `timingSafeEqual` throws when buffer lengths differ.
  - `apps/web/src/app/api/webhooks/sumsub/route.ts` catches unexpected errors and returns `500`.
- Exploitability:
  - An attacker cannot bypass the signature check this way, but malformed signatures can create noisy `500` responses and webhook retries.
- Impact:
  - Operational noise and possible retry amplification from the webhook sender.
- Recommended remediation:
  - Reject invalid signature length up front and return `401`.
  - Compare normalized byte arrays only after validating format and expected length.
- Regression test recommendation:
  - Add route tests for short, long, and malformed signatures asserting `401`, not `500`.

## Residual Notes

- The repo has several strong ownership and scope checks already; the biggest gaps are boundary mismatches, egress policy, token storage, and missing automation.
- No live dependency-advisory pull was performed in this sandbox, so version-specific CVEs remain a staging/CI follow-up item rather than a repo-proven finding here.
