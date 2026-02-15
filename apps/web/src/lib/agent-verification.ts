/**
 * Agent verification helpers - calling the agent's get-credential endpoint
 * to verify the developer controls the agent backend.
 */

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Fetches the agent's credential challenge response.
 * Calls GET {apiUrl}/get-credential?masumi_challenge={challenge}
 * and returns the response body as a plain string.
 *
 * @param apiUrl - The agent's API base URL (e.g. https://api.example.com)
 * @param challenge - The Masumi-generated challenge string
 * @returns The agent's response (plain signature string) or null on error
 */
export async function fetchAgentCredentialChallenge(
  apiUrl: string,
  challenge: string,
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
        error: `Agent returned ${response.status}. Ensure your agent exposes GET /get-credential?masumi_challenge=...`,
      };
    }

    const text = await response.text();

    // Agent should return the challenge string as plain text
    const signature = text.trim();

    if (!signature) {
      return {
        success: false,
        error:
          "Agent returned an empty response. Return the challenge string as plain text.",
      };
    }

    if (signature !== challenge) {
      return {
        success: false,
        error:
          "Agent returned a different value than the challenge. Ensure your endpoint returns the masumi_challenge value unchanged.",
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
