import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: { agent: {}, agentReference: {}, $transaction: vi.fn() },
  client: {
    getRegistryByAgentIdentifier: vi.fn(),
    getRegistryById: vi.fn(),
    updateAgent: vi.fn(),
    patchWallet: vi.fn(),
  },
}));

vi.mock("@masumi/database/client", () => ({ default: mocks.db }));
vi.mock("@/lib/payment-node/get-admin-client", () => ({
  createAdminPaymentNodeClient: () => mocks.client,
  tryCreateAdminPaymentNodeClient: () => mocks.client,
}));
vi.mock("@/lib/payment-node/config", () => ({ paymentNodeConfig: {} }));
vi.mock("@/lib/payment-node/resolve-smart-contract", () => ({}));
vi.mock("@/lib/registry/build-update-agent-input", () => ({
  buildUpdateAgentInput: () => ({}),
}));
vi.mock("@/lib/email/send-on-chain-verification-complete", () => ({}));
vi.mock("@/lib/veridian", () => ({
  getIssuerOobi: async () => "https://issuer.example/oobi",
  getAgentVerificationSchemaSaid: () => "schema",
}));
vi.mock("@/lib/veridian/build-registry-verifications", () => ({
  buildRegistryVerificationAnchorsFromCredential: () => [],
}));
vi.mock("@/lib/veridian/resolve-holder-oobi", () => ({}));
vi.mock("@/lib/veridian/verification-oobis", () => ({
  buildVerificationOobis: () => ({}),
}));
vi.mock("@/lib/payment-node/payout-address", () => ({
  normalizePayoutAddress: (address: string) => address,
  validatePayoutAddressForNetwork: () => null,
}));
vi.mock("@/lib/schemas/agent", () => ({
  agentPricingRequiresPayoutAddress: () => true,
}));

import { writeOnChainVerifications } from "@/lib/registry/write-on-chain-verifications";

import { updateAgentPayoutAddress } from "./update-agent-payout-address";

const OLD_IDENTIFIER = "a".repeat(56) + "b".repeat(58) + "000001";
const NEW_IDENTIFIER = "a".repeat(56) + "b".repeat(58) + "000002";
const OLD_PAYOUT = "old-payout";
const NEW_PAYOUT = "new-payout";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

let metadata: Record<string, unknown>;
let walletPayout: string;
let agent: Record<string, unknown>;

const writeVerification = () =>
  writeOnChainVerifications({
    agentId: "agent-1",
    userId: "user-1",
    holderOobi: "https://holder.example/oobi",
    credential: { sad: { d: "credential" } } as Parameters<
      typeof writeOnChainVerifications
    >[0]["credential"],
  });
const updatePayout = (payoutAddress: string) =>
  updateAgentPayoutAddress({
    agentId: "agent-1",
    userId: "user-1",
    payoutAddress,
  });

describe("agent reference metadata updates", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    metadata = {
      collectionAddress: OLD_PAYOUT,
      agentIdentifier: OLD_IDENTIFIER,
      smartContractAddress: "contract",
      registrationPayload: { preserved: true },
    };
    walletPayout = OLD_PAYOUT;
    agent = {
      id: "agent-1",
      userId: "user-1",
      name: "Demo",
      networkIdentifier: "Preprod",
      registrationState: "RegistrationConfirmed",
      agentIdentifier: OLD_IDENTIFIER,
    };
    mocks.db.agent = {
      findFirst: async () =>
        structuredClone({
          ...agent,
          agentReference: {
            externalId: "registry-1",
            sellingWalletId: "wallet-1",
            metadata,
          },
        }),
      updateMany: async () => ({ count: 1 }),
      update: async ({ data }: { data: Record<string, unknown> }) =>
        Object.assign(agent, data),
    };
    mocks.db.agentReference = {
      findUniqueOrThrow: async () => ({ metadata: structuredClone(metadata) }),
      update: async ({
        data,
      }: {
        data: { metadata: Record<string, unknown> };
      }) => {
        metadata = data.metadata;
      },
    };

    // Model transaction-scoped advisory locks by key; all database reads use
    // current committed state. No external services or database are contacted.
    const locks = new Map<string, Promise<void>>();
    mocks.db.$transaction.mockImplementation(async (callback) => {
      if (Array.isArray(callback)) return Promise.all(callback);
      const releases: Array<() => void> = [];
      try {
        return await callback({
          ...mocks.db,
          $executeRaw: async (
            _sql: TemplateStringsArray,
            ...keys: unknown[]
          ) => {
            const key = JSON.stringify(keys);
            const previous = locks.get(key) ?? Promise.resolve();
            const held = deferred();
            locks.set(key, held.promise);
            await previous;
            releases.push(held.resolve);
          },
        });
      } finally {
        releases.forEach((release) => release());
      }
    });
    mocks.client.getRegistryByAgentIdentifier.mockResolvedValue({
      Metadata: {},
    });
    mocks.client.getRegistryById
      .mockResolvedValueOnce({
        state: "RegistrationConfirmed",
        agentIdentifier: OLD_IDENTIFIER,
      })
      .mockResolvedValue({
        state: "UpdateConfirmed",
        agentIdentifier: NEW_IDENTIFIER,
      });
    mocks.client.updateAgent.mockResolvedValue({});
    mocks.client.patchWallet.mockImplementation(
      async ({ newCollectionAddress }) => {
        walletPayout = newCollectionAddress;
      },
    );
  });

  it.each(["confirmation", "reconciliation"])(
    "preserves a payout changed before verification %s",
    async (path) => {
      if (path === "reconciliation") {
        mocks.client.getRegistryById
          .mockReset()
          .mockResolvedValueOnce({
            state: "RegistrationConfirmed",
            agentIdentifier: OLD_IDENTIFIER,
          })
          .mockResolvedValueOnce(null)
          .mockResolvedValue({
            state: "UpdateConfirmed",
            agentIdentifier: NEW_IDENTIFIER,
          });
        mocks.client.getRegistryByAgentIdentifier
          .mockResolvedValueOnce({ Metadata: {} })
          .mockResolvedValue({
            Metadata: {
              verifications: [{ credential: { said: "credential" } }],
            },
          });
      }
      const submitted = deferred();
      const continueVerification = deferred();
      mocks.client.updateAgent.mockImplementation(async () => {
        submitted.resolve();
        await continueVerification.promise;
      });
      const verification = writeVerification();
      await submitted.promise;
      await updatePayout(NEW_PAYOUT);
      continueVerification.resolve();
      expect((await verification).success).toBe(true);

      expect(metadata.collectionAddress).toBe(NEW_PAYOUT);
      expect(metadata.agentIdentifier).toBe(NEW_IDENTIFIER);
      expect(metadata.registrationPayload).toEqual({ preserved: true });
      expect(walletPayout).toBe(NEW_PAYOUT);
      await updatePayout(OLD_PAYOUT);
      expect(walletPayout).toBe(OLD_PAYOUT);
      expect(mocks.client.patchWallet).toHaveBeenCalledTimes(2);
    },
  );

  it("preserves the new identifier when a payout change finishes last", async () => {
    const patchStarted = deferred();
    const continuePayout = deferred();
    mocks.client.patchWallet.mockImplementation(
      async ({ newCollectionAddress }) => {
        patchStarted.resolve();
        await continuePayout.promise;
        walletPayout = newCollectionAddress;
      },
    );
    const payout = updatePayout(NEW_PAYOUT);
    await patchStarted.promise;
    const verification = writeVerification();
    await vi.waitFor(() =>
      expect(mocks.client.getRegistryById).toHaveBeenCalledTimes(2),
    );
    continuePayout.resolve();
    await Promise.all([payout, verification]);

    expect(metadata.agentIdentifier).toBe(NEW_IDENTIFIER);
    expect(metadata.collectionAddress).toBe(NEW_PAYOUT);
  });
});
