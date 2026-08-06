import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config/verification.config", () => ({
  isKycVerificationEnabled: () => true,
}));

import {
  buildNetworkRegistrationPayload,
  buildNetworkSiteSuccessUrl,
} from "./index";

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
    network: "eip155:84532",
    asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    amount: "2000000",
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

  it("allows registration without x402 payment details", () => {
    const { payment: _payment, ...withoutPayment } = base;
    const payload = buildNetworkRegistrationPayload({
      ...withoutPayment,
      mint: {
        kyc: "skip",
        destination: "managed",
      },
    });
    expect(payload.payment).toBeUndefined();
    expect(payload.effectiveDestination).toBe("managed");
  });
});

describe("buildNetworkSiteSuccessUrl", () => {
  afterEach(() => {
    delete process.env.NETWORK_SITE_URL;
    delete process.env.NEXT_PUBLIC_NETWORK_SITE_URL;
  });

  it("returns an absolute marketing-site success URL", () => {
    process.env.NETWORK_SITE_URL = "http://localhost:3010";
    expect(buildNetworkSiteSuccessUrl("agent-123")).toBe(
      "http://localhost:3010/register/success?agentId=agent-123",
    );
  });
});
