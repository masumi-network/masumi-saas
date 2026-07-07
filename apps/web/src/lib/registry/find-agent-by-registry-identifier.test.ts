import { beforeEach, describe, expect, it, vi } from "vitest";

const { agentFindFirstMock, agentFindManyMock } = vi.hoisted(() => ({
  agentFindFirstMock: vi.fn(),
  agentFindManyMock: vi.fn(),
}));

vi.mock("@masumi/database/client", () => ({
  default: {
    agent: {
      findFirst: agentFindFirstMock,
      findMany: agentFindManyMock,
    },
  },
}));

import { findAgentByRegistryIdentifier } from "./find-agent-by-registry-identifier";

const POLICY_ID = "a".repeat(56);
const ROOT = "b".repeat(56);
const OLD_VERSIONED = POLICY_ID + "10" + ROOT + "000001";
const NEW_VERSIONED = POLICY_ID + "11" + ROOT + "000002";

describe("findAgentByRegistryIdentifier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an exact agentIdentifier match", async () => {
    agentFindFirstMock.mockResolvedValue({
      id: "agent-1",
      name: "Agent",
      apiUrl: "https://agent.example",
      agentIdentifier: OLD_VERSIONED,
      networkIdentifier: "Preprod",
      verificationStatus: "VERIFIED",
    });

    const result = await findAgentByRegistryIdentifier(OLD_VERSIONED);

    expect(result).toEqual({
      agent: {
        id: "agent-1",
        name: "Agent",
        apiUrl: "https://agent.example",
        agentIdentifier: OLD_VERSIONED,
        networkIdentifier: "Preprod",
        verificationStatus: "VERIFIED",
      },
      canonicalAgentIdentifier: OLD_VERSIONED,
    });
    expect(agentFindManyMock).not.toHaveBeenCalled();
  });

  it("matches by version-independent root when the identifier was bumped", async () => {
    agentFindFirstMock.mockResolvedValue(null);
    agentFindManyMock.mockResolvedValue([
      {
        id: "agent-1",
        name: "Agent",
        apiUrl: "https://agent.example",
        agentIdentifier: NEW_VERSIONED,
        networkIdentifier: "Preprod",
        verificationStatus: "VERIFIED",
      },
    ]);

    const result = await findAgentByRegistryIdentifier(OLD_VERSIONED);

    expect(result?.canonicalAgentIdentifier).toBe(NEW_VERSIONED);
    expect(agentFindManyMock).toHaveBeenCalledWith({
      where: { agentIdentifier: { startsWith: POLICY_ID } },
      select: expect.any(Object),
    });
  });
});
