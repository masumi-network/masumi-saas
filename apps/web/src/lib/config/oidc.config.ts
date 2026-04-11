import type { OIDCMetadata } from "better-auth/plugins/oidc-provider";

import { authEnvConfig } from "@/lib/config/auth.config";

export type OidcClientKey = "web" | "cli";

type TrustedOidcClient = {
  clientId: string;
  name: string;
  type: "public";
  redirectUrls: string[];
  disabled: false;
  skipConsent: true;
  metadata: Record<string, unknown>;
};

const DEFAULT_WEB_REDIRECT_URLS = ["http://localhost:3001/auth/callback"];
const DEFAULT_CLI_REDIRECT_URLS = ["http://127.0.0.1:43110/callback"];

export const OIDC_SUPPORTED_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
];

const OIDC_SUPPORTED_CLAIMS = [
  "sub",
  "iss",
  "aud",
  "exp",
  "nbf",
  "iat",
  "jti",
  "email",
  "email_verified",
  "name",
  "picture",
];

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function parseRedirectUrls(
  rawValue: string | undefined,
  fallback: string[],
): string[] {
  const values =
    rawValue && rawValue.trim().length > 0
      ? rawValue
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : fallback;

  return values.map((value) => {
    try {
      return new URL(value).toString();
    } catch {
      throw new Error(`[oidc config] Invalid redirect URL: ${value}`);
    }
  });
}

const issuer = normalizeBaseUrl(
  process.env.OIDC_PUBLIC_ISSUER_URL?.trim() || authEnvConfig.baseUrl,
);

const webRedirectUrls = parseRedirectUrls(
  process.env.OIDC_WEB_REDIRECT_URLS,
  DEFAULT_WEB_REDIRECT_URLS,
);

const cliRedirectUrls = parseRedirectUrls(
  process.env.OIDC_CLI_REDIRECT_URLS,
  DEFAULT_CLI_REDIRECT_URLS,
);

export const oidcEnvConfig = {
  issuer,
  deviceVerificationUri:
    process.env.OIDC_DEVICE_VERIFICATION_URI?.trim() || "/device",
  web: {
    clientId: process.env.OIDC_WEB_CLIENT_ID?.trim() || "masumi-spacetime-web",
    clientName: process.env.OIDC_WEB_CLIENT_NAME?.trim() || "Masumi Web App",
    redirectUrls: webRedirectUrls,
  },
  cli: {
    clientId: process.env.OIDC_CLI_CLIENT_ID?.trim() || "masumi-spacetime-cli",
    clientName: process.env.OIDC_CLI_CLIENT_NAME?.trim() || "Masumi CLI",
    redirectUrls: cliRedirectUrls,
  },
} as const;

export function getTrustedOidcClient(client: OidcClientKey): TrustedOidcClient {
  const config = oidcEnvConfig[client];

  return {
    clientId: config.clientId,
    name: config.clientName,
    type: "public",
    redirectUrls: [...config.redirectUrls],
    disabled: false,
    skipConsent: true,
    metadata: {
      firstParty: true,
      spacetime: true,
      client,
    },
  };
}

export function getTrustedOidcClients(): TrustedOidcClient[] {
  return [getTrustedOidcClient("web"), getTrustedOidcClient("cli")];
}

export function getTrustedOidcOrigins(): string[] {
  const origins = new Set<string>();

  for (const redirectUrl of oidcEnvConfig.web.redirectUrls) {
    origins.add(new URL(redirectUrl).origin);
  }

  return [...origins];
}

export function getPublicOidcMetadata(): Partial<OIDCMetadata> {
  return {
    issuer: oidcEnvConfig.issuer,
    authorization_endpoint: `${oidcEnvConfig.issuer}/api/auth/oauth2/authorize`,
    token_endpoint: `${oidcEnvConfig.issuer}/api/auth/oauth2/token`,
    userinfo_endpoint: `${oidcEnvConfig.issuer}/api/auth/oauth2/userinfo`,
    jwks_uri: `${oidcEnvConfig.issuer}/jwks`,
    registration_endpoint: `${oidcEnvConfig.issuer}/api/auth/oauth2/register`,
    end_session_endpoint: `${oidcEnvConfig.issuer}/api/auth/oauth2/endsession`,
    scopes_supported: [...OIDC_SUPPORTED_SCOPES],
    response_types_supported: ["code"] as ["code"],
    response_modes_supported: ["query"] as ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"] as [
      "authorization_code",
      ..."refresh_token"[],
    ],
    acr_values_supported: [
      "urn:mace:incommon:iap:silver",
      "urn:mace:incommon:iap:bronze",
    ],
    subject_types_supported: ["public"] as ["public"],
    id_token_signing_alg_values_supported: ["EdDSA", "none"],
    token_endpoint_auth_methods_supported: [
      "client_secret_basic",
      "client_secret_post",
      "none",
    ] as ["client_secret_basic", "client_secret_post", "none"],
    code_challenge_methods_supported: ["S256"] as ["S256"],
    claims_supported: [...OIDC_SUPPORTED_CLAIMS],
  };
}

export function getPublicAuthorizationServerMetadata() {
  return {
    ...getPublicOidcMetadata(),
    device_authorization_endpoint: `${oidcEnvConfig.issuer}/api/auth/device/code`,
    grant_types_supported: [
      "authorization_code",
      "refresh_token",
      "urn:ietf:params:oauth:grant-type:device_code",
    ],
  };
}
