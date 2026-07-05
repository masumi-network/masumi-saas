import { NextResponse } from "next/server";

import { getLangdockJobStatus } from "@/lib/mip/langdock-runtime";

export async function GET(
  request: Request,
  context: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await context.params;
  const url = new URL(request.url);
  const result = await getLangdockJobStatus(agentId, {
    job_id: url.searchParams.get("job_id"),
  });
  return NextResponse.json(result.body, { status: result.status });
}
