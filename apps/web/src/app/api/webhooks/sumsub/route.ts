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
        await prisma.user.update({
          where: { id: externalUserId },
          data: {
            kycStatus: isApproved
              ? "APPROVED"
              : isRejected
                ? "REJECTED"
                : "REVIEW",
            sumsubApplicantId: applicantId,
            kycCompletedAt: isApproved || isRejected ? new Date() : null,
            kycRejectionReason: isRejected ? rejectionReason : null,
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
