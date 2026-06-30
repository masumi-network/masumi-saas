import { beforeEach, describe, expect, it, vi } from "vitest";

import { VerificationMethod } from "@/lib/payment-node/verification-schemas";

const {
  agentFindFirstMock,
  agentFindManyMock,
  veridianCredentialFindFirstMock,
  getRegistryByAgentIdentifierMock,
  tryCreateAdminPaymentNodeClientMock,
  fetchContactCredentialsMock,
  findCredentialBySchemaMock,
  validateCredentialMock,
  extractCredentialAttributesMock,
  getAgentVerificationSchemaSaidMock,
} = vi.hoisted(() => ({
  agentFindFirstMock: vi.fn(),
  agentFindManyMock: vi.fn(),
  veridianCredentialFindFirstMock: vi.fn(),
  getRegistryByAgentIdentifierMock: vi.fn(),
  tryCreateAdminPaymentNodeClientMock: vi.fn(),
  fetchContactCredentialsMock: vi.fn(),
  findCredentialBySchemaMock: vi.fn(),
  validateCredentialMock: vi.fn(),
  extractCredentialAttributesMock: vi.fn(),
  getAgentVerificationSchemaSaidMock: vi.fn(),
}));

vi.mock("@masumi/database/client", () => ({
  default: {
    agent: {
      findFirst: agentFindFirstMock,
      findMany: agentFindManyMock,
    },
    veridianCredential: {
      findFirst: veridianCredentialFindFirstMock,
    },
  },
}));

vi.mock("@/lib/payment-node/get-admin-client", () => ({
  tryCreateAdminPaymentNodeClient: tryCreateAdminPaymentNodeClientMock,
}));

vi.mock("@/lib/config/verification.config", () => ({
  shouldReadOnChainAgentVerification: () => true,
  shouldUseDbVerificationFallback: () => true,
}));

vi.mock("@/lib/veridian", () => ({
  fetchContactCredentials: fetchContactCredentialsMock,
  findCredentialBySchema: findCredentialBySchemaMock,
  validateCredential: validateCredentialMock,
  extractCredentialAttributes: extractCredentialAttributesMock,
  getAgentVerificationSchemaSaid: getAgentVerificationSchemaSaidMock,
}));

import { resolveAgentVerification } from "./resolve-agent-verification";

const POLICY_ID = "a".repeat(56);
const ROOT = "b".repeat(56);
const VERSIONED = POLICY_ID + "10" + ROOT + "000001";
const BUMPED = POLICY_ID + "11" + ROOT + "000002";
const STABLE = POLICY_ID + ROOT;
const SCHEMA_SAID = "ESCHEMA";

const agentRow = {
  id: "agent-1",
  name: "DB Agent",
  apiUrl: "https://db.example",
  agentIdentifier: VERSIONED,
  networkIdentifier: "Preprod",
  verificationStatus: "VERIFIED",
};

const onChainMetadata = {
  policyId: POLICY_ID,
  assetName: "10" + ROOT + "000001",
  agentIdentifier: VERSIONED,
  Metadata: {
    name: "On-chain Agent",
    apiBaseUrl: "https://on-chain.example",
    metadataVersion: 2,
    verifications: [
      {
        method: VerificationMethod.KeriAcdc,
        issuer: {
          aid: "EISSUER",
          oobi: "https://issuer.example/oobi/EISSUER",
        },
        schema: {
          said: SCHEMA_SAID,
          oobi: "https://schema.example/oobi/ESCHEMA",
        },
        credential: {
          said: "ECRED",
          oobi: "https://cred.example/oobi/ECRED",
        },
        holder: {
          aid: "EHOLDER",
          oobi: "https://holder.example/oobi/EHOLDER",
        },
      },
    ],
  },
};

const credential = {
  sad: {
    d: "ECRED",
    s: SCHEMA_SAID,
    a: { i: "EHOLDER", dt: "2026-01-01T00:00:00.000Z" },
  },
};

function mockExactAgentLookup(agent: typeof agentRow | null) {
  agentFindFirstMock.mockResolvedValue(agent);
  agentFindManyMock.mockResolvedValue([]);
}

describe("resolveAgentVerification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAgentVerificationSchemaSaidMock.mockReturnValue(SCHEMA_SAID);
    tryCreateAdminPaymentNodeClientMock.mockReturnValue({
      getRegistryByAgentIdentifier: getRegistryByAgentIdentifierMock,
    });
    mockExactAgentLookup({
      ...agentRow,
      verificationStatus: null,
    });
  });

  it("returns on-chain verification when anchors and credential validate", async () => {
    getRegistryByAgentIdentifierMock.mockResolvedValue(onChainMetadata);
    fetchContactCredentialsMock.mockResolvedValue([credential]);
    findCredentialBySchemaMock.mockReturnValue(credential);
    validateCredentialMock.mockReturnValue({
      isValid: true,
      status: "issued",
      details: { expiresAt: "2027-01-01T00:00:00.000Z" },
    });
    extractCredentialAttributesMock.mockReturnValue({
      agentId: STABLE,
      agentName: "Cred Agent",
      agentApiUrl: "https://cred-agent.example",
    });

    const result = await resolveAgentVerification({
      agentIdentifier: VERSIONED,
    });

    expect(result).toEqual({
      verified: true,
      credentialId: "ECRED",
      expiresAt: "2027-01-01T00:00:00.000Z",
      agentName: "Cred Agent",
      apiUrl: "https://cred-agent.example",
      source: "on-chain",
    });
  });

  it("falls back to database verification when chain has no anchors", async () => {
    getRegistryByAgentIdentifierMock.mockResolvedValue({
      ...onChainMetadata,
      Metadata: { ...onChainMetadata.Metadata, verifications: [] },
    });
    mockExactAgentLookup(agentRow);
    veridianCredentialFindFirstMock.mockResolvedValue({
      credentialId: "EDBCRED",
      expiresAt: new Date("2027-01-01T00:00:00.000Z"),
    });

    const result = await resolveAgentVerification({
      agentIdentifier: VERSIONED,
    });

    expect(result).toEqual({
      verified: true,
      credentialId: "EDBCRED",
      expiresAt: "2027-01-01T00:00:00.000Z",
      agentName: "DB Agent",
      apiUrl: "https://db.example",
      source: "database",
    });
  });

  it("falls back to database verification when on-chain credential fetch fails", async () => {
    getRegistryByAgentIdentifierMock.mockResolvedValue(onChainMetadata);
    fetchContactCredentialsMock.mockRejectedValue(
      new Error("cred server down"),
    );
    mockExactAgentLookup(agentRow);
    veridianCredentialFindFirstMock.mockResolvedValue({
      credentialId: "EDBCRED",
      expiresAt: new Date("2027-01-01T00:00:00.000Z"),
    });

    const result = await resolveAgentVerification({
      agentIdentifier: VERSIONED,
    });

    expect(result.source).toBe("database");
    expect(result).toMatchObject({
      verified: true,
      credentialId: "EDBCRED",
    });
  });

  it("queries chain with bumped identifier when caller passes stale version", async () => {
    agentFindFirstMock.mockResolvedValue(null);
    agentFindManyMock.mockResolvedValue([
      { ...agentRow, agentIdentifier: BUMPED },
    ]);
    getRegistryByAgentIdentifierMock.mockResolvedValue({
      ...onChainMetadata,
      agentIdentifier: BUMPED,
    });
    fetchContactCredentialsMock.mockResolvedValue([credential]);
    findCredentialBySchemaMock.mockReturnValue(credential);
    validateCredentialMock.mockReturnValue({
      isValid: true,
      status: "issued",
      details: { expiresAt: "2027-01-01T00:00:00.000Z" },
    });
    extractCredentialAttributesMock.mockReturnValue({
      agentId: STABLE,
      agentName: "Cred Agent",
      agentApiUrl: "https://cred-agent.example",
    });

    await resolveAgentVerification({ agentIdentifier: VERSIONED });

    expect(getRegistryByAgentIdentifierMock).toHaveBeenCalledWith({
      agentIdentifier: BUMPED,
      network: "Preprod",
    });
  });

  it("returns not verified when neither chain nor database confirms", async () => {
    getRegistryByAgentIdentifierMock.mockResolvedValue(null);
    mockExactAgentLookup(null);

    const result = await resolveAgentVerification({
      agentIdentifier: VERSIONED,
    });

    expect(result).toEqual({ verified: false });
  });
});
