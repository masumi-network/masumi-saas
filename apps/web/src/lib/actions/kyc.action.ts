import "server-only";

import { getAuthenticatedHeaders } from "@/lib/auth/utils";
import { generateSumsubAccessToken } from "@/lib/sumsub";

/**
 * Generate Sumsub access token for KYC verification
 * @param levelName - Verification level name (default: "basic-kyc-level")
 */
export async function generateKycAccessTokenAction(
  levelName: string = "basic-kyc-level",
) {
  try {
    const { user } = await getAuthenticatedHeaders();

    // Generate token with user ID as externalUserId
    const token = await generateSumsubAccessToken(
      user.id,
      levelName,
      600, // 10 minutes TTL
    );

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
 * @param levelName - Verification level name (default: "basic-kyb-level")
 */
export async function generateKybAccessTokenAction(
  organizationId: string,
  levelName: string = "basic-kyb-level",
) {
  try {
    await getAuthenticatedHeaders();

    // Generate token with organization ID as externalUserId
    const token = await generateSumsubAccessToken(
      organizationId,
      levelName,
      600, // 10 minutes TTL
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
