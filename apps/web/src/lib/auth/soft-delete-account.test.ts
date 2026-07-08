import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  user: { update: vi.fn() },
  apikey: { updateMany: vi.fn() },
  session: { deleteMany: vi.fn() },
};

vi.mock("server-only", () => ({}));
vi.mock("@masumi/database/client", () => ({ default: prismaMock }));

const {
  softDeleteUserAccount,
  isAccountSoftDeletedSignal,
  ACCOUNT_DELETED_BAN_REASON,
  ACCOUNT_SOFT_DELETED_MESSAGE,
} = await import("./soft-delete-account");

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.update.mockResolvedValue({});
  prismaMock.apikey.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.session.deleteMany.mockResolvedValue({ count: 0 });
});

describe("softDeleteUserAccount", () => {
  it("bans the user, disables API keys, and revokes sessions", async () => {
    await softDeleteUserAccount("user-1");

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        banned: true,
        banReason: ACCOUNT_DELETED_BAN_REASON,
        banExpires: null,
      },
    });
    // API keys mint sessions that bypass the sign-in ban check, so they must be
    // disabled explicitly.
    expect(prismaMock.apikey.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { enabled: false },
    });
    expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
  });
});

describe("isAccountSoftDeletedSignal", () => {
  it("recognizes the soft-delete sentinel error", () => {
    expect(
      isAccountSoftDeletedSignal(new Error(ACCOUNT_SOFT_DELETED_MESSAGE)),
    ).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isAccountSoftDeletedSignal(new Error("Invalid password"))).toBe(
      false,
    );
    expect(isAccountSoftDeletedSignal("not an error")).toBe(false);
    expect(isAccountSoftDeletedSignal(null)).toBe(false);
  });
});
