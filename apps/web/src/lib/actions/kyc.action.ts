"use server";

import { getAuthenticatedHeaders } from "@/lib/auth/utils";
import { generateSumsubAccessToken } from "@/lib/sumsub";

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
