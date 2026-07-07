import { fetchContactOobi } from "@/lib/veridian/fetch-contact-oobi";

/**
 * Prefer OOBI stored at issue time; otherwise load from the credential server
 * contact that was established when the wallet connected.
 */
export async function resolveHolderOobi(params: {
  storedHolderOobi?: string | null;
  holderAid?: string | null;
}): Promise<string | null> {
  const stored = params.storedHolderOobi?.trim();
  if (stored) return stored;

  const holderAid = params.holderAid?.trim();
  if (!holderAid) return null;

  return fetchContactOobi(holderAid);
}
