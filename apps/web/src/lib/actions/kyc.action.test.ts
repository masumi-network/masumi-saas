import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const getAuthenticatedOrThrowMock = vi.fn();
const userFindUniqueMock = vi.fn();
const memberFindFirstMock = vi.fn();
const kycVerificationUpdateMock = vi.fn();
const kycVerificationCreateMock = vi.fn();
const generateSumsubAccessTokenMock = vi.fn();
const getApplicantByExternalUserIdMock = vi.fn();
const getApplicantDataMock = vi.fn();

vi.mock("@masumi/database/client", () => ({
  default: {
    user: {
      findUnique: userFindUniqueMock,
    },
    member: {
      findFirst: memberFindFirstMock,
    },
    kycVerification: {
      update: kycVerificationUpdateMock,
      create: kycVerificationCreateMock,
    },
  },
}));

vi.mock("@/lib/auth/utils", () => ({
  getAuthenticatedOrThrow: getAuthenticatedOrThrowMock,
}));

vi.mock("@/lib/sumsub", () => ({
  generateSumsubAccessToken: generateSumsubAccessTokenMock,
  getApplicantByExternalUserId: getApplicantByExternalUserIdMock,
  getApplicantData: getApplicantDataMock,
  isVerificationFinal: vi.fn(),
  parseReviewResult: vi.fn(),
}));

describe("kyc actions when verification is disabled", () => {
  let generateKycAccessTokenAction: typeof import("./kyc.action").generateKycAccessTokenAction;
  let generateKybAccessTokenAction: typeof import("./kyc.action").generateKybAccessTokenAction;
  let getKycStatusAction: typeof import("./kyc.action").getKycStatusAction;
  let markKycAsSubmittedAction: typeof import("./kyc.action").markKycAsSubmittedAction;

  beforeAll(async () => {
    ({
      generateKycAccessTokenAction,
      generateKybAccessTokenAction,
      getKycStatusAction,
      markKycAsSubmittedAction,
    } = await import("./kyc.action"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedOrThrowMock.mockResolvedValue({
      user: { id: "user-1" },
    });
  });

  it("rejects new KYC access tokens before any auth or Sumsub calls", async () => {
    await expect(generateKycAccessTokenAction()).resolves.toEqual({
      success: false,
      error:
        "New identity verification requests are disabled for now. Existing verification records remain visible.",
    });

    expect(getAuthenticatedOrThrowMock).not.toHaveBeenCalled();
    expect(generateSumsubAccessTokenMock).not.toHaveBeenCalled();
  });

  it("rejects new KYB access tokens before any auth or membership checks", async () => {
    await expect(generateKybAccessTokenAction("org-1")).resolves.toEqual({
      success: false,
      error: "Organization verification is temporarily unavailable.",
    });

    expect(getAuthenticatedOrThrowMock).not.toHaveBeenCalled();
    expect(memberFindFirstMock).not.toHaveBeenCalled();
  });

  it("rejects KYC submission updates while disabled", async () => {
    await expect(markKycAsSubmittedAction()).resolves.toEqual({
      success: false,
      error:
        "New identity verification requests are disabled for now. Existing verification records remain visible.",
    });

    expect(getAuthenticatedOrThrowMock).not.toHaveBeenCalled();
    expect(kycVerificationUpdateMock).not.toHaveBeenCalled();
    expect(kycVerificationCreateMock).not.toHaveBeenCalled();
  });

  it("returns the stored KYC status without calling Sumsub", async () => {
    userFindUniqueMock.mockResolvedValue({
      kycVerification: {
        id: "kyc-1",
        status: "REVIEW",
        completedAt: null,
        rejectionReason: null,
        sumsubApplicantId: "applicant-1",
      },
    });

    await expect(getKycStatusAction()).resolves.toEqual({
      success: true,
      data: {
        kycStatus: "REVIEW",
        kycCompletedAt: null,
        kycRejectionReason: null,
      },
    });

    expect(getAuthenticatedOrThrowMock).toHaveBeenCalledWith({
      requireEmailVerified: false,
    });
    expect(getApplicantDataMock).not.toHaveBeenCalled();
    expect(getApplicantByExternalUserIdMock).not.toHaveBeenCalled();
  });
});
