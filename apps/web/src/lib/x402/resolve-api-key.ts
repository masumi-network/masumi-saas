import "server-only";

import prisma from "@masumi/database/client";

import { getBetterAuthInnerSession } from "@/lib/auth/session-types";
import type { AuthenticatedApiContext } from "@/lib/auth/utils";
import { ApiError } from "@/server/hono/errors";

export async function resolveX402ApiKeyId(
  authContext: AuthenticatedApiContext,
  bodyApiKeyId?: string | null,
): Promise<string | null> {
  if (authContext.authMethod === "apiKey") {
    const inner = getBetterAuthInnerSession(authContext.session);
    return inner?.id ?? null;
  }

  if (bodyApiKeyId == null || bodyApiKeyId === "") {
    return null;
  }

  const apiKey = await prisma.apikey.findFirst({
    where: { id: bodyApiKeyId, userId: authContext.user.id },
    select: { id: true },
  });
  if (apiKey == null) {
    throw new ApiError(404, "API key not found");
  }

  return apiKey.id;
}

export async function requireX402ApiKeyIdForPay(
  authContext: AuthenticatedApiContext,
  bodyApiKeyId?: string,
): Promise<string> {
  const apiKeyId = await resolveX402ApiKeyId(authContext, bodyApiKeyId);
  if (apiKeyId == null) {
    throw new ApiError(
      400,
      "apiKeyId is required when not authenticated with an API key",
    );
  }
  return apiKeyId;
}
