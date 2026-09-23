import { describe, expect, it } from "vitest";

import {
  extractAssetName,
  extractPolicyId,
  versionIndependentAgentId,
} from "./version-independent-agent-id";

const POLICY_ID = "a".repeat(56);
const NONCE = "10";
const ROOT = "b".repeat(56);
const VERSION = "000001";
const ASSET_NAME = NONCE + ROOT + VERSION;
const AGENT_IDENTIFIER = POLICY_ID + ASSET_NAME;

describe("versionIndependentAgentId", () => {
  it("extracts policyId and assetName", () => {
    expect(extractPolicyId(AGENT_IDENTIFIER)).toBe(POLICY_ID);
    expect(extractAssetName(AGENT_IDENTIFIER)).toBe(ASSET_NAME);
  });

  it("strips nonce and version for V2 asset names", () => {
    expect(versionIndependentAgentId(AGENT_IDENTIFIER)).toBe(POLICY_ID + ROOT);
  });

  it("preserves bumped version in stable id", () => {
    const bumped = POLICY_ID + NONCE + ROOT + "000002";
    expect(versionIndependentAgentId(bumped)).toBe(POLICY_ID + ROOT);
    expect(versionIndependentAgentId(AGENT_IDENTIFIER)).toBe(
      versionIndependentAgentId(bumped),
    );
  });

  it("returns full identifier for legacy non-V2 asset names", () => {
    const legacy = POLICY_ID + "c".repeat(32);
    expect(versionIndependentAgentId(legacy)).toBe(legacy);
  });

  it("normalizes hex casing", () => {
    const mixed = AGENT_IDENTIFIER.toUpperCase();
    expect(versionIndependentAgentId(mixed)).toBe(POLICY_ID + ROOT);
  });
});
