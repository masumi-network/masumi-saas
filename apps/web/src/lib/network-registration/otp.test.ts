import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findVerification: vi.fn(),
  updateVerification: vi.fn(),
  updateMany: vi.fn(),
  findDraft: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ auth: {} }));
vi.mock("@/lib/auth/auth-storage", () => ({
  findVerificationByIdentifier: mocks.findVerification,
  updateVerificationValue: mocks.updateVerification,
}));
vi.mock("@masumi/database/client", () => ({
  default: {
    verification: { updateMany: mocks.updateMany },
    networkRegistrationDraft: { findUnique: mocks.findDraft },
  },
}));
vi.mock("@/lib/credits/service", () => ({}));
vi.mock("@/lib/email/postmark", () => ({ postmarkClient: null }));

import {
  bindNetworkRegistrationDraftToTicket,
  rebindNetworkRegistrationDraftToTicket,
  shouldExposeNetworkRegisterDevOtp,
} from "./otp";

describe("registration ticket draft binding", () => {
  let row: { id: string; value: string; expiresAt: Date };
  let releaseSecondWrite: () => void;
  let secondWrite: Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();
    row = {
      id: "ticket-row",
      value: JSON.stringify({ userId: "user", email: "user@example.com" }),
      expiresAt: new Date(Date.now() + 60_000),
    };
    secondWrite = new Promise<void>((resolve) => {
      releaseSecondWrite = resolve;
    });
    mocks.findVerification.mockImplementation(async () => ({ ...row }));
    mocks.findDraft.mockResolvedValue(null);
    mocks.updateVerification.mockImplementation(async (_id, value) => {
      if (JSON.parse(value).draftId === "draft-b") await secondWrite;
      row.value = value;
    });
    mocks.updateMany.mockImplementation(async ({ where, data }) => {
      if (JSON.parse(data.value).draftId === "draft-b") await secondWrite;
      if (
        row.id !== where.id ||
        row.value !== where.value ||
        row.expiresAt <= where.expiresAt.gt
      ) {
        return { count: 0 };
      }
      row.value = data.value;
      return { count: 1 };
    });
  });

  it("keeps the first binding when another request read the same unbound ticket", async () => {
    const first = bindNetworkRegistrationDraftToTicket({
      token: "ticket",
      draftId: "draft-a",
    });
    const second = bindNetworkRegistrationDraftToTicket({
      token: "ticket",
      draftId: "draft-b",
    });
    const results = Promise.allSettled([first, second]);
    await first;
    expect(JSON.parse(row.value).draftId).toBe("draft-a");
    releaseSecondWrite();
    expect((await results).map((result) => result.status)).toEqual([
      "fulfilled",
      "rejected",
    ]);
    expect(JSON.parse(row.value).draftId).toBe("draft-a");
  });

  it("stops a concurrent stale-ticket retry before it can mint a second draft", async () => {
    row.value = JSON.stringify({
      userId: "user",
      email: "user@example.com",
      draftId: "expired-draft",
    });
    const first = rebindNetworkRegistrationDraftToTicket({
      token: "ticket",
      draftId: "draft-a",
    });
    const second = rebindNetworkRegistrationDraftToTicket({
      token: "ticket",
      draftId: "draft-b",
    });
    const results = Promise.allSettled([first, second]);
    await first;
    releaseSecondWrite();
    expect((await results).map((result) => result.status)).toEqual([
      "fulfilled",
      "rejected",
    ]);
    expect(JSON.parse(row.value).draftId).toBe("draft-a");
  });

  it("does not replace a live draft bound before a delayed retry reads the ticket", async () => {
    row.value = JSON.stringify({
      userId: "user",
      email: "user@example.com",
      draftId: "draft-a",
    });
    mocks.findDraft.mockResolvedValue({
      email: "user@example.com",
      userId: "user",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 60_000),
    });
    releaseSecondWrite();
    await expect(
      rebindNetworkRegistrationDraftToTicket({
        token: "ticket",
        draftId: "draft-b",
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(JSON.parse(row.value).draftId).toBe("draft-a");
  });
});

describe("shouldExposeNetworkRegisterDevOtp", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSuppress = process.env.NETWORK_REGISTER_SUPPRESS_DEV_OTP;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalSuppress === undefined) {
      delete process.env.NETWORK_REGISTER_SUPPRESS_DEV_OTP;
    } else {
      process.env.NETWORK_REGISTER_SUPPRESS_DEV_OTP = originalSuppress;
    }
  });

  it("returns false outside development", () => {
    process.env.NODE_ENV = "production";
    delete process.env.NETWORK_REGISTER_SUPPRESS_DEV_OTP;
    expect(shouldExposeNetworkRegisterDevOtp()).toBe(false);
  });

  it("returns true in development by default", () => {
    process.env.NODE_ENV = "development";
    delete process.env.NETWORK_REGISTER_SUPPRESS_DEV_OTP;
    expect(shouldExposeNetworkRegisterDevOtp()).toBe(true);
  });

  it("returns false in development when suppress flag is enabled", () => {
    process.env.NODE_ENV = "development";
    process.env.NETWORK_REGISTER_SUPPRESS_DEV_OTP = "true";
    expect(shouldExposeNetworkRegisterDevOtp()).toBe(false);
  });
});
