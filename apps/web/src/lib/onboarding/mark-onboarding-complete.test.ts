import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateMock, updateUserMock } = vi.hoisted(() => ({
  updateMock: vi.fn(),
  updateUserMock: vi.fn(),
}));

vi.mock("@masumi/database/client", () => ({
  default: {
    user: {
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

describe("markOnboardingCompleteForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateUserMock.mockResolvedValue(undefined);
    updateMock.mockResolvedValue(undefined);
  });

  it("returns true when Better Auth succeeds", async () => {
    const { markOnboardingCompleteForUser } =
      await import("./mark-onboarding-complete");

    await expect(markOnboardingCompleteForUser("user-1")).resolves.toBe(true);
    expect(updateUserMock).toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("falls back to Prisma when Better Auth fails", async () => {
    updateUserMock.mockRejectedValue(new Error("auth down"));

    const { markOnboardingCompleteForUser } =
      await import("./mark-onboarding-complete");

    await expect(markOnboardingCompleteForUser("user-1")).resolves.toBe(true);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { onboardingCompleted: true },
    });
  });

  it("returns false when both Better Auth and Prisma fail", async () => {
    updateUserMock.mockRejectedValue(new Error("auth down"));
    updateMock.mockRejectedValue(new Error("db down"));

    const { markOnboardingCompleteForUser } =
      await import("./mark-onboarding-complete");

    await expect(markOnboardingCompleteForUser("user-1")).resolves.toBe(false);
  });
});
