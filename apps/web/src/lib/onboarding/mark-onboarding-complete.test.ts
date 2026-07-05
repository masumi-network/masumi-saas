import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateMock } = vi.hoisted(() => ({
  updateMock: vi.fn(),
}));

vi.mock("@masumi/database/client", () => ({
  default: {
    user: {
      update: updateMock,
    },
  },
}));

describe("markOnboardingCompleteForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMock.mockResolvedValue(undefined);
  });

  it("persists onboardingCompleted via Prisma", async () => {
    const { markOnboardingCompleteForUser } =
      await import("./mark-onboarding-complete");

    await expect(markOnboardingCompleteForUser("user-1")).resolves.toBe(true);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { onboardingCompleted: true },
    });
  });

  it("returns false when Prisma update fails", async () => {
    updateMock.mockRejectedValue(new Error("db down"));

    const { markOnboardingCompleteForUser } =
      await import("./mark-onboarding-complete");

    await expect(markOnboardingCompleteForUser("user-1")).resolves.toBe(false);
  });
});
