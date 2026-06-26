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

const prismaMock = {
  oauthAccessToken: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
};

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
    prismaMock.oauthAccessToken.findUnique.mockReset();
    prismaMock.oauthAccessToken.updateMany.mockReset();
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

  it("resolves an OIDC session id from a raw refresh token before rotation", async () => {
    const authStorageModule = await import("./auth-storage");
    prismaMock.oauthAccessToken.findUnique.mockResolvedValue({
      id: "oauth-token-1",
      oidcSessionId: "stable-sid",
    });

    await expect(
      authStorageModule.getOauthAccessTokenOidcSessionIdForRefreshToken(
        "raw-refresh-token",
      ),
    ).resolves.toBe("stable-sid");

    expect(prismaMock.oauthAccessToken.findUnique).toHaveBeenCalledWith({
      select: {
        id: true,
        oidcSessionId: true,
      },
      where: {
        refreshToken: authStorageModule.hashAuthLookupValue(
          "raw-refresh-token",
          "oauthAccessToken.refreshToken",
        ),
      },
    });
  });

  it("falls back to a deterministic OIDC session id for older token records", async () => {
    const authStorageModule = await import("./auth-storage");
    prismaMock.oauthAccessToken.findUnique.mockResolvedValue({
      id: "oauth-token-1",
      oidcSessionId: null,
    });

    await expect(
      authStorageModule.getOauthAccessTokenOidcSessionIdForRefreshToken(
        "raw-refresh-token",
      ),
    ).resolves.toBe(
      authStorageModule.createOidcSessionId({ tokenId: "oauth-token-1" }),
    );
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

  it("writes a resolved OIDC session id to the rotated refresh token record", async () => {
    const authStorageModule = await import("./auth-storage");
    prismaMock.oauthAccessToken.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      authStorageModule.carryForwardOauthAccessTokenOidcSessionId({
        previousOidcSessionId: "stable-sid",
        rotatedRefreshToken: "rotated-refresh-token",
      }),
    ).resolves.toBe("stable-sid");

    expect(prismaMock.oauthAccessToken.updateMany).toHaveBeenCalledWith({
      where: {
        refreshToken: authStorageModule.hashAuthLookupValue(
          "rotated-refresh-token",
          "oauthAccessToken.refreshToken",
        ),
      },
      data: { oidcSessionId: "stable-sid" },
    });
  });
});
