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
│       │   └── middleware.ts  # Next.js middleware
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

   - **SENTRY_DSN**: Your Sentry DSN (optional, for error tracking)
   - **SENTRY_AUTH_TOKEN**: Your Sentry auth token (optional, for source maps)
   - **SENTRY_PROJECT**: Your Sentry project name (defaults to "masumi-saas")

3. **Set up the database:**

   ```bash
   # Generate Prisma client
   pnpm prisma:generate

   # Run migrations
   pnpm prisma:migrate:dev
   ```

4. **Start the development server:**
   ```bash
   pnpm dev
   ```

## Features

- ✅ User authentication (email/password)
- ✅ Organization management (multi-tenant)
- ✅ API key management
- ✅ Internationalization (i18n) with next-intl
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

