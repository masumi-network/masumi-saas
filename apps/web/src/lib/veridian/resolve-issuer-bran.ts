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
      console.error(
        "[Veridian] Failed to decrypt VERIDIAN_ISSUER_BRAN_ENCRYPTED:",
        error,
      );
      return null;
    }
  }

  if (veridianConfig.issuerBranPlain) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[Veridian] VERIDIAN_ISSUER_BRAN is set in production — use VERIDIAN_ISSUER_BRAN_ENCRYPTED instead",
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
