import {
  buildNetworkedOidcScope,
  type OidcApiScope,
} from "@/lib/config/oidc-scopes.config";

import { type AuthenticatedApiContext, ForbiddenError } from "./utils";

export function requireOidcApiScope(
  authContext: AuthenticatedApiContext,
  requiredScope: OidcApiScope | string,
): void {
  if (authContext.authMethod !== "oidcAccessToken") {
    return;
  }

  if (authContext.oidcScopes.includes(requiredScope)) {
    return;
  }

  throw new ForbiddenError(`Missing required scope: ${requiredScope}`);
}

export function requireAnyOidcApiScope(
  authContext: AuthenticatedApiContext,
  requiredScopes: ReadonlyArray<OidcApiScope | string>,
): string | null {
  if (authContext.authMethod !== "oidcAccessToken") {
    return null;
  }

  for (const scope of requiredScopes) {
    if (authContext.oidcScopes.includes(scope)) {
      return scope;
    }
  }

  throw new ForbiddenError(
    `Missing one of the required scopes: ${requiredScopes.join(", ")}`,
  );
}

export function requireNetworkedOidcApiScope(
  authContext: AuthenticatedApiContext,
  options: {
    resource: "agents" | "credentials" | "activity" | "earnings" | "dashboard";
    action: "read" | "write";
    network: "Mainnet" | "Preprod" | "mainnet" | "preprod";
  },
): string {
  const scope = buildNetworkedOidcScope(
    options.resource,
    options.action,
    options.network,
  );
  requireOidcApiScope(authContext, scope);
  return scope;
}

export function requireAnyNetworkedOidcApiScope(
  authContext: AuthenticatedApiContext,
  options: {
    resource: "agents" | "credentials" | "activity" | "earnings" | "dashboard";
    action: "read" | "write";
  },
): string | null {
  return requireAnyOidcApiScope(authContext, [
    buildNetworkedOidcScope(options.resource, options.action, "preprod"),
    buildNetworkedOidcScope(options.resource, options.action, "mainnet"),
  ]);
}

export function rejectOidcAccessTokenAuth(
  authContext: AuthenticatedApiContext,
  message = "OIDC access tokens are not supported for this endpoint",
): void {
  if (authContext.authMethod === "oidcAccessToken") {
    throw new ForbiddenError(message);
  }
}
