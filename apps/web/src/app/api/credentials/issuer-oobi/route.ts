import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { getIssuerOobi } from "@/lib/veridian";

export async function GET(_request: NextRequest) {
  try {
    await getAuthenticatedOrThrow();

    const issuerOobi = await getIssuerOobi();

    return NextResponse.json({
      success: true,
      data: { oobi: issuerOobi },
    });
  } catch (error) {
    console.error("Failed to get issuer OOBI:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get issuer OOBI",
      },
      { status: 500 },
    );
  }
}
