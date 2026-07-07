#!/usr/bin/env tsx
/**
 * Encrypt the credential-server issuer bran for VERIDIAN_ISSUER_BRAN_ENCRYPTED.
 *
 * Usage:
 *   pnpm --filter web run encrypt:veridian-issuer-bran "<plaintext-bran>"
 *
 * Requires PAYMENT_NODE_ENCRYPTION_KEY in the environment (or apps/web/.env).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { encryptPaymentNodeSecret } from "../src/lib/payment-node/encryption";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");
if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eq = trimmed.indexOf("=");
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value.replace(/^["']|["']$/g, "");
        }
      }
    }
  }
}

const bran = process.argv[2]?.trim();
if (!bran) {
  console.error(
    'Usage: pnpm --filter web run encrypt:veridian-issuer-bran "<plaintext-bran>"',
  );
  process.exit(1);
}

encryptPaymentNodeSecret(bran)
  .then((encrypted) => {
    console.log("VERIDIAN_ISSUER_BRAN_ENCRYPTED=" + encrypted);
    console.error(
      "\nSet the line above in apps/web/.env (server-only). Remove VERIDIAN_ISSUER_BRAN if present.",
    );
  })
  .catch((error: unknown) => {
    console.error("Encryption failed:", error);
    process.exit(1);
  });
