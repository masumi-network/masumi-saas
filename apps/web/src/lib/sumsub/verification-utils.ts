import "server-only";

/**
 * Verification status enum matching Prisma schema
 * Note: This is for agent verification status, not KYC status
 */
export type VerificationStatus = "PENDING" | "VERIFIED" | "REVOKED" | "EXPIRED";

/**
 * KYC status enum for user identity verification (Sumsub)
 */
export type KycStatus = "PENDING" | "APPROVED" | "REJECTED" | "REVIEW";

/**
 * Review result from Sumsub API
 */
export interface SumsubReviewResult {
  reviewAnswer: "GREEN" | "RED";
  reviewRejectType?: "FINAL" | "RETRY";
  moderationComment?: string;
  clientComment?: string;
}

/**
 * Verification data to be saved to database
 * Note: For KYC, status uses KycStatus (APPROVED/REJECTED/REVIEW)
 * For agent verification, status uses VerificationStatus (VERIFIED/REVOKED/EXPIRED)
 */
export interface VerificationUpdateData {
  status: VerificationStatus | KycStatus;
  sumsubApplicantId: string | null;
  completedAt: Date | null;
  rejectionReason: string | null;
}

/**
 * Parse Sumsub review result and return verification update data for KYC
 * Maps Sumsub GREEN → APPROVED, RED → REJECTED, otherwise REVIEW
 */
export function parseReviewResult(
  reviewResult: SumsubReviewResult | undefined | null,
  applicantId: string | null,
): VerificationUpdateData {
  const isApproved = reviewResult?.reviewAnswer === "GREEN";
  const isRejected = reviewResult?.reviewAnswer === "RED";

  const rejectionReason = isRejected
    ? reviewResult?.moderationComment ||
      reviewResult?.clientComment ||
      "Verification rejected"
    : null;

  // Map Sumsub statuses to KYC status enum
  // GREEN → APPROVED, RED → REJECTED, otherwise REVIEW (in-progress)
  const status: KycStatus = isApproved
    ? "APPROVED"
    : isRejected
      ? "REJECTED"
      : "REVIEW";

  return {
    status,
    sumsubApplicantId: applicantId,
    completedAt: isApproved || isRejected ? new Date() : null,
    rejectionReason,
  };
}

/**
 * Check if the verification result is final (approved or rejected)
 */
export function isVerificationFinal(
  reviewResult: SumsubReviewResult | undefined | null,
): boolean {
  return (
    reviewResult?.reviewAnswer === "GREEN" ||
    reviewResult?.reviewAnswer === "RED"
  );
}
