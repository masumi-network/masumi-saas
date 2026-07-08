import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

import { x402Config } from "./config.js";

// Authenticated encryption for x402 wallet private keys and reusable payment
// authorizations. AES-256-GCM provides tamper detection via the auth tag, which
// AES-256-CBC (the previous scheme) lacked. New values use the "gcm:" prefix;
// legacy CBC values (pure hex, no prefix) remain decryptable for backward
// compatibility with already-stored ciphertext.
const GCM_PREFIX = "gcm";
const ALG = "aes-256-gcm";
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

const LEGACY_CBC_ALG = "aes-256-cbc";
const LEGACY_SALT_LEN = 16;
const LEGACY_IV_LEN = 16;

function deriveKey(salt: Buffer): Buffer {
  return scryptSync(x402Config.encryptionKey, salt, KEY_LEN);
}

export function encrypt(secret: string): string {
  const salt = randomBytes(SALT_LEN);
  const key = deriveKey(salt);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv, { authTagLength: TAG_LEN });
  const encrypted = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    GCM_PREFIX,
    salt.toString("hex"),
    iv.toString("hex"),
    tag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

export function decrypt(secretEncrypted: string): string {
  if (secretEncrypted.startsWith(`${GCM_PREFIX}:`)) {
    return decryptGcm(secretEncrypted);
  }
  return decryptLegacyCbc(secretEncrypted);
}

function decryptGcm(secretEncrypted: string): string {
  const [, saltHex, ivHex, tagHex, dataHex] = secretEncrypted.split(":");
  if (!saltHex || !ivHex || !tagHex || dataHex === undefined) {
    throw new Error("Invalid x402 encrypted value: malformed GCM payload");
  }

  const key = deriveKey(Buffer.from(saltHex, "hex"));
  const decipher = createDecipheriv(ALG, key, Buffer.from(ivHex, "hex"), {
    authTagLength: TAG_LEN,
  });
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

function decryptLegacyCbc(secretEncrypted: string): string {
  const secret = Buffer.from(secretEncrypted, "hex");
  if (secret.length <= LEGACY_SALT_LEN + LEGACY_IV_LEN) {
    throw new Error("Invalid x402 encrypted value: too short");
  }

  const salt = secret.subarray(0, LEGACY_SALT_LEN);
  const iv = secret.subarray(LEGACY_SALT_LEN, LEGACY_SALT_LEN + LEGACY_IV_LEN);
  const key = deriveKey(salt);
  const encryptedData = secret.subarray(LEGACY_SALT_LEN + LEGACY_IV_LEN);
  const decryptionCipher = createDecipheriv(LEGACY_CBC_ALG, key, iv);

  return (
    decryptionCipher.update(encryptedData, undefined, "utf8") +
    decryptionCipher.final("utf8")
  );
}
