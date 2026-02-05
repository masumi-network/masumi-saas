import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedHeaders } from "@/lib/auth/utils";
import { getCredentialServerUrl } from "@/lib/veridian";

const checkConnectionSchema = z.object({
  aid: z.string().min(1, "AID is required"),
});

export async function POST(request: NextRequest) {
  try {
    await getAuthenticatedHeaders();

    const body = await request.json().catch(() => ({}));
    const validation = checkConnectionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request",
          details: validation.error.issues.map((issue) => issue.message),
        },
        { status: 400 },
      );
    }

    const { aid } = validation.data;

    const credentialServerUrl = getCredentialServerUrl();
    const url = `${credentialServerUrl}/contacts`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to fetch contacts: ${response.status} ${response.statusText}`,
        },
        { status: 500 },
      );
    }

    const data = (await response.json()) as {
      success: boolean;
      data: unknown[];
    };
    if (!data.success || !Array.isArray(data.data)) {
      return NextResponse.json({
        success: true,
        data: { exists: false },
      });
    }

    const exists = data.data.some((contact) => {
      const c = contact as { id?: string };
      return c.id === aid;
    });

    return NextResponse.json({
      success: true,
      data: { exists },
    });
  } catch (error) {
    console.error("Failed to check connection:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to check connection",
      },
      { status: 500 },
    );
  }
}
