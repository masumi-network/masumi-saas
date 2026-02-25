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
│       │   │       ├── agents/        # Agent CRUD
│       │   │       ├── dashboard/     # Dashboard overview
│       │   │       ├── credentials/   # Veridian credentials
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

   - **NEXT_PUBLIC_APP_URL**: Full base URL for server-side API calls (optional)
     - Falls back to request headers if not set

   - **NEXT_PUBLIC_SOKOSUMI_MARKETPLACE_URL**: Sokosumi marketplace base URL (optional)
     - Defaults to `https://app.sokosumi.com`

   - **POSTMARK_SERVER_ID** / **POSTMARK_FROM_EMAIL**: Postmark credentials (optional)
     - If not set, emails are logged to console in development

   - **NEXT_PUBLIC_SENTRY_DSN** / **SENTRY_AUTH_TOKEN** / **SENTRY_PROJECT**: Sentry config (optional)

   - **SUMSUB_APP_TOKEN** / **SUMSUB_SECRET_KEY**: Sumsub credentials (optional, for KYC/KYB)
   - **SUMSUB_BASE_URL**: Defaults to `https://api.sumsub.com`
   - **SUMSUB_KYC_LEVEL** / **SUMSUB_KYB_LEVEL**: Verification level names (default: `"id-only"`)

   - **VERIDIAN_CREDENTIAL_SERVER_URL**: Veridian credential server URL (optional)
   - **VERIDIAN_KERIA_URL**: KERIA connect URL (optional, use port 3901 not 3903)
   - **VERIDIAN_AGENT_VERIFICATION_SCHEMA_SAID**: Schema SAID for agent verification credentials

   - **PAYMENT_NODE_BASE_URL**: Base URL of the Masumi payment node API
     - e.g. `https://payment.masumi.network` or `http://localhost:3001`
   - **PAYMENT_NODE_ADMIN_API_KEY**: Admin API key for the payment node (server-side only, never exposed to client)
     - Used to generate wallets and create per-user API keys
   - **PAYMENT_NODE_PAYMENT_SOURCE_ID**: Shared payment source ID for adding wallets
   - **PAYMENT_NODE_ENCRYPTION_KEY**: Encryption key for storing per-user payment node API keys (min 32 chars)
     - Generate with: `openssl rand -base64 32`
   - **PAYMENT_NODE_OPTIONAL** _(optional)_: Set to `1` to allow startup without payment node config
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
- ✅ API key management
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
- **Organization Plugin**: Multi-tenant support with organizations, members, and invitations
- **API Key Plugin**: Generate and manage API keys with rate limiting
- **Two-Factor Authentication**: TOTP-based 2FA support
- **Localization**: Built-in support for multiple languages

## Sentry Integration

Sentry is configured for:

- Server-side error tracking
- Client-side error tracking
- Edge runtime error tracking
- Source map uploads (in production)
- Session replay (1% of sessions, 100% on errors)
