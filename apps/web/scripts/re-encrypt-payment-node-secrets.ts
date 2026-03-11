/**
 * Re-encrypt User.paymentNodeApiKeyEncrypted from key derived with empty salt
 * to key derived with PAYMENT_NODE_KEY_SALT. Run once after setting
 * PAYMENT_NODE_KEY_SALT in a deployment that already has encrypted secrets.
 *
 * Usage (from repo root):
 *   pnpm --filter web exec tsx scripts/re-encrypt-payment-node-secrets.ts
 *
 * Or from apps/web:
 *   pnpm exec tsx scripts/re-encrypt-payment-node-secrets.ts
 *
 * Requires: PAYMENT_NODE_ENCRYPTION_KEY and PAYMENT_NODE_KEY_SALT in env.
 * If PAYMENT_NODE_KEY_SALT is not set, the script exits without changes.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load .env from apps/web
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

async function main() {
  if (!process.env.PAYMENT_NODE_KEY_SALT?.trim()) {
    console.log(
      "PAYMENT_NODE_KEY_SALT is not set. No re-encryption needed (keys already use empty salt).",
    );
    process.exit(0);
  }

  const { decryptPaymentNodeSecret, encryptPaymentNodeSecret } =
    await import("../src/lib/payment-node/encryption");
  const prisma = (await import("@masumi/database/client")).default;

  const users = await prisma.user.findMany({
    where: { paymentNodeApiKeyEncrypted: { not: null } },
    select: { id: true, paymentNodeApiKeyEncrypted: true },
  });

  if (users.length === 0) {
    console.log("No users with encrypted payment node keys found.");
    await prisma.$disconnect();
    process.exit(0);
  }

  let ok = 0;
  let err = 0;
  for (const user of users) {
    const enc = user.paymentNodeApiKeyEncrypted;
    if (!enc) continue;
    try {
      const plain = await decryptPaymentNodeSecret(enc, {
        keySalt: Buffer.alloc(0),
      });
      const reEncrypted = await encryptPaymentNodeSecret(plain);
      await prisma.user.update({
        where: { id: user.id },
        data: { paymentNodeApiKeyEncrypted: reEncrypted },
      });
      ok++;
    } catch (e) {
      console.error(`Failed to re-encrypt for user ${user.id}:`, e);
      err++;
    }
  }

  await prisma.$disconnect();
  console.log(
    `Re-encrypted ${ok} user(s).${err > 0 ? ` Failed: ${err}.` : ""}`,
  );
  process.exit(err > 0 ? 1 : 0);
}

main();
