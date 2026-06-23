import { X402EvmWalletType } from "@masumi/database";
import prisma from "@masumi/database/client";
import createHttpError from "http-errors";
import { defineChain, http } from "viem";

import { logger } from "./logger.js";

export type HexAddress = `0x${string}`;
export type PrivateKey = `0x${string}`;

export const RPC_REQUEST_TIMEOUT_MS = 30_000;

export function getEip155ChainId(caip2Network: string): number {
  const match = /^eip155:(\d+)$/.exec(caip2Network);
  if (match == null) {
    throw createHttpError(400, "x402 network must be a CAIP-2 eip155 chain id");
  }
  const chainId = Number(match[1]);
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    throw createHttpError(400, "x402 eip155 chain id is out of range");
  }
  return chainId;
}

export function normalizeAddress(value: string): string {
  return value.toLowerCase();
}

export function assertHexAddress(
  value: string,
  label: string,
): asserts value is HexAddress {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw createHttpError(400, `${label} must be an EVM address`);
  }
}

export function assertValidPrivateKey(
  value: string,
): asserts value is PrivateKey {
  if (!/^0x[a-fA-F0-9]{64}$/.test(value)) {
    throw createHttpError(
      400,
      "x402 wallet private key must be a 0x-prefixed 32-byte hex string",
    );
  }
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((part) => Number(part));
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0 || a === 127) return true;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.includes(":")) {
    if (host === "::1" || host === "::") return true;
    if (
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      /^fe[89ab]/.test(host)
    )
      return true;
    const mapped = /::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(host);
    if (mapped != null) return isPrivateIpv4(mapped[1]);
    return false;
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return isPrivateIpv4(host);
  return false;
}

export function assertSafeRpcUrl(rpcUrl: string): void {
  let url: URL;
  try {
    url = new URL(rpcUrl);
  } catch {
    throw createHttpError(400, "x402 network rpcUrl must be a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw createHttpError(400, "x402 network rpcUrl must use http or https");
  }
  if (isPrivateHost(url.hostname)) {
    throw createHttpError(
      400,
      "x402 network rpcUrl must not target a private, loopback or link-local address",
    );
  }
}

export function safeHttpTransport(rpcUrl: string) {
  assertSafeRpcUrl(rpcUrl);
  return http(rpcUrl, { timeout: RPC_REQUEST_TIMEOUT_MS });
}

export function createChain(
  caip2Network: string,
  rpcUrl: string,
  displayName: string,
) {
  const chainId = getEip155ChainId(caip2Network);

  return defineChain({
    id: chainId,
    name: displayName,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: [rpcUrl] },
    },
  });
}

export async function assertRpcServesDeclaredChain(
  client: { getChainId: () => Promise<number> },
  caip2Network: string,
) {
  const expectedChainId = getEip155ChainId(caip2Network);
  let actualChainId: number;
  try {
    actualChainId = await client.getChainId();
  } catch (error) {
    logger.error(
      "x402 network RPC is unreachable while verifying its chain id",
      { caip2Network, error },
    );
    throw createHttpError(502, "x402 network RPC is unreachable");
  }
  if (actualChainId !== expectedChainId) {
    logger.error(
      "x402 network RPC serves a different chain than its configured CAIP-2 id",
      { caip2Network, expectedChainId, actualChainId },
    );
    throw createHttpError(
      502,
      `x402 network RPC serves chain id ${actualChainId} but ${caip2Network} expects ${expectedChainId}`,
    );
  }
}

export async function getX402NetworkOrThrow(
  userId: string,
  caip2Network: string,
) {
  const network = await prisma.x402Network.findUnique({
    where: {
      userId_caip2Id: {
        userId,
        caip2Id: caip2Network,
      },
    },
    include: {
      FacilitatorWallet: true,
    },
  });
  if (network == null || !network.isEnabled) {
    throw createHttpError(404, "x402 network is not enabled");
  }
  return network;
}

export async function getManagedWalletOrThrow(
  userId: string,
  evmWalletId: string,
  expectedType?: X402EvmWalletType,
) {
  const wallet = await prisma.x402EvmWallet.findFirst({
    where: { id: evmWalletId, userId, deletedAt: null },
  });
  if (wallet == null) {
    throw createHttpError(404, "Managed EVM wallet not found");
  }
  if (expectedType != null && wallet.type !== expectedType) {
    throw createHttpError(
      400,
      expectedType === X402EvmWalletType.Purchasing
        ? "Managed EVM wallet is not a Purchasing wallet"
        : "Managed EVM wallet is not a Selling wallet",
    );
  }
  return wallet;
}
