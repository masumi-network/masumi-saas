import { describe, expect, it } from "vitest";

import { getRegistryListFilters } from "./registry-lookup";

describe("getRegistryListFilters", () => {
  it("does not include Web3CardanoV1 list filters", () => {
    for (const filter of getRegistryListFilters("Preprod")) {
      expect(filter.filterPaymentSourceType).not.toBe("Web3CardanoV1");
    }
  });
});
