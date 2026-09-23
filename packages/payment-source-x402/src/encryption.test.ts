import { afterEach, describe, expect, it } from "vitest";

import { decrypt, encrypt } from "./encryption.js";

const ACTIVE_KEY = "test-x402-encryption-key-32chars!!";

afterEach(() => {
  delete process.env.X402_ENCRYPTION_KEY_ID;
  delete process.env.X402_ENCRYPTION_KEYS_RETIRED;
  process.env.X402_ENCRYPTION_KEY = ACTIVE_KEY;
});

describe("encrypt/decrypt", () => {
  it("round-trips a secret and embeds the active key id", () => {
    process.env.X402_ENCRYPTION_KEY_ID = "v2";
    const ciphertext = encrypt("super-secret-private-key");
    expect(ciphertext.startsWith("gcm:v2:")).toBe(true);
    expect(decrypt(ciphertext)).toBe("super-secret-private-key");
  });

  it("defaults the key id to v1 when unset", () => {
    const ciphertext = encrypt("value");
    expect(ciphertext.startsWith("gcm:v1:")).toBe(true);
    expect(decrypt(ciphertext)).toBe("value");
  });

  it("still decrypts legacy gcm ciphertext with no key id", () => {
    // Simulate a value written before key ids existed: gcm:salt:iv:tag:data.
    process.env.X402_ENCRYPTION_KEY_ID = "v1";
    const keyed = encrypt("legacy-value");
    const [, , salt, iv, tag, data] = keyed.split(":");
    const legacy = ["gcm", salt, iv, tag, data].join(":");
    expect(decrypt(legacy)).toBe("legacy-value");
  });

  it("decrypts a value written under a now-retired key after rotation", () => {
    // Written under the old active key "v1".
    process.env.X402_ENCRYPTION_KEY = "old-key-that-is-32-chars-long!!!!";
    process.env.X402_ENCRYPTION_KEY_ID = "v1";
    const oldCiphertext = encrypt("rotate-me");

    // Rotate: new active key "v2", old key retired under id "v1".
    process.env.X402_ENCRYPTION_KEY = "new-active-key-32-characters-xx!!";
    process.env.X402_ENCRYPTION_KEY_ID = "v2";
    process.env.X402_ENCRYPTION_KEYS_RETIRED =
      "v1=old-key-that-is-32-chars-long!!!!";

    expect(decrypt(oldCiphertext)).toBe("rotate-me");
    const fresh = encrypt("fresh");
    expect(fresh.startsWith("gcm:v2:")).toBe(true);
    expect(decrypt(fresh)).toBe("fresh");
  });

  it("throws for an unknown key id", () => {
    const forged = "gcm:ghost:00:00:00:00";
    expect(() => decrypt(forged)).toThrow(/Unknown x402 encryption key id/);
  });
});
