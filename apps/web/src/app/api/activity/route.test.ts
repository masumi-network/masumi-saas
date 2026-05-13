import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const getAuthenticatedOrThrowMock = vi.fn();
const handleAuthErrorMock = vi.fn();
const requireNetworkedOidcApiScopeMock = vi.fn();
const getActivityMergedFeedCachedMock = vi.fn();

vi.mock("@/lib/auth/utils", () => ({
  getAuthenticatedOrThrow: getAuthenticatedOrThrowMock,
  handleAuthError: handleAuthErrorMock,
}));

vi.mock("@/lib/auth/oidc-api-permissions", () => ({
  requireNetworkedOidcApiScope: requireNetworkedOidcApiScopeMock,
}));

vi.mock("@/lib/schemas/activity", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/schemas/activity")>();

  return {
    ...actual,
    activityApiSearchParamsSchema: {
      safeParse: () => ({
        success: true as const,
        data: {
          filter: "transactions",
          network: "Mainnet",
          summary: false,
          lastUpdate: undefined,
          limit: undefined,
          cursor: undefined,
        },
      }),
    },
    activityPaginationFromLimitParamSchema: {
      safeParse: () => ({
        success: true as const,
        data: {
          usePagination: false,
          pageLimit: 50,
        },
      }),
    },
    parseActivityQueryInput: (input: Record<string, unknown>) => input,
  };
});

vi.mock("./build-merged-feed", () => ({
  ACTIVITY_MERGED_FEED_LIMIT: 200,
  getActivityMergedFeedCached: getActivityMergedFeedCachedMock,
}));

describe("/api/activity GET", () => {
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
  });

  it("returns a clear 503 when Mainnet payment-source config is missing", async () => {
    const { PaymentNodeConfigError } =
      await import("@/lib/payment-node/config");
    getActivityMergedFeedCachedMock.mockRejectedValue(
      new PaymentNodeConfigError(
        "PAYMENT_NODE_PAYMENT_SOURCE_ID_MAINNET is required for Mainnet payment-source operations",
      ),
    );

    const request = new NextRequest(
      "https://saas.example.com/api/activity?network=Mainnet&filter=transactions",
    );

    const response = await GET(request);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toStrictEqual({
      success: false,
      error:
        "PAYMENT_NODE_PAYMENT_SOURCE_ID_MAINNET is required for Mainnet payment-source operations",
    });
  });
});
