import { describe, expect, it, vi } from "vitest";

import type { RegistryInboxEntry } from "@/lib/payment-node";

import { findActiveRegistryInboxBySlug } from "./registry-slug-lookup";

function entry(id: string, agentSlug: string): RegistryInboxEntry {
  return { id, agentSlug } as RegistryInboxEntry;
}

describe("findActiveRegistryInboxBySlug", () => {
  it("runs one unfiltered scan when no contract addresses are given", async () => {
    const getRegistryInbox = vi.fn(async () => ({
      Assets: [entry("a", "support-inbox")],
    }));

    const result = await findActiveRegistryInboxBySlug({
      client: { getRegistryInbox },
      network: "Preprod",
      slug: "support-inbox",
      smartContractAddresses: [],
      isActive: () => true,
    });

    expect(result?.id).toBe("a");
    expect(getRegistryInbox).toHaveBeenCalledTimes(1);
    expect(getRegistryInbox).toHaveBeenCalledWith(
      expect.objectContaining({ filterSmartContractAddress: undefined }),
    );
  });

  it("scans each distinct contract once and ignores near-miss slugs", async () => {
    const getRegistryInbox = vi.fn(async ({ cursorId }) =>
      cursorId ? { Assets: [] } : { Assets: [entry("x", "support-inbox-2")] },
    );

    const result = await findActiveRegistryInboxBySlug({
      client: { getRegistryInbox },
      network: "Preprod",
      slug: "support-inbox",
      smartContractAddresses: ["addr_v1", "addr_v2", "addr_v2"],
      isActive: () => true,
    });

    expect(result).toBeNull();
    const scannedContracts = new Set(
      getRegistryInbox.mock.calls.map(
        ([params]) => params.filterSmartContractAddress,
      ),
    );
    expect(scannedContracts).toStrictEqual(new Set(["addr_v1", "addr_v2"]));
  });
});
