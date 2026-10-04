import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAuthenticatedOrThrowMock = vi.fn();
const startX402HttpAgentRegistrationMock = vi.fn();
const scheduleAgentRegistrationCompletionMock = vi.fn();

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/utils", () => ({
  getAuthenticatedOrThrow: getAuthenticatedOrThrowMock,
  handleAuthError: vi.fn(),
}));

vi.mock("@/lib/auth/oidc-api-permissions", () => ({
  requireNetworkedOidcApiScope: vi.fn(),
}));

vi.mock("@/lib/credits/apply-mainnet-registration-credit-gate", () => ({
  assertMainnetCreditsForNewRegistrations: vi.fn(),
}));

vi.mock("@/lib/agents/drive-registration-completion", () => ({
  scheduleAgentRegistrationCompletion: scheduleAgentRegistrationCompletionMock,
}));

vi.mock("@/lib/x402/start-x402-http-agent-registration", () => ({
  BATCH_X402_PROBE_TIMEOUT_MS: 15_000,
  BATCH_X402_REGISTRATION_CONCURRENCY: 5,
  BATCH_X402_REGISTRATION_MAX_URLS: 100,
  findRegisteredX402ResourceUrlKeys: vi.fn(async () => new Set()),
  startX402HttpAgentRegistration: startX402HttpAgentRegistrationMock,
}));

const { POST } = await import("./route");

const urls = Array.from(
  { length: 7 },
  (_, i) => `https://api.example.com/paid-${i}`,
);

function batchRequest() {
  return new NextRequest(
    "https://saas.example.com/api/agents/batch-x402?network=Preprod",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        registrations: urls.map((resourceUrl) => ({ resourceUrl })),
      }),
    },
  );
}

describe("/api/agents/batch-x402 POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedOrThrowMock.mockResolvedValue({
      user: { id: "user-1", name: null, email: null },
      activeOrganizationId: null,
      authMethod: "session",
    });
  });

  it("returns results in input order with a bounded probe timeout", async () => {
    startX402HttpAgentRegistrationMock.mockImplementation(
      async ({ resourceUrl }: { resourceUrl: string }) => {
        const index = Number(resourceUrl.split("-").pop());
        // Later URLs finish first to prove order does not follow completion.
        await new Promise((resolve) => setTimeout(resolve, (7 - index) * 2));
        return { ok: true, agentId: `agent-${index}`, resourceUrl };
      },
    );

    const response = await POST(batchRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(
      json.results.map((r: { resourceUrl: string }) => r.resourceUrl),
    ).toEqual(urls);
    expect(json.summary.started).toBe(7);
    expect(startX402HttpAgentRegistrationMock).toHaveBeenCalledWith(
      expect.objectContaining({ probeTimeoutMs: 15_000 }),
    );
    expect(scheduleAgentRegistrationCompletionMock).toHaveBeenCalledTimes(7);
  });

  it("marks items that have not started as not attempted once credits run out", async () => {
    startX402HttpAgentRegistrationMock.mockImplementation(
      async ({ resourceUrl }: { resourceUrl: string }) => {
        const index = Number(resourceUrl.split("-").pop());
        if (index === 0) {
          return {
            ok: false,
            code: "credits",
            resourceUrl,
            error: "Insufficient credits",
          };
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { ok: true, agentId: `agent-${index}`, resourceUrl };
      },
    );

    const response = await POST(batchRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    // Items 1-4 were already in flight; items 5 and 6 never start.
    expect(json.summary).toEqual({
      started: 4,
      skippedDuplicate: 0,
      failed: 1,
      notAttempted: 2,
      stoppedReason: "insufficient_credits",
    });
    expect(json.results[5].status).toBe("not_attempted");
    expect(startX402HttpAgentRegistrationMock).toHaveBeenCalledTimes(5);
  });
});
