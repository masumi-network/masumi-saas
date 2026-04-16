"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  type ConnectedOidcClient,
  listConnectedOidcClients,
  revokeOidcClientConnection,
} from "@/lib/auth/connected-oidc-clients";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";

const terminateSchema = z.object({
  clientId: z
    .string()
    .min(1, "Client id is required")
    .max(256, "Client id is too long"),
});

export type TerminateConnectedAppResult =
  | {
      success: true;
      deletedTokens: number;
      deletedConsents: number;
      deletedGrants: number;
    }
  | { success: false; error: string };

export async function terminateConnectedAppAction(
  rawClientId: string,
): Promise<TerminateConnectedAppResult> {
  const { user } = await getAuthenticatedOrThrow();
  const parsed = terminateSchema.safeParse({ clientId: rawClientId });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid client id",
    };
  }

  try {
    const result = await revokeOidcClientConnection(
      user.id,
      parsed.data.clientId,
    );

    console.info("[connected apps] revoked", {
      userId: user.id,
      clientId: parsed.data.clientId,
      ...result,
    });

    revalidatePath("/account");

    return {
      success: true,
      deletedTokens: result.deletedTokens,
      deletedConsents: result.deletedConsents,
      deletedGrants: result.deletedGrants,
    };
  } catch (error) {
    console.error("[connected apps] failed to revoke", {
      userId: user.id,
      clientId: parsed.data.clientId,
      error,
    });
    return {
      success: false,
      error: "Failed to terminate connection. Please try again.",
    };
  }
}

export async function getConnectedAppsAction(): Promise<ConnectedOidcClient[]> {
  const { user } = await getAuthenticatedOrThrow();
  return listConnectedOidcClients(user.id);
}
