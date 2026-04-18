import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type MockState = {
  version: number;
  user: {
    id: string;
    creditsRemaining: number;
    updatedAt: Date;
  } | null;
  ledger: Array<{
    id: string;
    userId: string;
    delta: number;
    balanceAfter: number;
    reason: string;
    reference: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
  }>;
  nextLedgerId: number;
};

function createState(creditsRemaining = 0): MockState {
  return {
    version: 0,
    user: {
      id: "user-1",
      creditsRemaining,
      updatedAt: new Date("2026-04-13T10:00:00.000Z"),
    },
    ledger: [],
    nextLedgerId: 1,
  };
}

const store: { current: MockState } = {
  current: createState(),
};

function cloneState(state: MockState): MockState {
  return {
    version: state.version,
    user: state.user
      ? {
          ...state.user,
          updatedAt: new Date(state.user.updatedAt),
        }
      : null,
    ledger: state.ledger.map((entry) => ({
      ...entry,
      createdAt: new Date(entry.createdAt),
      ...(entry.metadata ? { metadata: { ...entry.metadata } } : {}),
    })),
    nextLedgerId: state.nextLedgerId,
  };
}

function touchUser(state: MockState) {
  if (!state.user) return;
  state.user.updatedAt = new Date(state.user.updatedAt.getTime() + 1000);
}

function pickSelected<T extends Record<string, unknown>>(
  value: T,
  select?: Record<string, boolean>,
) {
  if (!select) return value;
  return Object.fromEntries(
    Object.entries(select)
      .filter(([, enabled]) => enabled)
      .map(([key]) => [key, value[key]]),
  );
}

function buildTxClient(state: MockState) {
  return {
    user: {
      findUnique: vi.fn(async ({ where, select }) => {
        if (!state.user || where.id !== state.user.id) {
          return null;
        }
        return pickSelected(state.user, select);
      }),
      findUniqueOrThrow: vi.fn(async ({ where, select }) => {
        if (!state.user || where.id !== state.user.id) {
          throw new Error("User not found");
        }
        return pickSelected(state.user, select);
      }),
      update: vi.fn(async ({ where, data }) => {
        if (!state.user || where.id !== state.user.id) {
          throw new Error("User not found");
        }
        if (data.creditsRemaining?.increment) {
          state.user.creditsRemaining += data.creditsRemaining.increment;
        }
        touchUser(state);
        return { ...state.user };
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        if (
          !state.user ||
          where.id !== state.user.id ||
          state.user.creditsRemaining < (where.creditsRemaining?.gte ?? 0)
        ) {
          return { count: 0 };
        }
        if (data.creditsRemaining?.decrement) {
          state.user.creditsRemaining -= data.creditsRemaining.decrement;
        }
        touchUser(state);
        return { count: 1 };
      }),
    },
    creditLedgerEntry: {
      findUnique: vi.fn(async ({ where, select }) => {
        const key = where.userId_reason_reference;
        if (!key) return null;
        const match = state.ledger.find(
          (entry) =>
            entry.userId === key.userId &&
            entry.reason === key.reason &&
            entry.reference === key.reference,
        );
        if (!match) return null;
        return pickSelected(match, select);
      }),
      create: vi.fn(async ({ data }) => {
        const exists = state.ledger.some(
          (entry) =>
            entry.userId === data.userId &&
            entry.reason === data.reason &&
            entry.reference === data.reference,
        );
        if (exists) {
          throw { code: "P2002" };
        }
        state.ledger.push({
          id: `ledger-${state.nextLedgerId++}`,
          userId: data.userId,
          delta: data.delta,
          balanceAfter: data.balanceAfter,
          reason: data.reason,
          reference: data.reference,
          metadata: data.metadata,
          createdAt: new Date("2026-04-13T10:00:00.000Z"),
        });
      }),
    },
  };
}

async function runTransaction<T>(
  callback: (tx: ReturnType<typeof buildTxClient>) => Promise<T>,
  attempts = 0,
): Promise<T> {
  await Promise.resolve();

  const baseVersion = store.current.version;
  const txState = cloneState(store.current);
  const txClient = buildTxClient(txState);
  const result = await callback(txClient);

  if (store.current.version !== baseVersion) {
    if (attempts > 3) {
      throw new Error("Transaction retry limit exceeded");
    }
    return runTransaction(callback, attempts + 1);
  }

  txState.version = baseVersion + 1;
  store.current = txState;
  return result;
}

vi.mock("@masumi/database/client", () => ({
  default: {
    user: {
      findUniqueOrThrow: vi.fn(async ({ where, select }) => {
        if (!store.current.user || where.id !== store.current.user.id) {
          throw new Error("User not found");
        }
        return pickSelected(store.current.user, select);
      }),
    },
    creditLedgerEntry: {},
    $transaction: vi.fn(runTransaction),
  },
}));

const {
  CREDIT_COST,
  InsufficientCreditsError,
  consumeCreditIfRequired,
  consumeCreditOrThrow,
  grantInitialCreditsIfNeeded,
  refundConsumedCredit,
} = await import("./service");

describe("credit service", () => {
  beforeEach(() => {
    store.current = createState();
  });

  it("grants exactly twenty initial credits once", async () => {
    await grantInitialCreditsIfNeeded("user-1");
    await grantInitialCreditsIfNeeded("user-1");

    expect(store.current.user?.creditsRemaining).toBe(20);
    expect(store.current.ledger).toHaveLength(1);
    expect(store.current.ledger[0]).toMatchObject({
      delta: 20,
      balanceAfter: 20,
      reason: "initial_grant",
      reference: "signup",
    });
  });

  it("consumes one credit and writes a ledger entry", async () => {
    store.current = createState(1);

    const result = await consumeCreditOrThrow({
      userId: "user-1",
      reason: "agent_register",
      reference: "agent-register:test",
      metadata: { network: "Preprod" },
    });

    expect(result.creditsRemaining).toBe(0);
    expect(store.current.user?.creditsRemaining).toBe(0);
    expect(store.current.ledger).toHaveLength(1);
    expect(store.current.ledger[0]).toMatchObject({
      delta: -CREDIT_COST,
      balanceAfter: 0,
      reason: "agent_register",
      reference: "agent-register:test",
    });
  });

  it("throws a standardized error when credits are empty", async () => {
    await expect(
      consumeCreditOrThrow({
        userId: "user-1",
        reason: "payment_proxy_write",
        reference: "payment:test",
      }),
    ).rejects.toBeInstanceOf(InsufficientCreditsError);

    expect(store.current.user?.creditsRemaining).toBe(0);
    expect(store.current.ledger).toHaveLength(0);
  });

  it("skips debit entirely on Preprod", async () => {
    store.current = createState(0);

    const result = await consumeCreditIfRequired({
      userId: "user-1",
      reason: "agent_register",
      reference: "agent-register:preprod",
      network: "Preprod",
      metadata: { network: "Preprod" },
    });

    expect(result.creditsRemaining).toBe(0);
    expect(store.current.user?.creditsRemaining).toBe(0);
    expect(store.current.ledger).toHaveLength(0);
  });

  it("skips debit when no network is provided", async () => {
    store.current = createState(0);

    const result = await consumeCreditIfRequired({
      userId: "user-1",
      reason: "agent_register",
      reference: "agent-register:default-network",
      metadata: { network: null },
    });

    expect(result.creditsRemaining).toBe(0);
    expect(store.current.user?.creditsRemaining).toBe(0);
    expect(store.current.ledger).toHaveLength(0);
  });

  it("skips debit for unknown networks", async () => {
    store.current = createState(0);

    const result = await consumeCreditIfRequired({
      userId: "user-1",
      reason: "payment_proxy_write",
      reference: "payment:unknown-network",
      network: "Preview",
      metadata: { network: "Preview" },
    });

    expect(result.creditsRemaining).toBe(0);
    expect(store.current.user?.creditsRemaining).toBe(0);
    expect(store.current.ledger).toHaveLength(0);
  });

  it("still debits on Mainnet", async () => {
    store.current = createState(1);

    const result = await consumeCreditIfRequired({
      userId: "user-1",
      reason: "payment_proxy_write",
      reference: "payment:mainnet",
      network: "Mainnet",
      metadata: { network: "Mainnet" },
    });

    expect(result.creditsRemaining).toBe(0);
    expect(store.current.user?.creditsRemaining).toBe(0);
    expect(store.current.ledger).toHaveLength(1);
    expect(store.current.ledger[0]).toMatchObject({
      delta: -CREDIT_COST,
      reason: "payment_proxy_write",
      reference: "payment:mainnet",
    });
  });

  it("refunds a Mainnet debit with a :refund ledger entry", async () => {
    store.current = createState(1);

    await refundConsumedCredit({
      userId: "user-1",
      reason: "payment_proxy_write",
      reference: "payment:mainnet",
      network: "Mainnet",
      metadata: { network: "Mainnet" },
    });

    expect(store.current.user?.creditsRemaining).toBe(2);
    expect(store.current.ledger).toHaveLength(1);
    expect(store.current.ledger[0]).toMatchObject({
      delta: CREDIT_COST,
      balanceAfter: 2,
      reason: "payment_proxy_write",
      reference: "payment:mainnet:refund",
    });
  });

  it("is idempotent when refunded twice with the same reference", async () => {
    store.current = createState(1);

    await refundConsumedCredit({
      userId: "user-1",
      reason: "payment_proxy_write",
      reference: "payment:mainnet",
      network: "Mainnet",
    });
    await refundConsumedCredit({
      userId: "user-1",
      reason: "payment_proxy_write",
      reference: "payment:mainnet",
      network: "Mainnet",
    });

    expect(store.current.user?.creditsRemaining).toBe(2);
    expect(store.current.ledger).toHaveLength(1);
    expect(store.current.ledger[0]).toMatchObject({
      reference: "payment:mainnet:refund",
    });
  });

  it("skips refund entirely on Preprod", async () => {
    store.current = createState(0);

    await refundConsumedCredit({
      userId: "user-1",
      reason: "payment_proxy_write",
      reference: "payment:preprod",
      network: "Preprod",
    });

    expect(store.current.user?.creditsRemaining).toBe(0);
    expect(store.current.ledger).toHaveLength(0);
  });

  it("allows only one concurrent debit when one credit remains", async () => {
    store.current = createState(1);

    const results = await Promise.allSettled([
      consumeCreditOrThrow({
        userId: "user-1",
        reason: "payment_proxy_write",
        reference: "payment:test:1",
      }),
      consumeCreditOrThrow({
        userId: "user-1",
        reason: "payment_proxy_write",
        reference: "payment:test:2",
      }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(InsufficientCreditsError);
    expect(store.current.user?.creditsRemaining).toBe(0);
    expect(store.current.ledger).toHaveLength(1);
  });
});
