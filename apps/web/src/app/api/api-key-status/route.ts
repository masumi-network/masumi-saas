import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { authConfig } from "@/lib/config/auth.config";

type SessionPayload = {
  id?: string;
  token?: string;
};

function getSessionPayload(session: unknown): SessionPayload | null {
  if (!session || typeof session !== "object") return null;
  if (!("session" in session)) return null;
  const inner = (session as { session: unknown }).session;
  if (!inner || typeof inner !== "object") return null;
  const s = inner as SessionPayload;
  return s;
}

export async function GET(request: NextRequest) {
  try {
    const { user, session } = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });

    const sess = getSessionPayload(session);
    const token = sess?.token;
    const isApiKeyAuth =
      typeof token === "string" &&
      token.startsWith(authConfig.apiKey.defaultKeyPrefix);

    if (isApiKeyAuth && typeof sess?.id === "string") {
      const keyRow = await prisma.apikey.findFirst({
        where: { id: sess.id, userId: user.id },
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
        return NextResponse.json(
          { success: false, error: "API key not found" },
          { status: 404 },
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          authMethod: "apiKey" as const,
          userId: user.id,
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

    return NextResponse.json({
      success: true,
      data: {
        authMethod: "session" as const,
        userId: user.id,
      },
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("GET /api/api-key-status:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load API key status" },
      { status: 500 },
    );
  }
}
