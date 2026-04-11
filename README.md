# Masumi SaaS

Masumi SaaS is a platform for registering, managing, and verifying your AI agents on the Masumi network. Users can register agents, complete identity verification (KYC), manage organizations, and top up or withdraw funds.

## Tech Stack

- **Next.js 16** (App Router)
- **React 19**
- **TypeScript**
- **Prisma** (PostgreSQL)
- **Better Auth** (with organization and API key plugins)
- **Zod** (Validation)
- **Tailwind CSS** + **shadcn/ui**
- **next-themes** (Theme switching)
- **next-intl** (Internationalization)
- **Sentry** (Error tracking)

## Architecture

This project uses a hybrid architecture depending on the feature:

1. **Config** (`apps/web/src/lib/config/`) - Centralized environment configuration (app, auth, email, sumsub, veridian)
2. **Server Actions** (`apps/web/src/lib/actions/`) - Directly call Prisma and external services (payment node, Veridian)
3. **API Routes** (`apps/web/src/app/api/`) - HTTP endpoints for client-side fetching and public API
4. **API Clients** (`apps/web/src/lib/api/`) - Client-side fetch wrappers for API routes
5. **Payment Node** (`apps/web/src/lib/payment-node/`) - Typed HTTP client + per-user key encryption for Masumi payment node
6. **Services** (`apps/web/src/lib/services/`) - Business logic and data access (Prisma)
7. **Schemas** (`apps/web/src/lib/schemas/`) - Shared Zod schemas for API routes and server actions

**Agent registration flow:** `Server Action → Payment Node Client → Prisma` (wallets generated server-side, no API route involved)

**Dashboard/other data flow:** `Server Component / Action → API Client → API Route → Service → Prisma`

**API authentication:** Authenticated API routes (`/api/agents`, `/api/dashboard/overview`, `/api/credentials/*`, etc.) accept either a session cookie (browser) or an API key: `Authorization: Bearer <key>` or `x-api-key: <key>`.

## API

### Authentication

Authenticated routes require either:

- **Session cookie** – used by the browser when you’re logged in.
- **API key** – for CLIs, MCP, scripts, and server-to-server calls. Create keys in the app under **API Keys**. Send the key in one of two ways:

  ```bash
  # Option 1: Authorization header (recommended)
  curl -H "Authorization: Bearer YOUR_API_KEY" https://your-domain.com/api/agents

  # Option 2: x-api-key header
  curl -H "x-api-key: YOUR_API_KEY" https://your-domain.com/api/agents
  ```

Unauthenticated requests receive `401 Unauthorized` with `{"success":false,"error":"Unauthorized"}`.

### OIDC / SpacetimeDB Authentication

Masumi SaaS can also act as an OIDC issuer for external apps and SpacetimeDB:

Detailed handoff doc for the external webapp repo:

- [docs/external-webapp-oidc-integration.md](/Users/sandro/GitHub/masumi-saas/docs/external-webapp-oidc-integration.md)

- **Discovery**: `GET /.well-known/openid-configuration`
- **OAuth metadata**: `GET /.well-known/oauth-authorization-server`
- **JWKS**: `GET /jwks`
- **OIDC auth endpoints**: `/api/auth/oauth2/*`
- **CLI device verification UI**: `/device`
- **Device authorization endpoint**: `POST /api/auth/device/code`

Trusted first-party client IDs default to:

- `masumi-spacetime-web`
- `masumi-spacetime-cli`

SpacetimeDB reducers should validate:

- `iss === <your public issuer>`
- `aud` contains one of the trusted client IDs above

For browser flows that authenticate directly against Better Auth (cookie or bearer session token), use `POST /api/oidc/spacetimedb/token` to exchange the current authenticated Masumi session for an issuer-signed OIDC token set suitable for SpacetimeDB. The bridge accepts origins configured via `OIDC_WEB_REDIRECT_URLS` in addition to `CORS_ALLOWED_ORIGINS`. Request body:

```json
{ "client": "web" }
```

or

```json
{ "client": "cli" }
```

For CLI sign-in, request a device code from `POST /api/auth/device/code`, approve it via `/device` / `/device/approve`, and poll the standard token endpoint `POST /api/auth/oauth2/token` with `grant_type=urn:ietf:params:oauth:grant-type:device_code` to receive the OIDC token set (`access_token`, `id_token`, optional `refresh_token`) directly. The legacy alias `POST /api/auth/device/token` remains supported for compatibility, but new clients should use `/api/auth/oauth2/token`.

### Authenticated routes (session or API key)

| Path                          | Description                                           |
| ----------------------------- | ----------------------------------------------------- |
| `GET/POST /api/agents`        | List or register agents                               |
| `GET/DELETE /api/agents/[id]` | Get or delete an agent                                |
| `GET /api/agents/counts`      | Agent counts by status and network                    |
| `GET /api/dashboard/overview` | User, KYC, orgs, agents, API keys, balance            |
| `GET /api/earnings`           | Earnings and payouts                                  |
| `GET/POST /api/credentials/*` | Veridian credentials (issue, status, reconcile, etc.) |

### Public API (no auth)

The **v1** namespace exposes read-only, rate-limited endpoints for agent discovery. No API key required.

| Path                      | Description                                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/agents`      | List agents by verification status. Query: `status` (PENDING, VERIFIED, REVOKED, EXPIRED; default VERIFIED), `page`, `limit`. |
| `GET /api/v1/agents/[id]` | Get a single agent by ID.                                                                                                     |

OpenAPI JSON for this surface: **`GET /api/v1/openapi`** (Swagger UI: **`/docs/openapi`**).

**Platform HTTP API** (session or API key): OpenAPI JSON at **`GET /api/openapi`** (Swagger UI: **`/docs/saas-openapi`**). Describes `/api/agents`, `/api/dashboard/*`, `/api/credentials/*`, allow-listed `/api/v1/*` proxy paths, etc. — not the public catalog above.

**Documentation:** header **Documentation** opens **[docs.masumi.network](https://docs.masumi.network/)**. **`/docs`** redirects there with **307** (temporary) so browsers/CDNs do not cache a permanent hop if the external docs URL changes. **Developers** (signed-in) → **`/developers`**: **Schema Validator** and **OpenAPI**; OpenAPI iframe is **`/docs/saas-openapi`**. **Public** discovery: **`/docs/openapi`**. Old paths **`/docs/api`** and **`/docs/saas-api`** **308** to **`/docs/saas-openapi`**.

Example:

```bash
curl "https://your-domain.com/api/v1/agents?status=VERIFIED&limit=10"
```

### Payment Node Proxy (authenticated)

The **v1** namespace proxies **only exact paths** listed in code (no prefix/root wildcards). New payment-node routes stay **403** until added to that set. Use app authentication (session or API key); the user's payment node key is used server-side. Anything not literally in `ALLOWED_PROXY_PATHS` (including paths containing `..`) gets **403** before `fetch`.

| Path                               | Description                                 |
| ---------------------------------- | ------------------------------------------- |
| `GET/POST /api/v1/purchase`        | Create or list purchases                    |
| `GET/POST /api/v1/payment`         | Create or list payments                     |
| `GET/POST /api/v1/registry`        | Register agents, list registry, deregister  |
| `GET /api/v1/api-key-status`       | API key status                              |
| `GET /api/v1/payment-source`       | List payment sources                        |
| `GET/POST/DELETE /api/v1/webhooks` | Webhooks                                    |
| …                                  | See `ALLOWED_PROXY_PATHS` in the route file |

Implementation: `apps/web/src/app/api/v1/[[...path]]/route.ts` (`ALLOWED_PROXY_PATHS`).

**Regenerate checked-in OpenAPI JSON** (same workflow as masumi-payment-service `pnpm run swagger-json`): from the monorepo root run `pnpm --filter web run swagger-json` (alias: `swagger:generate`). Writes:

- `apps/web/src/lib/swagger/openapi-docs.json` — public v1 discovery spec (`generator.ts`)
- `apps/web/src/lib/swagger/openapi-platform-docs.json` — platform HTTP API spec (`saas-app-openapi.ts`)
- `apps/web/public/openapi.json` — copy of the v1 spec for static hosting

`GET /api/v1/openapi` and `GET /api/openapi` still build the spec at request time; commit the JSON when you change the Zod registries so diffs are reviewable.

To regenerate the payment node client: `pnpm --filter web run payment-node:generate` (fetches latest OpenAPI from `https://payment.masumi.network/api-docs`, then runs `openapi-typescript`). Override the spec URL: `PAYMENT_NODE_OPENAPI_URL=https://your-host/api-docs pnpm --filter web run payment-node:fetch-spec`. To typegen only from the committed JSON (offline): `pnpm --filter web run payment-node:generate:local`.

## Project Structure

```
masumi-saas/
├── apps/
│   └── web/                   # Next.js application
│       ├── src/
│       │   ├── app/           # App Router routes
│       │   │   ├── (app)/     # Authenticated routes
│       │   │   │   ├── ai-agents/     # Agent management
│       │   │   │   ├── organizations/ # Organization management
│       │   │   │   ├── account/       # User account
│       │   │   │   ├── onboarding/    # KYC flow
│       │   │   │   ├── top-up/        # Add funds
│       │   │   │   └── withdraw/      # Withdraw earnings
│       │   │   ├── (auth)/    # Authentication routes
│       │   │   └── api/       # API routes
│       │   │       ├── agents/        # Agent CRUD (authenticated)
│       │   │       ├── dashboard/     # Dashboard overview (authenticated)
│       │   │       ├── credentials/   # Veridian credentials (authenticated)
│       │   │       ├── v1/            # Public API (agents, openapi; no auth)
│       │   │       └── webhooks/      # External webhooks
│       │   ├── components/    # UI components
│       │   ├── lib/
│       │   │   ├── config/        # Env config (app, auth, email, sumsub, veridian)
│       │   │   ├── actions/       # Server actions (agent, auth, organization)
│       │   │   ├── api/           # API clients (agent, dashboard, credential)
│       │   │   ├── payment-node/  # Masumi payment node client + encryption
│       │   │   ├── services/      # Business logic
│       │   │   ├── types/         # Shared TypeScript types
│       │   │   ├── schemas/       # Zod schemas
│       │   │   ├── utils/         # Shared utilities
│       │   │   └── auth/          # Better Auth setup
│       │   └── ...
│       └── messages/          # i18n messages
├── packages/
│   └── database/              # Shared database layer
│       ├── prisma/
│       │   ├── schema.prisma  # Database schema
│       │   └── migrations/
│       └── src/
│           └── client.ts     # Prisma client
└── package.json               # Root workspace config
```

## Setup

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Set up environment variables:**

   Configure environment variables in `apps/web/.env`.

   ```bash
   cp apps/web/.env.example apps/web/.env
   ```

   Edit `apps/web/.env` with the following values:
   - **DATABASE_URL**: Your PostgreSQL connection string
     - Format: `postgresql://username:password@host:port/database?schema=public`

   - **BETTER_AUTH_SECRET**: A random secret key for signing session tokens
     - Generate one with: `openssl rand -base64 32`

   - **BETTER_AUTH_URL**: Your application's base URL
     - For local development: `http://localhost:3000`

   - **OIDC_PUBLIC_ISSUER_URL** _(optional)_: Public OIDC issuer URL
     - Defaults to `BETTER_AUTH_URL`

   - **OIDC_WEB_CLIENT_ID** / **OIDC_WEB_REDIRECT_URLS** _(optional)_: Trusted public OIDC client for the external webapp
     - Local default redirect: `http://localhost:3001/auth/callback`

   - **OIDC_CLI_CLIENT_ID** / **OIDC_CLI_REDIRECT_URLS** _(optional)_: Trusted public OIDC client for the CLI device flow
     - Local default redirect: `http://127.0.0.1:43110/callback`

   - **OIDC_DEVICE_VERIFICATION_URI** _(optional)_: OIDC device flow verification page path or absolute URL
     - Defaults to `/device`

   - **NEXT_PUBLIC_APP_URL**: Full base URL for server-side API calls (optional)
     - Falls back to request headers if not set

   - **NEXT_PUBLIC_SOKOSUMI_MARKETPLACE_URL**: Sokosumi marketplace base URL (optional)
     - Defaults to `https://app.sokosumi.com`

   - **POSTMARK_SERVER_ID** / **POSTMARK_FROM_EMAIL**: Postmark credentials (optional)
     - If not set, emails are logged to console in development

   - **EMAIL_BRAND_LOGO_URL** _(optional)_: Absolute URL of the logo image shown at the top of transactional emails (verification, magic link, org invitations, etc.). Defaults to a Masumi GitHub avatar URL if unset.

   - **NEXT_PUBLIC_PRIVACY_POLICY_URL** _(optional)_: Privacy policy URL used by signup forms (checkbox link) and the consent line in magic-link emails when the address is not yet registered. Defaults to the House of Communication policy URL if unset.

   - **NEXT_PUBLIC_SENTRY_DSN** / **SENTRY_AUTH_TOKEN** / **SENTRY_PROJECT**: Sentry config (optional)

   - **SUMSUB_APP_TOKEN** / **SUMSUB_SECRET_KEY**: Sumsub credentials (optional, for KYC/KYB)
   - **SUMSUB_BASE_URL**: Defaults to `https://api.sumsub.com`
   - **SUMSUB_KYC_LEVEL** / **SUMSUB_KYB_LEVEL**: Verification level names (default: `"id-only"`)

   - **VERIDIAN_CREDENTIAL_SERVER_URL**: Veridian credential server URL (optional)
   - **VERIDIAN_KERIA_URL**: KERIA connect URL (optional, use port 3901 not 3903)
   - **VERIDIAN_AGENT_VERIFICATION_SCHEMA_SAID**: Schema SAID for agent verification credentials

   - **PAYMENT_NODE_BASE_URL**: Base URL of the Masumi payment node API, including the version path
     - e.g. `https://payment.masumi.network/api/v1` or `http://localhost:3001/api/v1`
   - **PAYMENT_NODE_ADMIN_API_KEY**: Admin API key for the payment node (server-side only, never exposed to client)
     - Used to generate wallets and create per-user API keys
   - **PAYMENT_NODE_PAYMENT_SOURCE_ID**: Shared payment source ID for adding wallets
   - **PAYMENT_NODE_ENCRYPTION_KEY**: Encryption key for storing per-user payment node API keys (min 32 chars)
     - Generate with: `openssl rand -base64 32`
   - **PAYMENT_NODE_STRICT_STARTUP** _(optional)_: Set to `1` to throw on startup if payment node is unreachable

3. **Configure Sumsub Webhook** (required for automatic KYC status updates):
   - Go to your [Sumsub Dashboard](https://sumsub.com/) → Settings → Webhooks
   - Add a webhook pointing to `https://yourdomain.com/api/webhooks/sumsub`
   - For local development, use [ngrok](https://ngrok.com/) to expose your local server

4. **Set up the database:**

   ```bash
   # Generate Prisma client
   pnpm prisma:generate

   # Run migrations
   pnpm prisma:migrate:dev
   ```

5. **Start the development server:**
   ```bash
   pnpm dev
   ```

## Admin Management

The project includes a CLI tool for managing admin users.

### Setting Up Your First Admin

1. Sign up normally at `/signup`
2. Run the promote command:

   ```bash
   pnpm admin:promote your@email.com
   ```

### Available Commands

```bash
pnpm admin:promote user@example.com   # Promote to admin
pnpm admin:demote user@example.com    # Demote to regular user
pnpm admin:list                       # List all admins
```

After promoting, admins can sign in at `/admin/signin`.

## Features

- ✅ User authentication (email/password, social sign-in, forgot password, 2FA)
- ✅ Organization management (multi-tenant, org dashboard)
- ✅ **API key authentication** – Use API keys for CLIs, MCP, and scripts (`Authorization: Bearer` or `x-api-key`)
- ✅ **Public API (v1)** – Unauthenticated, rate-limited agent listing and OpenAPI spec
- ✅ **Dashboard** – Overview with balance, agents, organizations; top up & withdraw
- ✅ **AI Agent management** – Register, verify, and manage agents on the Masumi network
- ✅ **Payment node integration** – Wallet generation, agent registration via Masumi payment node; Preprod/Mainnet network toggle
- ✅ **KYC/KYB** – Identity verification via Sumsub
- ✅ **Veridian integration** – Cryptographic credentials for agent verification
- ✅ Cookie consent banner
- ✅ Error tracking with Sentry
- ✅ Dark/light theme (auto-detect)
- ✅ Responsive design
- ✅ Server-side rendering with Suspense + skeleton loading

## Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm format` - Format code with Prettier
- `pnpm prisma:generate` - Generate Prisma client
- `pnpm prisma:migrate:dev` - Run database migrations
- `pnpm prisma:studio` - Open Prisma Studio
- `pnpm admin:promote <email>` - Promote user(s) to admin
- `pnpm admin:demote <email>` - Demote admin(s) to regular user
- `pnpm admin:list` - List all admin users

## Better Auth Features

- **Email/Password Authentication**: Sign up and sign in with email and password
- **Magic link**: Passwordless sign-in link; new email addresses receive a short Privacy Policy consent line in the email body (existing accounts do not). Display names default from the email local part when no name is provided.
- **Organization Plugin**: Multi-tenant support with organizations, members, and invitations
- **API Key Plugin**: Generate and manage API keys; use them to authenticate API routes (`Authorization: Bearer` or `x-api-key` header) with rate limiting
- **Bearer Plugin**: Session-token authentication for cross-domain clients and device flows
- **OIDC Provider**: Public issuer metadata, JWKS, trusted first-party public clients, and JWT-signed `id_token`s for SpacetimeDB
- **Device Authorization**: CLI login with `/api/auth/device/code`, `/api/auth/oauth2/token`, `/device`, and `/device/approve`; token polling returns OIDC tokens directly, and the legacy `/api/auth/device/token` alias remains available
- **Two-Factor Authentication**: TOTP-based 2FA support
- **Localization**: Built-in support for multiple languages

## Sentry Integration

Sentry is configured for:

- Server-side error tracking
- Client-side error tracking
- Edge runtime error tracking
- Source map uploads (in production)
- Session replay (1% of sessions, 100% on errors)
