import crypto from "crypto";

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Computes HMAC-SHA256(challenge, secret) as hex string.
 * Used for agent verification - the agent must return this value.
 */
export function computeVerificationHmac(
  challenge: string,
  secret: string,
): string {
  return crypto.createHmac("sha256", secret).update(challenge).digest("hex");
}

/**
 * Fetches the agent's credential challenge response and verifies it using HMAC.
 * Calls GET {apiUrl}/get-credential?masumi_challenge={challenge}
 * Agent must return HMAC-SHA256(challenge, secret) as plain text.
 *
 * @param apiUrl - The agent's API base URL
 * @param challenge - The Masumi-generated challenge string
 * @param secret - The agent's verification secret (stored in env as MASUMI_VERIFICATION_SECRET)
 */
export async function fetchAgentCredentialChallenge(
  apiUrl: string,
  challenge: string,
  secret: string,
): Promise<
  { success: true; signature: string } | { success: false; error: string }
> {
  const baseUrl = apiUrl.replace(/\/$/, "");
  const url = new URL("/get-credential", baseUrl);
  url.searchParams.set("masumi_challenge", challenge);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "text/plain, application/json, */*" },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return {
        success: false,
        error: `Agent returned ${response.status}. Ensure your agent exposes GET /get-credential?masumi_challenge=... and returns HMAC-SHA256(challenge, secret).`,
      };
    }

    const text = await response.text();
    const signature = text.trim();

    if (!signature) {
      return {
        success: false,
        error:
          "Agent returned an empty response. Return HMAC-SHA256(challenge, MASUMI_VERIFICATION_SECRET) as plain text.",
      };
    }

    const expected = computeVerificationHmac(challenge, secret);
    if (signature !== expected) {
      return {
        success: false,
        error:
          "Agent returned an invalid signature. Ensure MASUMI_VERIFICATION_SECRET in your agent matches the secret shown here.",
      };
    }

    return { success: true, signature };
  } catch (error) {
    clearTimeout(timeout);

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return {
          success: false,
          error:
            "Agent did not respond in time. Check that your agent is running and reachable.",
        };
      }
      return {
        success: false,
        error: `Could not reach agent: ${error.message}`,
      };
    }

    return {
      success: false,
      error:
        "Could not reach agent. Ensure your agent is running and the API URL is correct.",
    };
  }
}
