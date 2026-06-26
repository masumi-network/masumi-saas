import { beforeEach, describe, expect, it, vi } from "vitest";

const agentFindFirstMock = vi.fn();
const agentUpdateMock = vi.fn();
const createAdminPaymentNodeClientMock = vi.fn();
const resolveSmartContractAddressForDeregisterMock = vi.fn();
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

vi.mock("@/lib/payment-node/get-admin-client", () => ({
  createAdminPaymentNodeClient: createAdminPaymentNodeClientMock,
}));

vi.mock("@/lib/payment-node/resolve-deregister-smart-contract", () => ({
  resolveSmartContractAddressForDeregister:
    resolveSmartContractAddressForDeregisterMock,
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
    createAdminPaymentNodeClientMock.mockReturnValue({
      deregisterAgent: vi.fn(),
    });
  });

  it("deregisters through the admin payment-node client", async () => {
    const deregisterAgentMock = vi.fn().mockResolvedValue({ id: "reg-1" });
    createAdminPaymentNodeClientMock.mockReturnValue({
      deregisterAgent: deregisterAgentMock,
    });
    resolveSmartContractAddressForDeregisterMock.mockResolvedValue(
      "addr_test1contract",
    );

    const { deregisterAgentForUser } = await import("./deregister-agent");
    const result = await deregisterAgentForUser("agent-1", "user-1", {
      networkFallback: "Mainnet",
    });

    expect(result).toEqual({ success: true });
    expect(createAdminPaymentNodeClientMock).toHaveBeenCalledTimes(1);
    expect(deregisterAgentMock).toHaveBeenCalledWith({
      network: "Mainnet",
      agentIdentifier: "agent-identifier-1",
      smartContractAddress: "addr_test1contract",
    });
    expect(agentUpdateMock).toHaveBeenCalled();
    expect(recordAgentActivityEventMock).toHaveBeenCalledWith(
      "agent-1",
      "DeregistrationRequested",
    );
  });

  it("rethrows payment-node config errors for the route to surface as 503", async () => {
    const { PaymentNodeConfigError } =
      await import("@/lib/payment-node/config");
    const { deregisterAgentForUser } = await import("./deregister-agent");

    resolveSmartContractAddressForDeregisterMock.mockRejectedValue(
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
