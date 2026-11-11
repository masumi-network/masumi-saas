import { resolveOidcClientKey } from "@/lib/config/oidc.config";

import type { OidcScopeResolution } from "../oidc-user-grants";

function getScopeRemovalReasonLabel(
  reason: OidcScopeResolution["removedScopes"][number]["reason"],
): string {
  switch (reason) {
    case "unsupported_scope":
      return "scope is not part of the supported OIDC scope catalog";
    case "not_allowed_for_client":
      return "scope is not allowlisted for this client";
    case "not_yet_granted":
      return "scope has not been approved for this user yet";
    default:
      return reason;
  }
}

export function logOidcScopeResolution(
  flow: "authorize-request" | "device-code-request" | "session-token-request",
  clientId: string,
  resolution: OidcScopeResolution,
  extra?: Record<string, unknown>,
) {
  if (!resolveOidcClientKey(clientId)) {
    return;
  }

  const removedScopes = resolution.removedScopes.map((item) => ({
    scope: item.scope,
    reason: getScopeRemovalReasonLabel(item.reason),
  }));

  if (removedScopes.length === 0) {
    return;
  }

  console.warn("[oidc scopes removed]", {
    flow,
    clientId,
    removedScopes,
    ...extra,
  });
}
