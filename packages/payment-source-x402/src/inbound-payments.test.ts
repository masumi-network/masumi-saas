import { beforeEach, describe, expect, it, vi } from "vitest";

import { settleX402Payment, verifyX402Payment } from "./service.js";

const mocks = vi.hoisted(() => ({
  source: vi.fn(),
  network: vi.fn(),
  attempt: vi.fn(),
  settlement: vi.fn(),
  existing: vi.fn(),
}));
vi.mock("@masumi/database/client", () => ({
  default: {
    supportedPaymentSource: { findUnique: mocks.source },
    x402Network: { findFirst: mocks.network },
    x402PaymentAttempt: { create: mocks.attempt },
    x402Settlement: { findUnique: mocks.existing, upsert: mocks.settlement },
  },
}));

const requirements = {
  scheme: "exact",
  network: "eip155:84532" as const,
  asset: "0x1111111111111111111111111111111111111111",
  amount: "100",
  payTo: "0x2222222222222222222222222222222222222222",
  maxTimeoutSeconds: 300,
  extra: { assetTransferMethod: "permit2", decimals: 6 },
};
const payload = {
  x402Version: 2,
  accepted: requirements,
  resource: { url: "https://agent.example/run" },
  payload: {},
};
const params: Parameters<typeof verifyX402Payment>[0] = {
  userId: "owner",
  caip2NetworkLimit: null,
  supportedPaymentSourceId: "local-source",
  paymentPayload: payload,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.source.mockResolvedValue({
    id: "local-source",
    agentId: "agent",
    chain: "EVM",
    network: requirements.network,
    scheme: "Exact",
    asset: requirements.asset,
    amount: BigInt(requirements.amount),
    payTo: requirements.payTo,
    decimals: 6,
    resource: payload.resource.url,
    extra: null,
    agent: { userId: "owner", organizationId: null },
  });
  mocks.network.mockResolvedValue({
    id: "network",
    userId: "owner",
    isEnabled: true,
    FacilitatorWallet: {
      type: "Selling",
      deletedAt: null,
      encryptedPrivateKey: null,
      paymentNodeWalletId: "node-wallet",
    },
  });
  mocks.attempt.mockResolvedValue({ id: "local-attempt" });
  mocks.existing.mockResolvedValue(null);
});

describe("custodied inbound payments", () => {
  it("delegates verification and keeps the encrypted local audit", async () => {
    const verifyOnPaymentNode = vi
      .fn()
      .mockResolvedValue({ isValid: true, payer: "payer" });
    const result = await verifyX402Payment({ ...params, verifyOnPaymentNode });
    expect(result.verifyResponse.isValid).toBe(true);
    expect(verifyOnPaymentNode).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "agent",
        requirements,
        registeredResource: payload.resource.url,
        paymentPayload: payload,
      }),
    );
    const attempt = mocks.attempt.mock.calls[0]![0].data;
    expect(attempt).toMatchObject({
      userId: "owner",
      supportedPaymentSourceId: "local-source",
      status: "Verified",
      resource: payload.resource.url,
    });
    expect(typeof attempt.paymentPayload).toBe("string");
    expect(attempt.paymentPayload).not.toContain('"accepted"');
  });

  it("records settlement and returns the local webhook summary", async () => {
    const settleOnPaymentNode = vi.fn().mockResolvedValue({
      success: true,
      transaction: "0xtx",
      network: requirements.network,
      amount: "100",
    });
    const result = await settleX402Payment({ ...params, settleOnPaymentNode });
    expect(settleOnPaymentNode).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      replay: false,
      attemptId: "local-attempt",
      webhook: {
        supportedPaymentSourceId: "local-source",
        success: true,
        txHash: "0xtx",
      },
    });
    expect(mocks.settlement).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          paymentAttemptId: "local-attempt",
          txHash: "0xtx",
        }),
      }),
    );
  });

  it("never delegates a source owned by another tenant", async () => {
    const verifyOnPaymentNode = vi.fn();
    await expect(
      verifyX402Payment({ ...params, userId: "other", verifyOnPaymentNode }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(verifyOnPaymentNode).not.toHaveBeenCalled();
  });

  it.each(["network", "resource", "amount"])(
    "rejects mismatched %s before delegation",
    async (field) => {
      const settleOnPaymentNode = vi.fn();
      const input = structuredClone(params);
      if (field === "network") input.caip2NetworkLimit = ["eip155:1"];
      if (field === "resource")
        input.paymentPayload.resource!.url = "https://other.example/run";
      if (field === "amount") input.paymentPayload.accepted.amount = "1";
      await expect(
        settleX402Payment({ ...input, settleOnPaymentNode }),
      ).rejects.toMatchObject({ statusCode: field === "network" ? 401 : 400 });
      expect(settleOnPaymentNode).not.toHaveBeenCalled();
    },
  );

  it.each(["retired", "Purchasing", "disabled"])(
    "rejects a %s facilitator before delegation",
    async (state) => {
      const wallet = {
        type: state === "Purchasing" ? "Purchasing" : "Selling",
        deletedAt: state === "retired" ? new Date() : null,
        encryptedPrivateKey: null,
        paymentNodeWalletId: "node-wallet",
      };
      mocks.network.mockResolvedValue({
        id: "network",
        userId: "owner",
        isEnabled: state !== "disabled",
        FacilitatorWallet: wallet,
      });
      const settleOnPaymentNode = vi.fn();
      await expect(
        settleX402Payment({ ...params, settleOnPaymentNode }),
      ).rejects.toMatchObject({ statusCode: state === "disabled" ? 404 : 400 });
      expect(settleOnPaymentNode).not.toHaveBeenCalled();
    },
  );

  it("records invalid verification results locally", async () => {
    const verifyOnPaymentNode = vi.fn().mockResolvedValue({
      isValid: false,
      invalidReason: "invalid_signature",
    });
    await verifyX402Payment({ ...params, verifyOnPaymentNode });
    expect(mocks.attempt).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "Failed",
          errorReason: "invalid_signature",
        }),
      }),
    );
  });

  it("records failed settlements for webhooks without storing a settlement", async () => {
    const settleOnPaymentNode = vi.fn().mockResolvedValue({
      success: false,
      transaction: "",
      network: requirements.network,
      errorReason: "insufficient_funds",
    });
    const result = await settleX402Payment({ ...params, settleOnPaymentNode });
    expect(result).toMatchObject({
      replay: false,
      webhook: { success: false, errorReason: "insufficient_funds" },
    });
    expect(mocks.attempt).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "Failed" }),
      }),
    );
    expect(mocks.settlement).not.toHaveBeenCalled();
  });

  it("returns an existing local settlement without contacting the node", async () => {
    mocks.existing.mockResolvedValue({
      txHash: "0xold",
      caip2Network: requirements.network,
      amount: BigInt(100),
      PaymentAttempt: {
        supportedPaymentSourceId: "local-source",
        userId: "owner",
        x402NetworkId: "network",
      },
    });
    const settleOnPaymentNode = vi.fn();
    expect(
      await settleX402Payment({ ...params, settleOnPaymentNode }),
    ).toMatchObject({ replay: true, settleResponse: { transaction: "0xold" } });
    expect(settleOnPaymentNode).not.toHaveBeenCalled();
    expect(mocks.settlement).not.toHaveBeenCalled();
  });
});
