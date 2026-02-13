import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/api/error";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { checkContactExists } from "@/lib/veridian";

const checkConnectionSchema = z.object({
  aid: z.string().min(1, "AID is required"),
});

export async function POST(request: NextRequest) {
  try {
    await getAuthenticatedOrThrow();

    const body = await request.json().catch(() => ({}));
    const validation = checkConnectionSchema.safeParse(body);

    if (!validation.success) {
      return apiError(
        "Invalid request",
        400,
        validation.error.issues.map((issue) => issue.message),
      );
    }

    const { aid } = validation.data;

    const exists = await checkContactExists(aid);

    return NextResponse.json({
      success: true,
      data: { exists },
    });
  } catch (error) {
    console.error("Failed to check connection:", error);
    return apiError(
      error instanceof Error ? error.message : "Failed to check connection",
      500,
    );
  }
}
