import { beforeEach, describe, expect, it, vi } from "vitest";

const agentFindUniqueMock = vi.fn();

vi.mock("@masumi/database/client", () => ({
  default: { agent: { findUnique: agentFindUniqueMock } },
}));

const { GET } = await import("./route");

const manifest = {
  x402Version: 2,
  resources: [{ resource: "https://api.example.com/paid", type: "http" }],
};

function agentWithState(registrationState: string) {
  return {
    registrationState,
    metadata: JSON.stringify({
      registryEntryType: "X402",
      x402Manifest: manifest,
    }),
  };
}

function get() {
  return GET(new Request("https://saas.example.com"), {
    params: Promise.resolve({ agentId: "agent-1" }),
  });
}

describe("GET /api/public/x402-manifest/{agentId}", () => {
  beforeEach(() => {
    agentFindUniqueMock.mockReset();
  });

  it.each(["RegistrationRequested", "RegistrationConfirmed", "UpdateFailed"])(
    "serves the manifest in %s",
    async (state) => {
      agentFindUniqueMock.mockResolvedValue(agentWithState(state));
      const response = await get();
      expect(response.status).toBe(200);
    },
  );

  it.each(["RegistrationFailed", "DeregistrationConfirmed"])(
    "returns 404 in %s",
    async (state) => {
      agentFindUniqueMock.mockResolvedValue(agentWithState(state));
      const response = await get();
      expect(response.status).toBe(404);
    },
  );
});
