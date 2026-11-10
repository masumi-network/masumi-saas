import { createHash, randomUUID } from "node:crypto";

import { verifyOAuthQueryParams } from "@better-auth/oauth-provider";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";
import { buildAbsoluteAppUrl } from "@/lib/auth/callback-url";
import { OIDC_NO_STORE_HEADERS } from "@/lib/auth/oidc/constants";
import { addUserOidcGrantScopes } from "@/lib/auth/oidc-user-grants";
import { authEnvConfig } from "@/lib/config/auth.config";

const CONSENT_ENDPOINT_PATH = "/api/auth/oauth2/consent";
const FORWARDED_HEADERS = [
  "cookie",
  "origin",
  "referer",
  "user-agent",
] as const;

function redirectNoStore(url: string | URL): NextResponse {
  const res = NextResponse.redirect(url, 303);
  for (const [key, value] of Object.entries(OIDC_NO_STORE_HEADERS)) {
    res.headers.set(key, value);
  }
  return res;
}

function buildConsentPageUrl(oauthQuery: string, error?: string) {
  const url = new URL(buildAbsoluteAppUrl(`/oidc/consent?${oauthQuery}`));
  if (error) {
    url.searchParams.set("error", error);
  }
  return url;
}

/** Runs the provider's consent endpoint with the browser's session cookie. */
async function submitProviderConsent(
  request: Request,
  accept: boolean,
  oauthQuery: string,
): Promise<{ url?: unknown; error_description?: unknown; message?: unknown }> {
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
  });
  for (const key of FORWARDED_HEADERS) {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  }

  const response = await auth.handler(
    new Request(new URL(CONSENT_ENDPOINT_PATH, request.url), {
      method: "POST",
      headers,
      body: JSON.stringify({ accept, oauth_query: oauthQuery }),
    }),
  );
  const body = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!response.ok) {
    throw Object.assign(new Error("oauth2 consent failed"), {
      status: response.status,
      body,
    });
  }
  return body;
}

/** Same-origin form posts only: grants are written before the provider's own check. */
function isAppOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(buildAbsoluteAppUrl("/")).origin;
}

export async function POST(request: Request) {
  if (!isAppOrigin(request)) {
    return NextResponse.json(
      { error: "invalid_origin" },
      { status: 403, headers: OIDC_NO_STORE_HEADERS },
    );
  }
  const formData = await request.formData();
  const oauthQuery = formData.get("oauth_query");
  const accept = formData.get("accept") === "true";

  const requestId = randomUUID();
  if (typeof oauthQuery !== "string" || oauthQuery.trim().length === 0) {
    return redirectNoStore(buildAbsoluteAppUrl("/"));
  }
  const queryHash = createHash("sha256")
    .update(oauthQuery)
    .digest("hex")
    .slice(0, 12);

  if (!(await verifyOAuthQueryParams(oauthQuery, authEnvConfig.secret))) {
    return redirectNoStore(
      buildConsentPageUrl(
        oauthQuery,
        "The OIDC consent request is no longer valid. Please try again.",
      ),
    );
  }

  try {
    if (accept) {
      const session = await auth.api.getSession({
        headers: request.headers,
      });

      if (!session?.user) {
        return redirectNoStore(
          buildConsentPageUrl(
            oauthQuery,
            "Sign in again to continue the OIDC flow.",
          ),
        );
      }

      if (session.user.emailVerified !== true) {
        return redirectNoStore(
          buildConsentPageUrl(
            oauthQuery,
            "Verify your email before continuing.",
          ),
        );
      }

      const signedParams = new URLSearchParams(oauthQuery);
      const clientId = signedParams.get("client_id");
      if (clientId) {
        // Store the API grants first: the provider re-runs authorize after
        // consent, and that run keeps only API scopes the user has granted.
        await addUserOidcGrantScopes({
          userId: session.user.id,
          clientId,
          scopes: signedParams.get("scope") ?? "",
        });
      }
    }

    const result = await submitProviderConsent(request, accept, oauthQuery);
    if (typeof result.url !== "string") {
      throw Object.assign(new Error("oauth2 consent returned no redirect"), {
        body: result,
      });
    }
    return redirectNoStore(result.url);
  } catch (error) {
    const details = error as {
      status?: number;
      body?: Record<string, unknown>;
    };
    console.error(
      "[oidc consent] submit failed",
      {
        requestId,
        queryHash,
        accept,
        status: details.status,
        body: details.body,
      },
      error,
    );

    const description =
      details.body?.error_description ?? details.body?.message;
    return redirectNoStore(
      buildConsentPageUrl(
        oauthQuery,
        typeof description === "string"
          ? description
          : "Failed to process consent request",
      ),
    );
  }
}
