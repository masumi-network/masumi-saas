import { beforeEach, describe, expect, it, vi } from "vitest";

const agentReferenceFindUniqueMock = vi.fn();

vi.mock("@masumi/database/client", () => ({
  default: { agentReference: { findUnique: agentReferenceFindUniqueMock } },
}));

const { canRefundCreditAfterRegistrationThrow } =
  await import("./registration-credit-refund");

describe("canRefundCreditAfterRegistrationThrow", () => {
  beforeEach(() => {
    agentReferenceFindUniqueMock.mockReset();
  });

  it("refunds when no agent reference exists", async () => {
    agentReferenceFindUniqueMock.mockResolvedValue(null);
    await expect(
      canRefundCreditAfterRegistrationThrow("agent-1"),
    ).resolves.toBe(true);
    expect(agentReferenceFindUniqueMock).toHaveBeenCalledWith({
      where: { agentId: "agent-1" },
      select: { agentId: true },
    });
  });

  it("keeps the credit once the agent reference exists", async () => {
    agentReferenceFindUniqueMock.mockResolvedValue({ agentId: "agent-1" });
    await expect(
      canRefundCreditAfterRegistrationThrow("agent-1"),
    ).resolves.toBe(false);
  });
});
