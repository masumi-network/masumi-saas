function requireEncryptionKey(): string {
  const raw = process.env.X402_ENCRYPTION_KEY?.trim();
  if (!raw || raw.length < 32) {
    throw new Error(
      "X402_ENCRYPTION_KEY is required (at least 32 characters) for x402 wallet and payload encryption. Set it in apps/web/.env — see .env.example.",
    );
  }
  return raw;
}

export const x402Config = {
  get encryptionKey(): string {
    return requireEncryptionKey();
  },
};
