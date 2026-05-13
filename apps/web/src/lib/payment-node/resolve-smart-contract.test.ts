import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PaymentNodeClient } from "./client";
import {
  clearSmartContractAddressCache,
  getSmartContractAddressForConfiguredSource,
} from "./resolve-smart-contract";

const ENV_KEYS = [
  "PAYMENT_NODE_PAYMENT_SOURCE_ID_PREPROD",
  "PAYMENT_NODE_PAYMENT_SOURCE_ID_MAINNET",
  "PAYMENT_NODE_SMART_CONTRACT_ADDRESS_PREPROD",
  "PAYMENT_NODE_SMART_CONTRACT_ADDRESS_MAINNET",
] as const;

const ORIGINAL_ENV = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof ENV_KEYS)[number], string | undefined>;

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = ORIGINAL_ENV[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("getSmartContractAddressForConfiguredSource", () => {
  beforeEach(() => {
    clearSmartContractAddressCache();
    vi.clearAllMocks();
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    clearSmartContractAddressCache();
    restoreEnv();
  });

  it("keeps cache entries separate for Preprod and Mainnet", async () => {
    process.env.PAYMENT_NODE_PAYMENT_SOURCE_ID_PREPROD = "source-preprod";
    process.env.PAYMENT_NODE_PAYMENT_SOURCE_ID_MAINNET = "source-mainnet";

    const getPaymentSources = vi
      .fn()
      .mockResolvedValueOnce({
        PaymentSources: [
          {
            id: "source-preprod",
            smartContractAddress: "addr_test1preprod",
          },
        ],
      })
      .mockResolvedValueOnce({
        PaymentSources: [
          {
            id: "source-mainnet",
            smartContractAddress: "addr1mainnet",
          },
        ],
      });

    const client = {
      getPaymentSources,
    } as unknown as PaymentNodeClient;

    expect(
      await getSmartContractAddressForConfiguredSource(
        client,
        "user-1",
        "Preprod",
      ),
    ).toBe("addr_test1preprod");
    expect(
      await getSmartContractAddressForConfiguredSource(
        client,
        "user-1",
        "Preprod",
      ),
    ).toBe("addr_test1preprod");
    expect(
      await getSmartContractAddressForConfiguredSource(
        client,
        "user-1",
        "Mainnet",
      ),
    ).toBe("addr1mainnet");

    expect(getPaymentSources).toHaveBeenCalledTimes(2);
  });

  it("uses the network-specific env override before querying payment sources", async () => {
    process.env.PAYMENT_NODE_SMART_CONTRACT_ADDRESS_PREPROD = "addr_test1env";

    const client = {
      getPaymentSources: vi.fn(),
    } as unknown as PaymentNodeClient;

    await expect(
      getSmartContractAddressForConfiguredSource(client, "user-1", "Preprod"),
    ).resolves.toBe("addr_test1env");
    expect(client.getPaymentSources).not.toHaveBeenCalled();
  });
});
