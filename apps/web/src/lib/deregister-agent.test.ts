import { beforeEach, describe, expect, it, vi } from "vitest";

const agentFindFirstMock = vi.fn();
const agentUpdateMock = vi.fn();
const getPaymentNodeClientForUserMock = vi.fn();
const getSmartContractAddressForConfiguredSourceMock = vi.fn();
const recordAgentActivityEventMock = vi.fn();

vi.mock("@masumi/database/client", () => ({
  default: {
    agent: {
      findFirst: agentFindFirstMock,
      update: agentUpdateMock,
    },
  },
}));

vi.mock("@/lib/activity-event", () => ({
  recordAgentActivityEvent: recordAgentActivityEventMock,
}));

vi.mock("@/lib/payment-node/get-user-client", () => ({
  getPaymentNodeClientForUser: getPaymentNodeClientForUserMock,
}));

vi.mock("@/lib/payment-node/resolve-smart-contract", () => ({
  getSmartContractAddressForConfiguredSource:
    getSmartContractAddressForConfiguredSourceMock,
}));

describe("deregisterAgentForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    agentFindFirstMock.mockResolvedValue({
      id: "agent-1",
      registrationState: "RegistrationConfirmed",
      agentIdentifier: "agent-identifier-1",
      agentReference: {
        networkIdentifier: "Mainnet",
        metadata: {},
      },
    });
    getPaymentNodeClientForUserMock.mockResolvedValue({
      deregisterAgent: vi.fn(),
    });
  });

  it("rethrows payment-node config errors for the route to surface as 503", async () => {
    const { PaymentNodeConfigError } =
      await import("@/lib/payment-node/config");
    const { deregisterAgentForUser } = await import("./deregister-agent");

    getSmartContractAddressForConfiguredSourceMock.mockRejectedValue(
      new PaymentNodeConfigError(
        "PAYMENT_NODE_PAYMENT_SOURCE_ID_MAINNET is required for Mainnet payment-source operations",
      ),
    );

    await expect(
      deregisterAgentForUser("agent-1", "user-1", {
        networkFallback: "Mainnet",
      }),
    ).rejects.toMatchObject({
      name: "PaymentNodeConfigError",
      message:
        "PAYMENT_NODE_PAYMENT_SOURCE_ID_MAINNET is required for Mainnet payment-source operations",
    });

    expect(agentUpdateMock).not.toHaveBeenCalled();
    expect(recordAgentActivityEventMock).not.toHaveBeenCalled();
  });
});
