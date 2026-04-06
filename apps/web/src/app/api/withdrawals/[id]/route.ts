import prisma from "@masumi/database/client";
import { NextResponse } from "next/server";

import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import { withdrawalToDto } from "@/lib/utils/withdrawal-dto";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { user } = await getAuthenticatedOrThrow(request);
    const { id } = await context.params;

    const row = await prisma.withdrawal.findFirst({
      where: { id, userId: user.id },
    });

    if (!row) {
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { withdrawal: withdrawalToDto(row) },
    });
  } catch (error) {
    const auth = handleAuthError(error);
    if (auth) {
      return auth;
    }
    console.error("[withdrawals/[id] GET] failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: "Failed to load withdrawal" },
      { status: 500 },
    );
  }
}
