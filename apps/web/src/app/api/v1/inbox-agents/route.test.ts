import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { z } from "@/lib/zod-openapi";

const getAuthenticatedOrThrowMock = vi.fn();
const handleAuthErrorMock = vi.fn();
const requireNetworkedOidcApiScopeMock = vi.fn();
const getPaymentNodeClientForUserMock = vi.fn();
const createInboxAdminPaymentNodeClientMock = vi.fn();
const findInboxAgentSlugConflictMock = vi.fn();
const findRegistryInboxAgentSlugConflictMock = vi.fn();
const listOwnedInboxAgentsForUserMock = vi.fn();
const prepareManagedInboxRegistrationMock = vi.fn();
const reserveInboxAgentReferenceMock = vi.fn();
const finalizeInboxAgentReservationMock = vi.fn();
const deleteInboxAgentReferenceMock = vi.fn();
const consumeCreditIfRequiredMock = vi.fn();
const refundConsumedCreditMock = vi.fn();

class InboxAgentOwnershipMismatchError extends Error {
  readonly ownedByUserId: string;

  constructor(ownedByUserId: string) {
    super("Inbox agent is owned by a different user");
    this.name = "InboxAgentOwnershipMismatchError";
    this.ownedByUserId = ownedByUserId;
  }
}

class StaleInboxAgentCursorError extends Error {
  constructor() {
    super(
      "This page of inbox agents is out of date. Refresh to load the latest items.",
    );
    this.name = "StaleInboxAgentCursorError";
  }
}

vi.mock("@/lib/auth/utils", () => ({
  getAuthenticatedOrThrow: getAuthenticatedOrThrowMock,
  handleAuthError: handleAuthErrorMock,
}));

vi.mock("@/lib/auth/oidc-api-permissions", () => ({
  requireNetworkedOidcApiScope: requireNetworkedOidcApiScopeMock,
}));

vi.mock("@/lib/inbox-agents/server", () => ({
  createInboxAdminPaymentNodeClient: createInboxAdminPaymentNodeClientMock,
  deleteInboxAgentReference: deleteInboxAgentReferenceMock,
  finalizeInboxAgentReservation: finalizeInboxAgentReservationMock,
  findInboxAgentSlugConflict: findInboxAgentSlugConflictMock,
  findRegistryInboxAgentSlugConflict: findRegistryInboxAgentSlugConflictMock,
  INBOX_AGENT_DUPLICATE_SLUG_ERROR:
    "Inbox slug is already in use on this network",
  INBOX_AGENT_OWNERSHIP_CONFLICT_ERROR:
    "Inbox agent is already owned by another account",
  listOwnedInboxAgentsForUser: listOwnedInboxAgentsForUserMock,
  prepareManagedInboxRegistration: prepareManagedInboxRegistrationMock,
  reserveInboxAgentReference: reserveInboxAgentReferenceMock,
  isInboxAgentOwnershipMismatchError: (error: unknown) =>
    error instanceof InboxAgentOwnershipMismatchError,
  isStaleInboxAgentCursorError: (error: unknown) =>
    error instanceof StaleInboxAgentCursorError,
}));

vi.mock("@/lib/credits/service", () => ({
  consumeCreditIfRequired: consumeCreditIfRequiredMock,
  refundConsumedCredit: refundConsumedCreditMock,
  createCreditReference: () => "inbox-agent-register:test",
}));

vi.mock("@/lib/payment-node/get-user-client", () => ({
  getPaymentNodeClientForUser: getPaymentNodeClientForUserMock,
}));

vi.mock("@/lib/payment-node/wallet-scopes", () => ({
  ensureUserPaymentNodeKeyScopedToWallets: () => {
    throw new Error(
      "Inbox registration must not scope funding wallets to users",
    );
  },
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

describe("/pay/api/v1/inbox-agents", () => {
  let GET: typeof import("./route").GET;
  let POST: typeof import("./route").POST;

  const inboxAgent = {
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
  } as const;

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
    refundConsumedCreditMock.mockResolvedValue(undefined);
    getPaymentNodeClientForUserMock.mockResolvedValue({});
    findInboxAgentSlugConflictMock.mockResolvedValue(null);
    findRegistryInboxAgentSlugConflictMock.mockResolvedValue(null);
    prepareManagedInboxRegistrationMock.mockResolvedValue({
      success: true,
      executingWallet: {
        id: "funding-1",
        walletVkey: "funding_vkey",
        walletAddress: "addr_test1funding",
        collectionAddress: null,
        note: "Funding wallet",
      },
      paymentSourceId: "payment-source-1",
      smartContractAddress: "addr_test1contract",
    });
    reserveInboxAgentReferenceMock.mockResolvedValue({
      status: "reserved",
      reservation: {
        id: "reservation-1",
      },
    });
    finalizeInboxAgentReservationMock.mockResolvedValue({
      id: "ref-1",
      userId: "user-1",
    });
    deleteInboxAgentReferenceMock.mockResolvedValue(undefined);
    listOwnedInboxAgentsForUserMock.mockResolvedValue({
      Assets: [inboxAgent],
      nextCursor: null,
    });
  });

  it("lists inbox agents from DB ownership records", async () => {
    const request = new NextRequest(
      "https://saas.example.com/pay/api/v1/inbox-agents?network=Preprod&take=1",
      {
        method: "GET",
      },
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(listOwnedInboxAgentsForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      network: "Preprod",
      take: 1,
      cursor: undefined,
      filterStatus: undefined,
      search: undefined,
    });
  });

  it("returns 410 when a paginated list cursor is stale", async () => {
    listOwnedInboxAgentsForUserMock.mockRejectedValue(
      new StaleInboxAgentCursorError(),
    );
    const request = new NextRequest(
      "https://saas.example.com/pay/api/v1/inbox-agents?network=Preprod&cursor=stale-cursor",
      {
        method: "GET",
      },
    );

    const response = await GET(request);

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toStrictEqual({
      success: false,
      error:
        "This page of inbox agents is out of date. Refresh to load the latest items.",
    });
  });

  it("registers inbox agents through the admin key using the configured funding wallet", async () => {
    const registerInboxAgentMock = vi.fn().mockResolvedValue(inboxAgent);
    createInboxAdminPaymentNodeClientMock.mockReturnValue({
      registerInboxAgent: registerInboxAgentMock,
    });
    prepareManagedInboxRegistrationMock.mockResolvedValue({
      success: true,
      executingWallet: {
        id: "funding-1",
        walletVkey: "funding_vkey",
        walletAddress: "addr_test1funding",
        collectionAddress: null,
        note: "Funding wallet",
      },
      paymentSourceId: "payment-source-1",
      smartContractAddress: "addr_test1contract",
    });

    const request = new NextRequest(
      "https://saas.example.com/pay/api/v1/inbox-agents?network=Preprod",
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
    expect(getPaymentNodeClientForUserMock).toHaveBeenCalledWith("user-1");
    expect(createInboxAdminPaymentNodeClientMock).toHaveBeenCalledTimes(1);
    expect(findInboxAgentSlugConflictMock).toHaveBeenCalledWith({
      network: "Preprod",
      slug: "support-inbox",
      client: expect.any(Object),
    });
    expect(findRegistryInboxAgentSlugConflictMock).toHaveBeenCalledWith({
      network: "Preprod",
      slug: "support-inbox",
      client: expect.any(Object),
    });
    expect(reserveInboxAgentReferenceMock).toHaveBeenCalledWith({
      userId: "user-1",
      network: "Preprod",
      name: "Support inbox",
      description: "Routes support requests",
      slug: "support-inbox",
      executingWallet: {
        id: "funding-1",
        walletVkey: "funding_vkey",
        walletAddress: "addr_test1funding",
        collectionAddress: null,
        note: "Funding wallet",
      },
      smartContractAddress: "addr_test1contract",
    });
    expect(registerInboxAgentMock).toHaveBeenCalledWith({
      network: "Preprod",
      sellingWalletVkey: "funding_vkey",
      recipientWalletAddress: "addr_test1funding",
      name: "Support inbox",
      description: "Routes support requests",
      agentSlug: "support-inbox",
    });
    expect(finalizeInboxAgentReservationMock).toHaveBeenCalledWith({
      reservationId: "reservation-1",
      userId: "user-1",
      network: "Preprod",
      entry: inboxAgent,
      executingWallet: {
        id: "funding-1",
        walletVkey: "funding_vkey",
        walletAddress: "addr_test1funding",
        collectionAddress: null,
        note: "Funding wallet",
      },
      smartContractAddress: "addr_test1contract",
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

  it("returns 403 before resolving managed registration when the user payment-node key is unavailable", async () => {
    getPaymentNodeClientForUserMock.mockResolvedValue(null);
    const registerInboxAgentMock = vi.fn();
    createInboxAdminPaymentNodeClientMock.mockReturnValue({
      registerInboxAgent: registerInboxAgentMock,
    });

    const request = new NextRequest(
      "https://saas.example.com/pay/api/v1/inbox-agents?network=Preprod",
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

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toStrictEqual({
      success: false,
      error: "Payment node not configured for user",
    });
    expect(consumeCreditIfRequiredMock).not.toHaveBeenCalled();
    expect(findInboxAgentSlugConflictMock).not.toHaveBeenCalled();
    expect(findRegistryInboxAgentSlugConflictMock).not.toHaveBeenCalled();
    expect(prepareManagedInboxRegistrationMock).not.toHaveBeenCalled();
    expect(createInboxAdminPaymentNodeClientMock).not.toHaveBeenCalled();
    expect(registerInboxAgentMock).not.toHaveBeenCalled();
  });

  it("returns 409 before credit consumption when the inbox slug is already registered", async () => {
    const registerInboxAgentMock = vi.fn();
    createInboxAdminPaymentNodeClientMock.mockReturnValue({
      registerInboxAgent: registerInboxAgentMock,
    });
    findInboxAgentSlugConflictMock.mockResolvedValue({
      source: "registry",
      state: "RegistrationConfirmed",
      paymentNodeId: "inbox-existing",
      agentIdentifier: "policy.existing",
    });

    const request = new NextRequest(
      "https://saas.example.com/pay/api/v1/inbox-agents?network=Preprod",
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

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toStrictEqual({
      success: false,
      error: "Inbox slug is already in use on this network",
    });
    expect(consumeCreditIfRequiredMock).not.toHaveBeenCalled();
    expect(prepareManagedInboxRegistrationMock).not.toHaveBeenCalled();
    expect(registerInboxAgentMock).not.toHaveBeenCalled();
    expect(finalizeInboxAgentReservationMock).not.toHaveBeenCalled();
  });

  it("cleans up the payment-node entry when local ownership persistence fails", async () => {
    const registerInboxAgentMock = vi.fn().mockResolvedValue(inboxAgent);
    const deleteRegistryInboxEntryMock = vi.fn().mockResolvedValue(inboxAgent);
    createInboxAdminPaymentNodeClientMock.mockReturnValue({
      registerInboxAgent: registerInboxAgentMock,
      deleteRegistryInboxEntry: deleteRegistryInboxEntryMock,
    });
    finalizeInboxAgentReservationMock.mockRejectedValue(
      new Error("DB unavailable"),
    );
    prepareManagedInboxRegistrationMock.mockResolvedValue({
      success: true,
      executingWallet: {
        id: "funding-1",
        walletVkey: "funding_vkey",
        walletAddress: "addr_test1funding",
        collectionAddress: null,
        note: "Funding wallet",
      },
      paymentSourceId: "payment-source-1",
      smartContractAddress: "addr_test1contract",
    });

    const request = new NextRequest(
      "https://saas.example.com/pay/api/v1/inbox-agents?network=Preprod",
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

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toStrictEqual({
      success: false,
      error: "Failed to persist inbox agent ownership",
    });
    expect(finalizeInboxAgentReservationMock).toHaveBeenCalledTimes(1);
    expect(deleteRegistryInboxEntryMock).toHaveBeenCalledWith("inbox-1");
    expect(deleteInboxAgentReferenceMock).toHaveBeenCalledWith("reservation-1");
    expect(refundConsumedCreditMock).toHaveBeenCalledTimes(1);
  });

  it("returns 409 and leaves the remote entry intact on cross-user ownership collision", async () => {
    const registerInboxAgentMock = vi.fn().mockResolvedValue(inboxAgent);
    const deleteRegistryInboxEntryMock = vi.fn().mockResolvedValue(inboxAgent);
    createInboxAdminPaymentNodeClientMock.mockReturnValue({
      registerInboxAgent: registerInboxAgentMock,
      deleteRegistryInboxEntry: deleteRegistryInboxEntryMock,
    });
    finalizeInboxAgentReservationMock.mockRejectedValue(
      new InboxAgentOwnershipMismatchError("other-user"),
    );
    prepareManagedInboxRegistrationMock.mockResolvedValue({
      success: true,
      executingWallet: {
        id: "funding-1",
        walletVkey: "funding_vkey",
        walletAddress: "addr_test1funding",
        collectionAddress: null,
        note: "Funding wallet",
      },
      paymentSourceId: "payment-source-1",
      smartContractAddress: "addr_test1contract",
    });

    const request = new NextRequest(
      "https://saas.example.com/pay/api/v1/inbox-agents?network=Preprod",
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

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toStrictEqual({
      success: false,
      error: "Inbox agent is already owned by another account",
    });
    expect(finalizeInboxAgentReservationMock).toHaveBeenCalledTimes(1);
    expect(deleteRegistryInboxEntryMock).not.toHaveBeenCalled();
    expect(deleteInboxAgentReferenceMock).toHaveBeenCalledWith("reservation-1");
    expect(refundConsumedCreditMock).toHaveBeenCalledTimes(1);
  });

  it("does not remove the configured funding wallet when remote inbox registration fails", async () => {
    const registerInboxAgentMock = vi
      .fn()
      .mockRejectedValue(new Error("registry unavailable"));
    const addWalletsToPaymentSourceMock = vi.fn().mockResolvedValue({});
    createInboxAdminPaymentNodeClientMock.mockReturnValue({
      registerInboxAgent: registerInboxAgentMock,
      addWalletsToPaymentSource: addWalletsToPaymentSourceMock,
    });
    prepareManagedInboxRegistrationMock.mockResolvedValue({
      success: true,
      executingWallet: {
        id: "funding-1",
        walletVkey: "funding_vkey",
        walletAddress: "addr_test1funding",
        collectionAddress: null,
        note: "Funding wallet",
      },
      paymentSourceId: "payment-source-1",
      smartContractAddress: "addr_test1contract",
    });

    const request = new NextRequest(
      "https://saas.example.com/pay/api/v1/inbox-agents?network=Preprod",
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

    expect(response.status).toBe(500);
    expect(registerInboxAgentMock).toHaveBeenCalledTimes(1);
    expect(addWalletsToPaymentSourceMock).not.toHaveBeenCalled();
    expect(refundConsumedCreditMock).toHaveBeenCalledTimes(1);
    expect(finalizeInboxAgentReservationMock).not.toHaveBeenCalled();
    expect(deleteInboxAgentReferenceMock).toHaveBeenCalledWith("reservation-1");
  });

  it("deletes the local reservation even when credit refund fails during cleanup", async () => {
    const registerInboxAgentMock = vi
      .fn()
      .mockRejectedValue(new Error("registry unavailable"));
    createInboxAdminPaymentNodeClientMock.mockReturnValue({
      registerInboxAgent: registerInboxAgentMock,
    });
    refundConsumedCreditMock.mockRejectedValue(new Error("refund unavailable"));
    prepareManagedInboxRegistrationMock.mockResolvedValue({
      success: true,
      executingWallet: {
        id: "funding-1",
        walletVkey: "funding_vkey",
        walletAddress: "addr_test1funding",
        collectionAddress: null,
        note: "Funding wallet",
      },
      paymentSourceId: "payment-source-1",
      smartContractAddress: "addr_test1contract",
    });

    const request = new NextRequest(
      "https://saas.example.com/pay/api/v1/inbox-agents?network=Preprod",
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

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toStrictEqual({
      success: false,
      error: "Failed to register inbox agent",
    });
    expect(refundConsumedCreditMock).toHaveBeenCalledTimes(1);
    expect(deleteInboxAgentReferenceMock).toHaveBeenCalledWith("reservation-1");
    expect(deleteInboxAgentReferenceMock).toHaveBeenCalledTimes(1);
  });

  it("returns 503 when Mainnet payment-source config is missing", async () => {
    const { PaymentNodeConfigError } =
      await import("@/lib/payment-node/config");
    const registerInboxAgentMock = vi.fn();
    createInboxAdminPaymentNodeClientMock.mockReturnValue({
      registerInboxAgent: registerInboxAgentMock,
    });
    prepareManagedInboxRegistrationMock.mockRejectedValue(
      new PaymentNodeConfigError(
        "PAYMENT_NODE_PAYMENT_SOURCE_ID_MAINNET is required for Mainnet payment-source operations",
      ),
    );

    const request = new NextRequest(
      "https://saas.example.com/pay/api/v1/inbox-agents?network=Mainnet",
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

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toStrictEqual({
      success: false,
      error:
        "PAYMENT_NODE_PAYMENT_SOURCE_ID_MAINNET is required for Mainnet payment-source operations",
    });
    expect(registerInboxAgentMock).not.toHaveBeenCalled();
    expect(getPaymentNodeClientForUserMock).toHaveBeenCalledWith("user-1");
    expect(createInboxAdminPaymentNodeClientMock).toHaveBeenCalledTimes(1);
    expect(refundConsumedCreditMock).not.toHaveBeenCalled();
    expect(deleteInboxAgentReferenceMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported wallet and top-up fields from the register schema", async () => {
    const request = new NextRequest(
      "https://saas.example.com/pay/api/v1/inbox-agents?network=Preprod",
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
    createInboxAdminPaymentNodeClientMock.mockReturnValue({
      registerInboxAgent: registerInboxAgentMock,
    });

    const request = new NextRequest(
      "https://saas.example.com/pay/api/v1/inbox-agents?network=Preprod",
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
    expect(prepareManagedInboxRegistrationMock).toHaveBeenCalledWith({
      name: "Support inbox",
      network: "Preprod",
    });
    expect(createInboxAdminPaymentNodeClientMock).toHaveBeenCalledTimes(1);
    expect(registerInboxAgentMock).not.toHaveBeenCalled();
    expect(deleteInboxAgentReferenceMock).toHaveBeenCalledWith("reservation-1");
  });
});
