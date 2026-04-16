import { createHash, randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";
import { findVerificationByIdentifier } from "@/lib/auth/auth-storage";
import {
  buildAbsoluteAppUrl,
  sanitizeCallbackUrl,
} from "@/lib/auth/callback-url";
import { getAuthErrorDetails } from "@/lib/auth/error-results";
import { addUserOidcGrantScopes } from "@/lib/auth/oidc-user-grants";

function redirectNoStore(url: string | URL): NextResponse {
  const res = NextResponse.redirect(url, 303);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Pragma", "no-cache");
  return res;
}

type ConsentVerificationValue = {
  clientId?: unknown;
  requireConsent?: unknown;
  scope?: unknown;
  userId?: unknown;
};

function buildConsentPageUrl(formData: FormData, error?: string) {
  const url = new URL(buildAbsoluteAppUrl("/oidc/consent"));
  const consentCode = formData.get("consentCode");
  const clientId = formData.get("clientId");
  const scope = formData.get("scope");
  const continueUrl = formData.get("continueUrl");

  if (typeof consentCode === "string" && consentCode.trim().length > 0) {
    url.searchParams.set("consent_code", consentCode);
  }
  if (typeof clientId === "string" && clientId.trim().length > 0) {
    url.searchParams.set("client_id", clientId);
  }
  if (typeof scope === "string" && scope.trim().length > 0) {
    url.searchParams.set("scope", scope);
  }
  if (typeof continueUrl === "string") {
    const safeContinueUrl = sanitizeCallbackUrl(continueUrl);
    if (safeContinueUrl) {
      url.searchParams.set("continueUrl", safeContinueUrl);
    }
  }
  if (error) {
    url.searchParams.set("error", error);
  }

  return url;
}

function parseConsentVerificationValue(
  value: string,
): ConsentVerificationValue | null {
  try {
    const parsed = JSON.parse(value) as ConsentVerificationValue;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const consentCode = formData.get("consentCode");
  const accept = formData.get("accept") === "true";

  const requestId = randomUUID();
  const codeHash =
    typeof consentCode === "string"
      ? createHash("sha256").update(consentCode).digest("hex").slice(0, 12)
      : null;

  if (typeof consentCode !== "string" || consentCode.trim().length === 0) {
    return redirectNoStore(buildAbsoluteAppUrl("/"));
  }

  try {
    if (accept) {
      const session = await auth.api.getSession({
        headers: request.headers,
      });

      if (!session?.user) {
        return redirectNoStore(
          buildConsentPageUrl(
            formData,
            "Sign in again to continue the OIDC flow.",
          ),
        );
      }

      if (session.user.emailVerified !== true) {
        return redirectNoStore(
          buildConsentPageUrl(formData, "Verify your email before continuing."),
        );
      }

      const verificationRecord = await findVerificationByIdentifier(
        consentCode,
        {
          value: true,
        },
      );

      const verificationValue = verificationRecord
        ? parseConsentVerificationValue(verificationRecord.value)
        : null;

      if (
        !verificationValue ||
        verificationValue.requireConsent !== true ||
        typeof verificationValue.userId !== "string" ||
        verificationValue.userId !== session.user.id ||
        typeof verificationValue.clientId !== "string"
      ) {
        return redirectNoStore(
          buildConsentPageUrl(
            formData,
            "The OIDC consent request is no longer valid. Please try again.",
          ),
        );
      }

      await addUserOidcGrantScopes({
        userId: session.user.id,
        clientId: verificationValue.clientId,
        scopes:
          typeof verificationValue.scope === "string" ||
          Array.isArray(verificationValue.scope)
            ? verificationValue.scope
            : "",
      });
    }

    const result = await auth.api.oAuthConsent({
      headers: request.headers,
      body: {
        accept,
        consent_code: consentCode,
      },
    });

    return redirectNoStore(result.redirectURI);
  } catch (error) {
    const details = getAuthErrorDetails(error);
    console.error(
      "[oidc consent] submit failed",
      {
        requestId,
        codeHash,
        accept,
        status: details.status,
        messages: details.messages,
        body: details.body,
      },
      error,
    );

    const fallbackMessage =
      details.body?.error_description &&
      typeof details.body.error_description === "string"
        ? details.body.error_description
        : details.messages[0] || "Failed to process consent request";

    return redirectNoStore(buildConsentPageUrl(formData, fallbackMessage));
  }
}
