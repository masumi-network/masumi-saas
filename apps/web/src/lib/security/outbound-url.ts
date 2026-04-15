import "server-only";

import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

const blockedAddressRanges = new BlockList();
blockedAddressRanges.addSubnet("0.0.0.0", 8, "ipv4");
blockedAddressRanges.addSubnet("10.0.0.0", 8, "ipv4");
blockedAddressRanges.addSubnet("100.64.0.0", 10, "ipv4");
blockedAddressRanges.addSubnet("127.0.0.0", 8, "ipv4");
blockedAddressRanges.addSubnet("169.254.0.0", 16, "ipv4");
blockedAddressRanges.addSubnet("172.16.0.0", 12, "ipv4");
blockedAddressRanges.addSubnet("192.168.0.0", 16, "ipv4");
blockedAddressRanges.addSubnet("198.18.0.0", 15, "ipv4");
blockedAddressRanges.addSubnet("224.0.0.0", 4, "ipv4");
blockedAddressRanges.addSubnet("240.0.0.0", 4, "ipv4");
blockedAddressRanges.addAddress("::", "ipv6");
blockedAddressRanges.addAddress("::1", "ipv6");
blockedAddressRanges.addSubnet("fc00::", 7, "ipv6");
blockedAddressRanges.addSubnet("fe80::", 10, "ipv6");

function isStrictOutboundPolicyEnabled(): boolean {
  return process.env.NODE_ENV === "production";
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "localhost" || normalized.endsWith(".localhost");
}

function getIpFamily(address: string): "ipv4" | "ipv6" | null {
  const family = isIP(address);
  if (family === 4) return "ipv4";
  if (family === 6) return "ipv6";
  return null;
}

function getEmbeddedIpv4(address: string): string | null {
  const normalized = address.trim().toLowerCase();
  if (!normalized.startsWith("::ffff:")) {
    return null;
  }

  const embedded = normalized.slice("::ffff:".length);
  return isIP(embedded) === 4 ? embedded : null;
}

function isBlockedResolvedAddress(address: string): boolean {
  const embeddedIpv4 = getEmbeddedIpv4(address);
  if (embeddedIpv4) {
    return isBlockedResolvedAddress(embeddedIpv4);
  }

  const family = getIpFamily(address);
  if (!family) {
    return true;
  }

  return blockedAddressRanges.check(address, family);
}

async function resolveOutboundAddresses(hostname: string): Promise<string[]> {
  if (isLocalHostname(hostname)) {
    return ["127.0.0.1"];
  }

  const family = getIpFamily(hostname);
  if (family) {
    return [hostname];
  }

  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

export class OutboundUrlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutboundUrlValidationError";
  }
}

export async function assertAllowedAgentApiUrl(rawUrl: string): Promise<URL> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new OutboundUrlValidationError("API URL must be a valid URL.");
  }

  if (!ALLOWED_PROTOCOLS.has(parsedUrl.protocol)) {
    throw new OutboundUrlValidationError(
      "API URL must start with http:// or https://.",
    );
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new OutboundUrlValidationError(
      "API URL must not include embedded credentials.",
    );
  }

  if (!isStrictOutboundPolicyEnabled()) {
    return parsedUrl;
  }

  if (parsedUrl.protocol !== "https:") {
    throw new OutboundUrlValidationError(
      "API URL must use HTTPS in production.",
    );
  }

  let addresses: string[];
  try {
    addresses = await resolveOutboundAddresses(parsedUrl.hostname);
  } catch {
    throw new OutboundUrlValidationError("API URL host could not be resolved.");
  }

  if (addresses.length === 0) {
    throw new OutboundUrlValidationError("API URL host could not be resolved.");
  }

  if (addresses.some((address) => isBlockedResolvedAddress(address))) {
    throw new OutboundUrlValidationError(
      "API URL must resolve to a public internet host in production.",
    );
  }

  return parsedUrl;
}
