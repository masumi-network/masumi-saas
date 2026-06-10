import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock, updateMock, updateUserMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
  updateUserMock: vi.fn(),
}));

vi.mock("@masumi/database/client", () => ({
  default: {
    user: {
      findUnique: findUniqueMock,
      update: updateMock,
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: {
    api: {
      updateUser: updateUserMock,
    },
  },
}));

describe("resolveShowOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateUserMock.mockResolvedValue(undefined);
    updateMock.mockResolvedValue(undefined);
  });

  it("returns false when onboarding is already completed", async () => {
    findUniqueMock.mockResolvedValue({
      onboardingCompleted: true,
      _count: { members: 0 },
    });

    const { resolveShowOnboarding } = await import("./resolve-show-onboarding");
    await expect(resolveShowOnboarding("user-1")).resolves.toBe(false);
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("auto-completes and returns false for organization members", async () => {
    findUniqueMock.mockResolvedValue({
      onboardingCompleted: false,
      _count: { members: 1 },
    });

    const { resolveShowOnboarding } = await import("./resolve-show-onboarding");
    await expect(resolveShowOnboarding("user-1")).resolves.toBe(false);
    expect(updateUserMock).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { onboardingCompleted: true },
    });
  });

  it("returns true for new users without org membership", async () => {
    findUniqueMock.mockResolvedValue({
      onboardingCompleted: false,
      _count: { members: 0 },
    });

    const { resolveShowOnboarding } = await import("./resolve-show-onboarding");
    await expect(resolveShowOnboarding("user-1")).resolves.toBe(true);
    expect(updateUserMock).not.toHaveBeenCalled();
  });
});
