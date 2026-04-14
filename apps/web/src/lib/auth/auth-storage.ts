import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
} from "node:crypto";

import prisma from "@masumi/database/client";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { authEnvConfig } from "@/lib/config/auth.config";

import type { Prisma } from "../../../../../packages/database/dist/generated/prisma/client.js";

const HASH_KEY_INFO = "masumi-auth-storage-hmac";
const ENCRYPTION_KEY_INFO = "masumi-auth-storage-aes-256-gcm";
const ENCRYPTION_VERSION = "v1";
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_KEY_LENGTH = 32;
const ENCRYPTION_IV_LENGTH = 12;
const ENCRYPTION_TAG_LENGTH = 16;

const HASHED_FIELDS = {
  session: new Set(["token"]),
  oauthAccessToken: new Set(["accessToken", "refreshToken"]),
  deviceCode: new Set(["deviceCode", "userCode"]),
  verification: new Set(["identifier"]),
} as const;

const ENCRYPTED_FIELDS = {
  jwks: new Set(["privateKey"]),
} as const;

type AdapterWhereValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | Date
  | null;

type AdapterWhere = {
  operator?:
    | "eq"
    | "ne"
    | "lt"
    | "lte"
    | "gt"
    | "gte"
    | "in"
    | "not_in"
    | "contains"
    | "starts_with"
    | "ends_with";
  value: AdapterWhereValue;
  field: string;
  connector?: "AND" | "OR";
};

type AdapterJoinOption = {
  [model: string]:
    | boolean
    | {
        limit?: number;
      };
};

function getMasterSecret(): Buffer {
  const secret = authEnvConfig.secret?.trim();
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required for auth storage");
  }
  return Buffer.from(secret, "utf8");
}

function deriveKey(info: string): Buffer {
  return Buffer.from(
    hkdfSync(
      "sha256",
      getMasterSecret(),
      Buffer.alloc(0),
      info,
      ENCRYPTION_KEY_LENGTH,
    ),
  );
}

function getHashKey(): Buffer {
  return deriveKey(HASH_KEY_INFO);
}

function getEncryptionKey(): Buffer {
  return deriveKey(ENCRYPTION_KEY_INFO);
}

function getFieldLabel(model: string, field: string): string {
  return `${model}.${field}`;
}

function isHashedField(model: string, field: string): boolean {
  const fields = HASHED_FIELDS[model as keyof typeof HASHED_FIELDS];
  return fields?.has(field as never) ?? false;
}

function isEncryptedField(model: string, field: string): boolean {
  const fields = ENCRYPTED_FIELDS[model as keyof typeof ENCRYPTED_FIELDS];
  return fields?.has(field as never) ?? false;
}

export function hashAuthLookupValue(value: string, label: string): string {
  return createHmac("sha256", getHashKey())
    .update(label, "utf8")
    .update("\0")
    .update(value, "utf8")
    .digest("hex");
}

export async function encryptAuthSecret(
  plaintext: string,
  label: string,
): Promise<string> {
  const iv = randomBytes(ENCRYPTION_IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv, {
    authTagLength: ENCRYPTION_TAG_LENGTH,
  });
  cipher.setAAD(Buffer.from(label, "utf8"));
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    iv.toString("hex"),
    tag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

export async function decryptAuthSecret(
  ciphertext: string,
  label: string,
): Promise<string> {
  const [version, ivHex, tagHex, encryptedHex] = ciphertext.split(":");
  if (version !== ENCRYPTION_VERSION || !ivHex || !tagHex || !encryptedHex) {
    throw new Error(`Invalid encrypted auth secret for ${label}`);
  }

  const decipher = createDecipheriv(
    ENCRYPTION_ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivHex, "hex"),
    { authTagLength: ENCRYPTION_TAG_LENGTH },
  );
  decipher.setAAD(Buffer.from(label, "utf8"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

function transformStoredWhere(
  model: string,
  where?: AdapterWhere[],
): AdapterWhere[] {
  if (!where?.length) {
    return where ?? [];
  }

  return where.map((clause) => {
    if (
      typeof clause.value === "string" &&
      isHashedField(model, clause.field) &&
      (clause.operator === undefined || clause.operator === "eq")
    ) {
      return {
        ...clause,
        value: hashAuthLookupValue(
          clause.value,
          getFieldLabel(model, clause.field),
        ),
      };
    }

    return clause;
  });
}

async function transformStoredData(
  model: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const nextData: Record<string, unknown> = { ...data };

  for (const [field, value] of Object.entries(nextData)) {
    if (typeof value !== "string" || value.length === 0) {
      continue;
    }

    if (isHashedField(model, field)) {
      nextData[field] = hashAuthLookupValue(value, getFieldLabel(model, field));
      continue;
    }

    if (isEncryptedField(model, field)) {
      nextData[field] = await encryptAuthSecret(
        value,
        getFieldLabel(model, field),
      );
    }
  }

  return nextData;
}

async function restoreReadResult<T>(model: string, result: T): Promise<T> {
  if (!result) {
    return result;
  }

  if (Array.isArray(result)) {
    const restoredItems = await Promise.all(
      result.map((item) => restoreReadResult(model, item)),
    );
    return restoredItems as T;
  }

  if (typeof result !== "object") {
    return result;
  }

  const restored = { ...(result as Record<string, unknown>) };
  for (const [field, value] of Object.entries(restored)) {
    if (typeof value === "string" && isEncryptedField(model, field)) {
      restored[field] = await decryptAuthSecret(
        value,
        getFieldLabel(model, field),
      );
    }
  }

  return restored as T;
}

function restoreWriteResult<T>(
  model: string,
  result: T,
  rawData: Record<string, unknown>,
): T {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return result;
  }

  const restored = { ...(result as Record<string, unknown>) };
  for (const [field, value] of Object.entries(rawData)) {
    if (
      typeof value === "string" &&
      (isHashedField(model, field) || isEncryptedField(model, field))
    ) {
      restored[field] = value;
    }
  }

  return restored as T;
}

export function securePrismaAuthAdapter(
  client: typeof prisma,
  config: Parameters<typeof prismaAdapter>[1],
) {
  const baseFactory = prismaAdapter(client, config);

  return (options: Parameters<ReturnType<typeof prismaAdapter>>[0]) => {
    const adapter = baseFactory(options);

    return {
      ...adapter,
      async create(args: {
        model: string;
        data: Record<string, unknown>;
        select?: string[];
      }) {
        const data = await transformStoredData(args.model, args.data);
        const result = await adapter.create({ ...args, data });
        return restoreWriteResult(args.model, result, args.data);
      },
      async findOne(args: {
        model: string;
        where?: AdapterWhere[];
        select?: string[];
        join?: AdapterJoinOption;
      }) {
        const result = await adapter.findOne({
          ...args,
          where: transformStoredWhere(args.model, args.where),
        });
        return await restoreReadResult(args.model, result);
      },
      async findMany(args: {
        model: string;
        where?: AdapterWhere[];
        limit?: number;
        offset?: number;
        sortBy?: { field: string; direction: "asc" | "desc" };
        join?: AdapterJoinOption;
      }) {
        const result = await adapter.findMany({
          ...args,
          where: transformStoredWhere(args.model, args.where),
        });
        return await restoreReadResult(args.model, result);
      },
      async count(args: { model: string; where?: AdapterWhere[] }) {
        return adapter.count({
          ...args,
          where: transformStoredWhere(args.model, args.where),
        });
      },
      async update(args: {
        model: string;
        where: AdapterWhere[];
        update: Record<string, unknown>;
      }) {
        const update = await transformStoredData(args.model, args.update);
        const result = await adapter.update({
          ...args,
          where: transformStoredWhere(args.model, args.where),
          update,
        });
        return restoreWriteResult(args.model, result, args.update);
      },
      async updateMany(args: {
        model: string;
        where: AdapterWhere[];
        update: Record<string, unknown>;
      }) {
        return adapter.updateMany({
          ...args,
          where: transformStoredWhere(args.model, args.where),
          update: await transformStoredData(args.model, args.update),
        });
      },
      async delete(args: { model: string; where: AdapterWhere[] }) {
        return adapter.delete({
          ...args,
          where: transformStoredWhere(args.model, args.where),
        });
      },
      async deleteMany(args: { model: string; where: AdapterWhere[] }) {
        return adapter.deleteMany({
          ...args,
          where: transformStoredWhere(args.model, args.where),
        });
      },
    };
  };
}

export function createMagicLinkTokenHasher() {
  return {
    type: "custom-hasher" as const,
    hash: async (token: string) =>
      hashAuthLookupValue(token, getFieldLabel("magicLink", "token")),
  };
}

export function createEmailOtpStoreOptions() {
  return {
    hash: async (otp: string) =>
      hashAuthLookupValue(otp, getFieldLabel("verification", "otp")),
  };
}

export function buildStoredOtpValue(otp: string, attempts = 0): string {
  return `${hashAuthLookupValue(otp, getFieldLabel("verification", "otp"))}:${attempts}`;
}

export async function createVerificationValue(
  args: Pick<
    Prisma.VerificationCreateInput,
    "id" | "identifier" | "value" | "expiresAt"
  >,
) {
  return prisma.verification.create({
    data: {
      ...args,
      identifier: hashAuthLookupValue(
        args.identifier,
        getFieldLabel("verification", "identifier"),
      ),
    },
  });
}

export async function deleteVerificationByIdentifier(identifier: string) {
  return prisma.verification.deleteMany({
    where: {
      identifier: hashAuthLookupValue(
        identifier,
        getFieldLabel("verification", "identifier"),
      ),
    },
  });
}

export async function findVerificationByIdentifier<
  T extends Prisma.VerificationSelect,
>(identifier: string, select: T) {
  return prisma.verification.findFirst({
    where: {
      identifier: hashAuthLookupValue(
        identifier,
        getFieldLabel("verification", "identifier"),
      ),
    },
    orderBy: {
      createdAt: "desc",
    },
    select,
  }) as Promise<Prisma.VerificationGetPayload<{ select: T }> | null>;
}

export async function findDeviceCodeByDeviceCode<
  T extends Prisma.DeviceCodeSelect,
>(deviceCode: string, select: T) {
  return prisma.deviceCode.findUnique({
    where: {
      deviceCode: hashAuthLookupValue(
        deviceCode,
        getFieldLabel("deviceCode", "deviceCode"),
      ),
    },
    select,
  }) as Promise<Prisma.DeviceCodeGetPayload<{ select: T }> | null>;
}

export async function findDeviceCodeByUserCode<
  T extends Prisma.DeviceCodeSelect,
>(userCode: string, select: T) {
  return prisma.deviceCode.findUnique({
    where: {
      userCode: hashAuthLookupValue(
        userCode,
        getFieldLabel("deviceCode", "userCode"),
      ),
    },
    select,
  }) as Promise<Prisma.DeviceCodeGetPayload<{ select: T }> | null>;
}

type OauthAccessTokenLookupArgs = Omit<
  Prisma.OauthAccessTokenFindUniqueArgs,
  "where"
>;

function buildStoredOauthAccessTokenWhere(
  field: "accessToken",
  token: string,
): { accessToken: string };
function buildStoredOauthAccessTokenWhere(
  field: "refreshToken",
  token: string,
): { refreshToken: string };
function buildStoredOauthAccessTokenWhere(
  field: "accessToken" | "refreshToken",
  token: string,
) {
  const hashed = hashAuthLookupValue(
    token,
    getFieldLabel("oauthAccessToken", field),
  );

  if (field === "accessToken") {
    return { accessToken: hashed };
  }

  return { refreshToken: hashed };
}

export async function findOauthAccessTokenByAccessToken<
  T extends OauthAccessTokenLookupArgs,
>(accessToken: string, args: T) {
  return prisma.oauthAccessToken.findUnique({
    ...args,
    where: buildStoredOauthAccessTokenWhere(
      "accessToken",
      accessToken,
    ) as Prisma.OauthAccessTokenWhereUniqueInput,
  }) as Promise<Prisma.OauthAccessTokenGetPayload<T> | null>;
}

export async function findOauthAccessTokenByRefreshToken<
  T extends OauthAccessTokenLookupArgs,
>(refreshToken: string, args: T) {
  return prisma.oauthAccessToken.findUnique({
    ...args,
    where: buildStoredOauthAccessTokenWhere(
      "refreshToken",
      refreshToken,
    ) as Prisma.OauthAccessTokenWhereUniqueInput,
  }) as Promise<Prisma.OauthAccessTokenGetPayload<T> | null>;
}

type CreateOauthAccessTokenArgs = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  clientId: string;
  userId: string | null;
  scopes: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function createStoredOauthAccessToken(
  data: CreateOauthAccessTokenArgs,
) {
  const record = await prisma.oauthAccessToken.create({
    data: {
      ...data,
      accessToken: hashAuthLookupValue(
        data.accessToken,
        getFieldLabel("oauthAccessToken", "accessToken"),
      ),
      refreshToken: hashAuthLookupValue(
        data.refreshToken,
        getFieldLabel("oauthAccessToken", "refreshToken"),
      ),
    },
    include: {
      user: true,
    },
  });

  return {
    ...record,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  };
}

export async function deleteSessionByRawToken(token: string) {
  return prisma.session.deleteMany({
    where: {
      token: hashAuthLookupValue(token, getFieldLabel("session", "token")),
    },
  });
}
