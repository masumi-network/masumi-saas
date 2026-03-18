import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";

import {
  getAdminAgentsData,
  getAdminAgentsQuerySchema,
} from "@/lib/api/admin.server";
import {
  getAuthenticatedOrThrow,
  handleAuthError,
  isAdminUser,
} from "@/lib/auth/utils";

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });
    if (!isAdminUser({ id: user.id, role: dbUser?.role ?? undefined })) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const rawParams = Object.fromEntries(
      request.nextUrl.searchParams.entries(),
    );
    const queryResult = getAdminAgentsQuerySchema.safeParse(rawParams);
    if (!queryResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: queryResult.error.issues.map((e) => e.message).join(", "),
        },
        { status: 400 },
      );
    }

    const result = await getAdminAgentsData(queryResult.data);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 },
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to fetch admin agents:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load agents" },
      { status: 500 },
    );
  }
}
