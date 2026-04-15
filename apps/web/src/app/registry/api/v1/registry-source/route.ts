import prisma from "@masumi/database/client";
import { NextRequest, NextResponse } from "next/server";

import {
  getAuthenticatedOrThrow,
  handleAuthError,
  isAdminUser,
} from "@/lib/auth/utils";
import {
  buildUpstreamHeaders,
  readOptionalRequestBody,
  resolveRegistrySharedTokenUpstream,
  toUpstreamResponse,
} from "@/lib/v1-proxy/explicit-route-support";

const ROUTE_PATH = "registry-source";
const UPSTREAM_PATH = "/registry-source/";

export async function GET(request: NextRequest) {
  return handleRequest(request, "GET");
}

export async function POST(request: NextRequest) {
  return handleRequest(request, "POST");
}

export async function PATCH(request: NextRequest) {
  return handleRequest(request, "PATCH");
}

export async function DELETE(request: NextRequest) {
  return handleRequest(request, "DELETE");
}

async function handleRequest(
  request: NextRequest,
  method: "GET" | "POST" | "PATCH" | "DELETE",
) {
  try {
    const authContext = await getAuthenticatedOrThrow(request, {
      requireEmailVerified: false,
    });
    const dbUser = await prisma.user.findUnique({
      where: { id: authContext.user.id },
      select: { role: true },
    });

    if (!isAdminUser({ id: authContext.user.id, role: dbUser?.role })) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const upstream = resolveRegistrySharedTokenUpstream();
    if (!upstream.ok) {
      return NextResponse.json(
        { success: false, error: upstream.error },
        { status: upstream.status },
      );
    }

    const headers = buildUpstreamHeaders(request, upstream.token);
    const body =
      method === "GET" ? undefined : await readOptionalRequestBody(request);
    const response = await fetch(
      `${upstream.baseUrl}${UPSTREAM_PATH}${request.nextUrl.search}`,
      {
        method,
        headers,
        body,
      },
    );

    return toUpstreamResponse(response);
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    console.error(`[External Service Proxy:${ROUTE_PATH}]`, error);
    return NextResponse.json(
      { success: false, error: "Proxy request failed" },
      { status: 500 },
    );
  }
}
