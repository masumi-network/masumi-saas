import { auth } from "@/lib/auth/auth";
import { displayNameFromEmail } from "@/lib/auth/display-name-from-email";
import { classifyAuthError } from "@/lib/auth/error-results";
import { buildMagicLinkCallbackUrl } from "@/lib/auth/magic-link-callback";

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
  const resolvedName =
    typeof name === "string" && name.trim().length > 0
      ? name.trim()
      : displayNameFromEmail(email);

  const magicLinkCallbackUrl = buildMagicLinkCallbackUrl(callbackUrl);

  try {
    await auth.api.signInMagicLink({
      body: {
        email,
        name: resolvedName,
        callbackURL: magicLinkCallbackUrl,
        newUserCallbackURL: magicLinkCallbackUrl,
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
