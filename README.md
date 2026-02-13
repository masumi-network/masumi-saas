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

This project follows an **API-first** architecture with clear separation of concerns:

1. **Config** (`apps/web/src/lib/config/`) - Centralized environment configuration (app, auth, email, sumsub, veridian)
2. **API Clients** (`apps/web/src/lib/api/`) - Client-side and server-side fetch wrappers for API routes
3. **API Routes** (`apps/web/src/app/api/`) - HTTP endpoints that handle auth and delegate to services
4. **Services** (`apps/web/src/lib/services/`) - Business logic and data access (Prisma)
5. **Actions** (`apps/web/src/lib/actions/`) - Server actions that call API clients or services
6. **Types** (`apps/web/src/lib/types/`) - Shared TypeScript types

**Data flow (Option B):** `Action → API Client → API Route → Service → Prisma`

This keeps a single API boundary for dashboard, agents, and other features—enabling client-side fetching, caching, and consistency across the app.

## Project Structure

```
masumi-saas/
├── apps/
│   └── web/                   # Next.js application
│       ├── src/
│       │   ├── app/           # App Router routes
│       │   │   ├── (app)/     # Authenticated routes
│       │   │   │   ├── agents/        # Agent management
│       │   │   │   ├── organizations/ # Organization management
│       │   │   │   ├── account/       # User account
│       │   │   │   ├── onboarding/    # KYC flow
│       │   │   │   ├── top-up/        # Add funds
│       │   │   │   └── withdraw/      # Withdraw earnings
│       │   │   ├── (auth)/    # Authentication routes
│       │   │   └── api/       # API routes
│       │   │       ├── agents/        # Agent CRUD
│       │   │       ├── dashboard/     # Dashboard overview
│       │   │       ├── credentials/   # Veridian credentials
│       │   │       └── webhooks/      # External webhooks
│       │   ├── components/    # UI components
│       │   ├── lib/
│       │   │   ├── config/    # Env config (app, auth, email, sumsub, veridian)
│       │   │   ├── actions/   # Server actions
│       │   │   ├── api/       # API clients (agent, dashboard, credential)
│       │   │   ├── services/  # Business logic
│       │   │   ├── types/     # Shared types
│       │   │   ├── schemas/   # Zod schemas
│       │   │   └── auth/      # Better Auth setup
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

   ```bash
   cp apps/web/.env.example apps/web/.env
   ```

   Edit `apps/web/.env` with the following values. These are centralized in `apps/web/src/lib/config/` (app.config, auth.config, email.config, sumsub.config, veridian.config).
   - **DATABASE_URL**: Your PostgreSQL connection string
     - Format: `postgresql://username:password@host:port/database?schema=public`
     - Example: `postgresql://postgres:mypassword@localhost:5432/masumi_saas?schema=public`

   - **BETTER_AUTH_SECRET**: A random secret key for signing session tokens
     - Generate one with: `openssl rand -base64 32`
     - Or use any secure random string (keep it secret!)

   - **BETTER_AUTH_URL**: Your application's base URL
     - For local development: `http://localhost:3000`
     - For production: Your production domain (e.g., `https://yourdomain.com`)

   - **NEXT_PUBLIC_APP_URL**: Full base URL for server-side API calls (optional)
     - For local development: `http://localhost:3000`
     - For production: Your production domain (e.g., `https://yourdomain.com`)
     - Used when server actions fetch from API routes; falls back to request headers if not set

   - **NEXT_PUBLIC_SOKOSUMI_MARKETPLACE_URL**: Sokosumi marketplace base URL (optional)
     - Defaults to `https://app.sokosumi.com` if not set
     - Used for the "Hire in Sokosumi" link in agent details (URL format: `{base}/{agentIdentifier}`)

   - **POSTMARK_SERVER_ID**: Your Postmark server API token (optional, for email sending)
     - Get one from [Postmark](https://postmarkapp.com/)
     - If not set, password reset emails will be logged to console in development

   - **POSTMARK_FROM_EMAIL**: The email address to send emails from (optional)
     - Defaults to `noreply@masumi.network` if not set
     - Must be a verified sender in your Postmark account

   - **NEXT_PUBLIC_SENTRY_DSN**: Your Sentry DSN (optional, for error tracking)
   - **SENTRY_AUTH_TOKEN**: Your Sentry auth token (optional, for source maps)
   - **SENTRY_PROJECT**: Your Sentry project name (defaults to "masumi-saas")

   - **SUMSUB_APP_TOKEN**: Your Sumsub application token (optional, for KYC/KYB verification)
     - Get one from [Sumsub Dashboard](https://sumsub.com/)
     - Required for identity verification features
   - **SUMSUB_SECRET_KEY**: Your Sumsub secret key (optional, for KYC/KYB verification)
     - Get one from [Sumsub Dashboard](https://sumsub.com/)
     - Required for webhook signature verification and API authentication
   - **SUMSUB_BASE_URL**: Sumsub API base URL (optional)
     - Defaults to `https://api.sumsub.com` for production
     - Use `https://api.sumsub.com` for sandbox/testing
   - **SUMSUB_KYC_LEVEL**: Verification level name for KYC (optional)
     - Defaults to `"id-only"` (simpler, faster for development)
     - Recommended: `"id-and-liveness"` for production (includes liveness check)
     - Must match an existing verification level in your Sumsub dashboard
   - **SUMSUB_KYB_LEVEL**: Verification level name for KYB (optional)
     - Defaults to `"id-only"`
     - Must match an existing verification level in your Sumsub dashboard

   - **VERIDIAN_CREDENTIAL_SERVER_URL**: Veridian credential server URL (optional, for agent verification)
     - For local development: `http://localhost:3001`
     - For production: Your deployed credential server URL (e.g., `https://cred-issuance.yourdomain.com` or `https://cred-issuance-production.up.railway.app`)
     - Required for Veridian wallet integration and agent verification features

   - **VERIDIAN_KERIA_URL**: KERIA connect URL (optional, for signature verification)
     - For local development: `http://localhost:3901` (use the connect URL, not the boot URL)
     - For production: Your deployed KERIA connect URL (e.g., `https://keria.yourdomain.com`)
     - **Important**: Use the connect URL (port 3901), not the boot URL (port 3903)
     - Required for cryptographic signature verification when issuing credentials

   - **VERIDIAN_AGENT_VERIFICATION_SCHEMA_SAID**: Schema SAID for agent verification (required)
     - The credential schema SAID to use for agent verification credentials
     - Must match a schema registered in your Veridian credential server
     - Can default to `"EL9oOWU_7zQn_rD--Xsgi3giCWnFDaNvFMUGTOZx1ARO"` (Foundation Employee schema) if not set

3. **Configure Sumsub Webhook** (required for automatic status updates):
   - Go to your [Sumsub Dashboard](https://sumsub.com/) → Settings → Webhooks
   - Add a new webhook with:
     - **URL**: `https://yourdomain.com/api/webhooks/sumsub`
     - **Events**: Select `applicantWorkflowCompleted` (or all events)
     - **Secret**: Use the same `SUMSUB_SECRET_KEY` from your `.env` file
   - For local development, use a tool like [ngrok](https://ngrok.com/) to expose your local server:
     ```bash
     ngrok http 3000
     # Then use the ngrok URL: https://your-ngrok-url.ngrok.io/api/webhooks/sumsub
     ```
   - **Note**: The webhook is required for automatic status updates. Without it, you'll need to manually refresh or rely on the instant status check when users submit verification.

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

## Features

- ✅ User authentication (email/password, forgot password)
- ✅ Organization management (multi-tenant)
- ✅ API key management
- ✅ **Dashboard** – Overview with balance, agents, organizations; Top up & Withdraw
- ✅ **AI Agent management** – Register, verify, and manage agents on the Masumi network
- ✅ **KYC/KYB** – Identity verification via Sumsub
- ✅ **Veridian integration** – Cryptographic credentials for agent verification
- ✅ Cookie consent banner
- ✅ Error tracking with Sentry
- ✅ Dark/light theme (auto-detect)
- ✅ Responsive design
- ✅ Server-side rendering with Suspense
- ✅ API-first architecture (actions → API clients → API routes → services)

## Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm format` - Format code with Prettier
- `pnpm prisma:generate` - Generate Prisma client
- `pnpm prisma:migrate:dev` - Run database migrations
- `pnpm prisma:studio` - Open Prisma Studio

## Better Auth Features

- **Email/Password Authentication**: Sign up and sign in with email and password
- **Organization Plugin**: Multi-tenant support with organizations, members, and invitations
- **API Key Plugin**: Generate and manage API keys with rate limiting
- **Localization**: Built-in support for multiple languages

## Sentry Integration

Sentry is configured for:

- Server-side error tracking
- Client-side error tracking
- Edge runtime error tracking
- Source map uploads (in production)
- Session replay (1% of sessions, 100% on errors)
