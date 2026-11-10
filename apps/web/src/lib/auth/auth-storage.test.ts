import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const adapterMethods = {
  consumeOne: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
  findMany: vi.fn(),
  findOne: vi.fn(),
  incrementOne: vi.fn(),
  transaction: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
};

const prismaMock = {};

vi.mock("@masumi/database/client", () => ({
  Prisma: {},
  default: prismaMock,
}));

vi.mock("better-auth/adapters/prisma", () => ({
  prismaAdapter: () => () => adapterMethods,
}));

type EnvSnapshot = Record<string, string | undefined>;

function captureEnv(): EnvSnapshot {
  return {
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  };
}

function restoreEnv(snapshot: EnvSnapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }
}

describe("securePrismaAuthAdapter", () => {
  const envSnapshot = captureEnv();

  beforeEach(() => {
    process.env.BETTER_AUTH_SECRET = "test-auth-secret";
    Object.values(adapterMethods).forEach((mock) => mock.mockReset());
  });

  afterEach(() => {
    restoreEnv(envSnapshot);
    vi.resetModules();
  });

  it("hashes lookup-only session tokens before persistence and restores the raw result", async () => {
    const authStorageModule = await import("./auth-storage");
    adapterMethods.create.mockImplementation(async ({ data }) => ({
      id: "session-1",
      ...data,
    }));
    adapterMethods.findOne.mockImplementation(async ({ where }) => ({
      id: "session-1",
      token: where[0].value,
    }));

    const adapterFactory = authStorageModule.securePrismaAuthAdapter(
      {} as never,
      {
        provider: "postgresql",
      },
    );
    const adapter = adapterFactory({} as never);

    const created = await adapter.create({
      model: "session",
      data: {
        token: "raw-session-token",
      },
      select: ["token"],
    });

    expect(adapterMethods.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          token: authStorageModule.hashAuthLookupValue(
            "raw-session-token",
            "session.token",
          ),
        },
      }),
    );
    expect(created.token).toBe("raw-session-token");

    await adapter.findOne({
      model: "session",
      where: [{ field: "token", value: "raw-session-token" }],
      select: ["token"],
    });

    expect(adapterMethods.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: [
          {
            field: "token",
            value: authStorageModule.hashAuthLookupValue(
              "raw-session-token",
              "session.token",
            ),
          },
        ],
      }),
    );
  });

  it("encrypts retrievable JWKS private keys at rest and decrypts them on reads", async () => {
    const authStorageModule = await import("./auth-storage");
    adapterMethods.create.mockImplementation(async ({ data }) => ({
      id: "jwks-1",
      ...data,
    }));

    const adapterFactory = authStorageModule.securePrismaAuthAdapter(
      {} as never,
      {
        provider: "postgresql",
      },
    );
    const adapter = adapterFactory({} as never);

    const created = await adapter.create({
      model: "jwks",
      data: {
        privateKey: "super-secret-private-key",
      },
      select: ["privateKey"],
    });

    const storedPrivateKey = adapterMethods.create.mock.calls[0]?.[0]?.data
      ?.privateKey as string;

    expect(storedPrivateKey).not.toBe("super-secret-private-key");
    await expect(
      authStorageModule.decryptAuthSecret(storedPrivateKey, "jwks.privateKey"),
    ).resolves.toBe("super-secret-private-key");
    expect(created.privateKey).toBe("super-secret-private-key");
  });

  it("does not double-hash session tokens already loaded from storage on update", async () => {
    const authStorageModule = await import("./auth-storage");
    const storedToken = authStorageModule.hashAuthLookupValue(
      "raw-session-token",
      "session.token",
    );

    adapterMethods.update.mockImplementation(async ({ where, update }) => ({
      id: "session-1",
      token: where[0].value,
      ...update,
    }));

    const adapterFactory = authStorageModule.securePrismaAuthAdapter(
      {} as never,
      {
        provider: "postgresql",
      },
    );
    const adapter = adapterFactory({} as never);

    await adapter.update({
      model: "session",
      where: [{ field: "token", value: storedToken }],
      update: { activeOrganizationId: "org-1" },
    });

    expect(adapterMethods.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: [{ field: "token", value: storedToken }],
        update: { activeOrganizationId: "org-1" },
      }),
    );
  });

  it("re-hashes a digest-shaped token on reads so a leaked digest cannot be replayed", async () => {
    const authStorageModule = await import("./auth-storage");
    const storedToken = authStorageModule.hashAuthLookupValue(
      "raw-session-token",
      "session.token",
    );
    adapterMethods.findOne.mockResolvedValue(null);

    const adapterFactory = authStorageModule.securePrismaAuthAdapter(
      {} as never,
      { provider: "postgresql" },
    );
    const adapter = adapterFactory({} as never);

    // An attacker presents the stored digest verbatim as a bearer/cookie value.
    await adapter.findOne({
      model: "session",
      where: [{ field: "token", value: storedToken }],
      select: ["token"],
    });

    // The read path must hash it again (not match the stored digest directly),
    // so the digest is useless as a raw credential.
    expect(adapterMethods.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: [
          {
            field: "token",
            value: authStorageModule.hashAuthLookupValue(
              storedToken,
              "session.token",
            ),
          },
        ],
      }),
    );
  });

  it("returns the raw value of a hashed field matched by the lookup", async () => {
    const authStorageModule = await import("./auth-storage");
    // The device plugin compares `record.userCode` with the code it looked up.
    adapterMethods.findOne.mockImplementation(async ({ where }) => ({
      id: "device-1",
      userCode: where[0].value,
      deviceCode: authStorageModule.hashAuthLookupValue(
        "raw-device-code",
        "deviceCode.deviceCode",
      ),
    }));

    const adapter = authStorageModule.securePrismaAuthAdapter({} as never, {
      provider: "postgresql",
    })({} as never);

    const record = await adapter.findOne<{
      userCode: string;
      deviceCode: string;
    }>({
      model: "deviceCode",
      where: [{ field: "userCode", value: "ABCDEFGH" }],
    });

    expect(record?.userCode).toBe("ABCDEFGH");
    // Fields that were not part of the lookup stay hashed.
    expect(record?.deviceCode).not.toBe("raw-device-code");
  });

  it("stores a null device-code resources list as an empty list", async () => {
    const authStorageModule = await import("./auth-storage");
    adapterMethods.create.mockImplementation(async ({ data }) => data);

    const adapter = authStorageModule.securePrismaAuthAdapter({} as never, {
      provider: "postgresql",
    })({} as never);

    // Prisma rejects null for a String[] column (device/code returned 500).
    await adapter.create({
      model: "deviceCode",
      data: { deviceCode: "dc", userCode: "uc", resources: null },
    });

    expect(adapterMethods.create.mock.calls[0][0].data.resources).toEqual([]);
  });

  it("hashes consumeOne lookups so single-use codes resolve", async () => {
    const authStorageModule = await import("./auth-storage");
    adapterMethods.consumeOne.mockImplementation(async ({ where }) => ({
      id: "verification-1",
      identifier: where[0].value,
    }));

    const adapter = authStorageModule.securePrismaAuthAdapter({} as never, {
      provider: "postgresql",
    })({} as never);

    const consumed = await adapter.consumeOne<{ identifier: string }>({
      model: "verification",
      where: [{ field: "identifier", value: "magic-link-token" }],
    });

    expect(adapterMethods.consumeOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: [
          {
            field: "identifier",
            value: authStorageModule.hashAuthLookupValue(
              "magic-link-token",
              "verification.identifier",
            ),
          },
        ],
      }),
    );
    expect(consumed?.identifier).toBe("magic-link-token");
  });

  it("wraps the transaction-scoped adapter so writes inside a transaction are hashed", async () => {
    const authStorageModule = await import("./auth-storage");
    adapterMethods.transaction.mockImplementation(
      async (callback: (trx: typeof adapterMethods) => Promise<unknown>) =>
        callback(adapterMethods),
    );
    adapterMethods.create.mockImplementation(async ({ data }) => data);

    const adapter = authStorageModule.securePrismaAuthAdapter({} as never, {
      provider: "postgresql",
    })({} as never);

    await adapter.transaction!(async (trx) =>
      trx.create({ model: "session", data: { token: "raw-session-token" } }),
    );

    expect(adapterMethods.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          token: authStorageModule.hashAuthLookupValue(
            "raw-session-token",
            "session.token",
          ),
        },
      }),
    );
  });
});
