import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const getAuthenticatedOrThrowMock = vi.fn();
const getWalletOwnedAgentForUserMock = vi.fn();
const shapeAgentWithMergedMetadataMock = vi.fn();

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/utils", () => ({
  getAuthenticatedOrThrow: getAuthenticatedOrThrowMock,
}));

vi.mock("@/lib/agents/wallet-ownership", () => ({
  getWalletOwnedAgentForUser: getWalletOwnedAgentForUserMock,
}));

vi.mock("@/lib/api/agent-metadata", () => ({
  shapeAgentWithMergedMetadata: shapeAgentWithMergedMetadataMock,
}));

describe("getAgent", () => {
  let getAgent: typeof import("./agent.server").getAgent;

  beforeAll(async () => {
    ({ getAgent } = await import("./agent.server"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedOrThrowMock.mockResolvedValue({
      user: { id: "user-1" },
    });
    shapeAgentWithMergedMetadataMock.mockReturnValue({
      id: "agent-1",
      name: "Wallet agent",
      pricing: null,
      verificationStatus: "VERIFIED",
    });
  });

  it("returns not found when the agent is not visible through wallet ownership", async () => {
    getWalletOwnedAgentForUserMock.mockResolvedValue(null);

    const result = await getAgent("agent-404");

    expect(getWalletOwnedAgentForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      agentId: "agent-404",
    });
    expect(result).toStrictEqual({
      success: false,
      error: "Agent not found",
    });
  });

  it("shapes a wallet-owned agent for server consumers", async () => {
    getWalletOwnedAgentForUserMock.mockResolvedValue({
      id: "agent-1",
      name: "Wallet agent",
      agentReference: null,
    });

    const result = await getAgent("agent-1");

    expect(result).toStrictEqual({
      success: true,
      data: {
        id: "agent-1",
        name: "Wallet agent",
        pricing: null,
        verificationStatus: "VERIFIED",
      },
    });
  });
});
