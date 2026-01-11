import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    integrations: [Sentry.replayIntegration({})],

    tracesSampleRate: 0.005,

    replaysSessionSampleRate: 0.005,

    replaysOnErrorSampleRate: 1.0,

    debug: false,
  });
}

