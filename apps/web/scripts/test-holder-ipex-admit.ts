#!/usr/bin/env tsx
/**
 * Check whether a holder has admitted an IPEX grant on issuer KERIA (bran),
 * and optionally whether the credential server lists a credential for the AID.
 *
 * Usage:
 *   npx tsx scripts/test-holder-ipex-admit.ts --holder-aid <AID>
 *   npx tsx scripts/test-holder-ipex-admit.ts --holder-aid <AID> --credential-said <SAID>
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

function readArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return undefined;
  return process.argv[idx + 1]?.trim() || undefined;
}

const holderAid = readArg("--holder-aid");
const credentialSaid = readArg("--credential-said");
const keriaUrl = process.env.VERIDIAN_KERIA_URL?.trim();
const bootUrl =
  process.env.VERIDIAN_KERIA_BOOT_URL?.trim() ??
  process.env.NEXT_PUBLIC_VERIDIAN_KERIA_BOOT_URL?.trim();
const bran = process.env.VERIDIAN_ISSUER_BRAN?.trim();
const credentialServerUrl = process.env.VERIDIAN_CREDENTIAL_SERVER_URL?.trim();
const schemaSaid = process.env.VERIDIAN_AGENT_VERIFICATION_SCHEMA_SAID?.trim();

type ExchangeMessage = {
  exn: {
    d?: string;
    dt?: string;
    i?: string;
    p?: string;
    r?: string;
    e?: {
      acdc?: { d?: string; s?: string; a?: Record<string, unknown> };
      exn?: ExchangeMessage["exn"];
    };
  };
};

async function fetchCredentialServerCredentials(
  aid: string,
): Promise<Array<{ d?: string; s?: string; dt?: string }>> {
  if (!credentialServerUrl) return [];

  const base = credentialServerUrl.replace(/\/$/, "");
  const url = `${base}/contactCredentials?contactId=${encodeURIComponent(aid)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    console.log(
      `Credential server: GET contactCredentials → ${res.status} ${res.statusText}`,
    );
    return [];
  }

  const body = (await res.json()) as { data?: unknown };
  if (!Array.isArray(body.data)) return [];
  return body.data as Array<{
    d?: string;
    s?: string;
    dt?: string;
    sad?: { d?: string; s?: string };
  }>;
}

async function main(): Promise<void> {
  if (!holderAid) {
    console.error(
      "Usage: npx tsx scripts/test-holder-ipex-admit.ts --holder-aid <AID> [--credential-said <SAID>]",
    );
    process.exit(1);
  }
  if (!keriaUrl || !bootUrl || !bran) {
    console.error(
      "FAIL: VERIDIAN_KERIA_URL, boot URL, and VERIDIAN_ISSUER_BRAN required",
    );
    process.exit(1);
  }

  console.log("Holder IPEX admit + credential server check\n");
  console.log(`Holder AID:       ${holderAid}`);
  if (credentialSaid) console.log(`Credential SAID:  ${credentialSaid}`);
  if (schemaSaid) console.log(`Schema SAID:      ${schemaSaid}`);
  console.log();

  const creds = await fetchCredentialServerCredentials(holderAid);
  console.log(`Credential server: ${creds.length} credential(s) for holder`);
  for (const cred of creds.slice(0, 10)) {
    const d = cred.d ?? cred.sad?.d;
    const s = cred.s ?? cred.sad?.s;
    const marker = credentialSaid && d === credentialSaid ? " ← target" : "";
    console.log(
      `  - d=${d ?? "?"} s=${s ?? "?"} dt=${cred.dt ?? "?"}${marker}`,
    );
  }
  console.log();

  await signifyReady();
  const client = new SignifyClient(keriaUrl, bran, Tier.low, bootUrl);
  await client.connect();

  const issuer = await client.identifiers().get("issuer");
  console.log(`Issuer prefix:    ${issuer.prefix}`);

  const admits = (await client.exchanges().list({
    filter: { "-r": "/ipex/admit", "-i": holderAid },
    limit: 50,
  })) as ExchangeMessage[];

  console.log(`IPEX admits (-i=${holderAid}): ${admits.length}\n`);

  let matchedAdmit = false;
  for (const admit of admits) {
    const grantSaid = admit.exn.p;
    let grantCredSaid: string | undefined;
    let grantSchema: string | undefined;
    let grantAgentId: string | undefined;

    if (grantSaid) {
      try {
        const grant = (await client
          .exchanges()
          .get(grantSaid)) as ExchangeMessage;
        const acdc = grant.exn.e?.acdc;
        grantCredSaid = acdc?.d;
        grantSchema = acdc?.s;
        grantAgentId = acdc?.a?.agentId as string | undefined;
      } catch {
        // grant unreadable
      }
    }

    const credMatch =
      !credentialSaid || grantCredSaid === credentialSaid
        ? "MATCH"
        : "no-match";
    if (credMatch === "MATCH" && credentialSaid) matchedAdmit = true;

    console.log(`Admit ${admit.exn.d ?? "?"}`);
    console.log(`  dt=${admit.exn.dt ?? "?"} grant=${grantSaid ?? "?"}`);
    console.log(
      `  grant.acdc.d=${grantCredSaid ?? "?"} s=${grantSchema ?? "?"} agentId=${grantAgentId ?? "?"}`,
    );
    if (credentialSaid) console.log(`  credential match: ${credMatch}`);
    console.log();
  }

  if (credentialSaid) {
    const credOnServer = creds.some(
      (c) => (c.d ?? c.sad?.d) === credentialSaid,
    );
    console.log("Summary");
    console.log(`  Credential on server: ${credOnServer ? "yes" : "no"}`);
    console.log(`  Wallet IPEX admit:    ${matchedAdmit ? "yes" : "no"}`);
    console.log(
      `  SaaS would finalize:  ${credOnServer && matchedAdmit ? "yes" : "no (still PENDING)"}`,
    );
  } else if (admits.length > 0) {
    console.log(
      "Summary: holder has at least one /ipex/admit on issuer KERIA.",
    );
  } else {
    console.log(
      "Summary: no /ipex/admit found for this holder on issuer KERIA yet.",
    );
  }
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
