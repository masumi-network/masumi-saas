import { NextResponse } from "next/server";

import { provideLangdockJobInput } from "@/lib/mip/langdock-runtime";

export async function POST(
  request: Request,
  context: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await context.params;
  const body = await request.json().catch(() => null);
  const result = await provideLangdockJobInput(agentId, body);
  return NextResponse.json(result.body, { status: result.status });
}
