import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getAuthenticatedOrThrowMock = vi.fn();
const consumeCreditIfRequiredMock = vi.fn();
const refundConsumedCreditMock = vi.fn();
const updateAgentDetailsMock = vi.fn();
const agentFindFirstMock = vi.fn();

vi.mock("server-only", () => ({}));

vi.mock("@masumi/database/client", () => ({
  default: { agent: { findFirst: agentFindFirstMock } },
}));

vi.mock("@/lib/auth/utils", () => ({
  getAuthenticatedOrThrow: getAuthenticatedOrThrowMock,
  handleAuthError: vi.fn(),
}));

vi.mock("@/lib/auth/oidc-api-permissions", () => ({
  requireNetworkedOidcApiScope: vi.fn(),
}));

vi.mock("@/lib/credits/service", () => ({
  CREDIT_COST: 1,
  consumeCreditIfRequired: consumeCreditIfRequiredMock,
  createCreditReference: vi.fn(() => "agent-update:test"),
  refundConsumedCredit: refundConsumedCreditMock,
}));

vi.mock("@/lib/agents/update-agent-details", () => ({
  updateAgentDetails: updateAgentDetailsMock,
}));

vi.mock("@/lib/agents/delete-agent", () => ({
  deleteAgentForUser: vi.fn(),
}));

vi.mock("@/lib/agents/wallet-ownership", () => ({
  getWalletOwnedAgentForUser: vi.fn(),
}));

vi.mock("@masumi/payment-source-x402/supported-payment-sources", () => ({
  loadSupportedPaymentSourcesForAgent: vi.fn(),
}));

const { PATCH } = await import("./route");

function patchRequest() {
  return new NextRequest("https://saas.example.com/api/agents/agent-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "New name",
      tags: "ai",
      apiUrl: "https://agent.example.com/mip",
    }),
  });
}

function patch() {
  return PATCH(patchRequest(), {
    params: Promise.resolve({ agentId: "agent-1" }),
  });
}

describe("/api/agents/{agentId} PATCH", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_AGENT_DETAILS_EDIT", "true");
    getAuthenticatedOrThrowMock.mockResolvedValue({
      user: { id: "user-1" },
      authMethod: "session",
    });
    agentFindFirstMock.mockResolvedValue({
      networkIdentifier: "Mainnet",
      agentReference: { networkIdentifier: "Mainnet" },
    });
    consumeCreditIfRequiredMock.mockResolvedValue({ creditsRemaining: 1 });
    refundConsumedCreditMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 403 and consumes no credit when editing is disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_AGENT_DETAILS_EDIT", undefined);

    const response = await patch();

    expect(response.status).toBe(403);
    expect(consumeCreditIfRequiredMock).not.toHaveBeenCalled();
    expect(updateAgentDetailsMock).not.toHaveBeenCalled();
  });

  it("refunds the credit when the update fails before the registry call", async () => {
    updateAgentDetailsMock.mockResolvedValue({
      success: false,
      error: "Registry entry not found",
    });

    const response = await patch();

    expect(response.status).toBe(400);
    expect(refundConsumedCreditMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the credit when the update throws after the registry call", async () => {
    updateAgentDetailsMock.mockRejectedValue(new Error("final persist failed"));

    const response = await patch();

    expect(response.status).toBe(500);
    expect(consumeCreditIfRequiredMock).toHaveBeenCalledTimes(1);
    expect(refundConsumedCreditMock).not.toHaveBeenCalled();
  });
});
