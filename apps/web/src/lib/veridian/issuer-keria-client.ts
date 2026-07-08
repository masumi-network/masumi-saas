import "server-only";

import type { SignifyClient as SignifyClientType } from "signify-ts";

import { veridianConfig } from "@/lib/config/veridian.config";

import { resolveIssuerBran } from "./resolve-issuer-bran";
import { SignifyClient, signifyReady, Tier } from "./signify-ts-server";

let cachedClient: Promise<SignifyClientType> | null = null;
let cachedAt = 0;

/**
 * Time-to-live for the cached issuer client. Without a TTL the client is held
 * for the whole process lifetime, so a KERIA session expiry or a rotated bran
 * would leave a stale client that silently fails polls with no way to recover.
 */
const ISSUER_CLIENT_TTL_MS = 30 * 60 * 1000;

/**
 * Signify client authenticated as the Masumi credential issuer on KERIA.
 * Reused across status polls within the same process, refreshed after the TTL.
 */
export async function getIssuerSignifyClient(): Promise<SignifyClientType | null> {
  const bran = await resolveIssuerBran();
  const keriaUrl = veridianConfig.keriaUrl;
  const bootUrl = veridianConfig.keriaBootUrl;

  if (!bran || !keriaUrl || !bootUrl) {
    return null;
  }

  if (cachedClient && Date.now() - cachedAt >= ISSUER_CLIENT_TTL_MS) {
    cachedClient = null;
  }

  if (!cachedClient) {
    cachedAt = Date.now();
    cachedClient = (async () => {
      await signifyReady();
      const client = new SignifyClient(keriaUrl, bran, Tier.low, bootUrl);
      await client.connect();
      return client;
    })().catch(() => {
      cachedClient = null;
      // SignifyClient constructor/connect receives the `bran` (a secret) and may
      // embed it in a thrown error. Log only a coarse marker and throw a
      // sanitized error so the bran never reaches route 500 handlers / logs.
      console.error("[Veridian] Issuer KERIA connect failed");
      throw new Error("Issuer KERIA connection failed");
    });
  }

  return cachedClient;
}

/** Test helper — reset cached client between tests. */
export function resetIssuerSignifyClientCache(): void {
  cachedClient = null;
  cachedAt = 0;
}
