import type { SupportedPaymentSource } from "@masumi/payment-source-x402/payment-source";
import { beforeEach, describe, expect, it, vi } from "vitest";

const agentReferenceCreateMock = vi.fn();
const agentDeleteMock = vi.fn();
const replaceSupportedPaymentSourcesForAgentMock = vi.fn();

vi.mock("@masumi/database/client", () => ({
  default: {
    agentReference: { create: agentReferenceCreateMock },
    agent: { delete: agentDeleteMock },
  },
}));

vi.mock("@masumi/payment-source-x402/supported-payment-sources", () => ({
  replaceSupportedPaymentSourcesForAgent:
    replaceSupportedPaymentSourcesForAgentMock,
}));

const { persistAgentRegistrationSetup } =
  await import("./persist-agent-registration-setup");

const sources = [{ chain: "Cardano" }] as unknown as SupportedPaymentSource[];
const reference = {
  sellingWalletVkey: "vkey",
  networkIdentifier: "Preprod",
} as Parameters<typeof persistAgentRegistrationSetup>[0]["reference"];

describe("persistAgentRegistrationSetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    replaceSupportedPaymentSourcesForAgentMock.mockResolvedValue(undefined);
    agentReferenceCreateMock.mockResolvedValue({});
    agentDeleteMock.mockResolvedValue({});
  });

  it("writes sources before the reference", async () => {
    await persistAgentRegistrationSetup({
      agentId: "agent-1",
      supportedPaymentSources: sources,
      reference,
    });

    expect(replaceSupportedPaymentSourcesForAgentMock).toHaveBeenCalledWith(
      "agent-1",
      sources,
    );
    expect(agentReferenceCreateMock).toHaveBeenCalledWith({
      data: { ...reference, agentId: "agent-1" },
    });
    expect(
      replaceSupportedPaymentSourcesForAgentMock.mock.invocationCallOrder[0],
    ).toBeLessThan(agentReferenceCreateMock.mock.invocationCallOrder[0]!);
    expect(agentDeleteMock).not.toHaveBeenCalled();
  });

  it("deletes the agent and creates no reference when sources fail", async () => {
    const error = new Error("Only Fixed Exact x402 payment sources");
    replaceSupportedPaymentSourcesForAgentMock.mockRejectedValue(error);

    await expect(
      persistAgentRegistrationSetup({
        agentId: "agent-1",
        supportedPaymentSources: sources,
        reference,
      }),
    ).rejects.toBe(error);

    expect(agentReferenceCreateMock).not.toHaveBeenCalled();
    expect(agentDeleteMock).toHaveBeenCalledWith({ where: { id: "agent-1" } });
  });

  it("deletes the agent when the reference write fails", async () => {
    const error = new Error("db down");
    agentReferenceCreateMock.mockRejectedValue(error);

    await expect(
      persistAgentRegistrationSetup({
        agentId: "agent-1",
        supportedPaymentSources: sources,
        reference,
      }),
    ).rejects.toBe(error);

    expect(agentDeleteMock).toHaveBeenCalledWith({ where: { id: "agent-1" } });
  });

  it("rethrows the original error when the cleanup delete fails", async () => {
    const error = new Error("db down");
    agentReferenceCreateMock.mockRejectedValue(error);
    agentDeleteMock.mockRejectedValue(new Error("delete failed"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(
      persistAgentRegistrationSetup({
        agentId: "agent-1",
        supportedPaymentSources: sources,
        reference,
      }),
    ).rejects.toBe(error);

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
