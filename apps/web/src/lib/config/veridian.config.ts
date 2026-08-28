function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

export const veridianConfig = {
  credentialServerUrl: readOptionalEnv("VERIDIAN_CREDENTIAL_SERVER_URL"),
  agentVerificationSchemaSaid: readOptionalEnv(
    "VERIDIAN_AGENT_VERIFICATION_SCHEMA_SAID",
  ),
  keriaUrl: readOptionalEnv("VERIDIAN_KERIA_URL"),
  /** KERIA boot endpoint (port 3903). Falls back to the public wallet URL when unset. */
  keriaBootUrl:
    readOptionalEnv("VERIDIAN_KERIA_BOOT_URL") ??
    readOptionalEnv("NEXT_PUBLIC_VERIDIAN_KERIA_BOOT_URL"),
  issuerBranEncrypted: readOptionalEnv("VERIDIAN_ISSUER_BRAN_ENCRYPTED"),
  /** Plaintext issuer bran — local dev only; use {@link issuerBranEncrypted} in production. */
  issuerBranPlain: readOptionalEnv("VERIDIAN_ISSUER_BRAN"),
  /**
   * Trusted credential issuer AID (KERI prefix). When set, on-chain verification
   * rejects any credential not issued by this AID as a defence-in-depth check, so a
   * change to the credential-server fetch surface can never let a credential from an
   * untrusted issuer be treated as verified. Leave unset to skip the pin (still safe
   * because credentials are fetched from the trusted issuer's own credential server).
   */
  issuerAid: readOptionalEnv("VERIDIAN_ISSUER_AID"),
} as const;
