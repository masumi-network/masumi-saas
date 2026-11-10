import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
} from "node:crypto";

import prisma from "@masumi/database/client";
import { prismaAdapter } from "better-auth/adapters/prisma";
import type { DBAdapter, DBTransactionAdapter } from "better-auth/types";

import { authEnvConfig } from "@/lib/config/auth.config";

import type { Prisma } from "../../../../../packages/database/dist/generated/prisma/client.js";

const HASH_KEY_INFO = "masumi-auth-storage-hmac";
const ENCRYPTION_KEY_INFO = "masumi-auth-storage-aes-256-gcm";
const ENCRYPTION_VERSION = "v1";
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_KEY_LENGTH = 32;
const ENCRYPTION_IV_LENGTH = 12;
const ENCRYPTION_TAG_LENGTH = 16;
const STORED_HASH_DIGEST_RE = /^[a-f0-9]{64}$/i;

const HASHED_FIELDS = {
  session: new Set(["token"]),
  deviceCode: new Set(["deviceCode", "userCode"]),
  verification: new Set(["identifier"]),
} as const;

/**
 * Optional `string[]` fields that plugins write as `null`. Prisma list
 * columns cannot be null, so `null` is stored as an empty list.
 */
const NULLABLE_LIST_FIELDS = {
  deviceCode: new Set(["resources"]),
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

function isStoredAuthHashDigest(value: string): boolean {
  return STORED_HASH_DIGEST_RE.test(value);
}

export function hashAuthLookupValue(value: string, label: string): string {
  // Deterministic keyed hashing is intentional here so opaque random tokens can
  // be matched without storing them in plaintext.
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
  // Only mutation lookups (update/delete) may match an already-stored digest verbatim.
  // Read paths (findOne/findMany/count) MUST always re-hash so a leaked digest cannot be
  // presented as a raw credential to establish or read a session (pass-the-hash).
  allowStoredDigest = false,
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
      // Session reads return the persisted digest. Better Auth reuses that value
      // for update/delete lookups; hashing again would miss the row (Prisma P2025).
      // This shortcut is confined to mutation lookups — never the auth read path.
      if (allowStoredDigest && isStoredAuthHashDigest(clause.value)) {
        return clause;
      }

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
  const listFields =
    NULLABLE_LIST_FIELDS[model as keyof typeof NULLABLE_LIST_FIELDS];

  for (const [field, value] of Object.entries(nextData)) {
    if (value === null && listFields?.has(field)) {
      nextData[field] = [];
      continue;
    }

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

const DECRYPT_FAILURE = Symbol("auth-storage:decrypt-failure");

async function restoreReadResult<T>(model: string, result: T): Promise<T> {
  if (!result) {
    return result;
  }

  if (Array.isArray(result)) {
    const restoredItems = await Promise.all(
      result.map((item) => restoreReadResultInternal(model, item)),
    );
    // Drop rows whose encrypted fields could not be decrypted (e.g. rows
    // encrypted with a prior BETTER_AUTH_SECRET). Returning them would propagate
    // a thrown error up the RSC render and cause a full-screen error flash; the
    // rows are unusable anyway, so filtering lets other valid rows continue to
    // work (e.g. signing with a newer JWKS key).
    return restoredItems.filter((item) => item !== DECRYPT_FAILURE) as T;
  }

  const restored = await restoreReadResultInternal(model, result);
  if (restored === DECRYPT_FAILURE) {
    // Single-row reads: re-throw so callers see the real error instead of a
    // silently missing record (which could hide bugs in write paths).
    throw new Error(
      `Failed to decrypt stored auth field(s) for ${model}; check BETTER_AUTH_SECRET`,
    );
  }
  return restored as T;
}

async function restoreReadResultInternal<T>(
  model: string,
  result: T,
): Promise<T | typeof DECRYPT_FAILURE> {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return result;
  }

  const restored = { ...(result as Record<string, unknown>) };
  for (const [field, value] of Object.entries(restored)) {
    if (typeof value === "string" && isEncryptedField(model, field)) {
      try {
        restored[field] = await decryptAuthSecret(
          value,
          getFieldLabel(model, field),
        );
      } catch (error) {
        console.warn(
          `[auth-storage] Skipping ${model} row: failed to decrypt ${field}`,
          error instanceof Error ? error.message : error,
        );
        return DECRYPT_FAILURE;
      }
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

/**
 * A read that matched a hashed field by its raw value gets that raw value
 * back instead of the stored digest. Callers such as the device plugin
 * compare the returned field with the value they looked up.
 */
function restoreMatchedWhereValues<T>(
  model: string,
  where: AdapterWhere[] | undefined,
  result: T,
): T {
  if (!result || typeof result !== "object" || !where?.length) {
    return result;
  }

  const rawValues = new Map<string, string>();
  for (const clause of where) {
    if (
      typeof clause.value === "string" &&
      isHashedField(model, clause.field) &&
      (clause.operator === undefined || clause.operator === "eq") &&
      (clause.connector === undefined || clause.connector === "AND")
    ) {
      rawValues.set(clause.field, clause.value);
    }
  }
  if (rawValues.size === 0) {
    return result;
  }

  const restoreRow = (row: unknown) => {
    if (!row || typeof row !== "object") return row;
    const restored = { ...(row as Record<string, unknown>) };
    for (const [field, raw] of rawValues) {
      if (
        restored[field] ===
        hashAuthLookupValue(raw, getFieldLabel(model, field))
      ) {
        restored[field] = raw;
      }
    }
    return restored;
  };

  return (
    Array.isArray(result) ? result.map(restoreRow) : restoreRow(result)
  ) as T;
}

type SecureAdapter = DBTransactionAdapter & {
  transaction?: DBAdapter["transaction"];
};

function isRecordNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2025"
  );
}

/**
 * Wraps every adapter entry point that reads or writes hashed/encrypted
 * fields. better-auth 1.7 runs many flows (verification consume, sign-up,
 * update-user) inside `transaction`, which hands the callback a fresh
 * transaction-scoped adapter, so that adapter must be wrapped as well or the
 * lookups bypass the hashing and miss.
 */
function wrapSecureAdapter<A extends SecureAdapter>(adapter: A): A {
  const wrapped: SecureAdapter = {
    ...adapter,
    async create(args) {
      const data = await transformStoredData(args.model, args.data);
      const result = await adapter.create({ ...args, data });
      return restoreWriteResult(args.model, result, args.data);
    },
    async findOne(args) {
      const result = await adapter.findOne({
        ...args,
        where: transformStoredWhere(args.model, args.where),
      });
      return restoreMatchedWhereValues(
        args.model,
        args.where,
        await restoreReadResult(args.model, result),
      );
    },
    async findMany(args) {
      const result = await adapter.findMany({
        ...args,
        where: transformStoredWhere(args.model, args.where),
      });
      return restoreMatchedWhereValues(
        args.model,
        args.where,
        await restoreReadResult(args.model, result),
      );
    },
    async count(args) {
      return adapter.count({
        ...args,
        where: transformStoredWhere(args.model, args.where),
      });
    },
    async update(args) {
      const update = await transformStoredData(args.model, args.update);
      const result = await adapter.update({
        ...args,
        where: transformStoredWhere(args.model, args.where, true),
        update,
      });
      return restoreWriteResult(args.model, result, args.update);
    },
    async updateMany(args) {
      return adapter.updateMany({
        ...args,
        where: transformStoredWhere(args.model, args.where, true),
        update: await transformStoredData(args.model, args.update),
      });
    },
    async delete(args) {
      try {
        return await adapter.delete({
          ...args,
          where: transformStoredWhere(args.model, args.where, true),
        });
      } catch (error) {
        // P2025: "Record to delete does not exist." Treat as success — the
        // desired post-state (record absent) is already met. This avoids
        // crashes when better-auth deletes a session whose token was hashed
        // under a previous BETTER_AUTH_SECRET and can no longer be matched.
        if (isRecordNotFound(error)) {
          return;
        }
        throw error;
      }
    },
    async deleteMany(args) {
      return adapter.deleteMany({
        ...args,
        where: transformStoredWhere(args.model, args.where, true),
      });
    },
    // Single-use destructive read (verification tokens, codes): always
    // re-hash, like the other read paths.
    async consumeOne(args) {
      const result = await adapter.consumeOne({
        ...args,
        where: transformStoredWhere(args.model, args.where),
      });
      return restoreMatchedWhereValues(
        args.model,
        args.where,
        await restoreReadResult(args.model, result),
      );
    },
    async incrementOne(args) {
      const set = args.set
        ? await transformStoredData(args.model, args.set)
        : args.set;
      const result = await adapter.incrementOne({
        ...args,
        where: transformStoredWhere(args.model, args.where, true),
        set,
      });
      return restoreWriteResult(args.model, result, args.set ?? {});
    },
  };

  if (adapter.transaction) {
    const baseTransaction = adapter.transaction;
    wrapped.transaction = (callback) =>
      baseTransaction((trx) => callback(wrapSecureAdapter(trx)));
  }

  return wrapped as A;
}

export function securePrismaAuthAdapter(
  client: typeof prisma,
  config: Parameters<typeof prismaAdapter>[1],
) {
  const baseFactory = prismaAdapter(client, config);

  return (options: Parameters<ReturnType<typeof prismaAdapter>>[0]) =>
    wrapSecureAdapter(baseFactory(options));
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

export async function updateVerificationValue(id: string, value: string) {
  return prisma.verification.update({
    where: { id },
    data: { value },
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

export async function deleteSessionByRawToken(token: string) {
  return prisma.session.deleteMany({
    where: {
      token: hashAuthLookupValue(token, getFieldLabel("session", "token")),
    },
  });
}
