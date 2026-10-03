import { describe, expect, it, vi } from "vitest";

import { findRegistryInboxById } from "./registry-inbox-lookup";
import type { RegistryInboxEntry } from "./schemas";

const V2_CONTRACT = "addr_test1v2contract";

function entry(id: string): RegistryInboxEntry {
  return { id } as RegistryInboxEntry;
}

describe("findRegistryInboxById", () => {
  it("scopes the scan to the given smart contract so V2 entries are found", async () => {
    const list = vi.fn(async ({ filterSmartContractAddress, cursorId }) =>
      filterSmartContractAddress === V2_CONTRACT && !cursorId
        ? { Assets: [entry("v2-inbox")] }
        : { Assets: [] },
    );

    const result = await findRegistryInboxById(list, {
      id: "v2-inbox",
      network: "Preprod",
      filterSmartContractAddress: V2_CONTRACT,
    });

    expect(result?.id).toBe("v2-inbox");
    expect(list).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledWith({
      network: "Preprod",
      cursorId: undefined,
      limit: 100,
      filterSmartContractAddress: V2_CONTRACT,
    });
  });

  it("does not fall back to the unfiltered V1 list when the scoped scan misses", async () => {
    const list = vi.fn(async ({ filterSmartContractAddress, cursorId }) =>
      filterSmartContractAddress === undefined && !cursorId
        ? { Assets: [entry("v1-inbox")] }
        : { Assets: [] },
    );

    const result = await findRegistryInboxById(list, {
      id: "v1-inbox",
      network: "Preprod",
      filterSmartContractAddress: V2_CONTRACT,
    });

    expect(result).toBeNull();
    expect(list).toHaveBeenCalledTimes(1);
  });

  it("finds a scoped V2 entry on a later page", async () => {
    const list = vi.fn(async ({ filterSmartContractAddress, cursorId }) => {
      if (filterSmartContractAddress !== V2_CONTRACT) return { Assets: [] };
      return cursorId === "page-1-last"
        ? { Assets: [entry("page-1-last"), entry("v2-inbox")] }
        : { Assets: [entry("other"), entry("page-1-last")] };
    });

    const result = await findRegistryInboxById(list, {
      id: "v2-inbox",
      network: "Preprod",
      filterSmartContractAddress: V2_CONTRACT,
    });

    expect(result?.id).toBe("v2-inbox");
    expect(list).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cursorId: "page-1-last",
        filterSmartContractAddress: V2_CONTRACT,
      }),
    );
  });

  it("scans once and returns null when no contract is given and nothing matches", async () => {
    const list = vi.fn(async () => ({ Assets: [] }));

    const result = await findRegistryInboxById(list, {
      id: "missing",
      network: "Preprod",
      filterSmartContractAddress: null,
    });

    expect(result).toBeNull();
    expect(list).toHaveBeenCalledTimes(1);
  });

  it("pages with the last asset id as cursor", async () => {
    const list = vi.fn(async ({ cursorId }) =>
      cursorId === "a"
        ? { Assets: [entry("target")] }
        : { Assets: [entry("a")] },
    );

    const result = await findRegistryInboxById(list, {
      id: "target",
      network: "Preprod",
    });

    expect(result?.id).toBe("target");
    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursorId: "a" }),
    );
  });
});
