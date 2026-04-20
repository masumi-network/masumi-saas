import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { z } from "@/lib/zod-openapi";

const getAuthenticatedOrThrowMock = vi.fn();
const handleAuthErrorMock = vi.fn();
const requireNetworkedOidcApiScopeMock = vi.fn();
const getPaymentNodeClientForUserMock = vi.fn();
const createInboxAdminPaymentNodeClientMock = vi.fn();
const listOwnedInboxAgentsForUserMock = vi.fn();
const prepareManagedInboxRegistrationMock = vi.fn();
const saveInboxAgentReferenceMock = vi.fn();
const consumeCreditIfRequiredMock = vi.fn();
const ensureUserPaymentNodeKeyScopedToWalletsMock = vi.fn();

vi.mock("@/lib/auth/utils", () => ({
  getAuthenticatedOrThrow: getAuthenticatedOrThrowMock,
  handleAuthError: handleAuthErrorMock,
}));

vi.mock("@/lib/auth/oidc-api-permissions", () => ({
  requireNetworkedOidcApiScope: requireNetworkedOidcApiScopeMock,
}));

vi.mock("@/lib/inbox-agents/server", () => ({
  createInboxAdminPaymentNodeClient: createInboxAdminPaymentNodeClientMock,
  listOwnedInboxAgentsForUser: listOwnedInboxAgentsForUserMock,
  prepareManagedInboxRegistration: prepareManagedInboxRegistrationMock,
  saveInboxAgentReference: saveInboxAgentReferenceMock,
}));

vi.mock("@/lib/credits/service", () => ({
  consumeCreditIfRequired: consumeCreditIfRequiredMock,
  refundConsumedCredit: vi.fn(),
  createCreditReference: () => "inbox-agent-register:test",
}));

vi.mock("@/lib/payment-node/get-user-client", () => ({
  getPaymentNodeClientForUser: getPaymentNodeClientForUserMock,
}));

vi.mock("@/lib/payment-node/wallet-scopes", () => ({
  ensureUserPaymentNodeKeyScopedToWallets:
    ensureUserPaymentNodeKeyScopedToWalletsMock,
}));

vi.mock("@/lib/v1-proxy/explicit-route-support", () => ({
  getEffectivePaymentNetwork: (request: NextRequest) => {
    const value =
      request.nextUrl.searchParams.get("network") ??
      request.cookies.get("payment_network")?.value;
    return value === "Mainnet" || value === "Preprod" ? value : "Preprod";
  },
}));

vi.mock("@/lib/schemas/inbox-agent", () => {
  const registerInboxAgentBodySchema = z
    .object({
      name: z.string().min(1),
      description: z.string().optional().or(z.literal("")),
      agentSlug: z.string().min(1),
    })
    .strict();

  return {
    getCanonicalInboxAgentSlug: (value: string) =>
      value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/-{2,}/g, "-"),
    inboxAgentsListQuerySchema: z.object({
      cursor: z.string().optional(),
      filterStatus: z.string().optional(),
      network: z.enum(["Preprod", "Mainnet"]).default("Preprod"),
      search: z.string().optional(),
      take: z.coerce.number().optional(),
    }),
    registerInboxAgentBodySchema,
    validateCanonicalInboxAgentSlug: (slug: string) =>
      slug ? null : "Inbox slug is required",
  };
});

describe("/api/masumi/inbox-agent/register", () => {
  let POST: typeof import("./route").POST;

  beforeAll(async () => {
    ({ POST } = await import("./route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    handleAuthErrorMock.mockReturnValue(null);
    getAuthenticatedOrThrowMock.mockResolvedValue({
      user: { id: "user-1" },
      authMethod: "session",
    });
    requireNetworkedOidcApiScopeMock.mockImplementation(() => {});
    consumeCreditIfRequiredMock.mockResolvedValue({
      creditsRemaining: 0,
      updatedAt: new Date("2026-04-13T10:00:00.000Z"),
    });
    ensureUserPaymentNodeKeyScopedToWalletsMock.mockResolvedValue(undefined);
    saveInboxAgentReferenceMock.mockResolvedValue({
      id: "ref-1",
      userId: "user-1",
    });
  });

  it("registers inbox agents through the compatibility alias", async () => {
    const createdInboxAgent = {
      id: "inbox-1",
      name: "Support inbox",
      description: "Routes support requests",
      agentSlug: "support-inbox",
      state: "RegistrationConfirmed",
      error: null,
      createdAt: "2026-04-13T10:00:00.000Z",
      updatedAt: "2026-04-13T10:01:00.000Z",
      lastCheckedAt: "2026-04-13T10:02:00.000Z",
      agentIdentifier: "policy.asset",
      metadataVersion: 1,
      sendFundingLovelace: null,
      SmartContractWallet: {
        walletVkey: "funding_vkey",
        walletAddress: "addr_test1funding",
      },
      RecipientWallet: {
        walletVkey: "funding_vkey",
        walletAddress: "addr_test1funding",
      },
      CurrentTransaction: null,
    };
    const registerInboxAgentMock = vi.fn();
    registerInboxAgentMock.mockResolvedValue(createdInboxAgent);
    createInboxAdminPaymentNodeClientMock.mockReturnValue({
      registerInboxAgent: registerInboxAgentMock,
    });
    prepareManagedInboxRegistrationMock.mockResolvedValue({
      success: true,
      executingWallet: {
        id: "managed-1",
        walletVkey: "managed_vkey",
        walletAddress: "addr_test1managed",
        collectionAddress: null,
        note: "Inbox agent: Support inbox (selling)",
      },
      paymentSourceId: "payment-source-1",
      smartContractAddress: "addr_test1contract",
    });

    const request = new NextRequest(
      "https://saas.example.com/api/masumi/inbox-agent/register?network=Preprod",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Support inbox",
          description: "Routes support requests",
          agentSlug: "Support Inbox",
        }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(prepareManagedInboxRegistrationMock).toHaveBeenCalledWith({
      name: "Support inbox",
      network: "Preprod",
    });
    expect(ensureUserPaymentNodeKeyScopedToWalletsMock).toHaveBeenCalledWith({
      userId: "user-1",
      walletIds: ["managed-1"],
    });
    expect(getPaymentNodeClientForUserMock).not.toHaveBeenCalled();
    expect(createInboxAdminPaymentNodeClientMock).toHaveBeenCalledTimes(1);
    expect(registerInboxAgentMock).toHaveBeenCalledWith({
      network: "Preprod",
      sellingWalletVkey: "managed_vkey",
      recipientWalletAddress: "addr_test1managed",
      name: "Support inbox",
      description: "Routes support requests",
      agentSlug: "support-inbox",
    });
    expect(saveInboxAgentReferenceMock).toHaveBeenCalledWith({
      userId: "user-1",
      network: "Preprod",
      entry: createdInboxAgent,
      executingWallet: {
        id: "managed-1",
        walletVkey: "managed_vkey",
        walletAddress: "addr_test1managed",
        collectionAddress: null,
        note: "Inbox agent: Support inbox (selling)",
      },
      smartContractAddress: "addr_test1contract",
    });
  });
});
