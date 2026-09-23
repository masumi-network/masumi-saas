#!/usr/bin/env tsx
/**
 * Smoke-test issuer KERIA Signify connectivity (connect URL + boot URL + bran).
 * Does not print secrets.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ready as signifyReady, SignifyClient, Tier } from "signify-ts";

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

const keriaUrl = process.env.VERIDIAN_KERIA_URL?.trim();
const bootUrl =
  process.env.VERIDIAN_KERIA_BOOT_URL?.trim() ??
  process.env.NEXT_PUBLIC_VERIDIAN_KERIA_BOOT_URL?.trim();
const bran = process.env.VERIDIAN_ISSUER_BRAN?.trim();

async function main(): Promise<void> {
  console.log("Issuer KERIA connectivity check\n");

  if (!keriaUrl) {
    console.error("FAIL: VERIDIAN_KERIA_URL is not set");
    process.exit(1);
  }
  if (!bootUrl) {
    console.error(
      "FAIL: VERIDIAN_KERIA_BOOT_URL or NEXT_PUBLIC_VERIDIAN_KERIA_BOOT_URL is not set",
    );
    process.exit(1);
  }
  if (!bran) {
    console.error(
      "FAIL: VERIDIAN_ISSUER_BRAN is not set (or decrypt VERIDIAN_ISSUER_BRAN_ENCRYPTED)",
    );
    process.exit(1);
  }

  console.log(`Connect URL: ${keriaUrl}`);
  console.log(`Boot URL:    ${bootUrl}`);
  console.log(`Bran:        set (${bran.length} chars)\n`);

  await signifyReady();
  const client = new SignifyClient(keriaUrl, bran, Tier.low, bootUrl);

  try {
    await client.connect();
    console.log("OK: SignifyClient.connect() succeeded");
  } catch (error) {
    console.error("FAIL: connect()", error);
    process.exit(1);
  }

  try {
    const issuer = await client.identifiers().get("issuer");
    console.log(`OK: issuer identifier prefix = ${issuer.prefix}`);
  } catch (error) {
    console.error("FAIL: identifiers().get('issuer')", error);
    process.exit(1);
  }

  try {
    const admits = await client.exchanges().list({
      filter: { "-r": "/ipex/admit" },
      limit: 5,
    });
    const count = Array.isArray(admits) ? admits.length : 0;
    console.log(`OK: exchanges().list(/ipex/admit) returned ${count} item(s)`);
  } catch (error) {
    console.error("FAIL: exchanges().list()", error);
    process.exit(1);
  }

  try {
    const notifications = await client.notifications().list();
    const notes = notifications.notes ?? [];
    console.log(`OK: notifications().list() returned ${notes.length} item(s)`);

    let admitCount = 0;
    for (const notif of notes.slice(0, 50)) {
      try {
        const exn = await client.exchanges().get(notif.a.d);
        if (exn?.exn?.r === "/ipex/admit") admitCount += 1;
      } catch {
        // skip unreadable notes
      }
    }
    console.log(
      `OK: sampled admits (/ipex/admit) in recent notifications: ${admitCount}`,
    );
  } catch (error) {
    console.error("FAIL: notifications().list()", error);
    process.exit(1);
  }

  console.log(
    "\nAll checks passed — SaaS can reach issuer KERIA for admit polling.",
  );
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
