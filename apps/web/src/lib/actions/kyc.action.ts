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

    // Create a new verification record with REVIEW status
    // Webhook will update it with applicantId and final status
    const kycVerification = await prisma.kycVerification.create({
      data: {
        userId: user.id,
        status: "REVIEW",
      },
    });

    // Set as current verification
    await prisma.user.update({
      where: { id: user.id },
      data: {
        currentKycVerificationId: kycVerification.id,
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
        currentKycVerification: {
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

    const currentVerification = userWithKyc.currentKycVerification;

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

    // If status is REVIEW, check Sumsub API for latest status
    if (currentVerification.status === "REVIEW") {
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

      if (applicantData?.review?.reviewResult) {
        const reviewResult = applicantData.review.reviewResult;
        const isApproved = reviewResult.reviewAnswer === "GREEN";
        const isRejected = reviewResult.reviewAnswer === "RED";
        const rejectionReason =
          reviewResult.moderationComment ||
          reviewResult.clientComment ||
          "Verification rejected";

        if (isApproved || isRejected) {
          // Update or create verification record
          let updatedVerification = await prisma.kycVerification.findFirst({
            where: {
              userId: user.id,
              sumsubApplicantId: applicantId,
            },
          });

          if (!updatedVerification) {
            // Create new verification if not found
            updatedVerification = await prisma.kycVerification.create({
              data: {
                userId: user.id,
                status: isApproved ? "APPROVED" : "REJECTED",
                sumsubApplicantId: applicantId,
                completedAt: new Date(),
                rejectionReason: isRejected ? rejectionReason : null,
              },
            });
          } else {
            // Update existing verification
            updatedVerification = await prisma.kycVerification.update({
              where: { id: updatedVerification.id },
              data: {
                status: isApproved ? "APPROVED" : "REJECTED",
                completedAt: new Date(),
                rejectionReason: isRejected ? rejectionReason : null,
              },
            });
          }

          // Set as current verification
          await prisma.user.update({
            where: { id: user.id },
            data: {
              currentKycVerificationId: updatedVerification.id,
            },
          });

          return {
            success: true,
            data: {
              kycStatus: isApproved ? "APPROVED" : "REJECTED",
              kycCompletedAt: updatedVerification.completedAt,
              kycRejectionReason: updatedVerification.rejectionReason,
            },
          };
        }
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
