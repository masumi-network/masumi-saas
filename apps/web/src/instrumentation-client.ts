import * as Sentry from "@sentry/nextjs";

Sentry.init({
  // eslint-disable-next-line no-restricted-properties
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  integrations: [Sentry.replayIntegration({})],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 0.005,

  // Capture Replay for 1% of all sessions,
  // plus for 100% of sessions with an error
  replaysSessionSampleRate: 0.005,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
});

