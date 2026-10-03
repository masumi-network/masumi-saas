import prisma from "@masumi/database/client";
import { NextResponse } from "next/server";

import {
  isX402RegistryAgent,
  parseAgentRegistryMetadata,
} from "@/lib/x402/agent-registry-metadata";

type RouteContext = { params: Promise<{ agentId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { agentId } = await context.params;
  if (!agentId?.trim()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { metadata: true, registrationState: true },
  });
  if (!agent) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const registryMetadata = parseAgentRegistryMetadata(agent.metadata);
  if (!isX402RegistryAgent(registryMetadata)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(registryMetadata.x402Manifest, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
