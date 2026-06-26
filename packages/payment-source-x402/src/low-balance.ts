import { LowBalanceStatus, Prisma, X402EvmWalletType } from "@masumi/database";
import prisma from "@masumi/database/client";
import createHttpError from "http-errors";

import { buildPublicClient, NATIVE_ASSET, readAssetAmount } from "./balance.js";
import {
  assertHexAddress,
  assertRpcServesDeclaredChain,
  getManagedWalletOrThrow,
  type HexAddress,
  normalizeAddress,
} from "./internal.js";
import { logger } from "./logger.js";

const RULE_SELECT = {
  id: true,
  evmWalletId: true,
  EvmWallet: { select: { address: true } },
  caip2Network: true,
  asset: true,
  thresholdAmount: true,
  enabled: true,
  status: true,
  lastKnownAmount: true,
  lastCheckedAt: true,
  lastAlertedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.X402EvmWalletLowBalanceRuleSelect;

export function computeLowBalanceStatus(
  amount: bigint,
  threshold: bigint,
): LowBalanceStatus {
  return amount < threshold ? LowBalanceStatus.Low : LowBalanceStatus.Healthy;
}

function normalizeRuleAsset(asset: string): string {
  if (asset === NATIVE_ASSET) return NATIVE_ASSET;
  assertHexAddress(asset, "asset");
  return normalizeAddress(asset);
}

async function assertRuleOwnedByUser(userId: string, ruleId: string) {
  const existing = await prisma.x402EvmWalletLowBalanceRule.findFirst({
    where: { id: ruleId, EvmWallet: { userId, deletedAt: null } },
    select: { id: true },
  });
  if (existing == null) {
    throw createHttpError(404, "x402 low-balance rule not found");
  }
}

export async function setX402LowBalanceRule(input: {
  userId: string;
  evmWalletId: string;
  caip2Network: string;
  asset: string;
  thresholdAmount: string;
  enabled?: boolean;
}) {
  await getManagedWalletOrThrow(input.userId, input.evmWalletId);
  const network = await prisma.x402Network.findUnique({
    where: {
      userId_caip2Id: {
        userId: input.userId,
        caip2Id: input.caip2Network,
      },
    },
    select: { caip2Id: true },
  });
  if (network == null) {
    throw createHttpError(
      404,
      "x402 network is not registered; add the network before adding a rule",
    );
  }
  const asset = normalizeRuleAsset(input.asset);
  const thresholdAmount = BigInt(input.thresholdAmount);
  if (thresholdAmount < 0n) {
    throw createHttpError(400, "thresholdAmount must not be negative");
  }

  return prisma.x402EvmWalletLowBalanceRule.upsert({
    where: {
      evmWalletId_caip2Network_asset: {
        evmWalletId: input.evmWalletId,
        caip2Network: input.caip2Network,
        asset,
      },
    },
    create: {
      evmWalletId: input.evmWalletId,
      caip2Network: input.caip2Network,
      asset,
      thresholdAmount,
      enabled: input.enabled ?? true,
    },
    update: {
      thresholdAmount,
      enabled: input.enabled ?? undefined,
      status: LowBalanceStatus.Unknown,
    },
    select: RULE_SELECT,
  });
}

export async function listX402LowBalanceRules(input: {
  userId: string;
  evmWalletId?: string;
  onlyLow?: boolean;
  includeDisabled?: boolean;
}) {
  return prisma.x402EvmWalletLowBalanceRule.findMany({
    where: {
      evmWalletId: input.evmWalletId,
      enabled: input.includeDisabled ? undefined : true,
      status: input.onlyLow ? LowBalanceStatus.Low : undefined,
      EvmWallet: { userId: input.userId, deletedAt: null },
    },
    orderBy: { createdAt: "desc" },
    select: RULE_SELECT,
  });
}

export async function updateX402LowBalanceRule(input: {
  userId: string;
  ruleId: string;
  thresholdAmount?: string;
  enabled?: boolean;
}) {
  await assertRuleOwnedByUser(input.userId, input.ruleId);
  const thresholdAmount =
    input.thresholdAmount != null ? BigInt(input.thresholdAmount) : undefined;
  if (thresholdAmount != null && thresholdAmount < 0n) {
    throw createHttpError(400, "thresholdAmount must not be negative");
  }
  return prisma.x402EvmWalletLowBalanceRule.update({
    where: { id: input.ruleId },
    data: {
      thresholdAmount,
      enabled: input.enabled,
      ...(thresholdAmount != null ? { status: LowBalanceStatus.Unknown } : {}),
    },
    select: RULE_SELECT,
  });
}

export async function deleteX402LowBalanceRule(userId: string, ruleId: string) {
  await assertRuleOwnedByUser(userId, ruleId);
  await prisma.x402EvmWalletLowBalanceRule.delete({ where: { id: ruleId } });
  return { ruleId, deletedAt: new Date() };
}

export type X402LowBalanceAlert = {
  userId: string;
  ruleId: string;
  evmWalletId: string;
  walletAddress: string;
  walletType: X402EvmWalletType;
  caip2Network: string;
  asset: string;
  thresholdAmount: string;
  currentAmount: string;
  checkedAt: string;
};

/**
 * Evaluates every enabled low-balance rule against live on-chain balances, advances each
 * rule's state machine (Unknown/Healthy ⇄ Low), and returns the alerts for rules that just
 * transitioned INTO Low. When `userId` is given, only that tenant's wallets are evaluated.
 */
export async function evaluateX402LowBalanceRules(
  userId?: string,
): Promise<X402LowBalanceAlert[]> {
  const rules = await prisma.x402EvmWalletLowBalanceRule.findMany({
    where: {
      enabled: true,
      EvmWallet: {
        deletedAt: null,
        ...(userId != null ? { userId } : {}),
      },
    },
    select: {
      id: true,
      caip2Network: true,
      asset: true,
      thresholdAmount: true,
      status: true,
      EvmWallet: {
        select: { id: true, userId: true, address: true, type: true },
      },
    },
  });
  if (rules.length === 0) return [];

  const checkedAt = new Date();
  const alerts: X402LowBalanceAlert[] = [];

  for (const rule of rules) {
    const network = await prisma.x402Network.findUnique({
      where: {
        userId_caip2Id: {
          userId: rule.EvmWallet.userId,
          caip2Id: rule.caip2Network,
        },
      },
      select: {
        caip2Id: true,
        rpcUrl: true,
        displayName: true,
        isEnabled: true,
      },
    });
    if (network == null || !network.isEnabled) continue;
    try {
      const client = buildPublicClient(network);
      await assertRpcServesDeclaredChain(client, rule.caip2Network);
      const amount = await readAssetAmount(
        client,
        rule.EvmWallet.address as HexAddress,
        rule.asset,
      );
      const nextStatus = computeLowBalanceStatus(amount, rule.thresholdAmount);
      const transitionedToLow =
        nextStatus === LowBalanceStatus.Low &&
        rule.status !== LowBalanceStatus.Low;

      await prisma.x402EvmWalletLowBalanceRule.update({
        where: { id: rule.id },
        data: {
          status: nextStatus,
          lastKnownAmount: amount,
          lastCheckedAt: checkedAt,
          ...(transitionedToLow ? { lastAlertedAt: checkedAt } : {}),
        },
      });

      if (transitionedToLow) {
        alerts.push({
          userId: rule.EvmWallet.userId,
          ruleId: rule.id,
          evmWalletId: rule.EvmWallet.id,
          walletAddress: rule.EvmWallet.address,
          walletType: rule.EvmWallet.type,
          caip2Network: rule.caip2Network,
          asset: rule.asset,
          thresholdAmount: rule.thresholdAmount.toString(),
          currentAmount: amount.toString(),
          checkedAt: checkedAt.toISOString(),
        });
      }
    } catch (error) {
      logger.warn("x402 low-balance check failed for a rule", {
        ruleId: rule.id,
        error,
      });
    }
  }

  return alerts;
}
