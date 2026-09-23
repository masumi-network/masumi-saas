import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

import { x402Config } from "./config.js";

// Authenticated encryption for x402 wallet private keys and reusable payment
// authorizations. AES-256-GCM provides tamper detection via the auth tag, which
// AES-256-CBC (the previous scheme) lacked.
//
// Ciphertext formats (colon-delimited hex):
//   gcm:<keyId>:salt:iv:tag:data  — current; keyId selects the key from the
//                                   keyring so keys can be rotated gradually.
//   gcm:salt:iv:tag:data          — legacy GCM (no keyId): decrypted with the
//                                   active key for backward compatibility.
//   <hex>                         — legacy unauthenticated CBC (no prefix).
const GCM_PREFIX = "gcm";
// Cache-namespace sentinels for values that carry no explicit key id.
const LEGACY_GCM_KEY_ID = "__legacy_gcm__";
const LEGACY_CBC_KEY_ID = "__legacy_cbc__";
const ALG = "aes-256-gcm";
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

const LEGACY_CBC_ALG = "aes-256-cbc";
const LEGACY_SALT_LEN = 16;
const LEGACY_IV_LEN = 16;

// scrypt is deliberately expensive (~50-100ms). It runs on every decrypt, and
// decrypt is on the hot verify/settle/pay path (wallet + facilitator keys).
// Decrypt salts are stable (read from the stored ciphertext), so memoize the
// derived key per salt to avoid re-deriving — and blocking the event loop — on
// repeated use of the same wallet. Bounded LRU; derived keys share the same
// in-memory trust boundary as the master key, which is already resident.
const MAX_DERIVED_KEY_CACHE = 256;
const derivedKeyCache = new Map<string, Buffer>();

// Cache is keyed by (keyId, salt) — never the raw key material — so rotated keys
// don't collide and no secret is used as a Map key.
function deriveKey(keyId: string, keyMaterial: string, salt: Buffer): Buffer {
  const cacheKey = `${keyId}:${salt.toString("hex")}`;
  const cached = derivedKeyCache.get(cacheKey);
  if (cached) {
    derivedKeyCache.delete(cacheKey);
    derivedKeyCache.set(cacheKey, cached);
    return cached;
  }

  const key = scryptSync(keyMaterial, salt, KEY_LEN);
  derivedKeyCache.set(cacheKey, key);
  if (derivedKeyCache.size > MAX_DERIVED_KEY_CACHE) {
    const oldest = derivedKeyCache.keys().next().value;
    if (oldest !== undefined) derivedKeyCache.delete(oldest);
  }
  return key;
}

export function encrypt(secret: string): string {
  const keyId = x402Config.activeEncryptionKeyId;
  const salt = randomBytes(SALT_LEN);
  const key = deriveKey(keyId, x402Config.encryptionKey, salt);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv, { authTagLength: TAG_LEN });
  const encrypted = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    GCM_PREFIX,
    keyId,
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
  const parts = secretEncrypted.split(":");
  // gcm:<keyId>:salt:iv:tag:data (6) or legacy gcm:salt:iv:tag:data (5).
  let keyId: string;
  let keyMaterial: string;
  let saltHex: string | undefined;
  let ivHex: string | undefined;
  let tagHex: string | undefined;
  let dataHex: string | undefined;
  if (parts.length >= 6) {
    [, keyId, saltHex, ivHex, tagHex, dataHex] = parts;
    keyMaterial = x402Config.resolveEncryptionKey(keyId);
  } else {
    [, saltHex, ivHex, tagHex, dataHex] = parts;
    keyId = LEGACY_GCM_KEY_ID;
    keyMaterial = x402Config.encryptionKey;
  }
  if (!saltHex || !ivHex || !tagHex || dataHex === undefined) {
    throw new Error("Invalid x402 encrypted value: malformed GCM payload");
  }

  const key = deriveKey(keyId, keyMaterial, Buffer.from(saltHex, "hex"));
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
  const key = deriveKey(LEGACY_CBC_KEY_ID, x402Config.encryptionKey, salt);
  const encryptedData = secret.subarray(LEGACY_SALT_LEN + LEGACY_IV_LEN);
  const decryptionCipher = createDecipheriv(LEGACY_CBC_ALG, key, iv);

  return (
    decryptionCipher.update(encryptedData, undefined, "utf8") +
    decryptionCipher.final("utf8")
  );
}
