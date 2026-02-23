#!/usr/bin/env node
/**
 * Creates the Masumi Agent Verification credential schema via the credential-schema-builder API
 * and saves it for use with VERIDIAN_AGENT_VERIFICATION_SCHEMA_SAID.
 *
 * Prerequisite: Start the credential-schema-builder backend first:
 *   cd credential-schema-builder && npm run dev
 *
 * Usage: node scripts/create-agent-verification-schema.mjs
 *   API URL: CREDENTIAL_SCHEMA_BUILDER_URL env or http://localhost:3001
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_BASE =
  process.env.CREDENTIAL_SCHEMA_BUILDER_URL || "http://localhost:3001";
const SCHEMAS_DIR = path.join(__dirname, "schemas");
const OUTPUT_FILE = path.join(SCHEMAS_DIR, "masumi-agent-verification.json");

const MASUMI_AGENT_VERIFICATION_SCHEMA = {
  title: "Masumi Verified Agent",
  description:
    "Verifiable credential attesting that an AI agent on the Masumi platform has been verified. Issued after the agent owner completes KYC and proves control of the agent's KERI identifier.",
  credentialType: "MasumiVerifiedAgentCredential",
  version: "1.0.0",
  attributes: [
    {
      name: "kycVerificationId",
      type: "string",
      description:
        "ID of the KYC verification record for the user who requested verification",
      required: true,
    },
    {
      name: "agentId",
      type: "string",
      description: "The identifier of the agent in the masumi registry",
      required: true,
    },
    {
      name: "agentName",
      type: "string",
      description: "The name of the agent",
      required: true,
    },
    {
      name: "agentApiUrl",
      type: "string",
      description: "Base API URL of the agent",
      required: true,
    },
    {
      name: "signature",
      type: "string",
      description: "HMAC-SHA256(challenge, secret) proving agent ownership",
      required: true,
    },
  ],
};

async function main() {
  console.log("Creating Masumi Verified Agent schema via API...");
  console.log("API base:", API_BASE);

  const res = await fetch(`${API_BASE}/api/schemas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(MASUMI_AGENT_VERIFICATION_SCHEMA),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("API error:", data.error || res.statusText);
    process.exit(1);
  }

  if (!data.success || !data.data) {
    console.error("Invalid response:", data);
    process.exit(1);
  }

  const { schema, said, attributesSaid } = data.data;

  if (!fs.existsSync(SCHEMAS_DIR)) {
    fs.mkdirSync(SCHEMAS_DIR, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(schema, null, 2), "utf8");

  console.log("\nSchema written to:", OUTPUT_FILE);
  console.log("\nSchema SAID (use in .env):");
  console.log('VERIDIAN_AGENT_VERIFICATION_SCHEMA_SAID="' + said + '"');
  if (attributesSaid) {
    console.log("\nAttributes block SAID:", attributesSaid);
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Failed:", err.message);
  if (err.cause?.code === "ECONNREFUSED") {
    console.error(
      "\nMake sure the credential-schema-builder backend is running:",
    );
    console.error("  cd credential-schema-builder && npm run dev");
  }
  process.exit(1);
});
