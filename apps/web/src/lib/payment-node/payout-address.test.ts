import { describe, expect, it } from "vitest";

import {
  normalizePayoutAddress,
  validatePayoutAddressForNetwork,
} from "./payout-address";

describe("validatePayoutAddressForNetwork", () => {
  it("accepts a Preprod address on Preprod", () => {
    expect(
      validatePayoutAddressForNetwork(
        "addr_test1qqexamplepayoutaddressqqexamplepayoutqq",
        "Preprod",
      ),
    ).toBeNull();
  });

  it("rejects Mainnet addresses on Preprod", () => {
    expect(
      validatePayoutAddressForNetwork("addr1examplepayoutaddress", "Preprod"),
    ).toBe("Payout address must be a Preprod Cardano address (addr_test…).");
  });

  it("trims whitespace before validating", () => {
    expect(
      validatePayoutAddressForNetwork(
        "  addr_test1qqexamplepayoutaddressqqexamplepayoutqq  ",
        "Preprod",
      ),
    ).toBeNull();
    expect(normalizePayoutAddress("  addr_test1x  ")).toBe("addr_test1x");
  });
});
