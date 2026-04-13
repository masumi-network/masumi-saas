import { NextRequest, NextResponse } from "next/server";

import { addCorsHeaders, handleCorsPreflightResponse } from "@/lib/api/cors";
import { checkRateLimitOrRespond } from "@/lib/api/rate-limit-with-response";
import { sanitizeCallbackUrl } from "@/lib/auth/callback-url";
import { requestMagicLinkRegistration } from "@/lib/auth/email-registration";
import { registerByEmailApiBodySchema } from "@/lib/schemas/auth-api";

const REGISTER_EMAIL_CORS_METHODS = ["POST", "OPTIONS"] as const;

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflightResponse(request, REGISTER_EMAIL_CORS_METHODS);
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await checkRateLimitOrRespond(
      request,
      "public-register-email",
      undefined,
      REGISTER_EMAIL_CORS_METHODS,
    );
    if ("response" in rateLimitResult) return rateLimitResult.response;
    const { rl } = rateLimitResult;

    const body = await request.json().catch(() => null);
    const validation = registerByEmailApiBodySchema.safeParse(body);
    if (!validation.success) {
      return addCorsHeaders(
        NextResponse.json(
          {
            success: false,
            error: validation.error.issues
              .map((issue) => issue.message)
              .join(", "),
          },
          { status: 400 },
        ),
        request,
        REGISTER_EMAIL_CORS_METHODS,
      );
    }

    const result = await requestMagicLinkRegistration({
      email: validation.data.email,
      name: validation.data.name,
      callbackUrl: sanitizeCallbackUrl(validation.data.callbackUrl) ?? "/",
      headers: request.headers,
    });

    if ("error" in result) {
      return addCorsHeaders(
        NextResponse.json(
          { success: false, error: result.error },
          { status: 500 },
        ),
        request,
        REGISTER_EMAIL_CORS_METHODS,
      );
    }

    const response = NextResponse.json(result, { status: 202 });
    response.headers.set("X-RateLimit-Limit", String(rl.limit));
    response.headers.set("X-RateLimit-Remaining", String(rl.remaining));
    return addCorsHeaders(response, request, REGISTER_EMAIL_CORS_METHODS);
  } catch (error) {
    console.error("Failed to register via email:", error);
    return addCorsHeaders(
      NextResponse.json(
        { success: false, error: "Failed to register via email" },
        { status: 500 },
      ),
      request,
      REGISTER_EMAIL_CORS_METHODS,
    );
  }
}
