import { describe, expect, it, vi } from "vitest";

import type { Credential } from "@/lib/veridian";

vi.mock("@/lib/veridian", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/veridian")>();
  return {
    ...actual,
    validateCredential: vi.fn(() => ({ isValid: true, status: "valid" })),
  };
});

import { resolvePendingWalletCredential } from "./resolve-pending-wallet-credential";

const SCHEMA = "ESchema123";
const POLICY = "a".repeat(56);
const ROOT = "b".repeat(56);
const AGENT_ID = `${POLICY}00${ROOT}000000`;
const AGENT_ROOT = `${POLICY}${ROOT}`;

function cred(params: {
  d: string;
  dt: string;
  signature: string;
  agentId?: string;
}): Credential {
  return {
    sad: {
      d: params.d,
      s: SCHEMA,
      a: {
        dt: params.dt,
        signature: params.signature,
        agentId: params.agentId ?? AGENT_ROOT,
      },
    },
  } as Credential;
}

describe("resolvePendingWalletCredential", () => {
  const pendingCreatedAt = new Date("2026-07-02T12:00:00.000Z");

  it("returns null when only an older credential with a different signature exists", () => {
    const result = resolvePendingWalletCredential({
      pending: {
        createdAt: pendingCreatedAt,
        attributes: JSON.stringify({
          signature: "new-signature",
          agentId: AGENT_ROOT,
        }),
      },
      credentials: [
        cred({
          d: "Eold",
          dt: "2026-07-01T10:00:00.000Z",
          signature: "old-signature",
        }),
      ],
      schemaSaid: SCHEMA,
      versionedAgentIdentifier: AGENT_ID,
    });

    expect(result).toBeNull();
  });

  it("matches when signature and issue time align with the pending row", () => {
    const matching = cred({
      d: "Enew",
      dt: "2026-07-02T12:01:00.000Z",
      signature: "new-signature",
    });

    const result = resolvePendingWalletCredential({
      pending: {
        createdAt: pendingCreatedAt,
        attributes: JSON.stringify({
          signature: "new-signature",
          agentId: AGENT_ROOT,
        }),
      },
      credentials: [
        cred({
          d: "Eold",
          dt: "2026-07-01T10:00:00.000Z",
          signature: "old-signature",
        }),
        matching,
      ],
      schemaSaid: SCHEMA,
      versionedAgentIdentifier: AGENT_ID,
    });

    expect(result?.sad?.d).toBe("Enew");
  });
});
