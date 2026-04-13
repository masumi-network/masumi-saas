import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const getAuthenticatedOrThrowMock = vi.fn();
const handleAuthErrorMock = vi.fn();
const requireNetworkedOidcApiScopeMock = vi.fn();
const getPaymentNodeClientForUserMock = vi.fn();
const prepareManagedInboxRegistrationMock = vi.fn();
const consumeCreditIfRequiredMock = vi.fn();

vi.mock("@/lib/auth/utils", () => ({
  getAuthenticatedOrThrow: getAuthenticatedOrThrowMock,
  handleAuthError: handleAuthErrorMock,
}));

vi.mock("@/lib/auth/oidc-api-permissions", () => ({
  requireNetworkedOidcApiScope: requireNetworkedOidcApiScopeMock,
}));

vi.mock("@/lib/payment-node/get-user-client", () => ({
  getPaymentNodeClientForUser: getPaymentNodeClientForUserMock,
}));

vi.mock("@/lib/inbox-agents/server", () => ({
  prepareManagedInboxRegistration: prepareManagedInboxRegistrationMock,
}));

vi.mock("@/lib/credits/service", () => ({
  consumeCreditIfRequired: consumeCreditIfRequiredMock,
  createCreditReference: () => "inbox-agent-register:test",
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

describe("/api/v1/inbox-agents", () => {
  let GET: typeof import("./route").GET;
  let POST: typeof import("./route").POST;

  beforeAll(async () => {
    ({ GET, POST } = await import("./route"));
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
  });

  it("lists inbox agents from the v1 route", async () => {
    const getRegistryInboxMock = vi.fn().mockResolvedValue({
      Assets: [{ id: "inbox-1", name: "Support inbox" }],
    });
    getPaymentNodeClientForUserMock.mockResolvedValue({
      getRegistryInbox: getRegistryInboxMock,
    });

    const request = new NextRequest(
      "https://saas.example.com/api/v1/inbox-agents?network=Preprod&take=1",
      {
        method: "GET",
      },
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(getRegistryInboxMock).toHaveBeenCalledWith(
      expect.objectContaining({
        network: "Preprod",
        limit: 1,
      }),
    );
  });

  it("registers inbox agents with managed wallets selected on the server", async () => {
    const registerInboxAgentMock = vi.fn().mockResolvedValue({
      id: "inbox-1",
      name: "Support inbox",
    });
    getPaymentNodeClientForUserMock.mockResolvedValue({
      registerInboxAgent: registerInboxAgentMock,
    });
    prepareManagedInboxRegistrationMock.mockResolvedValue({
      success: true,
      sellingWallet: {
        walletMnemonic: "managed mnemonic",
        walletAddress: "addr_test1managed",
        walletVkey: "managed_vkey",
      },
      fundingWallet: {
        id: "funding-1",
        walletVkey: "funding_vkey",
        walletAddress: "addr_test1funding",
        collectionAddress: null,
        note: "Funding wallet",
      },
    });

    const request = new NextRequest(
      "https://saas.example.com/api/v1/inbox-agents?network=Preprod",
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
    expect(registerInboxAgentMock).toHaveBeenCalledWith({
      network: "Preprod",
      sellingWalletVkey: "funding_vkey",
      recipientWalletAddress: "addr_test1managed",
      name: "Support inbox",
      description: "Routes support requests",
      agentSlug: "support-inbox",
    });
    expect(consumeCreditIfRequiredMock).toHaveBeenCalledWith({
      userId: "user-1",
      reason: "inbox_agent_register",
      reference: "inbox-agent-register:test",
      network: "Preprod",
      metadata: {
        name: "Support inbox",
        agentSlug: "support-inbox",
        network: "Preprod",
        authMethod: "session",
      },
    });
  });

  it("rejects legacy wallet and top-up fields from the register schema", async () => {
    const request = new NextRequest(
      "https://saas.example.com/api/v1/inbox-agents?network=Preprod",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Support inbox",
          agentSlug: "support-inbox",
          sellingWalletVkey: "wallet_vkey_123",
          sendFundingAda: "2.5",
        }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
    });
    expect(prepareManagedInboxRegistrationMock).not.toHaveBeenCalled();
  });

  it("returns 402 without external writes when credits are insufficient", async () => {
    consumeCreditIfRequiredMock.mockRejectedValue({
      name: "InsufficientCreditsError",
      message: "Insufficient credits",
      creditsRemaining: 0,
      requiredCredits: 1,
    });
    handleAuthErrorMock.mockImplementation((error) => {
      if ((error as { name?: string }).name === "InsufficientCreditsError") {
        return Response.json(
          {
            success: false,
            error: "Insufficient credits",
            creditsRemaining: 0,
            requiredCredits: 1,
          },
          { status: 402 },
        );
      }
      return null;
    });
    const registerInboxAgentMock = vi.fn();
    getPaymentNodeClientForUserMock.mockResolvedValue({
      registerInboxAgent: registerInboxAgentMock,
    });

    const request = new NextRequest(
      "https://saas.example.com/api/v1/inbox-agents?network=Preprod",
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

    expect(response.status).toBe(402);
    expect(prepareManagedInboxRegistrationMock).not.toHaveBeenCalled();
    expect(registerInboxAgentMock).not.toHaveBeenCalled();
  });
});
