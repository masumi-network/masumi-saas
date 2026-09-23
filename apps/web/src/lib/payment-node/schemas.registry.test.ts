import { describe, expect, it } from "vitest";

import { registryListResponseSchema } from "./schemas";

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
