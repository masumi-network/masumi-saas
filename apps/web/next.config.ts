import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "path";

function parseOrigin(value: string | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Collects origins that the OIDC consent form at `/oidc/consent` is allowed
 * to be redirected to after POSTing to `/oidc/consent/submit`. The form-action
 * CSP directive applies to the whole navigation chain of a form submission
 * (including 303 redirects), so without these, Chromium/WebKit silently block
 * the cross-origin hop to the OIDC client callback (Firefox doesn't enforce
 * form-action on redirects — that's why the bug was browser-specific).
 *
 * No default fallback is applied: origins come exclusively from
 * `OIDC_WEB_REDIRECT_URLS`. Local dev that relies on a localhost OIDC client
 * must set the env var explicitly so the CSP matches the OIDC client
 * registration and no localhost origin leaks into production CSPs by default.
 */
function parseOidcRedirectOrigins(rawValue: string | undefined): string[] {
  if (!rawValue?.trim()) return [];
  const origins = new Set<string>();
  for (const value of rawValue.split(",")) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    try {
      origins.add(new URL(trimmed).origin);
    } catch {
      // Ignore malformed entries — the app side validates these anyway.
    }
  }
  return [...origins];
}

function buildContentSecurityPolicy(options: {
  sentryOrigin: string | null;
  sumsubOrigin: string | null;
  oidcRedirectOrigins: string[];
  route: "default" | "verification" | "docs";
}) {
  const connectSrc = new Set(["'self'", "https:", "wss:"]);
  const frameSrc = new Set(["'self'"]);
  const formAction = new Set(["'self'", ...options.oidcRedirectOrigins]);

  if (options.sentryOrigin) {
    connectSrc.add(options.sentryOrigin);
  }

  if (options.route === "verification" && options.sumsubOrigin) {
    connectSrc.add(options.sumsubOrigin);
    frameSrc.add(options.sumsubOrigin);
  }

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    `form-action ${[...formAction].join(" ")}`,
    "frame-ancestors 'self'",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    `connect-src ${[...connectSrc].join(" ")}`,
    `frame-src ${[...frameSrc].join(" ")}`,
    "worker-src 'self' blob:",
  ];

  if (options.route === "docs") {
    directives.push("manifest-src 'self'");
  }

  if (process.env.NODE_ENV === "production") {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

function buildSecurityHeaders() {
  const sentryOrigin = parseOrigin(process.env.NEXT_PUBLIC_SENTRY_DSN);
  const sumsubOrigin = parseOrigin(
    process.env.SUMSUB_BASE_URL || "https://api.sumsub.com",
  );
  const oidcRedirectOrigins = parseOidcRedirectOrigins(
    process.env.OIDC_WEB_REDIRECT_URLS,
  );
  const verificationPermissionsPolicy = [
    `camera=(self${sumsubOrigin ? ` "${sumsubOrigin}"` : ""})`,
    `microphone=(self${sumsubOrigin ? ` "${sumsubOrigin}"` : ""})`,
    "accelerometer=()",
    "geolocation=()",
    "gyroscope=()",
    "magnetometer=()",
    "payment=()",
    "usb=()",
  ].join(", ");

  const baseHeaders = [
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy({
        sentryOrigin,
        sumsubOrigin,
        oidcRedirectOrigins,
        route: "default",
      }),
    },
    {
      key: "Permissions-Policy",
      value:
        "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "X-Frame-Options",
      value: "SAMEORIGIN",
    },
  ];

  if (process.env.NODE_ENV === "production") {
    baseHeaders.unshift({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return {
    baseHeaders,
    verificationCsp: buildContentSecurityPolicy({
      sentryOrigin,
      sumsubOrigin,
      oidcRedirectOrigins,
      route: "verification",
    }),
    verificationPermissionsPolicy,
    docsCsp: buildContentSecurityPolicy({
      sentryOrigin,
      sumsubOrigin,
      oidcRedirectOrigins,
      route: "docs",
    }),
  };
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    root: path.resolve(process.cwd(), "../.."),
  },
  async headers() {
    const securityHeaders = buildSecurityHeaders();

    return [
      {
        source: "/:path*",
        headers: securityHeaders.baseHeaders,
      },
      {
        source: "/verification/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: securityHeaders.verificationCsp,
          },
          {
            key: "Permissions-Policy",
            value: securityHeaders.verificationPermissionsPolicy,
          },
        ],
      },
      {
        source: "/docs/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: securityHeaders.docsCsp,
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/docs/saas-api",
        destination: "/docs/saas-openapi",
        permanent: true,
      },
      {
        source: "/docs/api",
        destination: "/docs/saas-openapi",
        permanent: true,
      },
      // /docs is handled by app/docs/page.tsx so local routes (e.g. /docs/saas-openapi)
      // are never shadowed by a config redirect; trailing slash normalizes to the same page.
      { source: "/agents", destination: "/ai-agents", permanent: true },
      {
        source: "/agents/:path*",
        destination: "/ai-agents/:path*",
        permanent: true,
      },
    ];
  },
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
