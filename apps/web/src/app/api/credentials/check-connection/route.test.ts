import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const getAuthenticatedOrThrowMock = vi.fn();
const handleAuthErrorMock = vi.fn();
const requireAnyNetworkedOidcApiScopeMock = vi.fn();
const checkContactExistsMock = vi.fn();

vi.mock("@/lib/auth/utils", () => ({
  getAuthenticatedOrThrow: getAuthenticatedOrThrowMock,
  handleAuthError: handleAuthErrorMock,
}));

vi.mock("@/lib/auth/oidc-api-permissions", () => ({
  requireAnyNetworkedOidcApiScope: requireAnyNetworkedOidcApiScopeMock,
}));

vi.mock("@/lib/veridian", () => ({
  checkContactExists: checkContactExistsMock,
}));

describe("/api/credentials/check-connection", () => {
  let POST: typeof import("./route").POST;

  beforeAll(async () => {
    ({ POST } = await import("./route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    handleAuthErrorMock.mockReturnValue(null);
  });

  it("returns 503 before touching auth or Veridian when verification is disabled", async () => {
    const request = new NextRequest(
      "https://saas.example.com/api/credentials/check-connection",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aid: "aid-1" }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error:
        "New agent verification requests are disabled for now. Existing verification badges remain visible.",
    });
    expect(getAuthenticatedOrThrowMock).not.toHaveBeenCalled();
    expect(requireAnyNetworkedOidcApiScopeMock).not.toHaveBeenCalled();
    expect(checkContactExistsMock).not.toHaveBeenCalled();
  });
});
