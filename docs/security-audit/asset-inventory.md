# Masumi SaaS Security Audit: Asset Inventory

- Audit date: 2026-04-14
- Target commit: `64345b1a48b12bd570a78f0f8e067aa8156de3fa`
- Scope: repo, CI, and secret-handling review only
- Exclusions: cloud account configuration, DNS, production database operations, vendor-console settings, and live staging/prod probing

## System Overview

Masumi SaaS is a pnpm monorepo with:

- `apps/web`: Next.js 16 App Router application serving the browser UI, auth endpoints, OIDC issuer/device flow, public APIs, authenticated APIs, proxy routes, and webhooks.
- `packages/database`: Prisma/PostgreSQL package defining the shared schema and generated client.
- `.github/workflows`: CI workflows for PR checks and Claude automation.

Primary external dependencies visible in code:

- PostgreSQL via Prisma
- Better Auth with organization, API key, bearer, OIDC provider, device authorization, email OTP, magic link, 2FA, and admin plugins
- Masumi payment node
- Masumi registry service
- Veridian credential services
- Sumsub webhook and token issuance
- Postmark email delivery
- Upstash Redis for rate limiting when configured
- Sentry when configured

## Primary Assets

| Asset                            | Location                                                                                                                                                              | Notes                                                                                                        |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Browser app and authenticated UI | `apps/web/src/app/(app)`                                                                                                                                              | Authenticated session experience for agents, organizations, verification, credits, and API keys              |
| Auth and OIDC issuer             | `apps/web/src/lib/auth/*`, `apps/web/src/app/api/auth/[...all]/route.ts`, `apps/web/src/app/api/oidc/spacetimedb/token/route.ts`                                      | Better Auth plus custom OIDC/device-flow glue                                                                |
| User-scoped platform APIs        | `apps/web/src/app/api/*`                                                                                                                                              | Protected app APIs for agents, dashboard, earnings, activity, credentials, credits, admin, and helper routes |
| Public API surface               | `apps/web/src/app/api/v1/agents*`, `apps/web/src/app/api/v1/openapi/route.ts`, `apps/web/src/app/api/register/email/route.ts`, `apps/web/src/app/api/health/route.ts` | Unauthenticated catalog, verification helper, docs, registration, and health                                 |
| Authenticated proxy surface      | `apps/web/src/app/api/v1/*` excluding public `agents*` and `openapi`                                                                                                  | Session or API-key-backed proxying to payment/registry services                                              |
| Webhook ingress                  | `apps/web/src/app/api/webhooks/sumsub/route.ts`                                                                                                                       | Signed Sumsub callback updates KYC/KYB state                                                                 |
| Database schema                  | `packages/database/prisma/schema.prisma`                                                                                                                              | Stores users, sessions, API keys, OIDC tokens, orgs, agents, credentials, KYC/KYB records                    |
| CI/CD                            | `.github/workflows/pr-check.yml`, `.github/workflows/claude.yml`                                                                                                      | Build/lint pipeline and third-party assistant workflow                                                       |

## Sensitive Data Inventory

| Data type                                        | Current storage/flow                                       | Sensitivity | Current control noted in repo                                           |
| ------------------------------------------------ | ---------------------------------------------------------- | ----------- | ----------------------------------------------------------------------- |
| Better Auth session token                        | `Session.token` in Prisma schema                           | High        | Access gated by Better Auth; no hashing/encryption visible in repo      |
| Better Auth API key                              | `Apikey.key` in Prisma schema                              | High        | Key metadata exposed separately; at-rest protection not visible in repo |
| OIDC access and refresh tokens                   | `OauthAccessToken.accessToken`, `refreshToken`             | High        | Scope filtering exists; at-rest protection not visible in repo          |
| Social/provider tokens                           | `Account.accessToken`, `refreshToken`, `idToken`           | High        | Stored in auth tables; no extra encryption visible in repo              |
| Email OTP / verification / magic-link state      | `Verification.value`                                       | Medium/High | Expiry exists; stored raw in DB                                         |
| Payment-node per-user API key                    | `User.paymentNodeApiKeyEncrypted`                          | High        | AES-256-GCM + HKDF in `apps/web/src/lib/payment-node/encryption.ts`     |
| Sumsub secret and webhook secret material        | env only                                                   | High        | Signature verification and timestamp freshness check exist              |
| Veridian credential data and KYC/KYB identifiers | `VeridianCredential`, `KycVerification`, `KybVerification` | High        | Access usually user-scoped; contains PII-linked verification state      |
| Agent verification secret                        | `Agent.verificationSecret`                                 | Medium/High | Used for HMAC ownership proof; stored raw                               |
| Admin bootstrap IDs                              | `ADMIN_USER_IDS` env                                       | High        | Parsed from env; no environment gating besides deployment discipline    |

## Trust Boundaries

1. Browser to Next.js app
   - Cookies, API keys, bearer tokens, and OIDC flows cross this boundary.
   - Browser-facing CORS is selectively enabled on public routes and the OIDC bridge.

2. Next.js app to PostgreSQL
   - Auth state, tokens, org membership, agents, and credentials cross this boundary.

3. Next.js app to Better Auth internals
   - Session lookup, API-key-backed sessions, magic links, OIDC authorize/token flows, and admin checks cross this boundary.

4. Next.js app to payment node and registry service
   - User-scoped payment tokens and a shared registry token are forwarded server-side.

5. Next.js app to Veridian
   - Credential issuance, OOBI resolution, and credential polling cross this boundary.

6. Next.js app to Sumsub
   - Token issuance and signed webhook callbacks cross this boundary.

7. GitHub Actions to repository and secrets
   - Build pipeline and third-party workflow consume repo contents and GitHub secrets.

## Existing Controls Observed

These are meaningful positives from the repo review and should be preserved during remediation:

- Central auth entrypoint through `getAuthenticatedOrThrow`, with a consistent `401/403` error path.
- OIDC API-scope enforcement exists for OIDC bearer tokens via `requireNetworkedOidcApiScope` and `requireAnyNetworkedOidcApiScope`.
- Same-origin callback sanitization exists in `apps/web/src/lib/auth/callback-url.ts`.
- Payment-node per-user API keys are encrypted at rest using AES-256-GCM with HKDF-derived keys.
- Public API and registration routes have rate-limiting hooks and return rate-limit headers.
- Sumsub webhook checks both signature and a five-minute timestamp freshness window.
- Agent object access is usually mediated through `getWalletOwnedAgentForUser` or `listWalletOwnedAgentsForUser`.

## Public and Mixed-Auth Surface

| Endpoints                                                   | Auth expectation | Notes                                                                       |
| ----------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------- |
| `GET /api/health`                                           | None             | Public health endpoint, rate-limited                                        |
| `POST /api/register/email`                                  | None             | Public registration/magic-link request, CORS enabled                        |
| `GET /api/v1/agents`                                        | None             | Public catalog listing, rate-limited, CORS enabled                          |
| `GET /api/v1/agents/[agentId]`                              | None             | Public agent lookup by ID, rate-limited, CORS enabled                       |
| `GET /api/v1/agents/verify`                                 | None             | Public verification lookup by `agentIdentifier`, rate-limited, CORS enabled |
| `GET /api/v1/openapi`, `GET /api/openapi`                   | None             | Public docs surfaces, CORS enabled                                          |
| OIDC discovery endpoints (`/.well-known/*`, `/jwks`)        | None             | Public issuer metadata surface described in README                          |
| `POST /api/auth/device/code`, `POST /api/auth/oauth2/token` | Mixed by grant   | Public OAuth/OIDC token endpoints with grant-specific auth                  |
| `POST /api/auth/device/approve`, `/oidc/consent`            | Authenticated    | Device approval / consent surface depends on current authenticated user     |

## Protected Route Classification

### User-scoped app APIs

| Endpoints                                                                                                                                                                                                                                                                                                                          | Allowed auth methods in code        | Object / tenant control                                                       | Extra gate                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `GET/POST /api/agents`, `GET /api/agents/counts`                                                                                                                                                                                                                                                                                   | Session, API key, OIDC access token | User-scoped agent listing via `listWalletOwnedAgentsForUser`                  | OIDC bearer must satisfy networked `agents:*` scope         |
| `GET/DELETE /api/agents/[agentId]`                                                                                                                                                                                                                                                                                                 | Session, API key, OIDC access token | Ownership via `getWalletOwnedAgentForUser`                                    | OIDC bearer must satisfy networked `agents:*` scope         |
| `POST /api/agents/[agentId]/complete-registration`, `POST /api/agents/[agentId]/deregister`, `GET /api/agents/[agentId]/earnings`, `GET /api/agents/[agentId]/transactions`, `GET/POST /api/agents/[agentId]/verification-challenge`, `POST /api/agents/[agentId]/test-verification-endpoint`, `POST /api/agents/[agentId]/verify` | Session, API key, OIDC access token | Ownership via `getWalletOwnedAgentForUser`                                    | OIDC bearer must satisfy networked `agents:*` scope         |
| `GET /api/activity`, `GET /api/activity/transaction`                                                                                                                                                                                                                                                                               | Session, API key, OIDC access token | User ID from auth context                                                     | OIDC bearer must satisfy networked `activity:read:*` scope  |
| `GET /api/dashboard/overview`                                                                                                                                                                                                                                                                                                      | Session, API key, OIDC access token | User ID from auth context                                                     | OIDC bearer must satisfy networked `dashboard:read:*` scope |
| `GET /api/earnings`                                                                                                                                                                                                                                                                                                                | Session, API key, OIDC access token | User ID from auth context; payment-node client created for authenticated user | OIDC bearer must satisfy networked `earnings:read:*` scope  |
| `GET /api/credits`                                                                                                                                                                                                                                                                                                                 | Session, API key, OIDC access token | User ID from auth context                                                     | No extra scope gate beyond authentication                   |
| `GET /api/api-key-status`                                                                                                                                                                                                                                                                                                          | Session or API key                  | Current caller only                                                           | Explicitly rejects OIDC bearer auth                         |
| `GET /api/admin/agents`                                                                                                                                                                                                                                                                                                            | Session, API key, OIDC access token | Admin check via DB role or `ADMIN_USER_IDS`                                   | No OIDC-specific extra scope                                |

### Credential APIs

| Endpoints                                                                                                        | Allowed auth methods in code        | Object / tenant control                                                        | Extra gate                                                     |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `POST /api/credentials/check-connection`, `GET /api/credentials/issuer-oobi`, `GET /api/credentials/schema-said` | Session, API key, OIDC access token | No object ownership; caller is any authenticated user                          | OIDC bearer must have any `credentials:read:*` scope           |
| `POST /api/credentials/issue`                                                                                    | Session, API key, OIDC access token | Agent ownership checked by `agentId` + `userId`; optional org membership check | OIDC bearer must satisfy networked `credentials:write:*` scope |
| `GET /api/credentials/status`                                                                                    | Session, API key, OIDC access token | Credential row bound to `userId`                                               | OIDC bearer must satisfy networked `credentials:read:*` scope  |
| `GET /api/credentials/reconcile`                                                                                 | Session, API key, OIDC access token | Agent ownership checked by `agentId` + `userId`                                | OIDC bearer must satisfy networked `credentials:write:*` scope |

### Registry discovery helper APIs

| Endpoints                                                                                                     | Allowed auth methods in code | Object / tenant control                                  | Extra gate                          |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------- | ----------------------------------- |
| `GET /api/registry-discovery/inbox-agent-identifier`, `GET /api/registry-discovery/inbox-agent-registrations` | Session or API key           | Uses authenticated user payment or shared registry token | Explicitly rejects OIDC bearer auth |

### OIDC bridge

| Endpoint                           | Intended auth   | Actual auth acceptance in current code                                                                                            | Notes                                  |
| ---------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `POST /api/oidc/spacetimedb/token` | Browser session | Uses `getAuthenticatedOrThrow`, so session, API key, and potentially any auth method accepted by that helper can reach the bridge | This mismatch is recorded as a finding |

### Authenticated v1 proxy surface

| Endpoints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Allowed auth methods in code        | Upstream token model                                                    | Extra gate                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `GET/POST /api/v1/payment`, `GET/POST/DELETE /api/v1/registry`, `GET /api/v1/payment-source`, `POST /api/v1/payment/submit-result`, `POST /api/v1/registry/deregister`, `GET /api/v1/registry/diff`, `GET /api/v1/payment/count`, `GET /api/v1/payment/diff`, `GET /api/v1/payment/diff/next-action`, `GET /api/v1/payment/diff/onchain-state-or-result`, `POST /api/v1/payment/error-state-recovery`, `POST /api/v1/payment/authorize-refund`, `GET /api/v1/payment/resolve-blockchain-identifier`, `GET /api/v1/payment/income`, `GET /api/v1/registry/count`, `GET /api/v1/registry/agent-identifier` | Session or API key                  | User-scoped payment-node token                                          | Explicitly rejects OIDC bearer auth; some write routes also consume credits |
| `GET /api/v1/payment-information`, `POST /api/v1/inbox-agent-registration-search`, `POST /api/v1/registry-entry`, `POST /api/v1/registry-entry-search`, `GET /api/v1/capability`, `GET /api/v1/registry-diff`                                                                                                                                                                                                                                                                                                                                                                                            | Session or API key                  | Shared registry-service token                                           | Explicitly rejects OIDC bearer auth                                         |
| `GET/POST /api/v1/inbox-agents`, `GET /api/v1/inbox-agents/[inboxAgentId]`, `POST /api/v1/inbox-agents/[inboxAgentId]/deregister`                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Session, API key, OIDC access token | User-scoped payment-node token, plus wallet-scope tightening for writes | OIDC bearer must satisfy networked `inbox-agents:*` scope                   |

## Audit Notes About Coverage

- `pnpm lint` passed during the audit.
- `pnpm test` could not be used as a clean security baseline in this sandbox because many smoke and e2e tests require localhost access to `127.0.0.1:2999`, which is blocked here.
- Dependency CVE enumeration was not validated against live registries in this sandbox; supply-chain review in this audit therefore focuses on pinned workflow practices and missing automation rather than external advisory lookups.
