/**
 * Live smoke test for the Veridian shim that sits on top of
 * `@masumi_network/identity-sdk`.
 *
 * Proves end-to-end that:
 *   1. The SDK package loads and instantiates with env-based config.
 *   2. The shim's exported functions reach the real production credential
 *      server and return well-formed data.
 *   3. The credential utility helpers (validate / extract / find) re-exported
 *      from the SDK work on real inputs.
 *
 * Requires `.env` with VERIDIAN_CREDENTIAL_SERVER_URL set (already configured
 * to https://cred-issuance.masumi-identity.xyz in this repo).
 */

import { beforeAll, describe, expect, it } from "vitest";

import type { Credential as CredentialType } from "./index";

type VeridianShim = typeof import("./index");
let shim: VeridianShim;

beforeAll(async () => {
  if (
    !process.env.VERIDIAN_CREDENTIAL_SERVER_URL &&
    typeof process.loadEnvFile === "function"
  ) {
    process.loadEnvFile(".env");
  }
  shim = await import("./index");
});

describe("SMOKE — @masumi_network/identity-sdk via veridian shim (live prod)", () => {
  it("exposes config helpers backed by env", () => {
    expect(shim.getCredentialServerUrl()).toMatch(/^https?:\/\//);
    expect(shim.getAgentVerificationSchemaSaid()).toMatch(
      /^[A-Za-z0-9_-]{44}$/,
    );
  });

  it("getIssuerOobi() returns a live OOBI from the credential server", async () => {
    const oobi = await shim.getIssuerOobi();
    expect(oobi).toEqual(expect.any(String));
    expect(oobi).toMatch(/^https?:\/\//);
    expect(oobi).toContain("oobi");
  }, 30_000);

  it("checkContactExists() resolves to a boolean for an arbitrary AID", async () => {
    const bogusAid = "E" + "A".repeat(43);
    const exists = await shim.checkContactExists(bogusAid);
    expect(typeof exists).toBe("boolean");
  }, 30_000);

  it("credential utility helpers operate on a mock credential", () => {
    const schemaSaid = shim.getAgentVerificationSchemaSaid();
    const cred: CredentialType = {
      sad: {
        d: "EMOCK_CREDENTIAL_SAID_DDDDDDDDDDDDDDDDDDDDDDD",
        i: "EMOCK_ISSUER_AID_DDDDDDDDDDDDDDDDDDDDDDDDDDD",
        ri: "",
        s: schemaSaid,
        a: {
          d: "EMOCK_ATTRS_SAID_DDDDDDDDDDDDDDDDDDDDDDDDDD",
          i: "EMOCK_RECIPIENT_AID_DDDDDDDDDDDDDDDDDDDDDDD",
          dt: "2026-04-20T00:00:00.000000+00:00",
          agentId: "agent-42",
          name: "Test Agent",
        },
      },
      schema: {} as unknown as CredentialType["schema"],
      status: { s: "0" },
    };

    const attrs = shim.extractCredentialAttributes(cred);
    expect(attrs).toMatchObject({ agentId: "agent-42", name: "Test Agent" });

    const found = shim.findCredentialBySchema([cred], schemaSaid);
    expect(found).toBe(cred);

    const result = shim.validateCredential(cred);
    expect(result.isValid).toBe(true);
    expect(result.status).toBe("issued");
  });
});
