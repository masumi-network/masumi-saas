import { describe, expect, it } from "vitest";

import {
  credentialMatchesAgentRegistryId,
  parseStoredCredentialAttributes,
  withStoredHolderOobi,
} from "./stored-credential-attributes";

const POLICY_ID = "a".repeat(56);
const ROOT = "b".repeat(56);
const VERSIONED = POLICY_ID + "10" + ROOT + "000001";

describe("stored credential attributes", () => {
  it("round-trips holder OOBI metadata", () => {
    const stored = withStoredHolderOobi(
      { agentId: "x" },
      "https://holder/oobi",
    );
    const parsed = parseStoredCredentialAttributes(JSON.stringify(stored));
    expect(parsed.holderOobi).toBe("https://holder/oobi");
    expect(parsed.attributes).toEqual({ agentId: "x" });
  });

  it("matches version-independent and versioned agent ids", () => {
    expect(credentialMatchesAgentRegistryId(POLICY_ID + ROOT, VERSIONED)).toBe(
      true,
    );
    expect(credentialMatchesAgentRegistryId(VERSIONED, VERSIONED)).toBe(true);
    expect(credentialMatchesAgentRegistryId("other", VERSIONED)).toBe(false);
  });
});
