import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const getAuthenticatedOrThrowMock = vi.fn();
const handleAuthErrorMock = vi.fn();
const getCreditBalanceMock = vi.fn();

vi.mock("@/lib/auth/utils", () => ({
  getAuthenticatedOrThrow: getAuthenticatedOrThrowMock,
  handleAuthError: handleAuthErrorMock,
}));

vi.mock("@/lib/credits/service", () => ({
  getCreditBalance: getCreditBalanceMock,
}));

describe("/api/credits", () => {
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
    getCreditBalanceMock.mockResolvedValue({
      creditsRemaining: 16000,
      updatedAt: new Date("2026-04-13T10:30:00.000Z"),
    });
  });

  it("returns the current credit balance", async () => {
    const request = new NextRequest("https://saas.example.com/api/credits");

    const response = await GET(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        creditsRemaining: 16000,
        updatedAt: "2026-04-13T10:30:00.000Z",
      },
    });
  });
});
