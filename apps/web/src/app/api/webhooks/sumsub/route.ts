import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";

import { verifySumsubWebhookSignature } from "@/lib/sumsub";

// Maximum age for webhook timestamps (5 minutes)
const MAX_TIMESTAMP_AGE_SECONDS = 300;

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

    const isValidTestWebhook = isDevelopment && isTestWebhook;

    if ((!signature || !timestamp) && !isValidTestWebhook) {
      console.error("[Sumsub Webhook] Missing signature or timestamp");
      return NextResponse.json(
        { error: "Missing signature or timestamp" },
        { status: 401 },
      );
    }

    if (signature && timestamp) {
      // Validate timestamp to prevent replay attacks
      const webhookTime = parseInt(timestamp, 10);
      const currentTime = Math.floor(Date.now() / 1000);
      const timestampAge = currentTime - webhookTime;

      if (timestampAge > MAX_TIMESTAMP_AGE_SECONDS || timestampAge < 0) {
        console.error(
          `[Sumsub Webhook] Timestamp too old or in future: ${timestampAge}s`,
        );
        return NextResponse.json(
          { error: "Webhook timestamp expired" },
          { status: 401 },
        );
      }

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

      const isApproved = reviewResult?.reviewAnswer === "GREEN";
      const isRejected = reviewResult?.reviewAnswer === "RED";
      const rejectionReason =
        reviewResult?.moderationComment ||
        reviewResult?.clientComment ||
        "Verification rejected";

      const user = await prisma.user.findUnique({
        where: { id: externalUserId },
        include: { kycVerification: true },
      });

      if (user) {
        const kycData = {
          status: isApproved
            ? ("APPROVED" as const)
            : isRejected
              ? ("REJECTED" as const)
              : ("REVIEW" as const),
          sumsubApplicantId: applicantId,
          completedAt: isApproved || isRejected ? new Date() : null,
          rejectionReason: isRejected ? rejectionReason : null,
        };

        if (user.kycVerification) {
          // Update existing verification
          await prisma.kycVerification.update({
            where: { id: user.kycVerification.id },
            data: kycData,
          });
        } else {
          // Create new verification and link to user
          await prisma.kycVerification.create({
            data: {
              ...kycData,
              user: { connect: { id: externalUserId } },
            },
          });
        }
      } else {
        const organization = await prisma.organization.findUnique({
          where: { id: externalUserId },
          include: { kybVerification: true },
        });

        if (organization) {
          const kybData = {
            status: isApproved
              ? ("APPROVED" as const)
              : isRejected
                ? ("REJECTED" as const)
                : ("REVIEW" as const),
            sumsubApplicantId: applicantId,
            completedAt: isApproved || isRejected ? new Date() : null,
            rejectionReason: isRejected ? rejectionReason : null,
          };

          if (organization.kybVerification) {
            // Update existing verification
            await prisma.kybVerification.update({
              where: { id: organization.kybVerification.id },
              data: kybData,
            });
          } else {
            // Create new verification and link to organization
            await prisma.kybVerification.create({
              data: {
                ...kybData,
                organization: { connect: { id: externalUserId } },
              },
            });
          }
        } else {
          // No user or organization found for this externalUserId
          console.warn(
            `[Sumsub Webhook] No user or organization found for externalUserId: ${externalUserId}, applicantId: ${applicantId}`,
          );
          return NextResponse.json({
            success: true,
            warning: "No matching user or organization found",
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
