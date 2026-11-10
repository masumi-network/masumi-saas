import "server-only";

import prisma from "@masumi/database/client";

import {
  getTrustedOidcClients,
  resolveOidcClientKey,
} from "@/lib/config/oidc.config";

export type ConnectedOidcClient = {
  clientId: string;
  name: string;
  icon: string | null;
  isFirstParty: boolean;
  scopes: string[];
  activeTokenCount: number;
  lastTokenIssuedAt: Date | null;
  firstConnectedAt: Date | null;
  lastConnectedAt: Date | null;
};

function mergeScopes(existing: string[], incoming: Iterable<string>): string[] {
  const set = new Set(existing);
  for (const scope of incoming) {
    const trimmed = scope?.trim();
    if (trimmed) set.add(trimmed);
  }
  return [...set];
}

function pickEarlier(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a.getTime() <= b.getTime() ? a : b;
}

function pickLater(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a.getTime() >= b.getTime() ? a : b;
}

/**
 * Lists every OIDC client the user has ever authorized, aggregating data from
 * OauthConsent (consent records), OauthAccessToken / OauthRefreshToken (issued
 * tokens), and OidcUserGrant (per-user granular scope memory).
 *
 * First-party clients (spacetime web/cli, defined in oidc.config) are resolved
 * against their config name/icon; other clients fall back to OauthClient
 * metadata.
 */
export async function listConnectedOidcClients(
  userId: string,
): Promise<ConnectedOidcClient[]> {
  const now = new Date();
  const bucket = new Map<
    string,
    {
      scopes: string[];
      activeTokenCount: number;
      lastTokenIssuedAt: Date | null;
      firstConnectedAt: Date | null;
      lastConnectedAt: Date | null;
    }
  >();

  const upsertBucket = (clientId: string) => {
    const existing = bucket.get(clientId);
    if (existing) return existing;
    const fresh = {
      scopes: [] as string[],
      activeTokenCount: 0,
      lastTokenIssuedAt: null as Date | null,
      firstConnectedAt: null as Date | null,
      lastConnectedAt: null as Date | null,
    };
    bucket.set(clientId, fresh);
    return fresh;
  };

  const [consents, accessTokens, refreshTokens, grants] = await Promise.all([
    prisma.oauthConsent.findMany({
      where: { userId },
      select: {
        clientId: true,
        scopes: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.oauthAccessToken.findMany({
      where: { userId },
      select: {
        clientId: true,
        scopes: true,
        createdAt: true,
        expiresAt: true,
        revoked: true,
        refreshId: true,
      },
    }),
    prisma.oauthRefreshToken.findMany({
      where: { userId },
      select: {
        clientId: true,
        scopes: true,
        createdAt: true,
        expiresAt: true,
        revoked: true,
      },
    }),
    prisma.oidcUserGrant.findMany({
      where: { userId },
      select: { clientId: true, scopes: true, updatedAt: true },
    }),
  ]);

  for (const consent of consents) {
    const entry = upsertBucket(consent.clientId);
    entry.scopes = mergeScopes(entry.scopes, consent.scopes);
    entry.firstConnectedAt = pickEarlier(
      entry.firstConnectedAt,
      consent.createdAt,
    );
    entry.lastConnectedAt = pickLater(entry.lastConnectedAt, consent.updatedAt);
  }

  // A live refresh token keeps the connection active; an access token counts
  // on its own only when no refresh token backs it.
  const tokens = [
    ...accessTokens,
    ...refreshTokens.map((token) => ({ ...token, refreshId: null })),
  ];
  for (const token of tokens) {
    const entry = upsertBucket(token.clientId);
    entry.scopes = mergeScopes(entry.scopes, token.scopes);
    entry.firstConnectedAt = pickEarlier(
      entry.firstConnectedAt,
      token.createdAt,
    );
    entry.lastConnectedAt = pickLater(entry.lastConnectedAt, token.createdAt);
    entry.lastTokenIssuedAt = pickLater(
      entry.lastTokenIssuedAt,
      token.createdAt,
    );
    if (!token.refreshId && !token.revoked && token.expiresAt > now) {
      entry.activeTokenCount += 1;
    }
  }

  for (const grant of grants) {
    const entry = upsertBucket(grant.clientId);
    entry.scopes = mergeScopes(entry.scopes, grant.scopes ?? []);
    entry.lastConnectedAt = pickLater(entry.lastConnectedAt, grant.updatedAt);
  }

  if (bucket.size === 0) {
    return [];
  }

  const trustedClients = getTrustedOidcClients();
  const dynamicClientIds = [...bucket.keys()].filter(
    (clientId) => resolveOidcClientKey(clientId) === null,
  );
  const dynamicClients = dynamicClientIds.length
    ? await prisma.oauthClient.findMany({
        where: { clientId: { in: dynamicClientIds } },
        select: { clientId: true, name: true, icon: true },
      })
    : [];
  const dynamicByClientId = new Map(
    dynamicClients.map((item) => [item.clientId, item]),
  );

  const result: ConnectedOidcClient[] = [];
  for (const [clientId, entry] of bucket.entries()) {
    const trusted = trustedClients.find((item) => item.clientId === clientId);
    const dynamic = dynamicByClientId.get(clientId);
    const name = trusted?.name ?? dynamic?.name ?? clientId;
    const icon = dynamic?.icon ?? null;

    result.push({
      clientId,
      name,
      icon,
      isFirstParty: Boolean(trusted),
      scopes: entry.scopes.sort(),
      activeTokenCount: entry.activeTokenCount,
      lastTokenIssuedAt: entry.lastTokenIssuedAt,
      firstConnectedAt: entry.firstConnectedAt,
      lastConnectedAt: entry.lastConnectedAt,
    });
  }

  result.sort((a, b) => {
    const aTime = a.lastConnectedAt?.getTime() ?? 0;
    const bTime = b.lastConnectedAt?.getTime() ?? 0;
    return bTime - aTime;
  });

  return result;
}

/**
 * Terminates every OIDC connection the user has with `clientId`:
 *   - Deletes issued access and refresh tokens (kills silent refresh)
 *   - Deletes the stored consent record (forces re-consent next sign-in)
 *   - Deletes granular scope grants (resets remembered permissions)
 *
 * Returns counts per table so the caller can report to the user / audit log.
 * Idempotent: running twice returns zeroes the second time.
 */
export async function revokeOidcClientConnection(
  userId: string,
  clientId: string,
): Promise<{
  deletedTokens: number;
  deletedConsents: number;
  deletedGrants: number;
}> {
  // Access tokens reference refresh tokens, so they go first.
  const [accessTokens, refreshTokens, consents, grants] =
    await prisma.$transaction([
      prisma.oauthAccessToken.deleteMany({ where: { userId, clientId } }),
      prisma.oauthRefreshToken.deleteMany({ where: { userId, clientId } }),
      prisma.oauthConsent.deleteMany({ where: { userId, clientId } }),
      prisma.oidcUserGrant.deleteMany({ where: { userId, clientId } }),
    ]);

  return {
    deletedTokens: accessTokens.count + refreshTokens.count,
    deletedConsents: consents.count,
    deletedGrants: grants.count,
  };
}
