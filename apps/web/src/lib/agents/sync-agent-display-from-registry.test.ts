import { describe, expect, it } from "vitest";

import {
  agentDisplayFieldsDiffer,
  agentDisplayFieldsFromRegistryEntry,
  shouldSyncAgentDisplayFromRegistry,
} from "./sync-agent-display-from-registry";

const baseEntry = {
  id: "reg-1",
  name: "New name",
  description: "New desc",
  apiBaseUrl: null,
  x402ResourcesUrl: "https://x402.example/resource",
  state: "UpdateRequested" as const,
  error: null,
  agentIdentifier: "id",
  createdAt: "",
  updatedAt: "",
  Capability: { name: "Masumi", version: "2.0" },
  Author: {
    name: "Author",
    contactEmail: null,
    contactOther: null,
    organization: null,
  },
  Tags: ["ai", "x402"],
  AgentPricing: null,
};

describe("sync-agent-display-from-registry", () => {
  it("preserves the paid resource URL when syncing an x402 manifest", () => {
    expect(
      agentDisplayFieldsFromRegistryEntry(
        baseEntry,
        "https://paid.example/resource",
      ).apiUrl,
    ).toBe("https://paid.example/resource");
  });

  it("detects display field drift from registry row", () => {
    const fromRegistry = agentDisplayFieldsFromRegistryEntry(baseEntry);
    expect(
      agentDisplayFieldsDiffer(
        {
          name: "Old",
          description: null,
          tags: ["old"],
          apiUrl: "https://old.example",
        },
        fromRegistry,
      ),
    ).toBe(true);
  });

  it("syncs display during update lifecycle", () => {
    expect(
      shouldSyncAgentDisplayFromRegistry(
        { ...baseEntry, state: "UpdateRequested" },
        false,
      ),
    ).toBe(true);
    expect(
      shouldSyncAgentDisplayFromRegistry(
        { ...baseEntry, state: "RegistrationConfirmed" },
        false,
      ),
    ).toBe(false);
    expect(
      shouldSyncAgentDisplayFromRegistry(
        { ...baseEntry, state: "RegistrationConfirmed" },
        true,
      ),
    ).toBe(true);
  });
});
