import { describe, expect, it } from "vitest";

import {
  registryAgentIdentifierMetadataSchema,
  registryListResponseSchema,
} from "./schemas";

describe("registryAgentIdentifierMetadataSchema", () => {
  it("accepts V2 on-chain metadata with null AgentPricing", () => {
    const parsed = registryAgentIdentifierMetadataSchema.parse({
      policyId: "67ab0c92c4ac1610895a1c965ee50aba41a8f1513b15240723b3bd0b",
      assetName: "000001",
      agentIdentifier:
        "67ab0c92c4ac1610895a1c965ee50aba41a8f1513b15240723b3bd0b000001",
      Metadata: {
        name: "Test agent",
        apiBaseUrl: "https://agent.example.com/mip",
        description: "Desc",
        image: "https://agent.example.com/icon.png",
        metadataVersion: 2,
        Tags: ["ai"],
        AgentPricing: null,
        supportedPaymentSources: null,
        verifications: null,
      },
    });

    expect(parsed.Metadata.AgentPricing).toBeNull();
    expect(parsed.Metadata.metadataVersion).toBe(2);
  });
});

describe("registryListResponseSchema", () => {
  it("accepts OpenApi/X402 entries with null apiBaseUrl", () => {
    const parsed = registryListResponseSchema.parse({
      Assets: [
        {
          id: "reg-x402-1",
          name: "x402 agent",
          description: null,
          type: "X402",
          apiBaseUrl: null,
          x402ResourcesUrl: "https://agent.example/.well-known/x402.json",
          state: "RegistrationConfirmed",
          agentIdentifier: "policy1asset1",
          createdAt: "2026-08-18T00:00:00.000Z",
          updatedAt: "2026-08-18T00:00:00.000Z",
          Capability: { name: null, version: null },
          Author: {
            name: "Author",
            contactEmail: null,
            contactOther: null,
            organization: null,
          },
          Tags: ["x402"],
          AgentPricing: null,
        },
      ],
    });

    expect(parsed.Assets[0]?.apiBaseUrl).toBeNull();
    expect(parsed.Assets[0]?.x402ResourcesUrl).toBe(
      "https://agent.example/.well-known/x402.json",
    );
  });
});
