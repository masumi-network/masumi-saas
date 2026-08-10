import { afterEach, describe, expect, it } from "vitest";

import { getNetworkRegisterCapabilities } from "./registry-capabilities";

describe("getNetworkRegisterCapabilities", () => {
  afterEach(() => {
    delete process.env.PAYMENT_NODE_SUPPORTS_EXTERNAL_REGISTRY_RECIPIENT;
    delete process.env.PAYMENT_NODE_BASE_URL;
  });

  it("defaults to false for remote payment nodes", () => {
    process.env.PAYMENT_NODE_BASE_URL = "https://payment.masumi.network/api/v1";
    expect(getNetworkRegisterCapabilities().browserWalletMintSupported).toBe(
      false,
    );
  });

  it("enables browser mint for localhost payment nodes", () => {
    process.env.PAYMENT_NODE_BASE_URL = "http://localhost:3001/api/v1";
    expect(getNetworkRegisterCapabilities().browserWalletMintSupported).toBe(
      true,
    );
  });

  it("respects explicit env override", () => {
    process.env.PAYMENT_NODE_BASE_URL = "https://payment.masumi.network/api/v1";
    process.env.PAYMENT_NODE_SUPPORTS_EXTERNAL_REGISTRY_RECIPIENT = "true";
    expect(getNetworkRegisterCapabilities().browserWalletMintSupported).toBe(
      true,
    );
  });
});
