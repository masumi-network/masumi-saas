import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

const ALG = "aes-256-gcm";
const KEY_LEN = 32;
/** 12 bytes (96 bits) per NIST SP 800-38D for AES-GCM; decrypt supports legacy 16-byte IVs from stored ciphertext. */
const IV_LEN = 12;
const TAG_LEN = 16;

/**
 * Context string for HKDF (RFC 5869 / NIST SP 800-108). Industry-standard key derivation from a secret;
 * the info parameter binds the key to this use.
 * Salt: optional PAYMENT_NODE_KEY_SALT gives per-deployment key separation; when unset, empty salt (backward compatible).
 */
const KDF_INFO = "payment-node-aes-256-gcm-key";

function getKdfSalt(): Buffer {
  const s = process.env.PAYMENT_NODE_KEY_SALT;
  return s?.trim() ? Buffer.from(s.trim(), "utf8") : Buffer.alloc(0);
}

function getEncryptionKey(saltOverride?: Buffer): Buffer {
  const raw = process.env.PAYMENT_NODE_ENCRYPTION_KEY;
  if (!raw?.trim()) {
    throw new Error(
      "PAYMENT_NODE_ENCRYPTION_KEY is required to encrypt payment node API keys",
    );
  }
  const ikm = Buffer.from(raw.trim(), "utf8");
  const salt = saltOverride !== undefined ? saltOverride : getKdfSalt();
  return Buffer.from(hkdfSync("sha256", ikm, salt, KDF_INFO, KEY_LEN));
}

/**
 * Encrypt a plaintext (e.g. payment node API key) for storage.
 * Returns a string that includes iv:tag:encrypted (all hex).
 */
export async function encryptPaymentNodeSecret(
  plaintext: string,
): Promise<string> {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv, { authTagLength: TAG_LEN });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("hex"),
    tag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

/**
 * Decrypt a value produced by encryptPaymentNodeSecret.
 * @param options.keySalt - When re-encrypting (migration), pass Buffer.alloc(0) to decrypt with the legacy key (no PAYMENT_NODE_KEY_SALT).
 */
export async function decryptPaymentNodeSecret(
  ciphertext: string,
  options?: { keySalt?: Buffer },
): Promise<string> {
  const key =
    options?.keySalt !== undefined
      ? getEncryptionKey(options.keySalt)
      : getEncryptionKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid payment node encrypted value");
  }
  const [ivHex, tagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = createDecipheriv(ALG, key, iv, { authTagLength: TAG_LEN });
  decipher.setAuthTag(tag);
  const chunks = [decipher.update(encrypted), decipher.final()];
  return Buffer.concat(chunks).toString("utf8");
}
