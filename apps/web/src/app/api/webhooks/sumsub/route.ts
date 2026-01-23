import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";

import { getApplicantData, verifySumsubWebhookSignature } from "@/lib/sumsub";

/**
 * Sumsub webhook handler
 * Handles applicant status updates and updates database accordingly
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("X-Payload-Digest");
    const timestamp = request.headers.get("X-Payload-Digest-Ts");

    const isDevelopment = process.env.NODE_ENV === "development";
    const isTestWebhook =
      request.headers.get("user-agent")?.includes("PMI Service") &&
      (!signature || !timestamp);

    if (!signature || !timestamp) {
      if (!isDevelopment || !isTestWebhook) {
        console.error("[Sumsub Webhook] Missing signature or timestamp");
        return NextResponse.json(
          { error: "Missing signature or timestamp" },
          { status: 401 },
        );
      }
    }

    if (signature && timestamp) {
      const isValid = verifySumsubWebhookSignature(body, signature, timestamp);
      if (!isValid && (!isDevelopment || !isTestWebhook)) {
        console.error("[Sumsub Webhook] Invalid signature");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 },
        );
      }
    }

    const payload = JSON.parse(body) as {
      type: string;
      applicantId: string;
      externalUserId: string;
      reviewStatus: string;
      reviewResult?: {
        reviewAnswer: "GREEN" | "RED";
        reviewRejectType?: "FINAL" | "RETRY";
        moderationComment?: string;
        clientComment?: string;
      };
    };

    if (payload.type === "applicantWorkflowCompleted") {
      const { applicantId, externalUserId, reviewResult } = payload;

      if (isDevelopment && isTestWebhook) {
        return NextResponse.json({
          success: true,
          message: "Test webhook received (no database update)",
        });
      }

      await getApplicantData(applicantId);

      const isApproved = reviewResult?.reviewAnswer === "GREEN";
      const isRejected = reviewResult?.reviewAnswer === "RED";
      const rejectionReason =
        reviewResult?.moderationComment ||
        reviewResult?.clientComment ||
        "Verification rejected";

      const user = await prisma.user.findUnique({
        where: { id: externalUserId },
      });

      if (user) {
        // Find existing verification by applicantId or create new one
        let kycVerification = await prisma.kycVerification.findFirst({
          where: {
            userId: externalUserId,
            sumsubApplicantId: applicantId,
          },
        });

        if (!kycVerification) {
          // Create new verification record
          kycVerification = await prisma.kycVerification.create({
            data: {
              userId: externalUserId,
              status: isApproved
                ? "APPROVED"
                : isRejected
                  ? "REJECTED"
                  : "REVIEW",
              sumsubApplicantId: applicantId,
              completedAt: isApproved || isRejected ? new Date() : null,
              rejectionReason: isRejected ? rejectionReason : null,
            },
          });
        } else {
          // Update existing verification
          kycVerification = await prisma.kycVerification.update({
            where: { id: kycVerification.id },
            data: {
              status: isApproved
                ? "APPROVED"
                : isRejected
                  ? "REJECTED"
                  : "REVIEW",
              completedAt: isApproved || isRejected ? new Date() : null,
              rejectionReason: isRejected ? rejectionReason : null,
            },
          });
        }

        // Set as current verification
        await prisma.user.update({
          where: { id: externalUserId },
          data: {
            currentKycVerificationId: kycVerification.id,
          },
        });
      } else {
        const organization = await prisma.organization.findUnique({
          where: { id: externalUserId },
        });

        if (organization) {
          await prisma.organization.update({
            where: { id: externalUserId },
            data: {
              kybStatus: isApproved
                ? "APPROVED"
                : isRejected
                  ? "REJECTED"
                  : "REVIEW",
              sumsubApplicantId: applicantId,
              kybCompletedAt: isApproved || isRejected ? new Date() : null,
              kybRejectionReason: isRejected ? rejectionReason : null,
            },
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sumsub webhook error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
