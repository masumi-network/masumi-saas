import "server-only";

import type { Prisma } from "@masumi/database";
import prisma from "@masumi/database/client";
import { z } from "zod";

import { getAuthenticatedOrThrow, isAdminUser } from "@/lib/auth/utils";

import type { AdminAgentRow, GetAdminAgentsResult } from "./admin.types";

const getAdminAgentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().max(200).optional().default(""),
});

const agentSelect = {
  id: true,
  name: true,
  apiUrl: true,
  registrationState: true,
  verificationStatus: true,
  agentIdentifier: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as const satisfies Prisma.AgentSelect;

export type GetAdminAgentsParams = z.infer<typeof getAdminAgentsQuerySchema>;

/**
 * Fetches admin agents list (no auth). Caller must ensure the user is admin.
 */
export async function getAdminAgentsData(
  params: GetAdminAgentsParams,
): Promise<GetAdminAgentsResult> {
  const { page, limit, search: searchRaw } = params;
  const search = searchRaw.trim();
  const escapedSearch = search
    ? search.replace(/[\\_%]/g, (match) => "\\" + match)
    : "";

  const searchCondition = escapedSearch
    ? {
        OR: [
          { name: { contains: escapedSearch, mode: "insensitive" as const } },
          {
            user: {
              email: {
                contains: escapedSearch,
                mode: "insensitive" as const,
              },
            },
          },
          {
            user: {
              name: { contains: escapedSearch, mode: "insensitive" as const },
            },
          },
        ],
      }
    : {};

  const total = await prisma.agent.count({ where: searchCondition });
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(page, totalPages);

  const agents = await prisma.agent.findMany({
    where: searchCondition,
    select: agentSelect,
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: (currentPage - 1) * limit,
  });

  const data: AdminAgentRow[] = agents.map((a) => ({
    id: a.id,
    name: a.name,
    apiUrl: a.apiUrl,
    registrationState: a.registrationState,
    verificationStatus: a.verificationStatus,
    agentIdentifier: a.agentIdentifier,
    createdAt: a.createdAt.toISOString(),
    ownerName: a.user.name ?? "",
    ownerEmail: a.user.email ?? "",
  }));

  return {
    success: true,
    data: {
      agents: data,
      pagination: {
        currentPage,
        totalPages,
        total,
        limit,
      },
      search,
    },
  };
}

/**
 * Server function for internal use (RSC, server actions). Ensures auth + admin
 * and returns typed result. Prefer this over client fetch for typesafety.
 */
export async function getAdminAgents(
  params: GetAdminAgentsParams,
): Promise<GetAdminAgentsResult> {
  try {
    const { user } = await getAuthenticatedOrThrow({
      requireEmailVerified: false,
    });

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });
    if (!isAdminUser({ id: user.id, role: dbUser?.role ?? undefined })) {
      return { success: false, error: "Forbidden" };
    }

    return await getAdminAgentsData(params);
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to load agents" };
  }
}

export type GetAdminAgentDetailResult =
  | { success: true; agent: AdminAgentRow }
  | { success: false; error: string };

/**
 * Single agent for admin detail page. Caller should enforce admin via layout;
 * this still verifies admin for defense in depth.
 */
export async function getAdminAgentDetail(
  agentId: string,
): Promise<GetAdminAgentDetailResult> {
  try {
    const { user } = await getAuthenticatedOrThrow({
      requireEmailVerified: false,
    });

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });
    if (!isAdminUser({ id: user.id, role: dbUser?.role ?? undefined })) {
      return { success: false, error: "Forbidden" };
    }

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: agentSelect,
    });
    if (!agent) {
      return { success: false, error: "Not found" };
    }

    const row: AdminAgentRow = {
      id: agent.id,
      name: agent.name,
      apiUrl: agent.apiUrl,
      registrationState: agent.registrationState,
      verificationStatus: agent.verificationStatus,
      agentIdentifier: agent.agentIdentifier,
      createdAt: agent.createdAt.toISOString(),
      ownerName: agent.user.name ?? "",
      ownerEmail: agent.user.email ?? "",
    };

    return { success: true, agent: row };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to load agent" };
  }
}

export { getAdminAgentsQuerySchema };
