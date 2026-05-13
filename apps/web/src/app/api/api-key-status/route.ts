import prisma from "@masumi/database/client";
import { NextRequest } from "next/server";

import { rejectOidcAccessTokenAuth } from "@/lib/auth/oidc-api-permissions";
import { getBetterAuthInnerSession } from "@/lib/auth/session-types";
import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { authConfig } from "@/lib/config/auth.config";
import { contractJsonResponse } from "@/lib/openapi/contracts";

import contract from "./route.contract";

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });
    rejectOidcAccessTokenAuth(
      authContext,
      "OIDC access tokens are not supported for /api/api-key-status",
    );

    const sess = getBetterAuthInnerSession(authContext.session);
    const token = sess?.token;
    const isApiKeyAuth =
      typeof token === "string" &&
      token.startsWith(authConfig.apiKey.defaultKeyPrefix);

    if (isApiKeyAuth && typeof sess?.id === "string") {
      const keyRow = await prisma.apikey.findFirst({
        where: { id: sess.id, userId: authContext.user.id },
        select: {
          id: true,
          name: true,
          prefix: true,
          start: true,
          enabled: true,
          createdAt: true,
          lastRequest: true,
        },
      });

      if (!keyRow) {
        return contractJsonResponse(contract, "GET", 404, {
          success: false,
          error: "API key not found",
        });
      }

      return contractJsonResponse(contract, "GET", 200, {
        success: true,
        data: {
          authMethod: "apiKey" as const,
          userId: authContext.user.id,
          key: {
            id: keyRow.id,
            name: keyRow.name,
            prefix: keyRow.prefix,
            start: keyRow.start,
            enabled: keyRow.enabled ?? true,
            createdAt: keyRow.createdAt.toISOString(),
            lastRequest: keyRow.lastRequest?.toISOString() ?? null,
          },
        },
      });
    }

    return contractJsonResponse(contract, "GET", 200, {
      success: true,
      data: {
        authMethod: "session" as const,
        userId: authContext.user.id,
      },
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("GET /api/api-key-status:", error);
    return contractJsonResponse(contract, "GET", 500, {
      success: false,
      error: "Failed to load API key status",
    });
  }
}
