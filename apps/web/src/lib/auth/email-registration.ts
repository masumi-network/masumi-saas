import { auth } from "@/lib/auth/auth";

function isInfrastructureError(message: string) {
  return (
    message.includes("denied access") ||
    message.includes("database") ||
    message.includes("connection") ||
    message.includes("not available")
  );
}

function createUnexpectedErrorResult() {
  return {
    error: "An unexpected error occurred",
    errorKey: "UnexpectedError" as const,
  };
}

function getMagicLinkErrorResult(error: unknown) {
  if (!(error instanceof Error)) {
    return createUnexpectedErrorResult();
  }

  const errorMessage = error.message.toLowerCase();
  if (isInfrastructureError(errorMessage)) {
    return {
      error:
        "Database connection error. Please check your database configuration.",
      errorKey: "DatabaseError" as const,
    };
  }
  if (
    errorMessage.includes("magic link") ||
    errorMessage.includes("failed to send")
  ) {
    return {
      error: "Failed to send magic link",
      errorKey: "MagicLinkRequestFailed" as const,
    };
  }

  return createUnexpectedErrorResult();
}

interface RequestMagicLinkRegistrationParams {
  email: string;
  name: string;
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
        name,
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
