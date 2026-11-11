import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth/auth";
import { createEmptyBrowserRedirectResponse } from "@/lib/auth/redirect-response";

const authHandler = toNextJsHandler(auth);

const LEGACY_DEVICE_TOKEN_PATH = "/api/auth/device/token";
const OAUTH_TOKEN_PATH = "/api/auth/oauth2/token";
const DEVICE_CODE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

function isRedirect(response: Response): boolean {
  return (
    response.status >= 300 &&
    response.status < 400 &&
    response.headers.has("location")
  );
}

async function readGrantType(request: Request): Promise<string | null> {
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/x-www-form-urlencoded")) {
      return new URLSearchParams(await request.clone().text()).get(
        "grant_type",
      );
    }
    if (contentType.includes("application/json")) {
      const body = (await request.clone().json()) as { grant_type?: unknown };
      return typeof body?.grant_type === "string" ? body.grant_type : null;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Device codes issued for OAuth clients must be redeemed at `/oauth2/token`.
 * Older CLI builds still poll `/device/token`, so that path is forwarded.
 */
async function forwardLegacyDeviceTokenRequest(
  request: Request,
): Promise<Request | null> {
  if (new URL(request.url).pathname !== LEGACY_DEVICE_TOKEN_PATH) {
    return null;
  }
  if ((await readGrantType(request)) !== DEVICE_CODE_GRANT) {
    return null;
  }
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  return new Request(new URL(OAUTH_TOKEN_PATH, request.url), {
    method: "POST",
    headers,
    body: await request.text(),
  });
}

export async function GET(request: Request): Promise<Response> {
  const response = await authHandler.GET(request);
  return isRedirect(response)
    ? createEmptyBrowserRedirectResponse(response)
    : response;
}

export async function POST(request: Request): Promise<Response> {
  return authHandler.POST(
    (await forwardLegacyDeviceTokenRequest(request)) ?? request,
  );
}
