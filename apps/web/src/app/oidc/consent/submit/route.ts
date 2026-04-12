import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";
import { sanitizeCallbackUrl } from "@/lib/auth/callback-url";
import { getAuthErrorDetails } from "@/lib/auth/error-results";

function buildConsentPageUrl(
  request: Request,
  formData: FormData,
  error?: string,
) {
  const url = new URL("/oidc/consent", request.url);
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

export async function POST(request: Request) {
  const formData = await request.formData();
  const consentCode = formData.get("consentCode");
  const accept = formData.get("accept") === "true";

  if (typeof consentCode !== "string" || consentCode.trim().length === 0) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  try {
    if (accept) {
      const session = await auth.api.getSession({
        headers: request.headers,
      });

      if (!session?.user) {
        return NextResponse.redirect(
          buildConsentPageUrl(
            request,
            formData,
            "Sign in again to continue the OIDC flow.",
          ),
          303,
        );
      }

      if (session.user.emailVerified !== true) {
        return NextResponse.redirect(
          buildConsentPageUrl(
            request,
            formData,
            "Verify your email before continuing.",
          ),
          303,
        );
      }
    }

    const result = await auth.api.oAuthConsent({
      headers: request.headers,
      body: {
        accept,
        consent_code: consentCode,
      },
    });

    return NextResponse.redirect(result.redirectURI, 303);
  } catch (error) {
    const details = getAuthErrorDetails(error);
    console.error(
      "[oidc consent] submit failed",
      {
        consentCode,
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

    return NextResponse.redirect(
      buildConsentPageUrl(request, formData, fallbackMessage),
      303,
    );
  }
}
