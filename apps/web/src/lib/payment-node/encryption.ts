import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

const ALG = "aes-256-gcm";
const KEY_LEN = 32;
const IV_LEN = 16;
const TAG_LEN = 16;

function getEncryptionKey(): Buffer {
  const raw = process.env.PAYMENT_NODE_ENCRYPTION_KEY;
  if (!raw?.trim()) {
    throw new Error(
      "PAYMENT_NODE_ENCRYPTION_KEY is required to encrypt payment node API keys",
    );
  }
  return scryptSync(raw, "payment-node-key", KEY_LEN);
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
 */
export async function decryptPaymentNodeSecret(
  ciphertext: string,
): Promise<string> {
  const key = getEncryptionKey();
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
  return decipher.update(encrypted) + decipher.final("utf8");
}
