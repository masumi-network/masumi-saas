import { NextResponse } from "next/server";

import { getLangdockInputSchema } from "@/lib/mip/langdock-runtime";

export async function GET(
  _request: Request,
  context: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await context.params;
  const result = await getLangdockInputSchema(agentId);
  if (!result) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  return NextResponse.json(result);
}
