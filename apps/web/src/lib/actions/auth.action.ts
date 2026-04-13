"use server";

import prisma from "@masumi/database/client";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";
import {
  buildAbsoluteCallbackUrl,
  sanitizeCallbackUrl,
} from "@/lib/auth/callback-url";
import { requestMagicLinkRegistration } from "@/lib/auth/email-registration";
import {
  classifyAuthError,
  createUnexpectedErrorResult,
  getAuthErrorDetails,
  isInfrastructureError,
} from "@/lib/auth/error-results";
import { getAuthenticatedOrThrow, getRequestHeaders } from "@/lib/auth/utils";
import {
  changePasswordFormDataSchema,
  deleteAccountFormDataSchema,
  magicLinkCodeFormDataSchema,
  magicLinkSignInFormDataSchema,
  magicLinkSignUpFormDataSchema,
  signInFormDataSchema,
  signUpFormDataSchema,
  updateNameFormDataSchema,
} from "@/lib/schemas";

import { convertZodError } from "../utils/convert-zod-error";

const OIDC_TRANSIENT_COOKIE_NAMES = new Set([
  "oidc_login_prompt",
  "oidc_consent_prompt",
]);

function stripOidcTransientCookies(headers: Headers): Headers {
  const sanitizedHeaders = new Headers(headers);
  const rawCookieHeader = sanitizedHeaders.get("cookie");

  if (!rawCookieHeader) {
    return sanitizedHeaders;
  }

  const filteredCookies = rawCookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .filter((cookie) => {
      const [name] = cookie.split("=", 1);
      return name && !OIDC_TRANSIENT_COOKIE_NAMES.has(name);
    });

  if (filteredCookies.length === 0) {
    sanitizedHeaders.delete("cookie");
    return sanitizedHeaders;
  }

  sanitizedHeaders.set("cookie", filteredCookies.join("; "));
  return sanitizedHeaders;
}

export async function signOutAction() {
  const headersList = await getRequestHeaders();
  await auth.api.signOut({
    headers: headersList,
  });
  redirect("/signin");
}

export async function switchAccountAction(callbackUrl?: string) {
  const headersList = await getRequestHeaders();
  await auth.api.signOut({
    headers: headersList,
  });

  const redirectTo = sanitizeCallbackUrl(callbackUrl) ?? "/";
  redirect(`/signin?callbackUrl=${encodeURIComponent(redirectTo)}`);
}

function getSignUpErrorResult(error: unknown) {
  return classifyAuthError(error, [
    {
      matches: (message) =>
        message.includes("unique") ||
        message.includes("duplicate") ||
        message.includes("already exists"),
      result: {
        error: "An account with this email already exists",
        errorKey: "AccountExists" as const,
      },
    },
  ]);
}

function getMagicLinkCodeErrorResult(error: unknown) {
  return classifyAuthError(error, [
    {
      matches: (message) =>
        message.includes("too many attempts") ||
        message.includes("too many failed attempts"),
      result: {
        error: "Too many failed attempts. Request a new email.",
        errorKey: "TooManyMagicLinkCodeAttempts" as const,
      },
    },
    {
      matches: (message) =>
        message.includes("expired") || message.includes("otp expired"),
      result: {
        error: "Sign-in code expired. Request a new email.",
        errorKey: "ExpiredMagicLinkCode" as const,
      },
    },
    {
      matches: (message) =>
        message.includes("invalid otp") ||
        message.includes("invalid code") ||
        message.includes("invalid_otp"),
      result: {
        error: "Invalid sign-in code.",
        errorKey: "InvalidMagicLinkCode" as const,
      },
    },
  ]);
}

export async function signInAction(formData: FormData, callbackUrl?: string) {
  const validation = signInFormDataSchema.safeParse(formData);
  if (!validation.success) {
    return {
      error: validation.error.issues[0]?.message || "Invalid input",
      errorKey: "InvalidInput",
    };
  }

  try {
    const redirectTo = sanitizeCallbackUrl(callbackUrl) ?? "/";
    const requestHeaders = stripOidcTransientCookies(await getRequestHeaders());
    const result = await auth.api.signInEmail({
      body: {
        email: validation.data.email,
        password: validation.data.password,
      },
      headers: requestHeaders,
    });

    if ("twoFactorRedirect" in result && result.twoFactorRedirect) {
      return {
        twoFactorRedirect: true,
        resultKey: "TwoFactorRequired",
      };
    }

    if (!result.user) {
      return {
        error: "Invalid email or password",
        errorKey: "InvalidCredentials",
      };
    }

    console.info("[signInAction] success", {
      userId: result.user.id,
      redirectTo,
      oidcAuthorizeFlow: redirectTo.startsWith("/api/auth/oauth2/authorize"),
    });

    return {
      success: true,
      resultKey: "SignInSuccess",
      redirectTo,
    };
  } catch (error) {
    const details = getAuthErrorDetails(error);
    console.error(
      "[signInAction] error",
      {
        callbackUrl,
        redirectTo: sanitizeCallbackUrl(callbackUrl) ?? "/",
        status: details.status,
        messages: details.messages,
        body: details.body,
      },
      error,
    );
    const status = details.status;
    const errorMessage = details.message;

    if (status === 401) {
      if (errorMessage.includes("failed to create session")) {
        return createUnexpectedErrorResult();
      }

      return {
        error: "Invalid email or password",
        errorKey: "InvalidCredentials",
      };
    }

    if (status === 403) {
      if (errorMessage.includes("banned") || errorMessage.includes("ban")) {
        return {
          error: "Your account has been suspended.",
          errorKey: "AccountBanned",
        };
      }
      if (
        errorMessage.includes("email verification") ||
        errorMessage.includes("verify your email") ||
        errorMessage.includes("email not verified")
      ) {
        return {
          error: "Your email address must be verified.",
          errorKey: "EmailVerificationRequired",
        };
      }
      return {
        error: "Access denied.",
        errorKey: "AccessDenied",
      };
    }

    if (isInfrastructureError(errorMessage)) {
      return {
        error:
          "Database connection error. Please check your database configuration.",
        errorKey: "DatabaseError",
      };
    }

    if (
      errorMessage.includes("email verification") ||
      errorMessage.includes("verify your email") ||
      errorMessage.includes("email not verified")
    ) {
      return {
        error: "Your email address must be verified.",
        errorKey: "EmailVerificationRequired",
      };
    }

    if (
      errorMessage.includes("invalid") ||
      errorMessage.includes("password") ||
      errorMessage.includes("credentials") ||
      errorMessage.includes("email")
    ) {
      return {
        error: "Invalid email or password",
        errorKey: "InvalidCredentials",
      };
    }

    return createUnexpectedErrorResult();
  }
}

export async function signUpAction(formData: FormData, callbackUrl?: string) {
  const validation = signUpFormDataSchema.safeParse(formData);
  if (!validation.success) {
    return {
      error: convertZodError(validation.error),
      errorKey: "InvalidInput",
    };
  }

  try {
    const redirectTo = sanitizeCallbackUrl(callbackUrl) ?? "/";
    const verificationCallbackURL = redirectTo.startsWith(
      "/api/auth/oauth2/authorize",
    )
      ? buildAbsoluteCallbackUrl(redirectTo)
      : undefined;
    const requestHeaders = stripOidcTransientCookies(await getRequestHeaders());
    const result = await auth.api.signUpEmail({
      body: {
        email: validation.data.email,
        password: validation.data.password,
        name: validation.data.name,
        ...(verificationCallbackURL
          ? { callbackURL: verificationCallbackURL }
          : {}),
      },
      headers: requestHeaders,
    });

    if (!result.user) {
      return {
        error: "Failed to create account",
        errorKey: "AccountCreationFailed",
      };
    }

    console.info("[signUpAction] success", {
      userId: result.user.id,
      redirectTo,
      oidcAuthorizeFlow: redirectTo.startsWith("/api/auth/oauth2/authorize"),
    });

    return {
      success: true,
      resultKey: "SignUpSuccess",
      redirectTo,
    };
  } catch (error) {
    const details = getAuthErrorDetails(error);
    console.error(
      "[signUpAction] error",
      {
        callbackUrl,
        redirectTo: sanitizeCallbackUrl(callbackUrl) ?? "/",
        status: details.status,
        messages: details.messages,
        body: details.body,
      },
      error,
    );
    return getSignUpErrorResult(error);
  }
}

export async function requestMagicLinkSignUpAction(
  formData: FormData,
  callbackUrl?: string,
) {
  const validation = magicLinkSignUpFormDataSchema.safeParse(formData);
  if (!validation.success) {
    return {
      error: convertZodError(validation.error),
      errorKey: "InvalidInput",
    };
  }

  const headersList = await getRequestHeaders();
  return await requestMagicLinkRegistration({
    email: validation.data.email,
    name: validation.data.name,
    callbackUrl: sanitizeCallbackUrl(callbackUrl) ?? "/",
    headers: new Headers(headersList),
  });
}

export async function requestMagicLinkSignInAction(
  formData: FormData,
  callbackUrl?: string,
) {
  const validation = magicLinkSignInFormDataSchema.safeParse(formData);
  if (!validation.success) {
    return {
      error: convertZodError(validation.error),
      errorKey: "InvalidInput" as const,
    };
  }

  const headersList = await getRequestHeaders();
  return await requestMagicLinkRegistration({
    email: validation.data.email,
    callbackUrl: sanitizeCallbackUrl(callbackUrl) ?? "/",
    headers: new Headers(headersList),
  });
}

export async function signInMagicLinkCodeAction(
  formData: FormData,
  callbackUrl?: string,
) {
  const validation = magicLinkCodeFormDataSchema.safeParse(formData);
  if (!validation.success) {
    return {
      error: convertZodError(validation.error),
      errorKey: "InvalidInput" as const,
    };
  }

  try {
    const redirectTo = sanitizeCallbackUrl(callbackUrl) ?? "/";
    const requestHeaders = stripOidcTransientCookies(await getRequestHeaders());
    const result = await auth.api.signInEmailOTP({
      body: {
        email: validation.data.email,
        otp: validation.data.otp.trim(),
      },
      headers: requestHeaders,
    });

    if (!result.user) {
      return {
        error: "Invalid sign-in code.",
        errorKey: "InvalidMagicLinkCode" as const,
      };
    }

    return {
      success: true,
      resultKey: "SignInSuccess" as const,
      redirectTo,
    };
  } catch (error) {
    const details = getAuthErrorDetails(error);
    console.error(
      "[signInMagicLinkCodeAction] error",
      {
        callbackUrl,
        redirectTo: sanitizeCallbackUrl(callbackUrl) ?? "/",
        status: details.status,
        messages: details.messages,
        body: details.body,
      },
      error,
    );

    return getMagicLinkCodeErrorResult(error);
  }
}

export async function updateUserNameAction(formData: FormData) {
  const { headers: headersList } = await getAuthenticatedOrThrow();
  const validation = updateNameFormDataSchema.safeParse(formData);

  if (!validation.success) {
    return {
      error: validation.error.issues[0]?.message || "Invalid input",
      errorKey: "InvalidInput",
    };
  }

  try {
    await auth.api.updateUser({
      headers: headersList,
      body: {
        name: validation.data.name.trim(),
      },
    });

    return {
      success: true,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to update name",
      errorKey: "UnexpectedError",
    };
  }
}

export async function changePasswordAction(formData: FormData) {
  const { headers: headersList } = await getAuthenticatedOrThrow();
  const validation = changePasswordFormDataSchema.safeParse(formData);

  if (!validation.success) {
    return {
      error: validation.error.issues[0]?.message || "Invalid input",
      errorKey: "InvalidInput",
    };
  }

  try {
    await auth.api.changePassword({
      headers: headersList,
      body: {
        currentPassword: validation.data.currentPassword,
        newPassword: validation.data.newPassword,
      },
    });

    return {
      success: true,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to change password",
      errorKey: "UnexpectedError",
    };
  }
}

export async function deleteAccountAction(formData: FormData) {
  const { headers: headersList } = await getAuthenticatedOrThrow();
  const validation = deleteAccountFormDataSchema.safeParse(formData);

  if (!validation.success) {
    return {
      error: validation.error.issues[0]?.message || "Invalid input",
      errorKey: "InvalidInput",
    };
  }

  try {
    await auth.api.deleteUser({
      headers: headersList,
      body: {
        password: validation.data.currentPassword,
      },
    });

    return {
      success: true,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to delete account",
      errorKey: "UnexpectedError",
    };
  }
}

export type ApiKeyListItem = {
  id: string;
  name: string | null;
  prefix: string | null;
  start: string | null;
  createdAt: Date;
  lastRequest: Date | null;
};

export async function getApiKeysAction(): Promise<
  { success: true; keys: ApiKeyListItem[] } | { success: false; error: string }
> {
  try {
    const { user } = await getAuthenticatedOrThrow();
    const keys = await prisma.apikey.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        prefix: true,
        start: true,
        createdAt: true,
        lastRequest: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return {
      success: true,
      keys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        start: k.start,
        createdAt: k.createdAt,
        lastRequest: k.lastRequest,
      })),
    };
  } catch (error) {
    console.error("Failed to list API keys:", error);
    return {
      success: false,
      error: "Failed to load API keys",
    };
  }
}
