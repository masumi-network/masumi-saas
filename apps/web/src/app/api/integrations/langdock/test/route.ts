import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import {
  decryptIntegrationConnectionSecret,
  getScopedIntegrationConnection,
} from "@/lib/integrations/connections";
import {
  langdockInputFieldsToMipSchema,
  testLangdockAgent,
} from "@/lib/integrations/langdock";

const bodySchema = z.object({
  apiKey: z.string().min(1).optional(),
  integrationConnectionId: z.string().min(1).optional(),
  agentId: z.string().min(1),
  baseUrl: z.string().url().optional().or(z.literal("")),
});

export async function POST(request: Request) {
  const authContext = await getAuthenticatedOrThrow(request);
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const scope = {
    userId: authContext.user.id,
    organizationId: authContext.activeOrganizationId,
  };
  let apiKey = parsed.data.apiKey?.trim() ?? "";

  if (parsed.data.integrationConnectionId) {
    const connection = await getScopedIntegrationConnection({
      scope,
      id: parsed.data.integrationConnectionId,
    });
    if (!connection || connection.provider !== "LANGDOCK") {
      return NextResponse.json(
        { error: "Langdock connection not found" },
        { status: 404 },
      );
    }
    apiKey = await decryptIntegrationConnectionSecret(connection);
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: "Langdock API key is required" },
      { status: 400 },
    );
  }

  try {
    const agent = await testLangdockAgent({
      apiKey,
      agentId: parsed.data.agentId,
      baseUrl: parsed.data.baseUrl || undefined,
    });
    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id ?? agent.agentId ?? parsed.data.agentId,
        name: agent.name ?? "",
        description: agent.description ?? "",
        emojiIcon: agent.emojiIcon ?? null,
      },
      inputSchema: langdockInputFieldsToMipSchema(agent.inputFields),
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
