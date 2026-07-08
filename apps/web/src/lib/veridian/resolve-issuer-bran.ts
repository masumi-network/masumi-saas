import { veridianConfig } from "@/lib/config/veridian.config";
import { decryptPaymentNodeSecret } from "@/lib/payment-node/encryption";

/**
 * Resolve the credential-server issuer bran for KERIA Signify access.
 * Prefer `VERIDIAN_ISSUER_BRAN_ENCRYPTED` (AES-GCM via PAYMENT_NODE_ENCRYPTION_KEY).
 */
export async function resolveIssuerBran(): Promise<string | null> {
  if (veridianConfig.issuerBranEncrypted) {
    try {
      return await decryptPaymentNodeSecret(veridianConfig.issuerBranEncrypted);
    } catch (error) {
      // Log only the message (not the full error/stack) to avoid leaking key
      // material or env details from the decrypt failure.
      console.error(
        "[Veridian] Failed to decrypt VERIDIAN_ISSUER_BRAN_ENCRYPTED:",
        error instanceof Error ? error.message : "unknown error",
      );
      return null;
    }
  }

  if (veridianConfig.issuerBranPlain) {
    // A plaintext issuer bran grants full control of the issuer's KERIA channel.
    // Refuse to use it in production so a misconfigured deploy fails closed
    // rather than silently running on an insecurely-stored secret.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "VERIDIAN_ISSUER_BRAN (plaintext) must not be used in production — set VERIDIAN_ISSUER_BRAN_ENCRYPTED instead.",
      );
    }
    return veridianConfig.issuerBranPlain;
  }

  return null;
}

export function isIssuerKeriaConfigured(): boolean {
  return Boolean(
    veridianConfig.keriaUrl &&
    veridianConfig.keriaBootUrl &&
    (veridianConfig.issuerBranEncrypted || veridianConfig.issuerBranPlain),
  );
}
