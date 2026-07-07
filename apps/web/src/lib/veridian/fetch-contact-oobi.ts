import { getCredentialServerUrl } from "@/lib/veridian/index";
import { z } from "@/lib/zod-openapi";

const contactSchema = z.object({
  id: z.string().optional(),
  oobi: z.string().optional(),
});

const contactsResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(contactSchema),
});

/**
 * Load a holder's OOBI from the credential server contact list.
 * The server stores OOBI when an AID is connected via resolveOobi.
 */
export async function fetchContactOobi(
  holderAid: string,
): Promise<string | null> {
  const aid = holderAid.trim();
  if (!aid) return null;

  const url = `${getCredentialServerUrl()}/contacts`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      console.error(
        "[Veridian] Failed to fetch contacts for holder OOBI:",
        response.status,
        response.statusText,
      );
      return null;
    }

    const parsed = contactsResponseSchema.safeParse(await response.json());
    if (!parsed.success || !parsed.data.success) {
      return null;
    }

    const contact = parsed.data.data.find((entry) => entry.id === aid);
    const oobi = contact?.oobi?.trim();
    return oobi || null;
  } catch (error) {
    console.error("[Veridian] Failed to fetch contacts for holder OOBI:", {
      holderAid: aid,
      error,
    });
    return null;
  }
}
