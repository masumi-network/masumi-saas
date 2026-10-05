import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  consumeCreditIfRequiredMock,
  refundConsumedCreditMock,
  startAgentRegistrationMock,
  prepareX402HttpRegistrationMock,
  validatePreflightMock,
  canRefundCreditAfterRegistrationThrowMock,
} = vi.hoisted(() => ({
  consumeCreditIfRequiredMock: vi.fn(),
  refundConsumedCreditMock: vi.fn(),
  startAgentRegistrationMock: vi.fn(),
  prepareX402HttpRegistrationMock: vi.fn(),
  validatePreflightMock: vi.fn(),
  canRefundCreditAfterRegistrationThrowMock: vi.fn(),
}));

vi.mock("@/lib/agents/registration-credit-refund", () => ({
  canRefundCreditAfterRegistrationThrow:
    canRefundCreditAfterRegistrationThrowMock,
}));

vi.mock("@/lib/agent-registration", () => ({
  startAgentRegistration: startAgentRegistrationMock,
  validateAgentRegistrationPaymentSourcesPreflight: validatePreflightMock,
}));

vi.mock("@/lib/credits/service", () => ({
  consumeCreditIfRequired: consumeCreditIfRequiredMock,
  createCreditReference: () => "agent-register:test-ref",
  refundConsumedCredit: refundConsumedCreditMock,
}));

vi.mock("./prepare-http-registration", () => ({
  prepareX402HttpRegistration: prepareX402HttpRegistrationMock,
}));

vi.mock("@masumi/database/client", () => ({
  default: {
    agent: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { startX402HttpAgentRegistration } from "./start-x402-http-agent-registration";

const ctx = {
  user: { id: "user-1", name: "Test", email: "t@example.com" },
  activeOrganizationId: null,
  network: "Mainnet" as const,
};

describe("startX402HttpAgentRegistration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validatePreflightMock.mockResolvedValue({ ok: true });
    consumeCreditIfRequiredMock.mockResolvedValue({ creditsRemaining: 9 });
    refundConsumedCreditMock.mockResolvedValue(undefined);
    canRefundCreditAfterRegistrationThrowMock.mockResolvedValue(true);
    prepareX402HttpRegistrationMock.mockResolvedValue({
      ok: true,
      data: {
        resourceUrl: "https://x402.org/protected",
        probeRow: {},
        x402Manifest: { x402Version: 2, resources: [] },
        supportedPaymentSources: [],
      },
    });
  });

  it("refunds Mainnet credit when registration start fails", async () => {
    startAgentRegistrationMock.mockResolvedValue({
      success: false,
      error: "Payment node unavailable",
    });

    const result = await startX402HttpAgentRegistration({
      ctx,
      resourceUrl: "https://x402.org/protected",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("registration");
    expect(consumeCreditIfRequiredMock).toHaveBeenCalledTimes(1);
    expect(refundConsumedCreditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        reason: "agent_register",
        reference: "agent-register:test-ref",
        network: "Mainnet",
      }),
    );
  });

  it("reports the agent as started when registration throws after it is submittable", async () => {
    startAgentRegistrationMock.mockRejectedValue(new Error("db write failed"));
    canRefundCreditAfterRegistrationThrowMock.mockResolvedValue(false);

    const result = await startX402HttpAgentRegistration({
      ctx,
      resourceUrl: "https://x402.org/protected",
    });

    const params = startAgentRegistrationMock.mock.calls[0]?.[1];
    expect(canRefundCreditAfterRegistrationThrowMock).toHaveBeenCalledWith(
      params?.id,
    );
    // Reported as started so the batch route schedules completion polling.
    expect(result).toEqual({
      ok: true,
      agentId: params?.id,
      resourceUrl: "https://x402.org/protected",
    });
    expect(refundConsumedCreditMock).not.toHaveBeenCalled();
  });

  it("refunds when registration throws after debit", async () => {
    startAgentRegistrationMock.mockRejectedValue(
      new Error("Payment node config missing"),
    );

    const result = await startX402HttpAgentRegistration({
      ctx,
      resourceUrl: "https://x402.org/protected",
    });

    expect(result.ok).toBe(false);
    expect(refundConsumedCreditMock).toHaveBeenCalledTimes(1);
  });

  it("does not refund when registration succeeds", async () => {
    startAgentRegistrationMock.mockResolvedValue({
      success: true,
      agentId: "agent-1",
    });

    const result = await startX402HttpAgentRegistration({
      ctx,
      resourceUrl: "https://x402.org/protected",
    });

    expect(result.ok).toBe(true);
    expect(refundConsumedCreditMock).not.toHaveBeenCalled();
  });
});
