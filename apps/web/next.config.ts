/* eslint-disable no-restricted-properties */
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

const withNextIntl = createNextIntlPlugin();

const configWithIntl = withNextIntl(nextConfig);

const shouldUseSentry =
  process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.SENTRY_AUTH_TOKEN;

export default shouldUseSentry
  ? withSentryConfig(configWithIntl, {
      telemetry: process.env.NODE_ENV === "production",
      org: "masumi",
      project: process.env.SENTRY_PROJECT ?? "masumi-saas",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      widenClientFileUpload: true,
      silent: !process.env.CI,
      tunnelRoute: true,
      disableLogger: true,
      autoInstrumentMiddleware: process.env.NODE_ENV === "production",
      reactComponentAnnotation: {
        enabled: true,
      },
    })
  : configWithIntl;

