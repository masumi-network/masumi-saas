import "server-only";

import type { SignifyClient as SignifyClientType } from "signify-ts";

import { veridianConfig } from "@/lib/config/veridian.config";

import { resolveIssuerBran } from "./resolve-issuer-bran";
import { SignifyClient, signifyReady, Tier } from "./signify-ts-server";

let cachedClient: Promise<SignifyClientType> | null = null;

/**
 * Signify client authenticated as the Masumi credential issuer on KERIA.
 * Reused across status polls within the same process.
 */
export async function getIssuerSignifyClient(): Promise<SignifyClientType | null> {
  const bran = await resolveIssuerBran();
  const keriaUrl = veridianConfig.keriaUrl;
  const bootUrl = veridianConfig.keriaBootUrl;

  if (!bran || !keriaUrl || !bootUrl) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = (async () => {
      await signifyReady();
      const client = new SignifyClient(keriaUrl, bran, Tier.low, bootUrl);
      await client.connect();
      return client;
    })().catch((error) => {
      cachedClient = null;
      throw error;
    });
  }

  return cachedClient;
}

/** Test helper — reset cached client between tests. */
export function resetIssuerSignifyClientCache(): void {
  cachedClient = null;
}
