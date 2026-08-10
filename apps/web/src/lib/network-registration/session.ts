import "server-only";

import prisma from "@masumi/database/client";

import { getBetterAuthInnerSession } from "@/lib/auth/session-types";
import { getAuthContext } from "@/lib/auth/utils";

export type NetworkRegisterSessionContext =
  | { kind: "not_found" }
  | {
      kind: "sign_in_required";
      returnPath: string;
      registrationEmail: string;
    }
  | {
      kind: "wrong_account";
      returnPath: string;
      registrationEmail: string;
      signedInEmail: string;
    }
  | {
      kind: "ok";
      draft: {
        id: string;
        email: string;
        agentId: string | null;
        status: string;
      };
      user: { id: string; name: string | null; email: string | null };
      activeOrganizationId: string | null;
    };

export async function resolveNetworkRegisterSession(params: {
  draftId: string;
  returnPath: string;
}): Promise<NetworkRegisterSessionContext> {
  const draft = await prisma.networkRegistrationDraft.findUnique({
    where: { id: params.draftId.trim() },
    select: {
      id: true,
      email: true,
      agentId: true,
      status: true,
    },
  });

  if (!draft) {
    return { kind: "not_found" };
  }

  const registrationEmail = draft.email.trim().toLowerCase();
  const authContext = await getAuthContext();

  if (!authContext.isAuthenticated || !authContext.session) {
    return {
      kind: "sign_in_required",
      returnPath: params.returnPath,
      registrationEmail,
    };
  }

  const signedInEmail = authContext.session.user.email?.trim().toLowerCase();
  if (!signedInEmail || signedInEmail !== registrationEmail) {
    return {
      kind: "wrong_account",
      returnPath: params.returnPath,
      registrationEmail,
      signedInEmail: signedInEmail ?? "",
    };
  }

  return {
    kind: "ok",
    draft,
    user: {
      id: authContext.session.user.id,
      name: authContext.session.user.name ?? null,
      email: authContext.session.user.email ?? null,
    },
    activeOrganizationId:
      getBetterAuthInnerSession(authContext.session)?.activeOrganizationId ??
      null,
  };
}
