import "server-only";

import crypto from "crypto";

const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN;
const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY;
const SUMSUB_BASE_URL = process.env.SUMSUB_BASE_URL || "https://api.sumsub.com";

if (!SUMSUB_APP_TOKEN || !SUMSUB_SECRET_KEY) {
  console.warn(
    "Sumsub credentials not configured. KYC/KYB features will not work.",
  );
}

/**
 * Generate Sumsub access token for Web SDK
 * @param externalUserId - Your internal user/org ID
 * @param levelName - Verification level name (e.g., "basic-kyc-level", "basic-kyb-level")
 * @param ttlInSecs - Token time-to-live in seconds (default: 600 = 10 minutes)
 */
export async function generateSumsubAccessToken(
  externalUserId: string,
  levelName: string,
  ttlInSecs: number = 600,
): Promise<string> {
  if (!SUMSUB_APP_TOKEN || !SUMSUB_SECRET_KEY) {
    throw new Error("Sumsub credentials not configured");
  }

  const path = `/resources/accessTokens?userId=${encodeURIComponent(externalUserId)}&levelName=${encodeURIComponent(levelName)}&ttlInSecs=${ttlInSecs}`;
  const url = `${SUMSUB_BASE_URL}${path}`;

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac("sha256", SUMSUB_SECRET_KEY)
    .update(`${timestamp}POST${path}`)
    .digest("hex");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-App-Token": SUMSUB_APP_TOKEN,
      "X-App-Access-Ts": timestamp.toString(),
      "X-App-Access-Sig": signature,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to generate Sumsub access token: ${response.status} ${errorText}`,
    );
  }

  const data = (await response.json()) as { token: string };
  return data.token;
}

/**
 * Verify Sumsub webhook signature
 * @param payload - Raw request body as string
 * @param signature - X-Payload-Digest header value
 * @param timestamp - X-Payload-Digest-Ts header value
 */
export function verifySumsubWebhookSignature(
  payload: string,
  signature: string,
  timestamp: string,
): boolean {
  if (!SUMSUB_SECRET_KEY) {
    throw new Error("Sumsub secret key not configured");
  }

  const expectedSignature = crypto
    .createHmac("sha256", SUMSUB_SECRET_KEY)
    .update(`${timestamp}${payload}`)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature),
  );
}

/**
 * Get applicant data from Sumsub
 * @param applicantId - Sumsub applicant ID
 */
export async function getApplicantData(applicantId: string) {
  if (!SUMSUB_APP_TOKEN || !SUMSUB_SECRET_KEY) {
    throw new Error("Sumsub credentials not configured");
  }

  const url = `${SUMSUB_BASE_URL}/resources/applicants/${applicantId}/one`;

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac("sha256", SUMSUB_SECRET_KEY)
    .update(`${timestamp}GET${url.replace(SUMSUB_BASE_URL, "")}`)
    .digest("hex");

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-App-Token": SUMSUB_APP_TOKEN,
      "X-App-Access-Ts": timestamp.toString(),
      "X-App-Access-Sig": signature,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to get applicant data: ${response.status} ${errorText}`,
    );
  }

  return (await response.json()) as {
    id: string;
    externalUserId: string;
    reviewStatus: string;
    reviewResult: {
      reviewAnswer: "GREEN" | "RED";
      reviewRejectType?: "FINAL" | "RETRY";
      moderationComment?: string;
      clientComment?: string;
    };
    createdAt: string;
    updatedAt: string;
  };
}
