import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const getAuthenticatedOrThrowMock = vi.fn();
const handleAuthErrorMock = vi.fn();
const requireNetworkedOidcApiScopeMock = vi.fn();
const listWalletOwnedAgentsForUserMock = vi.fn();

vi.mock("@/lib/auth/utils", () => ({
  getAuthenticatedOrThrow: getAuthenticatedOrThrowMock,
  handleAuthError: handleAuthErrorMock,
}));

vi.mock("@/lib/auth/oidc-api-permissions", () => ({
  requireNetworkedOidcApiScope: requireNetworkedOidcApiScopeMock,
}));

vi.mock("@/lib/agents/wallet-ownership", () => ({
  listWalletOwnedAgentsForUser: listWalletOwnedAgentsForUserMock,
}));

vi.mock("@/lib/schemas", () => ({
  agentCountsQuerySchema: {
    safeParse: (input: { network?: string | null }) => {
      const network = input.network === "Mainnet" ? "Mainnet" : "Preprod";
      return {
        success: true as const,
        data: { network },
      };
    },
  },
}));

describe("/api/agents/counts GET", () => {
  let GET: typeof import("./route").GET;

  beforeAll(async () => {
    ({ GET } = await import("./route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    handleAuthErrorMock.mockReturnValue(null);
    getAuthenticatedOrThrowMock.mockResolvedValue({
      user: { id: "user-1" },
    });
    requireNetworkedOidcApiScopeMock.mockImplementation(() => {});
    listWalletOwnedAgentsForUserMock.mockResolvedValue([
      {
        id: "agent-1",
        registrationState: "RegistrationConfirmed",
        verificationStatus: "VERIFIED",
      },
      {
        id: "agent-2",
        registrationState: "DeregistrationConfirmed",
        verificationStatus: "PENDING",
      },
      {
        id: "agent-3",
        registrationState: "RegistrationRequested",
        verificationStatus: "PENDING",
      },
      {
        id: "agent-4",
        registrationState: "RegistrationFailed",
        verificationStatus: "PENDING",
      },
    ]);
  });

  it("counts only wallet-owned agents from the payment-node scoped list", async () => {
    const request = new NextRequest(
      "https://saas.example.com/api/agents/counts?network=Preprod",
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(listWalletOwnedAgentsForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      network: "Preprod",
    });
    await expect(response.json()).resolves.toStrictEqual({
      success: true,
      data: {
        all: 4,
        registered: 1,
        deregistered: 1,
        pending: 1,
        failed: 1,
        verified: 1,
      },
    });
  });
});
