import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import {
  createIntegrationConnection,
  listScopedIntegrationConnections,
  serializeIntegrationConnection,
} from "@/lib/integrations/connections";
import { testLangdockAgent } from "@/lib/integrations/langdock";

const createBodySchema = z.object({
  apiKey: z.string().min(1),
  agentId: z.string().min(1),
  baseUrl: z.string().url().optional().or(z.literal("")),
  name: z.string().min(1).max(120).optional(),
});

export async function GET(request: Request) {
  const authContext = await getAuthenticatedOrThrow(request, {
    requireEmailVerified: false,
  });
  const connections = await listScopedIntegrationConnections({
    scope: {
      userId: authContext.user.id,
      organizationId: authContext.activeOrganizationId,
    },
    provider: "LANGDOCK",
  });
  return NextResponse.json({
    success: true,
    data: connections.map(serializeIntegrationConnection),
  });
}

export async function POST(request: Request) {
  const authContext = await getAuthenticatedOrThrow(request);
  const body = await request.json().catch(() => null);
  const parsed = createBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  try {
    const agent = await testLangdockAgent({
      apiKey: parsed.data.apiKey,
      agentId: parsed.data.agentId,
      baseUrl: parsed.data.baseUrl || undefined,
    });
    const connection = await createIntegrationConnection({
      scope: {
        userId: authContext.user.id,
        organizationId: authContext.activeOrganizationId,
      },
      provider: "LANGDOCK",
      name: parsed.data.name?.trim() || "Langdock",
      secret: parsed.data.apiKey,
      metadata: {
        baseUrl: parsed.data.baseUrl || undefined,
        lastAgentId: parsed.data.agentId,
        lastAgentName: agent.name ?? null,
        lastCheckedAt: new Date().toISOString(),
      },
    });
    return NextResponse.json({
      success: true,
      data: serializeIntegrationConnection(connection),
      agent: {
        id: agent.id ?? agent.agentId ?? parsed.data.agentId,
        name: agent.name ?? "",
        description: agent.description ?? "",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Langdock connection check failed",
      },
      { status: 400 },
    );
  }
}
