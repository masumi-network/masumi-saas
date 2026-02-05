"use server";

import prisma from "@masumi/database/client";

import { getAuthenticatedHeaders } from "@/lib/auth/utils";
import {
  generateSumsubAccessToken,
  getApplicantByExternalUserId,
  getApplicantData,
  isVerificationFinal,
  parseReviewResult,
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
    const { user } = await getAuthenticatedHeaders();

    // Verify user is a member of the organization
    const member = await prisma.member.findFirst({
      where: {
        userId: user.id,
        organizationId,
      },
    });

    if (!member) {
      return {
        success: false,
        error: "You do not have permission to access this organization",
      };
    }

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

    // Check if user already has a verification record
    const existingUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { kycVerificationId: true },
    });

    if (existingUser?.kycVerificationId) {
      // Update existing verification to REVIEW status
      await prisma.kycVerification.update({
        where: { id: existingUser.kycVerificationId },
        data: { status: "REVIEW" },
      });
    } else {
      // Create new verification and link to user
      await prisma.kycVerification.create({
        data: {
          status: "REVIEW",
          user: { connect: { id: user.id } },
        },
      });
    }

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
        kycVerification: {
          select: {
            id: true,
            status: true,
            completedAt: true,
            rejectionReason: true,
            sumsubApplicantId: true,
          },
        },
      },
    });

    if (!userWithKyc) {
      return {
        success: false,
        error: "User not found",
      };
    }

    const currentVerification = userWithKyc.kycVerification;

    // If no current verification, return PENDING status
    if (!currentVerification) {
      return {
        success: true,
        data: {
          kycStatus: "PENDING" as const,
          kycCompletedAt: null,
          kycRejectionReason: null,
        },
      };
    }

    // If status is PENDING or REVIEW, check Sumsub API for latest status
    // REVIEW means verification is in progress, PENDING means not started
    if (
      currentVerification.status === "PENDING" ||
      currentVerification.status === "REVIEW"
    ) {
      let applicantData = null;
      let applicantId = currentVerification.sumsubApplicantId;

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
          }
        } catch (error) {
          console.error(
            `Failed to fetch applicant by externalUserId ${user.id}:`,
            error,
          );
        }
      }

      if (
        applicantData?.review?.reviewResult &&
        isVerificationFinal(applicantData.review.reviewResult)
      ) {
        const verificationData = parseReviewResult(
          applicantData.review.reviewResult,
          applicantId,
        );

        // Update existing verification linked to user
        const updatedVerification = await prisma.kycVerification.update({
          where: { id: currentVerification.id },
          data: verificationData,
        });

        return {
          success: true,
          data: {
            kycStatus: updatedVerification.status,
            kycCompletedAt: updatedVerification.completedAt,
            kycRejectionReason: updatedVerification.rejectionReason,
          },
        };
      }
    }

    return {
      success: true,
      data: {
        kycStatus: currentVerification.status,
        kycCompletedAt: currentVerification.completedAt,
        kycRejectionReason: currentVerification.rejectionReason,
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
