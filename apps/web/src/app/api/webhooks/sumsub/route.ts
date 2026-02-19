import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifySumsubWebhookSignature } from "@/lib/sumsub";
import { parseReviewResult } from "@/lib/sumsub/verification-utils";

// Maximum age for webhook timestamps (5 minutes)
const MAX_TIMESTAMP_AGE_SECONDS = 300;

/**
 * Zod schema for Sumsub webhook payload
 */
const sumsubWebhookSchema = z.object({
  type: z.string(),
  applicantId: z.string().optional(),
  externalUserId: z.string(),
  reviewStatus: z.string().optional(),
  reviewResult: z
    .object({
      reviewAnswer: z.enum(["GREEN", "RED"]),
      reviewRejectType: z.enum(["FINAL", "RETRY"]).optional(),
      moderationComment: z.string().optional(),
      clientComment: z.string().optional(),
    })
    .optional(),
});

type SumsubWebhookPayload = z.infer<typeof sumsubWebhookSchema>;

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

    // Parse and validate webhook payload
    let payload: SumsubWebhookPayload;
    try {
      const rawPayload = JSON.parse(body);
      payload = sumsubWebhookSchema.parse(rawPayload);
    } catch (error) {
      console.error("[Sumsub Webhook] Invalid payload format:", error);
      return NextResponse.json(
        { error: "Invalid payload format" },
        { status: 400 },
      );
    }

    if (payload.type === "applicantWorkflowCompleted") {
      const { applicantId, externalUserId, reviewResult } = payload;

      if (isDevelopment && isTestWebhook) {
        return NextResponse.json({
          success: true,
          message: "Test webhook received (no database update)",
        });
      }

      // Use shared utility to parse review result
      const verificationData = parseReviewResult(
        reviewResult,
        applicantId ?? null,
      );

      const user = await prisma.user.findUnique({
        where: { id: externalUserId },
        include: { kycVerification: true },
      });

      if (user) {
        if (user.kycVerification) {
          // Update existing verification
          await prisma.kycVerification.update({
            where: { id: user.kycVerification.id },
            data: verificationData,
          });
        } else {
          // Create new verification and link to user
          await prisma.kycVerification.create({
            data: {
              ...verificationData,
              user: { connect: { id: externalUserId } },
            },
          });
        }
        return NextResponse.json({ success: true });
      }

      const organization = await prisma.organization.findUnique({
        where: { id: externalUserId },
        include: { kybVerification: true },
      });

      if (organization) {
        if (organization.kybVerification) {
          // Update existing verification
          await prisma.kybVerification.update({
            where: { id: organization.kybVerification.id },
            data: verificationData,
          });
        } else {
          // Create new verification and link to organization
          await prisma.kybVerification.create({
            data: {
              ...verificationData,
              organization: { connect: { id: externalUserId } },
            },
          });
        }
        return NextResponse.json({ success: true });
      }

      // No user or organization found - return 404 so Sumsub can retry
      console.error(
        `[Sumsub Webhook] No user or organization found for externalUserId: ${externalUserId}, applicantId: ${applicantId}`,
      );
      return NextResponse.json(
        { error: "No matching user or organization found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sumsub webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
