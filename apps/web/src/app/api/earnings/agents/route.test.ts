import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const getAuthenticatedOrThrowMock = vi.fn();
const handleAuthErrorMock = vi.fn();
const requireNetworkedOidcApiScopeMock = vi.fn();
const listUserOwnedAgentsForEarningsMock = vi.fn();

vi.mock("@/lib/auth/utils", () => ({
  getAuthenticatedOrThrow: getAuthenticatedOrThrowMock,
  handleAuthError: handleAuthErrorMock,
}));

vi.mock("@/lib/auth/oidc-api-permissions", () => ({
  requireNetworkedOidcApiScope: requireNetworkedOidcApiScopeMock,
}));

vi.mock("@/lib/earnings/owned-agent", () => ({
  listUserOwnedAgentsForEarnings: listUserOwnedAgentsForEarningsMock,
}));

describe("/api/earnings/agents GET", () => {
  let GET: typeof import("./route").GET;

  beforeAll(async () => {
    ({ GET } = await import("./route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    handleAuthErrorMock.mockReturnValue(null);
    getAuthenticatedOrThrowMock.mockResolvedValue({
      user: { id: "user-1" },
      authMethod: "session",
    });
    requireNetworkedOidcApiScopeMock.mockImplementation(() => {});
  });

  it("includes fully deregistered earnings agents from the requested network", async () => {
    listUserOwnedAgentsForEarningsMock.mockResolvedValue([
      {
        id: "agent-2",
        name: "Gamma",
        icon: null,
        agentIdentifier: "agent-gamma",
        registrationState: "DeregistrationConfirmed",
        networkIdentifier: "Preprod",
        agentReference: null,
      },
      {
        id: "agent-1",
        name: "Alpha",
        icon: null,
        agentIdentifier: "agent-alpha",
        registrationState: "RegistrationConfirmed",
        networkIdentifier: "Preprod",
        agentReference: null,
      },
      {
        id: "agent-4",
        name: "Pending",
        icon: null,
        agentIdentifier: "agent-pending",
        registrationState: "RegistrationInitiated",
        networkIdentifier: "Preprod",
        agentReference: null,
      },
    ]);

    const response = await GET(
      new NextRequest(
        "https://saas.example.com/api/earnings/agents?network=Preprod",
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: [
        {
          id: "agent-1",
          name: "Alpha",
          icon: null,
          agentIdentifier: "agent-alpha",
          registrationState: "RegistrationConfirmed",
          network: "Preprod",
        },
        {
          id: "agent-2",
          name: "Gamma",
          icon: null,
          agentIdentifier: "agent-gamma",
          registrationState: "DeregistrationConfirmed",
          network: "Preprod",
        },
      ],
    });
    expect(listUserOwnedAgentsForEarningsMock).toHaveBeenCalledWith({
      userId: "user-1",
      network: "Preprod",
    });
    expect(requireNetworkedOidcApiScopeMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        resource: "earnings",
        action: "read",
        network: "Preprod",
      },
    );
  });
});
