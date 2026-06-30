import { describe, expect, it } from "vitest";

import { buildUpdateAgentInput } from "./build-update-agent-input";

const registryEntry = {
  id: "reg-1",
  name: "Registry Name",
  description: "Registry description",
  apiBaseUrl: "https://api.example/agent",
  state: "RegistrationConfirmed" as const,
  agentIdentifier: "a".repeat(120),
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  Capability: { name: "gpt", version: "4" },
  Author: {
    name: "Author",
    contactEmail: "author@example.com",
    contactOther: null,
    organization: null,
  },
  Tags: ["ai"],
  AgentPricing: { pricingType: "Free" as const },
};

describe("buildUpdateAgentInput", () => {
  it("merges on-chain metadata with registry entry and verifications", () => {
    const onChainMetadata = {
      policyId: "a".repeat(56),
      assetName: "b".repeat(64),
      agentIdentifier: "a".repeat(120),
      Metadata: {
        name: "On-chain Name",
        apiBaseUrl: "https://api.example/agent",
        metadataVersion: 2,
        ExampleOutputs: [
          {
            name: "demo",
            url: "https://example.com/demo",
            mimeType: "application/json",
          },
        ],
      },
    };

    const input = buildUpdateAgentInput({
      network: "Preprod",
      agentIdentifier: onChainMetadata.agentIdentifier,
      registryEntry,
      onChainMetadata,
      verifications: [
        {
          method: "KERI-ACDC",
          issuer: {
            aid: "EISSUER",
            oobi: "https://issuer.example/oobi",
          },
          schema: {
            said: "ESCHEMA",
            oobi: "https://schema.example/oobi",
          },
          credential: {
            said: "ECRED",
            oobi: "https://cred.example/oobi",
          },
          holder: {
            aid: "EHOLDER",
            oobi: "https://holder.example/oobi",
          },
        },
      ],
    });

    expect(input.name).toBe("On-chain Name");
    expect(input.ExampleOutputs).toHaveLength(1);
    expect(input.verifications).toHaveLength(1);
    expect(input.agentIdentifier).toBe(onChainMetadata.agentIdentifier);
  });
});
