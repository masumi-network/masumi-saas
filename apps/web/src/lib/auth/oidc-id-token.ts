import prisma from "@masumi/database/client";
import { getJwtToken, type JwtOptions } from "better-auth/plugins";

import { auth } from "@/lib/auth/auth";
import { authEnvConfig } from "@/lib/config/auth.config";
import {
  OIDC_ID_TOKEN_SIGNING_ALG,
  oidcEnvConfig,
} from "@/lib/config/oidc.config";

type OidcRefreshTokenUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  image: string | null;
  updatedAt: Date;
};

type OidcRefreshTokenRecord = {
  id: string;
  accessToken: string;
  accessTokenExpiresAt: Date;
  clientId: string;
  createdAt: Date;
  refreshToken: string;
  scopes: string;
  updatedAt: Date;
  user: OidcRefreshTokenUser | null;
};

function normalizeScopes(scopes: string): string[] {
  return scopes
    .split(" ")
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function buildOidcUserClaims(
  tokenRecord: NonNullable<OidcRefreshTokenRecord>,
): Record<string, unknown> {
  const user = tokenRecord.user;
  if (!user) {
    return {};
  }

  const scopes = normalizeScopes(tokenRecord.scopes);
  const claims: Record<string, unknown> = {};
  const name = user.name?.trim() || user.email;

  if (scopes.includes("profile")) {
    const [givenName, ...familyNameParts] = name.split(/\s+/).filter(Boolean);

    claims.given_name = givenName || name;
    if (familyNameParts.length > 0) {
      claims.family_name = familyNameParts.join(" ");
    }
    claims.name = name;
    claims.profile = user.image;
    claims.updated_at = new Date(user.updatedAt).toISOString();
    if (user.image) {
      claims.picture = user.image;
    }
  }

  if (scopes.includes("email")) {
    claims.email = user.email;
    claims.email_verified = user.emailVerified;
  }

  return claims;
}

export async function createIdTokenForRefreshToken(
  refreshToken: string,
): Promise<string | null> {
  const tokenRecord = (await prisma.oauthAccessToken.findUnique({
    where: { refreshToken },
    include: { user: true },
  })) as OidcRefreshTokenRecord | null;

  if (!tokenRecord?.user) {
    return null;
  }

  const scopes = normalizeScopes(tokenRecord.scopes);
  if (!scopes.includes("openid")) {
    return null;
  }

  const user = tokenRecord.user;
  const session = {
    id: tokenRecord.id,
    createdAt: tokenRecord.createdAt,
    updatedAt: tokenRecord.updatedAt,
    userId: user.id,
    expiresAt: tokenRecord.accessTokenExpiresAt,
    token: tokenRecord.accessToken,
  };

  const payload = {
    acr: "urn:mace:incommon:iap:silver",
    ...buildOidcUserClaims(tokenRecord),
  };

  const jwtOptions: JwtOptions = {
    jwt: {
      issuer: oidcEnvConfig.issuer,
      audience: tokenRecord.clientId,
      expirationTime: tokenRecord.accessTokenExpiresAt,
      getSubject: () => user.id,
      definePayload: () => payload,
    },
    jwks: {
      keyPairConfig: {
        alg: OIDC_ID_TOKEN_SIGNING_ALG,
      },
    },
  };

  const authContext = await auth.$context;

  return await getJwtToken(
    {
      method: "POST",
      path: "/api/auth/oauth2/token",
      headers: new Headers(),
      body: undefined,
      query: {},
      params: {},
      request: undefined,
      responseHeaders: new Headers(),
      context: {
        ...authContext,
        options: {
          ...authContext.options,
          baseURL: authEnvConfig.baseUrl,
        },
        session: {
          session,
          user,
        },
      },
    } as unknown as Parameters<typeof getJwtToken>[0],
    jwtOptions,
  );
}
