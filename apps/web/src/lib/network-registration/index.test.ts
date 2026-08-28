import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config/verification.config", () => ({
  isKycVerificationEnabled: () => true,
}));

import {
  buildNetworkRegistrationPayload,
  buildNetworkSiteContinueUrl,
  buildNetworkSiteSuccessUrl,
  resolveNetworkRegistrationCommerceForTest,
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
  afterEach(() => {
    delete process.env.PAYMENT_NODE_SUPPORTS_EXTERNAL_REGISTRY_RECIPIENT;
    delete process.env.PAYMENT_NODE_BASE_URL;
  });

  it("keeps browser destination with connected address when supported", () => {
    process.env.PAYMENT_NODE_SUPPORTS_EXTERNAL_REGISTRY_RECIPIENT = "true";
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

  it("rejects browser destination when payment node does not support it", () => {
    process.env.PAYMENT_NODE_BASE_URL = "https://payment.masumi.network/api/v1";
    expect(() =>
      buildNetworkRegistrationPayload({
        ...base,
        mint: {
          kyc: "skip",
          destination: "browser",
          cardanoAddress: "addr_test1qxyz",
        },
      }),
    ).toThrow(/not available yet/i);
  });

  it("requires KYC for external address", () => {
    expect(() =>
      buildNetworkRegistrationPayload({
        ...base,
        mint: {
          kyc: "skip",
          destination: "external",
          cardanoAddress: "addr_test1qxyz",
        },
      }),
    ).toThrow(/KYC/);
  });

  it("accepts external address after KYC", () => {
    const payload = buildNetworkRegistrationPayload({
      ...base,
      mint: {
        kyc: "kyc",
        destination: "external",
        cardanoAddress: "addr_test1qxyz",
      },
    });
    expect(payload.effectiveDestination).toBe("external");
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

describe("resolveNetworkRegistrationCommerce", () => {
  it("uses dynamic Cardano pricing even without x402", () => {
    const payload = buildNetworkRegistrationPayload({
      ...base,
      payment: undefined,
      mint: { kyc: "skip", destination: "managed" },
    });
    const commerce = resolveNetworkRegistrationCommerceForTest(payload);
    expect(commerce.agentPricing).toEqual({ pricingType: "Dynamic" });
    expect(commerce.supportedPaymentSources).toBeUndefined();
  });

  it("keeps dynamic Cardano pricing when x402 payment is included", () => {
    const payload = buildNetworkRegistrationPayload({
      ...base,
      mint: { kyc: "skip", destination: "managed" },
    });
    const commerce = resolveNetworkRegistrationCommerceForTest(payload);
    expect(commerce.agentPricing).toEqual({ pricingType: "Dynamic" });
    expect(commerce.supportedPaymentSources).toHaveLength(1);
    expect(commerce.supportedPaymentSources?.[0]?.pricing.pricingType).toBe(
      "Fixed",
    );
  });
});

describe("buildNetworkSiteSuccessUrl", () => {
  afterEach(() => {
    delete process.env.NETWORK_SITE_URL;
    delete process.env.NEXT_PUBLIC_NETWORK_SITE_URL;
  });

  it("returns an absolute marketing-site success URL", () => {
    process.env.NETWORK_SITE_URL = "http://localhost:3001";
    expect(buildNetworkSiteSuccessUrl("agent-123")).toBe(
      "http://localhost:3001/register/success?agentId=agent-123",
    );
  });
});

describe("buildNetworkSiteContinueUrl", () => {
  afterEach(() => {
    delete process.env.NETWORK_SITE_URL;
    delete process.env.NEXT_PUBLIC_NETWORK_SITE_URL;
  });

  it("includes draftId and pollToken for pending registration polling", () => {
    process.env.NETWORK_SITE_URL = "http://localhost:3001";
    expect(
      buildNetworkSiteContinueUrl(
        "draft-1",
        "agent-123",
        "Research Bot",
        "poll-token-abc",
      ),
    ).toBe(
      "http://localhost:3001/register/success?agentId=agent-123&draftId=draft-1&agentName=Research+Bot&pollToken=poll-token-abc",
    );
  });
});
