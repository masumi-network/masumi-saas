import type { OAuthOptions, Scope } from "@better-auth/oauth-provider";
import { APIError } from "better-auth/api";

import {
  OIDC_ID_TOKEN_SIGNING_ALG,
  OIDC_SUPPORTED_CLAIMS,
  oidcEnvConfig,
} from "@/lib/config/oidc.config";
import { OIDC_SUPPORTED_SCOPES } from "@/lib/config/oidc-scopes.config";

import { createConfigClientDiscovery } from "./config-clients";
import {
  OIDC_ACCESS_DENIED,
  OIDC_NO_STORE_HEADERS,
  OIDC_USER_BANNED,
} from "./constants";

const ACCESS_TOKEN_EXPIRES_IN_SECONDS = 3600;
const REFRESH_TOKEN_EXPIRES_IN_SECONDS = 604800;
const ID_TOKEN_EXPIRES_IN_SECONDS = 3600;

type IdTokenClaimUser = {
  email: string;
  emailVerified: boolean;
  name?: string | null;
  image?: string | null;
  updatedAt?: Date | string | null;
};

/**
 * Profile and email claims for ID tokens. The 1.7 provider only puts these
 * claims on the UserInfo response, but SpacetimeDB and the CLI read them from
 * the ID token, so this keeps the pre-1.7 ID-token claim set.
 */
export function buildOidcIdTokenClaims(
  user: IdTokenClaimUser,
  scopes: readonly string[],
): Record<string, unknown> {
  const claims: Record<string, unknown> = {};

  if (scopes.includes("profile")) {
    const name = user.name?.trim() || user.email;
    const [givenName, ...familyNameParts] = name.split(/\s+/).filter(Boolean);
    claims.name = name;
    claims.given_name = givenName || name;
    if (familyNameParts.length > 0) {
      claims.family_name = familyNameParts.join(" ");
    }
    if (user.image) {
      claims.picture = user.image;
      claims.profile = user.image;
    }
    if (user.updatedAt) {
      claims.updated_at = new Date(user.updatedAt).toISOString();
    }
  }

  if (scopes.includes("email")) {
    claims.email = user.email;
    claims.email_verified = user.emailVerified;
  }

  return claims;
}

/**
 * Options for `oauthProvider()`. Exported so the session bridge and token
 * validation can reach the provider API with the same settings.
 */
/**
 * Token-time gate: a banned user gets no OIDC tokens on any grant (code,
 * refresh, session bridge). The authorize hooks only see the request, and a
 * refresh token outlives the ban. Email verification is not checked here: a
 * refresh for a user who lost verification still works and the ID token
 * carries `email_verified: false`.
 */
export function assertUserMayReceiveOidcTokens(
  user: Record<string, unknown> | null | undefined,
): void {
  if (user?.banned === true) {
    throw new APIError(
      "FORBIDDEN",
      { error: OIDC_ACCESS_DENIED, error_description: OIDC_USER_BANNED },
      OIDC_NO_STORE_HEADERS,
    );
  }
}

export const oidcProviderOptions = {
  loginPage: "/signin",
  consentPage: "/oidc/consent",
  scopes: [...OIDC_SUPPORTED_SCOPES] as Scope[],
  grantTypes: ["authorization_code", "refresh_token"],
  storeClientSecret: "hashed",
  accessTokenExpiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
  refreshTokenExpiresIn: REFRESH_TOKEN_EXPIRES_IN_SECONDS,
  idTokenExpiresIn: ID_TOKEN_EXPIRES_IN_SECONDS,
  // Clients come from config only (see config-clients.ts). Deny every
  // user-driven client create/read/update/delete endpoint.
  clientPrivileges: () => false,
  extensions: [{ clientDiscovery: createConfigClientDiscovery() }],
  // Runs before every token issuance (code, refresh, session bridge).
  customTokenResponseFields: ({ user }) => {
    assertUserMayReceiveOidcTokens(user);
    return {};
  },
  customIdTokenClaims: ({ user, scopes }) =>
    buildOidcIdTokenClaims(user, scopes),
  advertisedMetadata: {
    scopes_supported: [...OIDC_SUPPORTED_SCOPES] as Scope[],
    claims_supported: [...OIDC_SUPPORTED_CLAIMS],
  },
} satisfies OAuthOptions<Scope[]>;

export const oidcJwtPluginOptions = {
  jwt: { issuer: oidcEnvConfig.issuer },
  jwks: { keyPairConfig: { alg: OIDC_ID_TOKEN_SIGNING_ALG } },
} as const;
