import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findGrant: vi.fn(),
  clawBack: vi.fn(),
}));
vi.mock("@masumi/database/client", () => ({
  default: { creditLedgerEntry: { findUnique: mocks.findGrant } },
}));
vi.mock("@/lib/credits/service", () => ({
  clawBackCreditTopUpFromCheckoutSession: mocks.clawBack,
}));
vi.mock("@/lib/server/logger", () => ({ serverLog: { warn: vi.fn() } }));
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }));

import { MASUMI_CHECKOUT_METADATA_PURPOSE } from "./config";
import {
  processChargeDisputeCreated,
  processChargeRefunded,
} from "./refund-clawback";

const retrieveCharge = vi.fn();
const stripe = {
  checkout: {
    sessions: {
      list: vi.fn(async () => ({ data: [{ id: "cs-1" }] })),
      retrieve: vi.fn(async () => ({
        metadata: { masumi_purpose: MASUMI_CHECKOUT_METADATA_PURPOSE },
      })),
    },
  },
  charges: { retrieve: retrieveCharge },
} as unknown as Stripe;
const charge = {
  id: "ch-1",
  payment_intent: "pi-1",
  amount: 10_000,
  amount_refunded: 5_000,
} as Stripe.Charge;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findGrant.mockResolvedValue({ userId: "user-1", delta: 200 });
  mocks.clawBack.mockResolvedValue({ shortfall: 0 });
});

describe("Stripe credit clawback units", () => {
  it.each([
    [50, 0.5],
    [3_000, 30],
    [5_000, 50],
    [10_000, 100],
  ])(
    "refunds %i cents as %s display credits",
    async (amountRefunded, credits) => {
      await processChargeRefunded({
        stripe,
        charge: { ...charge, amount_refunded: amountRefunded },
        stripeEventId: "evt-refund",
      });
      expect(mocks.clawBack).toHaveBeenCalledWith(
        expect.objectContaining({ creditsToClawBack: credits }),
      );
    },
  );
  it("passes display credits for disputes", async () => {
    retrieveCharge.mockResolvedValue(charge);
    await processChargeDisputeCreated({
      stripe,
      dispute: { id: "dp-1", charge: "ch-1" } as Stripe.Dispute,
      stripeEventId: "evt-dispute",
    });
    expect(mocks.clawBack).toHaveBeenCalledWith(
      expect.objectContaining({ creditsToClawBack: 100 }),
    );
  });
});
