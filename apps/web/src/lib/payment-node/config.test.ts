import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { paymentNodeConfig } from "./config";
import { isPaymentNodeConfigured } from "./health";

const ENV_KEYS = [
  "PAYMENT_NODE_BASE_URL",
  "PAYMENT_NODE_ADMIN_API_KEY",
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

describe("paymentNodeConfig", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
    process.env.PAYMENT_NODE_BASE_URL = "https://payment.example.com/api/v1";
    process.env.PAYMENT_NODE_ADMIN_API_KEY = "admin-key";
  });

  afterEach(() => {
    restoreEnv();
  });

  it("resolves the Preprod and Mainnet payment source ids independently", () => {
    process.env.PAYMENT_NODE_PAYMENT_SOURCE_ID_PREPROD = "source-preprod";
    process.env.PAYMENT_NODE_PAYMENT_SOURCE_ID_MAINNET = "source-mainnet";

    expect(paymentNodeConfig.getPaymentSourceId("Preprod")).toBe(
      "source-preprod",
    );
    expect(paymentNodeConfig.getPaymentSourceId("Mainnet")).toBe(
      "source-mainnet",
    );
  });

  it("returns network-specific smart contract overrides", () => {
    process.env.PAYMENT_NODE_SMART_CONTRACT_ADDRESS_PREPROD = "addr_test1pre";
    process.env.PAYMENT_NODE_SMART_CONTRACT_ADDRESS_MAINNET = "addr1main";

    expect(paymentNodeConfig.tryGetSmartContractAddress("Preprod")).toBe(
      "addr_test1pre",
    );
    expect(paymentNodeConfig.tryGetSmartContractAddress("Mainnet")).toBe(
      "addr1main",
    );
  });

  it("treats missing Preprod source config as payment-node config missing", () => {
    process.env.PAYMENT_NODE_PAYMENT_SOURCE_ID_MAINNET = "source-mainnet";

    expect(isPaymentNodeConfigured()).toBe(false);
  });

  it("throws a network-specific error when Mainnet source config is missing", () => {
    process.env.PAYMENT_NODE_PAYMENT_SOURCE_ID_PREPROD = "source-preprod";

    expect(() => paymentNodeConfig.getPaymentSourceId("Mainnet")).toThrow(
      "PAYMENT_NODE_PAYMENT_SOURCE_ID_MAINNET is required for Mainnet payment-source operations",
    );
  });
});
