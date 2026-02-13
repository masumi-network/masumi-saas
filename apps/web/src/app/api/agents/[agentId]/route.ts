import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedOrThrow } from "@/lib/auth/utils";

const exampleOutputSchema = z.object({
  name: z.string().max(60).min(1),
  url: z.string().url().min(1),
  mimeType: z.string().max(60).min(1),
});

const updateAgentSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(250, "Name must be less than 250 characters")
    .optional(),
  summary: z
    .string()
    .max(250, "Summary must be 250 characters or less")
    .optional()
    .nullable(),
  description: z
    .string()
    .max(5000, "Description must be less than 5000 characters")
    .optional()
    .nullable(),
  tags: z.array(z.string()).optional(),
  icon: z.string().max(2000).optional().nullable(),
  pricing: z
    .object({
      pricingType: z.enum(["Free", "Fixed"]),
      prices: z
        .array(
          z.object({
            amount: z.string(),
            currency: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional()
    .nullable(),
  authorName: z.string().max(250).optional().or(z.literal("")),
  authorEmail: z.union([z.literal(""), z.string().email().max(250)]).optional(),
  organization: z.string().max(250).optional().or(z.literal("")),
  contactOther: z.string().max(250).optional().or(z.literal("")),
  termsOfUseUrl: z.union([z.literal(""), z.string().url().max(250)]).optional(),
  privacyPolicyUrl: z
    .union([z.literal(""), z.string().url().max(250)])
    .optional(),
  otherUrl: z.union([z.literal(""), z.string().url().max(250)]).optional(),
  capabilityName: z.string().max(250).optional().or(z.literal("")),
  capabilityVersion: z.string().max(250).optional().or(z.literal("")),
  exampleOutputs: z.array(exampleOutputSchema).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { user } = await getAuthenticatedOrThrow();
    const { agentId } = await params;

    const agent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        userId: user.id,
      },
    });

    if (!agent) {
      return NextResponse.json(
        {
          success: false,
          error: "Agent not found",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: agent,
    });
  } catch (error) {
    console.error("Failed to get agent:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get agent",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { user } = await getAuthenticatedOrThrow();
    const { agentId } = await params;

    const agent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        userId: user.id,
      },
    });

    if (!agent) {
      return NextResponse.json(
        {
          success: false,
          error: "Agent not found",
        },
        { status: 404 },
      );
    }

    const body = await request.json();
    const validation = updateAgentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.issues.map((e) => e.message).join(", "),
        },
        { status: 400 },
      );
    }

    const data = validation.data;

    const metadataKeys = [
      "authorName",
      "authorEmail",
      "organization",
      "contactOther",
      "termsOfUseUrl",
      "privacyPolicyUrl",
      "otherUrl",
      "capabilityName",
      "capabilityVersion",
      "exampleOutputs",
    ] as const;
    const hasMetadataUpdates = metadataKeys.some((k) => k in data);
    let finalMetadata: string | null = null;
    if (hasMetadataUpdates) {
      const existingMetadata =
        agent.metadata != null
          ? (JSON.parse(agent.metadata) as Record<string, unknown>)
          : {};
      for (const key of metadataKeys) {
        if (!(key in data)) continue;
        const raw = (data as Record<string, unknown>)[key];
        if (key === "exampleOutputs") {
          if (Array.isArray(raw) && raw.length > 0) {
            existingMetadata[key] = raw;
          } else {
            delete existingMetadata[key];
          }
        } else {
          const v = typeof raw === "string" ? raw.trim() : "";
          if (v) existingMetadata[key] = v;
          else delete existingMetadata[key];
        }
      }
      finalMetadata =
        Object.keys(existingMetadata).length > 0
          ? JSON.stringify(existingMetadata)
          : null;
    }

    const updateData: {
      name?: string;
      summary?: string | null;
      description?: string | null;
      tags?: string[];
      icon?: string | null;
      pricing?: unknown;
      metadata?: string | null;
    } = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.summary !== undefined)
      updateData.summary = data.summary?.trim() || null;
    if (data.description !== undefined)
      updateData.description = data.description?.trim() || null;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.icon !== undefined) updateData.icon = data.icon?.trim() || null;
    if (data.pricing !== undefined) updateData.pricing = data.pricing;
    if (hasMetadataUpdates) updateData.metadata = finalMetadata;

    const updatedAgent = await prisma.agent.update({
      where: { id: agentId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: updatedAgent,
    });
  } catch (error) {
    console.error("Failed to update agent:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update agent",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { user } = await getAuthenticatedOrThrow();
    const { agentId } = await params;

    const agent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        userId: user.id,
      },
    });

    if (!agent) {
      return NextResponse.json(
        {
          success: false,
          error: "Agent not found",
        },
        { status: 404 },
      );
    }

    await prisma.agent.delete({
      where: {
        id: agentId,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Failed to delete agent:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to delete agent",
      },
      { status: 500 },
    );
  }
}
