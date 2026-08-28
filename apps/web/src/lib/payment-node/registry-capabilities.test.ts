import { afterEach, describe, expect, it, vi } from "vitest";

const { listSettleablePaymentNodeX402NetworksMock } = vi.hoisted(() => ({
  listSettleablePaymentNodeX402NetworksMock: vi.fn(),
}));

vi.mock("@/lib/payment-node/resolve-payment-node-x402-network", () => ({
  listSettleablePaymentNodeX402Networks:
    listSettleablePaymentNodeX402NetworksMock,
}));

import {
  fetchNetworkRegisterCapabilities,
  getNetworkRegisterCapabilities,
} from "./registry-capabilities";

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

describe("fetchNetworkRegisterCapabilities", () => {
  afterEach(() => {
    delete process.env.PAYMENT_NODE_SUPPORTS_EXTERNAL_REGISTRY_RECIPIENT;
    delete process.env.PAYMENT_NODE_BASE_URL;
    listSettleablePaymentNodeX402NetworksMock.mockReset();
  });

  it("returns settleable x402 networks from the payment node", async () => {
    process.env.PAYMENT_NODE_BASE_URL = "http://localhost:3005/api/v1";
    listSettleablePaymentNodeX402NetworksMock.mockResolvedValue([
      {
        caip2Id: "eip155:84532",
        displayName: "Base Sepolia",
        isTestnet: true,
        defaultAsset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      },
    ]);

    await expect(fetchNetworkRegisterCapabilities()).resolves.toEqual({
      browserWalletMintSupported: true,
      x402SettleableNetworks: [
        {
          caip2Id: "eip155:84532",
          displayName: "Base Sepolia",
          isTestnet: true,
          defaultAsset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        },
      ],
    });
  });

  it("returns an empty list when the payment node lookup fails", async () => {
    process.env.PAYMENT_NODE_BASE_URL = "http://localhost:3005/api/v1";
    listSettleablePaymentNodeX402NetworksMock.mockRejectedValue(
      new Error("payment node unavailable"),
    );

    await expect(fetchNetworkRegisterCapabilities()).resolves.toEqual({
      browserWalletMintSupported: true,
      x402SettleableNetworks: [],
    });
  });
});
