/**
 * Extract the holder AID from a KERI OOBI URL.
 * Typical paths: /oobi/{AID}/witness/{witnessId} or /oobi/{AID}/agent/{agentId}
 */
export function parseAidFromOobi(oobi: string): string | null {
  try {
    const url = new URL(oobi.trim());
    const segments = url.pathname.split("/").filter(Boolean);
    const oobiIndex = segments.indexOf("oobi");
    if (oobiIndex !== -1 && segments[oobiIndex + 1]) {
      return segments[oobiIndex + 1];
    }
  } catch {
    // Invalid URL
  }
  return null;
}
