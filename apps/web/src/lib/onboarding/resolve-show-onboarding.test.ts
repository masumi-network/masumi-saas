import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock, updateMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock("@masumi/database/client", () => ({
  default: {
    user: {
      findUnique: findUniqueMock,
      update: updateMock,
    },
  },
}));

describe("resolveShowOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMock.mockResolvedValue(undefined);
  });

  it("returns false when onboarding is already completed", async () => {
    findUniqueMock.mockResolvedValue({
      onboardingCompleted: true,
      _count: { members: 0 },
    });

    const { resolveShowOnboarding } = await import("./resolve-show-onboarding");
    await expect(resolveShowOnboarding("user-1")).resolves.toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("auto-completes and returns false for organization members", async () => {
    findUniqueMock.mockResolvedValue({
      onboardingCompleted: false,
      _count: { members: 1 },
    });

    const { resolveShowOnboarding } = await import("./resolve-show-onboarding");
    await expect(resolveShowOnboarding("user-1")).resolves.toBe(false);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { onboardingCompleted: true },
    });
  });

  it("returns false for organization members when auto-complete persistence fails", async () => {
    findUniqueMock.mockResolvedValue({
      onboardingCompleted: false,
      _count: { members: 1 },
    });
    updateMock.mockRejectedValue(new Error("db down"));

    const { resolveShowOnboarding } = await import("./resolve-show-onboarding");
    await expect(resolveShowOnboarding("user-1")).resolves.toBe(false);
  });

  it("returns true for new users without org membership", async () => {
    findUniqueMock.mockResolvedValue({
      onboardingCompleted: false,
      _count: { members: 0 },
    });

    const { resolveShowOnboarding } = await import("./resolve-show-onboarding");
    await expect(resolveShowOnboarding("user-1")).resolves.toBe(true);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
