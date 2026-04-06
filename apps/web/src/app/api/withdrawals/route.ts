import { WithdrawalStatus } from "@masumi/database";
import prisma from "@masumi/database/client";
import { NextResponse } from "next/server";

import { getAuthenticatedOrThrow, handleAuthError } from "@/lib/auth/utils";
import {
  createWithdrawalBodySchema,
  withdrawalListQuerySchema,
} from "@/lib/schemas/withdrawal";
import { withdrawalToDto } from "@/lib/utils/withdrawal-dto";

export async function GET(request: Request) {
  try {
    const { user } = await getAuthenticatedOrThrow(request);
    const url = new URL(request.url);
    const parsed = withdrawalListQuerySchema.safeParse({
      status: url.searchParams.get("status") ?? "all",
      limit: url.searchParams.get("limit") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid query" },
        { status: 400 },
      );
    }
    const { status, limit } = parsed.data;
    const where =
      status === "all"
        ? { userId: user.id }
        : { userId: user.id, status: status as WithdrawalStatus };

    const rows = await prisma.withdrawal.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      data: { withdrawals: rows.map(withdrawalToDto) },
    });
  } catch (error) {
    const auth = handleAuthError(error);
    if (auth) {
      return auth;
    }
    console.error("[withdrawals GET] failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: "Failed to load withdrawals" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await getAuthenticatedOrThrow(request);
    const json: unknown = await request.json();
    const parsed = createWithdrawalBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400 },
      );
    }

    const pendingCount = await prisma.withdrawal.count({
      where: { userId: user.id, status: WithdrawalStatus.PENDING },
    });
    if (pendingCount > 0) {
      return NextResponse.json(
        { success: false, error: "pending_exists" },
        { status: 409 },
      );
    }

    const { amountUsd, network, payoutAddress, destinationLabel } = parsed.data;

    const created = await prisma.withdrawal.create({
      data: {
        userId: user.id,
        status: WithdrawalStatus.PENDING,
        amountUsd,
        network,
        payoutAddress,
        destinationLabel: destinationLabel ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      data: { withdrawal: withdrawalToDto(created) },
    });
  } catch (error) {
    const auth = handleAuthError(error);
    if (auth) {
      return auth;
    }
    console.error("[withdrawals POST] failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: "Failed to create withdrawal" },
      { status: 500 },
    );
  }
}
