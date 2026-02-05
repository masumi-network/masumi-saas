import "server-only";

/**
 * Verification status enum matching Prisma schema
 * Note: This is for agent verification status, not KYC status
 */
export type VerificationStatus = "PENDING" | "VERIFIED" | "REVOKED" | "EXPIRED";

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
 */
export interface VerificationUpdateData {
  status: VerificationStatus;
  sumsubApplicantId: string | null;
  completedAt: Date | null;
  rejectionReason: string | null;
}

/**
 * Parse Sumsub review result and return verification update data
 * Extracts the common logic for processing verification status from Sumsub responses
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

  // Map Sumsub statuses to VerificationStatus enum
  // APPROVED (GREEN) → VERIFIED, REJECTED (RED) → REVOKED, REVIEW → PENDING
  const status: VerificationStatus = isApproved
    ? "VERIFIED"
    : isRejected
      ? "REVOKED"
      : "PENDING";

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
