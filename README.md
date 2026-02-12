# Masumi SaaS

A fullstack SaaS boilerplate built with Next.js, Prisma, PostgreSQL, Better Auth, next-intl, and Sentry.

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

This project follows the three-layer architecture pattern:

1. **Repositories** (`packages/database/src/repositories/`) - Database access layer
2. **Services** (`apps/web/src/lib/services/`) - Business logic coordination
3. **Actions** (`apps/web/src/lib/actions/`) - Server mutations

## Project Structure

```
masumi-saas/
├── apps/
│   └── web/                   # Next.js application
│       ├── src/
│       │   ├── app/           # App Router routes
│       │   │   ├── (app)/     # Authenticated routes
│       │   │   ├── (auth)/    # Authentication routes
│       │   │   └── api/        # API routes
│       │   ├── components/    # UI components
│       │   ├── lib/            # Domain logic
│       │   │   ├── actions/   # Server actions
│       │   │   ├── services/  # Business logic
│       │   │   ├── schemas/   # Zod schemas
│       │   │   └── auth/      # Better Auth setup
│       └── messages/           # i18n messages
├── packages/
│   └── database/              # Shared database layer
│       ├── src/
│       │   ├── repositories/  # Prisma access layer
│       │   └── client.ts      # Prisma client
│       └── prisma/
│           └── schema.prisma  # Database schema
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
     - Example: `postgresql://postgres:mypassword@localhost:5432/masumi_saas?schema=public`

   - **BETTER_AUTH_SECRET**: A random secret key for signing session tokens
     - Generate one with: `openssl rand -base64 32`
     - Or use any secure random string (keep it secret!)

   - **BETTER_AUTH_URL**: Your application's base URL
     - For local development: `http://localhost:3000`
     - For production: Your production domain (e.g., `https://yourdomain.com`)

   - **POSTMARK_SERVER_ID**: Your Postmark server API token (optional, for email sending)
     - Get one from [Postmark](https://postmarkapp.com/)
     - If not set, password reset emails will be logged to console in development

   - **POSTMARK_FROM_EMAIL**: The email address to send emails from (optional)
     - Defaults to `noreply@masumi.network` if not set
     - Must be a verified sender in your Postmark account

   - **SENTRY_DSN**: Your Sentry DSN (optional, for error tracking)
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

## Admin Management

The project includes a CLI tool for managing admin users. No need to manually look up user IDs in the database — just use their email address.

### Setting Up Your First Admin

1. Sign up normally at `/signup`
2. Run the promote command:

   ```bash
   pnpm admin:promote your@email.com
   ```

The script updates the user's role in the database and automatically syncs `ADMIN_USER_IDS` in `apps/web/.env`.

### Available Commands

```bash
# Promote one or more users to admin
pnpm admin:promote user@example.com
pnpm admin:promote user1@example.com user2@example.com

# Demote an admin back to regular user
pnpm admin:demote user@example.com

# List all current admin users
pnpm admin:list
```

After promoting a user, they can sign in at `/admin/signin` to access the admin dashboard.

## Features

- ✅ User authentication (email/password, forgot password)
- ✅ Organization management (multi-tenant)
- ✅ API key management
- ✅ Cookie consent banner
- ✅ Error tracking with Sentry
- ✅ Dark/light theme (auto-detect)
- ✅ Responsive design
- ✅ Server-side rendering with Suspense
- ✅ Three-layer architecture (repositories/services/actions)

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
- **Localization**: Built-in support for multiple languages

## Sentry Integration

Sentry is configured for:

- Server-side error tracking
- Client-side error tracking
- Edge runtime error tracking
- Source map uploads (in production)
- Session replay (1% of sessions, 100% on errors)
