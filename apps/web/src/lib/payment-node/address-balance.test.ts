import { describe, expect, it, vi } from "vitest";

import {
  addressHasConfirmedBalance,
  formatLovelaceBalanceDisplay,
  readLovelaceFromBalanceAmounts,
  resolveAdaBalanceForAddresses,
} from "./address-balance";
import type { PaymentNodeClient } from "./client";

describe("address-balance", () => {
  it("sums lovelace entries and ignores other assets", () => {
    expect(
      readLovelaceFromBalanceAmounts([
        { unit: "lovelace", quantity: 1_500_000 },
        { unit: "", quantity: 500_000 },
        { unit: "policyasset", quantity: 42 },
      ]),
    ).toBe(2_000_000n);
  });

  it("treats empty balance as unfunded", () => {
    expect(addressHasConfirmedBalance([])).toBe(false);
    expect(
      addressHasConfirmedBalance([{ unit: "policyasset", quantity: 10 }]),
    ).toBe(false);
  });

  it("treats positive lovelace as funded", () => {
    expect(
      addressHasConfirmedBalance([{ unit: "lovelace", quantity: 1 }]),
    ).toBe(true);
  });

  it("formats ADA for dashboard display", () => {
    expect(formatLovelaceBalanceDisplay(2_500_000n)).toBe("2.5 ADA");
    expect(formatLovelaceBalanceDisplay(0n)).toBe("0 ADA");
  });

  it("sums balances for the provided addresses", async () => {
    const getBalance = vi
      .fn()
      .mockResolvedValueOnce({
        Balance: [{ unit: "lovelace", quantity: 1_000_000 }],
      })
      .mockResolvedValueOnce({
        Balance: [{ unit: "lovelace", quantity: 2_000_000 }],
      });
    const client = {
      getBalance,
    };

    const balance = await resolveAdaBalanceForAddresses(
      client as unknown as PaymentNodeClient,
      "Preprod",
      ["addr_test1one", "addr_test1two", "addr_test1one"],
    );

    expect(balance).toBe("3 ADA");
    expect(getBalance).toHaveBeenCalledTimes(2);
  });
});
