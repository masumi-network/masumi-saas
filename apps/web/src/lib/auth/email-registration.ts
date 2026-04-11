import { auth } from "@/lib/auth/auth";
import { classifyAuthError } from "@/lib/auth/error-results";

function getMagicLinkErrorResult(error: unknown) {
  return classifyAuthError(error, [
    {
      matches: (message) =>
        message.includes("magic link") || message.includes("failed to send"),
      result: {
        error: "Failed to send magic link",
        errorKey: "MagicLinkRequestFailed" as const,
      },
    },
  ]);
}

interface RequestMagicLinkRegistrationParams {
  email: string;
  name?: string;
  callbackUrl: string;
  headers?: Headers;
}

export async function requestMagicLinkRegistration({
  email,
  name,
  callbackUrl,
  headers,
}: RequestMagicLinkRegistrationParams) {
  try {
    await auth.api.signInMagicLink({
      body: {
        email,
        ...(name ? { name } : {}),
        callbackURL: callbackUrl,
        newUserCallbackURL: callbackUrl,
      },
      headers: headers ?? new Headers(),
    });

    return {
      success: true as const,
      resultKey: "MagicLinkSent" as const,
      email,
    };
  } catch (error) {
    console.error("[requestMagicLinkRegistration] error:", error);
    return getMagicLinkErrorResult(error);
  }
}
