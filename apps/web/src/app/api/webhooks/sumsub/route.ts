import prisma from "@masumi/database/client";
import { z } from "zod";

import { isKycVerificationEnabled } from "@/lib/config/verification.config";
import { verifySumsubWebhookSignature } from "@/lib/sumsub";
import { parseReviewResult } from "@/lib/sumsub/verification-utils";
import { createApiApp } from "@/server/hono/app";
import { nextHandlers } from "@/server/hono/next";

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

const app = createApiApp("/api/webhooks/sumsub");

/**
 * Sumsub webhook handler
 * Handles applicant status updates and updates database accordingly
 */
app.post("/", async (c) => {
  try {
    if (!isKycVerificationEnabled()) {
      return c.json({
        success: true,
        disabled: true,
        message: "Sumsub verification is currently disabled.",
      });
    }

    const body = await c.req.raw.text();
    const signature = c.req.header("X-Payload-Digest");
    const timestamp = c.req.header("X-Payload-Digest-Ts");

    const isDevelopment = process.env.NODE_ENV === "development";
    const isTestWebhook =
      c.req.header("user-agent")?.includes("PMI Service") &&
      (!signature || !timestamp);

    const isValidTestWebhook = isDevelopment && isTestWebhook;

    if ((!signature || !timestamp) && !isValidTestWebhook) {
      console.error("[Sumsub Webhook] Missing signature or timestamp");
      return c.json({ error: "Missing signature or timestamp" }, 401);
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
        return c.json({ error: "Webhook timestamp expired" }, 401);
      }

      const isValid = verifySumsubWebhookSignature(body, signature, timestamp);
      if (!isValid && (!isDevelopment || !isTestWebhook)) {
        console.error("[Sumsub Webhook] Invalid signature");
        return c.json({ error: "Invalid signature" }, 401);
      }
    }

    // Parse and validate webhook payload
    let payload: SumsubWebhookPayload;
    try {
      const rawPayload = JSON.parse(body);
      payload = sumsubWebhookSchema.parse(rawPayload);
    } catch (error) {
      console.error("[Sumsub Webhook] Invalid payload format:", error);
      return c.json({ error: "Invalid payload format" }, 400);
    }

    if (payload.type === "applicantWorkflowCompleted") {
      const { applicantId, externalUserId, reviewResult } = payload;

      if (isDevelopment && isTestWebhook) {
        return c.json({
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
        return c.json({ success: true });
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
        return c.json({ success: true });
      }

      // No user or organization found - return 404 so Sumsub can retry
      console.error(
        `[Sumsub Webhook] No user or organization found for externalUserId: ${externalUserId}, applicantId: ${applicantId}`,
      );
      return c.json({ error: "No matching user or organization found" }, 404);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Sumsub webhook error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export const { POST } = nextHandlers(app);
export default app;
