import "server-only";

import prisma from "@masumi/database/client";

import { parseNetwork } from "@/lib/schemas/api-query";

import {
  type CreditChargeReason,
  getCreditCostForReason,
  INITIAL_CREDIT_GRANT_ATOMIC,
} from "./pricing";

export type { CreditLedgerReason } from "./pricing";
export {
  CREDIT_COST,
  CREDITS_PER_PAYMENT_EVENT,
  getCreditCostForReason,
} from "./pricing";

export type CreditBalance = {
  creditsRemaining: number;
  updatedAt: Date;
};

type CreditMetadata = Record<string, unknown>;

export class InsufficientCreditsError extends Error {
  readonly creditsRemaining: number;
  readonly requiredCredits: number;

  constructor(creditsRemaining: number, requiredCredits: number) {
    super("Insufficient credits");
    this.name = "InsufficientCreditsError";
    this.creditsRemaining = creditsRemaining;
    this.requiredCredits = requiredCredits;
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function toJsonMetadata(metadata?: CreditMetadata) {
  return metadata as never;
}

export function createCreditReference(prefix: string): string {
  return `${prefix}:${crypto.randomUUID()}`;
}

export async function getCreditBalance(userId: string): Promise<CreditBalance> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      creditsRemaining: true,
      updatedAt: true,
    },
  });

  return {
    creditsRemaining: user.creditsRemaining,
    updatedAt: user.updatedAt,
  };
}

export async function grantInitialCreditsIfNeeded(
  userId: string,
): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { creditsRemaining: true },
      });

      const balanceAfter = user.creditsRemaining + INITIAL_CREDIT_GRANT_ATOMIC;

      await tx.user.update({
        where: { id: userId },
        data: {
          creditsRemaining: {
            increment: INITIAL_CREDIT_GRANT_ATOMIC,
          },
        },
      });

      await tx.creditLedgerEntry.create({
        data: {
          userId,
          delta: INITIAL_CREDIT_GRANT_ATOMIC,
          balanceAfter,
          reason: "initial_grant",
          reference: "signup",
        },
      });
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return;
    }
    throw error;
  }
}

export async function consumeCreditOrThrow(params: {
  userId: string;
  reason: CreditChargeReason;
  reference: string;
  metadata?: CreditMetadata;
  amount?: number;
}): Promise<CreditBalance> {
  const cost = params.amount ?? getCreditCostForReason(params.reason);

  return prisma.$transaction(async (tx) => {
    const debitResult = await tx.user.updateMany({
      where: {
        id: params.userId,
        creditsRemaining: {
          gte: cost,
        },
      },
      data: {
        creditsRemaining: {
          decrement: cost,
        },
      },
    });

    if (debitResult.count !== 1) {
      const user = await tx.user.findUnique({
        where: { id: params.userId },
        select: { creditsRemaining: true },
      });
      throw new InsufficientCreditsError(user?.creditsRemaining ?? 0, cost);
    }

    const user = await tx.user.findUniqueOrThrow({
      where: { id: params.userId },
      select: {
        creditsRemaining: true,
        updatedAt: true,
      },
    });

    await tx.creditLedgerEntry.create({
      data: {
        userId: params.userId,
        delta: -cost,
        balanceAfter: user.creditsRemaining,
        reason: params.reason,
        reference: params.reference,
        ...(params.metadata
          ? { metadata: toJsonMetadata(params.metadata) }
          : {}),
      },
    });

    return {
      creditsRemaining: user.creditsRemaining,
      updatedAt: user.updatedAt,
    };
  });
}

export async function consumeCreditIfRequired(params: {
  userId: string;
  reason: CreditChargeReason;
  reference: string;
  metadata?: CreditMetadata;
  network?: string | null | undefined;
  amount?: number;
}): Promise<CreditBalance> {
  const effectiveNetwork = parseNetwork(params.network);

  if (effectiveNetwork !== "Mainnet") {
    return getCreditBalance(params.userId);
  }

  return consumeCreditOrThrow({
    userId: params.userId,
    reason: params.reason,
    reference: params.reference,
    metadata: params.metadata,
    amount: params.amount,
  });
}

export async function refundConsumedCredit(params: {
  userId: string;
  reason: CreditChargeReason;
  reference: string;
  metadata?: CreditMetadata;
  network?: string | null | undefined;
}): Promise<void> {
  const effectiveNetwork = parseNetwork(params.network);
  if (effectiveNetwork !== "Mainnet") return;

  const refundReference = `${params.reference}:refund`;

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.creditLedgerEntry.findUnique({
        where: {
          userId_reason_reference: {
            userId: params.userId,
            reason: params.reason,
            reference: refundReference,
          },
        },
        select: { id: true },
      });
      if (existing) return;

      const originalDebit = await tx.creditLedgerEntry.findUnique({
        where: {
          userId_reason_reference: {
            userId: params.userId,
            reason: params.reason,
            reference: params.reference,
          },
        },
        select: { delta: true },
      });
      if (!originalDebit || originalDebit.delta >= 0) return;

      const refundAmount = -originalDebit.delta;

      const user = await tx.user.update({
        where: { id: params.userId },
        data: { creditsRemaining: { increment: refundAmount } },
        select: { creditsRemaining: true },
      });

      await tx.creditLedgerEntry.create({
        data: {
          userId: params.userId,
          delta: refundAmount,
          balanceAfter: user.creditsRemaining,
          reason: params.reason,
          reference: refundReference,
          ...(params.metadata
            ? { metadata: toJsonMetadata(params.metadata) }
            : {}),
        },
      });
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) return;
    console.error("[Credits] Failed to refund consumed credit:", {
      userId: params.userId,
      reason: params.reason,
      reference: params.reference,
      error,
    });
  }
}
