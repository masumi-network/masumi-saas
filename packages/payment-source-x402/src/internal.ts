import { lookup as dnsLookup } from "node:dns/promises";

import { X402EvmWalletType } from "@masumi/database";
import prisma from "@masumi/database/client";
import createHttpError from "http-errors";
import { createPublicClient, defineChain, http } from "viem";

import { logger } from "./logger.js";
import {
  activeWalletWhere,
  networkOwnershipWhere,
  resolveX402TenantScope,
  type X402ScopeInput,
} from "./tenant-scope.js";

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
  // Non-standard numeric encodings (decimal int "2130706433", hex "0x7f000001",
  // octal, or short-form dotted "127.1") are not caught by the dotted-quad
  // check above but still resolve to internal IPs. Treat any all-numeric /
  // hex host that is not a clean public dotted-quad as unsafe.
  if (/^0x[0-9a-f]+$/i.test(host)) return true;
  if (/^[0-9.]+$/.test(host)) return true;
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

/**
 * DNS-aware SSRF guard. `assertSafeRpcUrl` only inspects the hostname string, so
 * a public DNS name that resolves to an internal address (169.254.169.254,
 * 10.x, loopback, …) would slip through. Resolve the host and reject if ANY
 * resolved address is private/loopback/link-local. Call this at the persist and
 * probe boundaries so a malicious endpoint is rejected before it is stored or
 * reached. Note: this does not fully close request-time DNS rebinding on
 * already-stored URLs (a pinned-lookup dispatcher would be required for that).
 */
export async function assertSafeRpcUrlResolved(rpcUrl: string): Promise<void> {
  assertSafeRpcUrl(rpcUrl);
  const { hostname } = new URL(rpcUrl);
  const host = hostname.replace(/^\[|\]$/g, "");
  // Literal IPs are already fully validated by assertSafeRpcUrl.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":")) return;

  let resolved: { address: string }[];
  try {
    resolved = await dnsLookup(host, { all: true });
  } catch {
    throw createHttpError(
      400,
      "x402 network rpcUrl host could not be resolved",
    );
  }
  if (resolved.some((entry) => isPrivateHost(entry.address))) {
    throw createHttpError(
      400,
      "x402 network rpcUrl must not resolve to a private, loopback or link-local address",
    );
  }
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

export type X402RpcProbeFailureReason =
  | "invalid_caip2"
  | "invalid_url"
  | "unreachable"
  | "chain_mismatch";

export type X402RpcProbeResult =
  | { ok: true; chainId: number }
  | {
      ok: false;
      reason: X402RpcProbeFailureReason;
      message: string;
      actualChainId?: number;
      expectedChainId?: number;
    };

export async function probeX402NetworkRpc(input: {
  caip2Id: string;
  rpcUrl: string;
  displayName?: string;
}): Promise<X402RpcProbeResult> {
  let expectedChainId: number;
  try {
    expectedChainId = getEip155ChainId(input.caip2Id);
  } catch {
    return {
      ok: false,
      reason: "invalid_caip2",
      message: "x402 network must be a CAIP-2 eip155 chain id",
    };
  }

  try {
    await assertSafeRpcUrlResolved(input.rpcUrl);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "x402 network rpcUrl must be a valid URL";
    return { ok: false, reason: "invalid_url", message };
  }

  const chain = createChain(
    input.caip2Id,
    input.rpcUrl,
    input.displayName ?? "x402",
  );
  const client = createPublicClient({
    chain,
    transport: safeHttpTransport(input.rpcUrl),
  });

  let actualChainId: number;
  try {
    actualChainId = await client.getChainId();
  } catch (error) {
    logger.warn("x402 network RPC probe failed to reach endpoint", {
      caip2Id: input.caip2Id,
      error,
    });
    return {
      ok: false,
      reason: "unreachable",
      message: "RPC endpoint is unreachable or did not respond",
    };
  }

  if (actualChainId !== expectedChainId) {
    return {
      ok: false,
      reason: "chain_mismatch",
      message: `RPC serves chain id ${actualChainId} but ${input.caip2Id} expects ${expectedChainId}`,
      actualChainId,
      expectedChainId,
    };
  }

  return { ok: true, chainId: actualChainId };
}

export async function getX402NetworkOrThrow(
  scopeInput: X402ScopeInput,
  caip2Network: string,
) {
  const scope = resolveX402TenantScope(scopeInput);
  const network = await prisma.x402Network.findFirst({
    where: {
      ...networkOwnershipWhere(scope),
      caip2Id: caip2Network,
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
  scopeInput: X402ScopeInput,
  evmWalletId: string,
  expectedType?: X402EvmWalletType,
) {
  const scope = resolveX402TenantScope(scopeInput);
  const wallet = await prisma.x402EvmWallet.findFirst({
    where: { id: evmWalletId, ...activeWalletWhere(scope) },
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
