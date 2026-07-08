import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  user: { update: vi.fn() },
  apikey: { updateMany: vi.fn() },
  oauthAccessToken: { deleteMany: vi.fn() },
  session: { deleteMany: vi.fn() },
  member: { findMany: vi.fn(), count: vi.fn() },
};

vi.mock("server-only", () => ({}));
vi.mock("@masumi/database/client", () => ({ default: prismaMock }));

const {
  softDeleteUserAccount,
  isAccountSoftDeletedSignal,
  assertUserIsNotSoleOrgOwner,
  ACCOUNT_DELETED_BAN_REASON,
  ACCOUNT_SOFT_DELETED_MESSAGE,
  SOLE_ORG_OWNER_BLOCK_MESSAGE,
} = await import("./soft-delete-account");

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.update.mockResolvedValue({});
  prismaMock.apikey.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.oauthAccessToken.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.session.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.member.findMany.mockResolvedValue([]);
  prismaMock.member.count.mockResolvedValue(0);
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
    // OIDC access tokens are validated by expiry only, so outstanding tokens
    // must be revoked or a soft-deleted user keeps API access until they expire.
    expect(prismaMock.oauthAccessToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
    expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
  });
});

describe("assertUserIsNotSoleOrgOwner", () => {
  it("passes when the user owns no organizations", async () => {
    prismaMock.member.findMany.mockResolvedValueOnce([]);
    await expect(
      assertUserIsNotSoleOrgOwner("user-1"),
    ).resolves.toBeUndefined();
  });

  it("passes when every owned org has another owner", async () => {
    prismaMock.member.findMany.mockResolvedValueOnce([
      { organizationId: "org-1" },
    ]);
    prismaMock.member.count.mockResolvedValueOnce(1); // another owner exists
    await expect(
      assertUserIsNotSoleOrgOwner("user-1"),
    ).resolves.toBeUndefined();
  });

  it("blocks when the user is the sole owner of an org", async () => {
    prismaMock.member.findMany.mockResolvedValueOnce([
      { organizationId: "org-1" },
    ]);
    prismaMock.member.count.mockResolvedValueOnce(0); // no other owners
    await expect(assertUserIsNotSoleOrgOwner("user-1")).rejects.toThrow(
      SOLE_ORG_OWNER_BLOCK_MESSAGE,
    );
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
