import "server-only";

import prisma from "@masumi/database/client";

import { parseNetwork } from "../schemas/api-query";

export const CREDIT_COST = 1;
const INITIAL_CREDIT_GRANT = 20;

export type CreditLedgerReason =
  | "initial_grant"
  | "agent_register"
  | "inbox_agent_register"
  | "payment_proxy_write"
  | "stripe_checkout";

export type CreditBalance = {
  creditsRemaining: number;
  updatedAt: Date;
};

type CreditMetadata = Record<string, unknown>;

export class InsufficientCreditsError extends Error {
  readonly creditsRemaining: number;
  readonly requiredCredits: number;

  constructor(creditsRemaining: number, requiredCredits = CREDIT_COST) {
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

      const balanceAfter = user.creditsRemaining + INITIAL_CREDIT_GRANT;

      await tx.user.update({
        where: { id: userId },
        data: {
          creditsRemaining: {
            increment: INITIAL_CREDIT_GRANT,
          },
        },
      });

      await tx.creditLedgerEntry.create({
        data: {
          userId,
          delta: INITIAL_CREDIT_GRANT,
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
  reason: Exclude<CreditLedgerReason, "initial_grant">;
  reference: string;
  metadata?: CreditMetadata;
}): Promise<CreditBalance> {
  return prisma.$transaction(async (tx) => {
    const debitResult = await tx.user.updateMany({
      where: {
        id: params.userId,
        creditsRemaining: {
          gte: CREDIT_COST,
        },
      },
      data: {
        creditsRemaining: {
          decrement: CREDIT_COST,
        },
      },
    });

    if (debitResult.count !== 1) {
      const user = await tx.user.findUnique({
        where: { id: params.userId },
        select: { creditsRemaining: true },
      });
      throw new InsufficientCreditsError(user?.creditsRemaining ?? 0);
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
        delta: -CREDIT_COST,
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
  reason: Exclude<CreditLedgerReason, "initial_grant">;
  reference: string;
  metadata?: CreditMetadata;
  network?: string | null | undefined;
}): Promise<CreditBalance> {
  const effectiveNetwork = parseNetwork(params.network);

  // Credits should only be spent for writes against Mainnet.
  if (effectiveNetwork !== "Mainnet") {
    return getCreditBalance(params.userId);
  }

  return consumeCreditOrThrow({
    userId: params.userId,
    reason: params.reason,
    reference: params.reference,
    metadata: params.metadata,
  });
}

/**
 * Idempotent credit grant for Stripe Checkout (`checkout.session.completed`).
 * Same `checkoutSessionId` only applies once (unique userId + reason + reference).
 */
export async function grantCreditTopUpFromCheckoutSession(params: {
  userId: string;
  credits: number;
  checkoutSessionId: string;
  metadata?: CreditMetadata;
}): Promise<{ granted: boolean; balanceAfter: number }> {
  if (params.credits <= 0) {
    throw new Error(
      "grantCreditTopUpFromCheckoutSession: credits must be positive",
    );
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.creditLedgerEntry.findUnique({
      where: {
        userId_reason_reference: {
          userId: params.userId,
          reason: "stripe_checkout",
          reference: params.checkoutSessionId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      const u = await tx.user.findUniqueOrThrow({
        where: { id: params.userId },
        select: { creditsRemaining: true },
      });
      return { granted: false, balanceAfter: u.creditsRemaining };
    }

    const user = await tx.user.update({
      where: { id: params.userId },
      data: {
        creditsRemaining: {
          increment: params.credits,
        },
      },
      select: { creditsRemaining: true },
    });

    await tx.creditLedgerEntry.create({
      data: {
        userId: params.userId,
        delta: params.credits,
        balanceAfter: user.creditsRemaining,
        reason: "stripe_checkout",
        reference: params.checkoutSessionId,
        ...(params.metadata
          ? { metadata: toJsonMetadata(params.metadata) }
          : {}),
      },
    });

    return { granted: true, balanceAfter: user.creditsRemaining };
  });
}

export async function refundConsumedCredit(params: {
  userId: string;
  reason: Exclude<CreditLedgerReason, "initial_grant">;
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
      if (!originalDebit || originalDebit.delta !== -CREDIT_COST) return;

      const user = await tx.user.update({
        where: { id: params.userId },
        data: { creditsRemaining: { increment: CREDIT_COST } },
        select: { creditsRemaining: true },
      });

      await tx.creditLedgerEntry.create({
        data: {
          userId: params.userId,
          delta: CREDIT_COST,
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
