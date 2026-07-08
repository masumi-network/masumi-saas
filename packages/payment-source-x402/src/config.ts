function requireEncryptionKey(): string {
  const raw = process.env.X402_ENCRYPTION_KEY?.trim();
  if (!raw || raw.length < 32) {
    throw new Error(
      "X402_ENCRYPTION_KEY is required (at least 32 characters) for x402 wallet and payload encryption. Set it in apps/web/.env — see .env.example.",
    );
  }
  return raw;
}

const DEFAULT_KEY_ID = "v1";
const KEY_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function getActiveKeyId(): string {
  const raw = process.env.X402_ENCRYPTION_KEY_ID?.trim();
  const keyId = raw || DEFAULT_KEY_ID;
  if (!KEY_ID_PATTERN.test(keyId)) {
    throw new Error(
      "X402_ENCRYPTION_KEY_ID must match [A-Za-z0-9_-]+ (it is embedded in the ciphertext).",
    );
  }
  return keyId;
}

/**
 * Retired keys kept ONLY to decrypt values written before a rotation. The
 * active key still comes from `X402_ENCRYPTION_KEY`; to rotate, move the old key
 * here under its id and set a new active key + `X402_ENCRYPTION_KEY_ID`.
 * Format: "id1=key1,id2=key2".
 */
function parseRetiredKeys(): Map<string, string> {
  const raw = process.env.X402_ENCRYPTION_KEYS_RETIRED?.trim();
  const map = new Map<string, string>();
  if (!raw) return map;
  for (const entry of raw.split(",")) {
    const idx = entry.indexOf("=");
    if (idx <= 0) continue;
    const id = entry.slice(0, idx).trim();
    const key = entry.slice(idx + 1).trim();
    if (id && KEY_ID_PATTERN.test(id) && key) map.set(id, key);
  }
  return map;
}

export const x402Config = {
  /** Active key material — used for new encryptions and legacy (no-keyId) values. */
  get encryptionKey(): string {
    return requireEncryptionKey();
  },
  /** Key id embedded in newly written ciphertext. */
  get activeEncryptionKeyId(): string {
    return getActiveKeyId();
  },
  /** Resolve key material for a given key id (active or retired). */
  resolveEncryptionKey(keyId: string): string {
    if (keyId === getActiveKeyId()) return requireEncryptionKey();
    const retired = parseRetiredKeys().get(keyId);
    if (retired) return retired;
    throw new Error(`Unknown x402 encryption key id: ${keyId}`);
  },
};
