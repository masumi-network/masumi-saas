import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config/verification.config", () => ({
  isKycVerificationEnabled: () => true,
}));

import { buildNetworkRegistrationPayload } from "./index";

const base = {
  name: "Ada",
  email: "ada@example.com",
  termsAccepted: true as const,
  agent: {
    name: "Agent",
    apiUrl: "https://example.com",
    tags: "research",
  },
  payment: {
    network: "eip155:8453",
    asset: "USDC",
    amount: "2.00",
    decimals: 6,
    payTo: "0x0000000000000000000000000000000000000001",
  },
  cardanoNetwork: "Preprod" as const,
};

describe("buildNetworkRegistrationPayload", () => {
  it("keeps browser destination with connected address", () => {
    const payload = buildNetworkRegistrationPayload({
      ...base,
      mint: {
        kyc: "skip",
        destination: "browser",
        cardanoAddress: "addr_test1qxyz",
      },
    });
    expect(payload.effectiveDestination).toBe("browser");
    expect(payload.mint.cardanoAddress).toContain("addr_test1");
  });

  it("requires KYC for paper", () => {
    expect(() =>
      buildNetworkRegistrationPayload({
        ...base,
        mint: {
          kyc: "skip",
          destination: "paper",
          cardanoAddress: "addr_test1qxyz",
        },
      }),
    ).toThrow(/KYC/);
  });

  it("accepts paper after KYC", () => {
    const payload = buildNetworkRegistrationPayload({
      ...base,
      mint: {
        kyc: "kyc",
        destination: "paper",
        cardanoAddress: "addr_test1qxyz",
      },
    });
    expect(payload.effectiveDestination).toBe("paper");
  });
});
