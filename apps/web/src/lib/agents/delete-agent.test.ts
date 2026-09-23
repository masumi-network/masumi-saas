import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAgent: vi.fn(),
  deleteAgent: vi.fn(),
  deleteRegistry: vi.fn(),
  recordActivity: vi.fn(),
}));

vi.mock("@masumi/database/client", () => ({
  default: { agent: { delete: mocks.deleteAgent } },
}));
vi.mock("@/lib/agents/wallet-ownership", () => ({
  getWalletOwnedAgentForUser: mocks.findAgent,
}));
vi.mock("@/lib/activity-event", () => ({
  recordAgentActivityEvent: mocks.recordActivity,
}));
vi.mock("@/lib/payment-node", () => ({
  paymentNodeConfig: { getBaseUrl: () => "", getAdminApiKey: () => "" },
  createPaymentNodeClient: () => ({
    deleteRegistryEntry: mocks.deleteRegistry,
  }),
}));

import { deleteAgentForUser } from "./delete-agent";

describe("deleteAgentForUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["UpdateRequested", "UpdateInitiated", "UpdateFailed"])(
    "keeps the live agent when registry state is %s",
    async (registrationState) => {
      mocks.findAgent.mockResolvedValue({
        id: "agent-1",
        registrationState,
        agentIdentifier: "registered-agent",
        agentReference: { externalId: "registry-1" },
      });

      const result = await deleteAgentForUser({
        userId: "user-1",
        agentId: "agent-1",
      });

      expect(result.success).toBe(false);
      expect(mocks.deleteAgent).not.toHaveBeenCalled();
      expect(mocks.deleteRegistry).not.toHaveBeenCalled();
      expect(mocks.recordActivity).not.toHaveBeenCalled();
    },
  );

  it("deletes a deregistered agent", async () => {
    mocks.findAgent.mockResolvedValue({
      id: "agent-1",
      registrationState: "DeregistrationConfirmed",
      agentIdentifier: "registered-agent",
      agentReference: { externalId: "registry-1" },
    });

    expect(
      await deleteAgentForUser({ userId: "user-1", agentId: "agent-1" }),
    ).toEqual({ success: true });
    expect(mocks.deleteAgent).toHaveBeenCalledWith({
      where: { id: "agent-1" },
    });
    expect(mocks.deleteRegistry).toHaveBeenCalledWith("registry-1");
  });
});
