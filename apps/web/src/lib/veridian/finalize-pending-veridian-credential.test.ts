import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  veridianCredential: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  agent: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  // Interactive transaction: run the callback with the same mock as `tx` so the
  // claim + agent update assertions observe the same spies.
  $transaction: vi.fn((cb: (tx: typeof prismaMock) => unknown) =>
    cb(prismaMock),
  ),
};

const fetchContactCredentialsMock = vi.fn();
const getAgentVerificationSchemaSaidMock = vi.fn();
const resolvePendingWalletCredentialMock = vi.fn();
const hasHolderAdmittedIpexGrantMock = vi.fn();
const recordAgentActivityEventMock = vi.fn();
const triggerOnChainVerificationWriteMock = vi.fn();

vi.mock("@masumi/database/client", () => ({
  default: prismaMock,
}));

vi.mock("@/lib/activity-event", () => ({
  recordAgentActivityEvent: recordAgentActivityEventMock,
}));

vi.mock("@/lib/registry/write-on-chain-verifications", () => ({
  triggerOnChainVerificationWrite: triggerOnChainVerificationWriteMock,
}));

vi.mock("@/lib/veridian", () => ({
  fetchContactCredentials: fetchContactCredentialsMock,
  getAgentVerificationSchemaSaid: getAgentVerificationSchemaSaidMock,
}));

vi.mock("@/lib/veridian/resolve-pending-wallet-credential", () => ({
  resolvePendingWalletCredential: resolvePendingWalletCredentialMock,
}));

vi.mock("@/lib/veridian/holder-ipex-admit", () => ({
  hasHolderAdmittedIpexGrant: hasHolderAdmittedIpexGrantMock,
}));

describe("finalizePendingVeridianCredential", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAgentVerificationSchemaSaidMock.mockReturnValue("schema-said");
    triggerOnChainVerificationWriteMock.mockResolvedValue(true);
    hasHolderAdmittedIpexGrantMock.mockResolvedValue(true);
  });

  it("returns already-issued state without side effects", async () => {
    const { finalizePendingVeridianCredential } =
      await import("./finalize-pending-veridian-credential");

    prismaMock.veridianCredential.findFirst.mockResolvedValue({
      id: "cred-1",
      status: "ISSUED",
      credentialId: "said-1",
      aid: "holder-aid",
      agentId: "agent-1",
      attributes: null,
      credentialData: null,
      createdAt: new Date(),
    });

    const result = await finalizePendingVeridianCredential({
      pendingCredentialId: "cred-1",
      userId: "user-1",
    });

    expect(result).toEqual({
      outcome: "issued",
      id: "cred-1",
      credentialId: "said-1",
      status: "ISSUED",
      newlyIssued: false,
    });
    expect(fetchContactCredentialsMock).not.toHaveBeenCalled();
    expect(triggerOnChainVerificationWriteMock).not.toHaveBeenCalled();
  });

  it("claims PENDING only once and triggers on-chain write for the winner", async () => {
    const { finalizePendingVeridianCredential } =
      await import("./finalize-pending-veridian-credential");

    const pendingRow = {
      id: "cred-1",
      status: "PENDING",
      credentialId: "pending-uuid",
      aid: "holder-aid",
      agentId: "agent-1",
      attributes: "{}",
      credentialData: "{}",
      createdAt: new Date(),
    };

    prismaMock.veridianCredential.findFirst
      .mockResolvedValueOnce(pendingRow)
      .mockResolvedValueOnce({
        ...pendingRow,
        status: "ISSUED",
        credentialId: "said-1",
      });
    prismaMock.agent.findFirst.mockResolvedValue({
      agentIdentifier: "agent-id-v2",
      verificationStatus: "PENDING",
    });
    fetchContactCredentialsMock.mockResolvedValue([{ sad: { d: "said-1" } }]);
    resolvePendingWalletCredentialMock.mockReturnValue({
      sad: { d: "said-1" },
    });
    prismaMock.veridianCredential.updateMany.mockResolvedValue({ count: 0 });

    const loser = await finalizePendingVeridianCredential({
      pendingCredentialId: "cred-1",
      userId: "user-1",
    });

    expect(loser).toEqual({
      outcome: "issued",
      id: "cred-1",
      credentialId: "said-1",
      status: "ISSUED",
      newlyIssued: false,
    });
    expect(triggerOnChainVerificationWriteMock).not.toHaveBeenCalled();

    prismaMock.veridianCredential.findFirst.mockResolvedValueOnce(pendingRow);
    prismaMock.veridianCredential.updateMany.mockResolvedValue({ count: 1 });

    const winner = await finalizePendingVeridianCredential({
      pendingCredentialId: "cred-1",
      userId: "user-1",
    });

    expect(winner.newlyIssued).toBe(true);
    expect(recordAgentActivityEventMock).toHaveBeenCalledWith(
      "agent-1",
      "AgentVerified",
    );
    expect(triggerOnChainVerificationWriteMock).toHaveBeenCalledTimes(1);
  });

  it("stays pending until the holder admits the IPEX grant in wallet", async () => {
    const { finalizePendingVeridianCredential } =
      await import("./finalize-pending-veridian-credential");

    const pendingRow = {
      id: "cred-1",
      status: "PENDING",
      credentialId: "pending-uuid",
      aid: "holder-aid",
      agentId: "agent-1",
      attributes: "{}",
      credentialData: "{}",
      createdAt: new Date(),
    };

    prismaMock.veridianCredential.findFirst.mockResolvedValue(pendingRow);
    prismaMock.agent.findFirst.mockResolvedValue({
      agentIdentifier: "agent-id-v2",
      verificationStatus: "PENDING",
    });
    fetchContactCredentialsMock.mockResolvedValue([{ sad: { d: "said-1" } }]);
    resolvePendingWalletCredentialMock.mockReturnValue({
      sad: { d: "said-1" },
    });
    hasHolderAdmittedIpexGrantMock.mockResolvedValue(false);

    const result = await finalizePendingVeridianCredential({
      pendingCredentialId: "cred-1",
      userId: "user-1",
    });

    expect(result).toEqual({
      outcome: "pending",
      id: "cred-1",
      status: "PENDING",
    });
    expect(prismaMock.veridianCredential.updateMany).not.toHaveBeenCalled();
  });
});
