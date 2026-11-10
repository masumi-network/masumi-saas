import type {
  ClientDiscovery,
  SchemaClient,
} from "@better-auth/oauth-provider";

import {
  getTrustedOidcClient,
  resolveOidcClientKey,
} from "@/lib/config/oidc.config";
import {
  getAllowedScopesForClient,
  type OidcClientKey,
} from "@/lib/config/oidc-scopes.config";

/**
 * Provenance id stored on the `oauthClient` rows this module owns. The
 * provider only calls `resolve` for rows carrying this id, so changing it
 * orphans the existing rows.
 */
export const CONFIG_CLIENT_DISCOVERY_ID = "masumi-config";

const OAUTH_CLIENT_MODEL = "oauthClient";
const DEVICE_CODE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";
const UNIQUE_VIOLATION_CODES = new Set(["P2002", "23505"]);

/** The `oauthClient` fields that config owns. Everything else is left alone. */
export type ConfigOidcClientRow = {
  clientId: string;
  clientDiscoveryId: string;
  name: string;
  disabled: boolean;
  skipConsent: boolean;
  enableEndSession: boolean;
  requirePKCE: boolean;
  tokenEndpointAuthMethod: "none";
  applicationType: "web" | "native";
  redirectUris: string[];
  grantTypes: string[];
  responseTypes: ["code"];
  scopes: string[];
  metadata: string;
};

/**
 * Builds the `oauthClient` row for a config-defined first-party client.
 * Both clients are public (PKCE, no secret). The CLI also polls the device
 * grant and skips the consent screen; the web client always shows consent.
 */
export function buildConfigOidcClientRow(
  clientKey: OidcClientKey,
): ConfigOidcClientRow {
  const client = getTrustedOidcClient(clientKey);
  const isCli = clientKey === "cli";

  return {
    clientId: client.clientId,
    clientDiscoveryId: CONFIG_CLIENT_DISCOVERY_ID,
    name: client.name,
    disabled: false,
    skipConsent: client.skipConsent,
    // Lets the provider emit `sid` in ID tokens and serve end-session.
    enableEndSession: true,
    requirePKCE: true,
    tokenEndpointAuthMethod: "none",
    applicationType: isCli ? "native" : "web",
    redirectUris: [...client.redirectUrls],
    grantTypes: isCli
      ? ["authorization_code", "refresh_token", DEVICE_CODE_GRANT]
      : ["authorization_code", "refresh_token"],
    responseTypes: ["code"],
    scopes: getAllowedScopesForClient(clientKey),
    metadata: JSON.stringify(client.metadata),
  };
}

function sameList(have: unknown, want: unknown[]): boolean {
  return (
    Array.isArray(have) &&
    have.length === want.length &&
    have.every((value, index) => value === want[index])
  );
}

/** True when the stored row already matches config (no write needed). */
export function isConfigOidcClientRowCurrent(
  existing: Record<string, unknown>,
  desired: ConfigOidcClientRow,
): boolean {
  return (Object.keys(desired) as Array<keyof ConfigOidcClientRow>).every(
    (key) => {
      const want = desired[key];
      const have = existing[key];
      if (Array.isArray(want)) {
        return sameList(have, want);
      }
      if (key === "metadata") {
        // The adapter may hand back parsed JSON for json-typed fields.
        const normalized =
          typeof have === "string" ? have : JSON.stringify(have ?? null);
        return normalized === want;
      }
      return have === want;
    },
  );
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && UNIQUE_VIOLATION_CODES.has(code);
}

/**
 * Client discovery for the config-defined clients. The token, consent, and
 * device tables reference `oauthClient.clientId`, so each config client must
 * exist as a row. `resolve` creates the row on first use and refreshes it
 * whenever config changes. It is idempotent; a concurrent create that loses
 * the unique-key race re-reads the winner's row.
 */
export function createConfigClientDiscovery(): ClientDiscovery {
  return {
    id: CONFIG_CLIENT_DISCOVERY_ID,
    matches: (clientId) => resolveOidcClientKey(clientId) !== null,
    async resolve(ctx, clientId, existing) {
      const clientKey = resolveOidcClientKey(clientId);
      if (!clientKey) return null;

      const desired = buildConfigOidcClientRow(clientKey);
      const adapter = ctx.context.adapter;
      const where = [{ field: "clientId", value: clientId }];

      if (existing) {
        if (
          isConfigOidcClientRowCurrent(
            existing as unknown as Record<string, unknown>,
            desired,
          )
        ) {
          return existing;
        }
        const updated = await adapter.update<SchemaClient>({
          model: OAUTH_CLIENT_MODEL,
          where,
          update: { ...desired, updatedAt: new Date() },
        });
        return updated ?? ({ ...existing, ...desired } as SchemaClient);
      }

      try {
        const now = new Date();
        return await adapter.create<Record<string, unknown>, SchemaClient>({
          model: OAUTH_CLIENT_MODEL,
          data: { ...desired, createdAt: now, updatedAt: now },
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        return await adapter.findOne<SchemaClient>({
          model: OAUTH_CLIENT_MODEL,
          where,
        });
      }
    },
  };
}
