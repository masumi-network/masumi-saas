import "server-only";

import prisma from "@masumi/database/client";

import { serverLog } from "@/lib/server/logger";

import { parseNetwork } from "../schemas/api-query";

export const CREDIT_COST = 1;
const INITIAL_CREDIT_GRANT = 20;

export type CreditLedgerReason =
  | "initial_grant"
  | "agent_register"
  | "inbox_agent_register"
  | "payment_proxy_write"
  | "stripe_checkout"
  | "stripe_checkout_clawback";

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

/** Raised when granting credits would exceed {@link MAX_USER_CREDITS_REMAINING}. */
export class CreditBalanceCapExceededError extends Error {
  constructor() {
    super("Credit balance would exceed configured maximum");
    this.name = "CreditBalanceCapExceededError";
  }
}

/** Stay below Postgres `Int` max (2_147_483_647) with headroom. */
export const MAX_USER_CREDITS_REMAINING = 2_000_000_000;

export function wouldExceedCreditBalanceCap(
  creditsRemaining: number,
  creditsToAdd: number,
): boolean {
  return creditsRemaining > MAX_USER_CREDITS_REMAINING - creditsToAdd;
}

function isUniqueConstraintError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (
      typeof current === "object" &&
      current !== null &&
      "code" in current &&
      (current as { code?: unknown }).code === "P2002"
    ) {
      return true;
    }
    current =
      typeof current === "object" && current !== null && "cause" in current
        ? (current as { cause?: unknown }).cause
        : undefined;
  }
  return false;
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
      const existingGrant = await tx.creditLedgerEntry.findUnique({
        where: {
          userId_reason_reference: {
            userId,
            reason: "initial_grant",
            reference: "signup",
          },
        },
        select: { id: true },
      });
      if (existingGrant) return;

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
 * Same `checkoutSessionId` only applies once via a unique ledger column.
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
        stripeCheckoutSessionId: params.checkoutSessionId,
      },
      select: { balanceAfter: true },
    });

    if (existing) {
      return { granted: false, balanceAfter: existing.balanceAfter };
    }

    const before = await tx.user.findUniqueOrThrow({
      where: { id: params.userId },
      select: { creditsRemaining: true },
    });
    if (wouldExceedCreditBalanceCap(before.creditsRemaining, params.credits)) {
      throw new CreditBalanceCapExceededError();
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
        stripeCheckoutSessionId: params.checkoutSessionId,
        ...(params.metadata
          ? { metadata: toJsonMetadata(params.metadata) }
          : {}),
      },
    });

    return { granted: true, balanceAfter: user.creditsRemaining };
  });
}

function clawBackReference(
  checkoutSessionId: string,
  stripeEventId: string,
): string {
  return `clawback:${checkoutSessionId}:${stripeEventId}`;
}

/**
 * Idempotent clawback for Stripe refunds / disputes against a prior top-up grant.
 * {@link params.creditsToClawBack} is the cumulative total that should have been
 * clawed back for this checkout session so far (e.g. from charge.amount_refunded).
 * Only the increment since prior clawback ledger rows is applied on this call.
 */
export async function clawBackCreditTopUpFromCheckoutSession(params: {
  userId: string;
  checkoutSessionId: string;
  stripeEventId: string;
  creditsToClawBack: number;
  metadata?: CreditMetadata;
}): Promise<{
  clawedBack: boolean;
  creditsRemoved: number;
  balanceAfter: number;
  shortfall: number;
}> {
  if (params.creditsToClawBack <= 0) {
    const balance = await getCreditBalance(params.userId);
    return {
      clawedBack: false,
      creditsRemoved: 0,
      balanceAfter: balance.creditsRemaining,
      shortfall: 0,
    };
  }

  const reference = clawBackReference(
    params.checkoutSessionId,
    params.stripeEventId,
  );

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.creditLedgerEntry.findUnique({
        where: {
          userId_reason_reference: {
            userId: params.userId,
            reason: "stripe_checkout_clawback",
            reference,
          },
        },
        select: { delta: true, balanceAfter: true },
      });
      if (existing) {
        return {
          clawedBack: false,
          creditsRemoved: -existing.delta,
          balanceAfter: existing.balanceAfter,
          shortfall: 0,
        };
      }

      const grant = await tx.creditLedgerEntry.findUnique({
        where: {
          stripeCheckoutSessionId: params.checkoutSessionId,
        },
        select: { userId: true, delta: true },
      });
      if (grant == null || grant.userId !== params.userId || grant.delta <= 0) {
        return {
          clawedBack: false,
          creditsRemoved: 0,
          balanceAfter: (
            await tx.user.findUniqueOrThrow({
              where: { id: params.userId },
              select: { creditsRemaining: true },
            })
          ).creditsRemaining,
          shortfall: 0,
        };
      }

      const priorClawbacks = await tx.creditLedgerEntry.findMany({
        where: {
          userId: params.userId,
          reason: "stripe_checkout_clawback",
          reference: { startsWith: `clawback:${params.checkoutSessionId}:` },
        },
        select: { delta: true },
      });
      const alreadyRemoved = priorClawbacks.reduce(
        (sum, entry) => sum + (entry.delta < 0 ? -entry.delta : 0),
        0,
      );
      const remainingGrant = Math.max(0, grant.delta - alreadyRemoved);
      const incrementalTarget = Math.max(
        0,
        params.creditsToClawBack - alreadyRemoved,
      );
      const targetRemoval = Math.min(incrementalTarget, remainingGrant);
      if (targetRemoval <= 0) {
        const user = await tx.user.findUniqueOrThrow({
          where: { id: params.userId },
          select: { creditsRemaining: true },
        });
        return {
          clawedBack: false,
          creditsRemoved: 0,
          balanceAfter: user.creditsRemaining,
          shortfall: 0,
        };
      }

      const before = await tx.user.findUniqueOrThrow({
        where: { id: params.userId },
        select: { creditsRemaining: true },
      });
      const creditsRemoved = Math.min(targetRemoval, before.creditsRemaining);
      const shortfall = targetRemoval - creditsRemoved;

      if (creditsRemoved === 0) {
        return {
          clawedBack: false,
          creditsRemoved: 0,
          balanceAfter: before.creditsRemaining,
          shortfall,
        };
      }

      const user = await tx.user.update({
        where: { id: params.userId },
        data: {
          creditsRemaining: { decrement: creditsRemoved },
        },
        select: { creditsRemaining: true },
      });

      await tx.creditLedgerEntry.create({
        data: {
          userId: params.userId,
          delta: -creditsRemoved,
          balanceAfter: user.creditsRemaining,
          reason: "stripe_checkout_clawback",
          reference,
          metadata: toJsonMetadata({
            checkoutSessionId: params.checkoutSessionId,
            stripeEventId: params.stripeEventId,
            requestedClawback: params.creditsToClawBack,
            shortfall,
            ...(params.metadata ?? {}),
          }),
        },
      });

      return {
        clawedBack: true,
        creditsRemoved,
        balanceAfter: user.creditsRemaining,
        shortfall,
      };
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const balance = await getCreditBalance(params.userId);
      return {
        clawedBack: false,
        creditsRemoved: 0,
        balanceAfter: balance.creditsRemaining,
        shortfall: 0,
      };
    }
    throw error;
  }
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
    serverLog.error("[Credits] Failed to refund consumed credit", {
      userId: params.userId,
      reason: params.reason,
      reference: params.reference,
      err: error,
    });
  }
}
