import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const adapterMethods = {
  count: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
  findMany: vi.fn(),
  findOne: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
};

vi.mock("@masumi/database/client", () => ({
  Prisma: {},
  default: {},
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
});
