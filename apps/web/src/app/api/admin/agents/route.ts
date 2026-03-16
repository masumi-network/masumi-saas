import type { Prisma } from "@masumi/database";
import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getAuthenticatedOrThrow,
  handleAuthError,
  isAdminUser,
} from "@/lib/auth/utils";

const getAdminAgentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().max(200).optional().default(""),
});

type AdminAgentRow = {
  id: string;
  name: string;
  apiUrl: string;
  registrationState: string;
  verificationStatus: string | null;
  agentIdentifier: string | null;
  createdAt: string;
  ownerName: string;
  ownerEmail: string;
};

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

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });
    if (!isAdminUser({ id: user.id, role: dbUser?.role ?? undefined })) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const rawParams = Object.fromEntries(
      request.nextUrl.searchParams.entries(),
    );
    const queryResult = getAdminAgentsQuerySchema.safeParse(rawParams);
    if (!queryResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: queryResult.error.issues.map((e) => e.message).join(", "),
        },
        { status: 400 },
      );
    }
    const { page, limit, search: searchRaw } = queryResult.data;
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
      ownerName: a.user.name,
      ownerEmail: a.user.email,
    }));

    return NextResponse.json({
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
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error("Failed to fetch admin agents:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load agents" },
      { status: 500 },
    );
  }
}
