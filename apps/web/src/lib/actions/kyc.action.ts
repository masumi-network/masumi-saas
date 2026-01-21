"use server";

import prisma from "@masumi/database/client";

import { getAuthenticatedHeaders } from "@/lib/auth/utils";
import {
  generateSumsubAccessToken,
  getApplicantByExternalUserId,
  getApplicantData,
} from "@/lib/sumsub";

const DEFAULT_KYC_LEVEL = process.env.SUMSUB_KYC_LEVEL || "id-only";
const DEFAULT_KYB_LEVEL = process.env.SUMSUB_KYB_LEVEL || "id-only";

/**
 * Generate Sumsub access token for KYC verification
 * @param levelName - Verification level name (defaults to SUMSUB_KYC_LEVEL env var or "id-only")
 */
export async function generateKycAccessTokenAction(
  levelName: string = DEFAULT_KYC_LEVEL,
) {
  try {
    const { user } = await getAuthenticatedHeaders();

    const token = await generateSumsubAccessToken(user.id, levelName, 600);

    return {
      success: true,
      data: { token },
    };
  } catch (error) {
    console.error("Failed to generate KYC access token:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate access token",
    };
  }
}

/**
 * Generate Sumsub access token for KYB verification (organization)
 * @param organizationId - Organization ID
 * @param levelName - Verification level name (defaults to SUMSUB_KYB_LEVEL env var or "id-only")
 */
export async function generateKybAccessTokenAction(
  organizationId: string,
  levelName: string = DEFAULT_KYB_LEVEL,
) {
  try {
    await getAuthenticatedHeaders();

    const token = await generateSumsubAccessToken(
      organizationId,
      levelName,
      600,
    );

    return {
      success: true,
      data: { token },
    };
  } catch (error) {
    console.error("Failed to generate KYB access token:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate access token",
    };
  }
}

/**
 * Mark KYC verification as submitted and check status immediately
 * Called when user submits verification in Sumsub SDK
 * Checks Sumsub API for instant status update if already processed
 */
export async function markKycAsSubmittedAction() {
  try {
    const { user } = await getAuthenticatedHeaders();

    // Simply mark as submitted - webhook will save applicantId and update status
    await prisma.user.update({
      where: { id: user.id },
      data: {
        kycStatus: "REVIEW",
      },
    });

    return {
      success: true,
    };
  } catch (error) {
    console.error("Failed to mark KYC as submitted:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update verification status",
    };
  }
}

/**
 * Get current user's KYC status
 * If status is REVIEW, checks Sumsub API for latest status
 */
export async function getKycStatusAction() {
  try {
    const { user } = await getAuthenticatedHeaders();

    const userWithKyc = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        kycStatus: true,
        kycCompletedAt: true,
        kycRejectionReason: true,
        sumsubApplicantId: true,
      },
    });

    if (!userWithKyc) {
      return {
        success: false,
        error: "User not found",
      };
    }

    if (userWithKyc.kycStatus === "REVIEW") {
      let applicantData = null;
      let applicantId = userWithKyc.sumsubApplicantId;

      if (applicantId) {
        try {
          applicantData = await getApplicantData(applicantId);
        } catch (error) {
          console.error(
            `Failed to fetch status from Sumsub for applicant ${applicantId}:`,
            error,
          );
        }
      }

      if (!applicantData) {
        try {
          applicantData = await getApplicantByExternalUserId(user.id);
          if (applicantData) {
            applicantId = applicantData.id;
            await prisma.user.update({
              where: { id: user.id },
              data: {
                sumsubApplicantId: applicantId,
              },
            });
          }
        } catch (error) {
          console.error(
            `Failed to fetch applicant by externalUserId ${user.id}:`,
            error,
          );
        }
      }

      if (applicantData?.review?.reviewResult) {
        const reviewResult = applicantData.review.reviewResult;
        const isApproved = reviewResult.reviewAnswer === "GREEN";
        const isRejected = reviewResult.reviewAnswer === "RED";
        const rejectionReason =
          reviewResult.moderationComment ||
          reviewResult.clientComment ||
          "Verification rejected";

        if (isApproved || isRejected) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              kycStatus: isApproved ? "APPROVED" : "REJECTED",
              kycCompletedAt: new Date(),
              kycRejectionReason: isRejected ? rejectionReason : null,
              sumsubApplicantId: applicantId || undefined,
            },
          });

          return {
            success: true,
            data: {
              kycStatus: isApproved ? "APPROVED" : "REJECTED",
              kycCompletedAt: new Date(),
              kycRejectionReason: isRejected ? rejectionReason : null,
            },
          };
        }
      }
    }

    return {
      success: true,
      data: {
        kycStatus: userWithKyc.kycStatus,
        kycCompletedAt: userWithKyc.kycCompletedAt,
        kycRejectionReason: userWithKyc.kycRejectionReason,
      },
    };
  } catch (error) {
    console.error("Failed to get KYC status:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get verification status",
    };
  }
}
