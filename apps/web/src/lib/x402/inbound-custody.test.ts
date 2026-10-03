import type { X402InboundPaymentNodeContext } from "@masumi/payment-source-x402";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  settleX402PaymentOnNode,
  verifyX402PaymentOnNode,
} from "./inbound-custody";

const mocks = vi.hoisted(() => ({
  reference: vi.fn(),
  registry: vi.fn(),
  verify: vi.fn(),
  settle: vi.fn(),
  admin: vi.fn(),
}));
vi.mock("@masumi/database/client", () => ({
  default: { agentReference: { findUnique: mocks.reference } },
}));
vi.mock("@/lib/payment-node/get-admin-client", () => ({
  tryCreateAdminPaymentNodeClient: mocks.admin,
}));

const requirements = {
  scheme: "exact",
  network: "eip155:84532" as const,
  asset: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  amount: "100",
  payTo: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  maxTimeoutSeconds: 300,
  extra: {
    assetTransferMethod: "permit2",
    decimals: 6,
    domain: { name: "Token" },
  },
};
const context: X402InboundPaymentNodeContext = {
  agentId: "agent",
  requirements,
  registeredResource: "https://agent.example/run",
  paymentPayload: {
    x402Version: 2,
    accepted: requirements,
    resource: { url: "https://agent.example/run" },
    payload: {},
  },
};
const source = {
  id: "node-source",
  chain: "EVM",
  network: requirements.network,
  scheme: "Exact",
  payTo: requirements.payTo,
  resource: context.registeredResource,
  extra: { domain: { name: "Token" } },
  pricing: {
    pricingType: "Fixed",
    fixed: [{ asset: requirements.asset, amount: "100", decimals: 6 }],
  },
};
const entry = {
  id: "registry-id",
  name: "Agent",
  description: null,
  apiBaseUrl: null,
  state: "RegistrationConfirmed",
  agentIdentifier: null,
  createdAt: "now",
  updatedAt: "now",
  Capability: { name: null, version: null },
  Author: {
    name: "Author",
    contactEmail: null,
    contactOther: null,
    organization: null,
  },
  Tags: [],
  AgentPricing: null,
  supportedPaymentSources: [source],
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.reference.mockResolvedValue({
    externalId: "registry-id",
    networkIdentifier: "Preprod",
  });
  mocks.admin.mockReturnValue({
    getRegistry: mocks.registry,
    verifyX402Payment: mocks.verify,
    settleX402Payment: mocks.settle,
  });
  mocks.registry.mockResolvedValue({ Assets: structuredClone([entry]) });
  mocks.verify.mockResolvedValue({ verifyResponse: { isValid: true } });
  mocks.settle.mockResolvedValue({
    settleResponse: {
      success: true,
      transaction: "0xtx",
      network: requirements.network,
    },
  });
});
describe("payment-node inbound source mapping", () => {
  it("uses the exact inclusive cursor and refreshes source IDs on each request", async () => {
    await verifyX402PaymentOnNode(context);
    mocks.registry.mockResolvedValue({
      Assets: [
        {
          ...entry,
          supportedPaymentSources: [{ ...source, id: "replacement" }],
        },
      ],
    });
    await verifyX402PaymentOnNode(context);
    expect(mocks.registry).toHaveBeenCalledTimes(2);
    expect(mocks.registry).toHaveBeenCalledWith({
      network: "Preprod",
      cursorId: "registry-id",
      limit: 1,
      filterPaymentSourceType: "Web3CardanoV2",
    });
    expect(
      mocks.verify.mock.calls.map(([input]) => input.supportedPaymentSourceId),
    ).toEqual(["node-source", "replacement"]);
  });
  it.each(["missing ID", "duplicate", "neighbor", "missing row"])(
    "fails closed for %s",
    async (reason) => {
      let rows: unknown[] = [entry];
      if (reason === "missing ID")
        rows = [
          { ...entry, supportedPaymentSources: [{ ...source, id: undefined }] },
        ];
      if (reason === "duplicate")
        rows = [
          {
            ...entry,
            supportedPaymentSources: [source, { ...source, id: "other" }],
          },
        ];
      if (reason === "neighbor") rows = [{ ...entry, id: "neighbor" }];
      if (reason === "missing row") rows = [];
      mocks.registry.mockResolvedValue({ Assets: rows });
      await expect(verifyX402PaymentOnNode(context)).rejects.toMatchObject({
        status: 503,
      });
      expect(mocks.verify).not.toHaveBeenCalled();
    },
  );
  it.each([
    "resource",
    "extra",
    "network",
    "amount",
    "decimals",
    "asset",
    "payTo",
  ])("rejects changed %s", async (field) => {
    const changed = structuredClone(source);
    if (field === "resource") changed.resource = "https://other.example";
    if (field === "extra") changed.extra.domain.name = "Other";
    if (field === "network")
      changed.network = "eip155:1" as typeof changed.network;
    if (field === "amount") changed.pricing.fixed[0]!.amount = "99";
    if (field === "decimals") changed.pricing.fixed[0]!.decimals = 18;
    if (field === "asset") changed.pricing.fixed[0]!.asset = requirements.payTo;
    if (field === "payTo") changed.payTo = requirements.asset;
    mocks.registry.mockResolvedValue({
      Assets: [{ ...entry, supportedPaymentSources: [changed] }],
    });
    await expect(settleX402PaymentOnNode(context)).rejects.toMatchObject({
      status: 503,
    });
    expect(mocks.settle).not.toHaveBeenCalled();
  });
  it("matches address case and atomic amount semantics", async () => {
    mocks.registry.mockResolvedValue({
      Assets: [
        {
          ...entry,
          supportedPaymentSources: [
            {
              ...source,
              payTo: source.payTo.replaceAll("b", "B"),
              pricing: {
                pricingType: "Fixed",
                fixed: [
                  {
                    asset: requirements.asset.replaceAll("a", "A"),
                    amount: "0100",
                    decimals: 6,
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(await settleX402PaymentOnNode(context)).toMatchObject({
      success: true,
    });
  });
  it("matches extra objects independent of nested key order", async () => {
    const reordered = {
      ...context,
      requirements: {
        ...requirements,
        extra: {
          domain: { version: "1", name: "Token" },
          decimals: 6,
          assetTransferMethod: "permit2",
        },
      },
    };
    mocks.registry.mockResolvedValue({
      Assets: [
        {
          ...entry,
          supportedPaymentSources: [
            { ...source, extra: { domain: { name: "Token", version: "1" } } },
          ],
        },
      ],
    });
    expect(await verifyX402PaymentOnNode(reordered)).toEqual({ isValid: true });
  });

  it("rejects malformed verification results", async () => {
    mocks.verify.mockResolvedValue({ verifyResponse: { isValid: "yes" } });
    await expect(verifyX402PaymentOnNode(context)).rejects.toThrow();
  });
  it("rejects settlement results for another network", async () => {
    mocks.settle.mockResolvedValue({
      settleResponse: { success: true, transaction: "tx", network: "eip155:1" },
    });
    await expect(settleX402PaymentOnNode(context)).rejects.toMatchObject({
      status: 502,
    });
  });
});
