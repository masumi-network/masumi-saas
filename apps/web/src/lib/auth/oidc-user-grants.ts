import prisma from "@masumi/database/client";

import { resolveOidcClientKey } from "@/lib/config/oidc.config";
import {
  getAllowedApiScopesForClient,
  getAllowedScopesForClient,
  isOidcApiScope,
  isOidcStandardScope,
  normalizeScopeList,
  type OidcClientKey,
  serializeScopeList,
} from "@/lib/config/oidc-scopes.config";

type OidcRemovedScopeReason =
  | "unsupported_scope"
  | "not_allowed_for_client"
  | "not_yet_granted";

export type OidcRemovedScope = {
  scope: string;
  reason: OidcRemovedScopeReason;
};

export type OidcScopeResolution = {
  clientKey: OidcClientKey | null;
  requestedScopes: string[];
  allowedScopes: string[];
  storedGrantScopes: string[];
  finalScopes: string[];
  removedScopes: OidcRemovedScope[];
};

type OidcUserGrantDelegate = {
  findUnique: (
    ...args: unknown[]
  ) => Promise<{ scopes?: string[] | null } | null>;
  findMany: (
    ...args: unknown[]
  ) => Promise<Array<{ clientId: string; scopes?: string[] | null }>>;
  upsert: (...args: unknown[]) => Promise<unknown>;
  deleteMany: (...args: unknown[]) => Promise<unknown>;
};

let didWarnAboutMissingOidcGrantStorage = false;

function getOidcUserGrantDelegate(): OidcUserGrantDelegate | null {
  const delegate = (prisma as { oidcUserGrant?: OidcUserGrantDelegate })
    .oidcUserGrant;

  if (delegate) {
    return delegate;
  }

  if (!didWarnAboutMissingOidcGrantStorage) {
    didWarnAboutMissingOidcGrantStorage = true;
    console.warn(
      "[oidc grants] Prisma runtime does not expose oidcUserGrant yet. Falling back to no stored API grants until the app is restarted with the regenerated client.",
    );
  }

  return null;
}

function isMissingOidcGrantStorageError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };
  return (
    maybeError.code === "P2021" ||
    maybeError.code === "P2022" ||
    maybeError.message?.includes("oidcUserGrant") === true
  );
}

function sanitizeGrantScopesForClient(
  clientKey: OidcClientKey,
  scopes: Iterable<string> | string | null | undefined,
): string[] {
  const allowed = new Set(getAllowedApiScopesForClient(clientKey));
  return normalizeScopeList(scopes).filter(
    (scope) => isOidcApiScope(scope) && allowed.has(scope),
  );
}

export async function resolveOidcScopeGrantSet(options: {
  clientId: string;
  requestedScopes: Iterable<string> | string | null | undefined;
  userId?: string | null;
  enforceStoredGrants?: boolean;
}): Promise<OidcScopeResolution> {
  const requestedScopes = normalizeScopeList(options.requestedScopes);
  const clientKey = resolveOidcClientKey(options.clientId);

  if (!clientKey) {
    const finalScopes = requestedScopes.filter((scope) =>
      isOidcStandardScope(scope),
    );

    return {
      clientKey: null,
      requestedScopes,
      allowedScopes: [],
      storedGrantScopes: [],
      finalScopes,
      removedScopes: requestedScopes
        .filter((scope) => !isOidcStandardScope(scope))
        .map((scope) => ({
          scope,
          reason: "unsupported_scope" as const,
        })),
    };
  }

  const allowedScopes = getAllowedScopesForClient(clientKey);
  const allowedScopeSet = new Set(allowedScopes);
  const storedGrantScopes = options.userId
    ? await getStoredOidcGrantScopes(options.userId, options.clientId)
    : [];
  const storedGrantScopeSet = new Set(storedGrantScopes);
  const enforceStoredGrants = options.enforceStoredGrants === true;
  const finalScopes: string[] = [];
  const removedScopes: OidcRemovedScope[] = [];

  for (const scope of requestedScopes) {
    if (isOidcStandardScope(scope)) {
      if (allowedScopeSet.has(scope)) {
        finalScopes.push(scope);
      } else {
        removedScopes.push({
          scope,
          reason: "not_allowed_for_client",
        });
      }
      continue;
    }

    if (!isOidcApiScope(scope)) {
      removedScopes.push({
        scope,
        reason: "unsupported_scope",
      });
      continue;
    }

    if (!allowedScopeSet.has(scope)) {
      removedScopes.push({
        scope,
        reason: "not_allowed_for_client",
      });
      continue;
    }

    if (enforceStoredGrants && !storedGrantScopeSet.has(scope)) {
      removedScopes.push({
        scope,
        reason: "not_yet_granted",
      });
      continue;
    }

    finalScopes.push(scope);
  }

  return {
    clientKey,
    requestedScopes,
    allowedScopes,
    storedGrantScopes,
    finalScopes,
    removedScopes,
  };
}

export async function getStoredOidcGrantScopes(
  userId: string,
  clientId: string,
): Promise<string[]> {
  const clientKey = resolveOidcClientKey(clientId);
  if (!clientKey) {
    return [];
  }

  const delegate = getOidcUserGrantDelegate();
  if (!delegate) {
    return [];
  }

  try {
    const grant = await delegate.findUnique({
      where: {
        userId_clientId: {
          userId,
          clientId,
        },
      },
      select: {
        scopes: true,
      },
    });

    return sanitizeGrantScopesForClient(clientKey, grant?.scopes ?? []);
  } catch (error) {
    if (isMissingOidcGrantStorageError(error)) {
      console.warn(
        "[oidc grants] Stored OIDC grant table is unavailable. Falling back to no stored API grants.",
        error,
      );
      return [];
    }

    throw error;
  }
}

export async function filterRequestedOidcScopes(options: {
  clientId: string;
  requestedScopes: Iterable<string> | string | null | undefined;
  userId?: string | null;
}): Promise<string[]> {
  const resolution = await resolveOidcScopeGrantSet({
    ...options,
    enforceStoredGrants: true,
  });

  return resolution.finalScopes;
}

export async function allowRequestedOidcScopesForConsent(options: {
  clientId: string;
  requestedScopes: Iterable<string> | string | null | undefined;
  userId?: string | null;
}): Promise<string[]> {
  const resolution = await resolveOidcScopeGrantSet({
    ...options,
    enforceStoredGrants: false,
  });

  return resolution.finalScopes;
}

export function serializeRequestedOidcScopes(
  scopes: Iterable<string> | string | null | undefined,
): string {
  return serializeScopeList(normalizeScopeList(scopes));
}

export async function setUserOidcGrantScopes(options: {
  userId: string;
  clientId: string;
  scopes: Iterable<string> | string | null | undefined;
}): Promise<string[]> {
  const clientKey = resolveOidcClientKey(options.clientId);
  if (!clientKey) {
    throw new Error(`Unsupported OIDC client: ${options.clientId}`);
  }

  const sanitizedScopes = sanitizeGrantScopesForClient(
    clientKey,
    options.scopes,
  );

  if (sanitizedScopes.length === 0) {
    const delegate = getOidcUserGrantDelegate();
    if (!delegate) {
      throw new Error(
        "OIDC grant storage is unavailable. Restart the app after regenerating Prisma and applying the migration.",
      );
    }

    await delegate.deleteMany({
      where: {
        userId: options.userId,
        clientId: options.clientId,
      },
    });
    return [];
  }

  const delegate = getOidcUserGrantDelegate();
  if (!delegate) {
    throw new Error(
      "OIDC grant storage is unavailable. Restart the app after regenerating Prisma and applying the migration.",
    );
  }

  await delegate.upsert({
    where: {
      userId_clientId: {
        userId: options.userId,
        clientId: options.clientId,
      },
    },
    update: {
      scopes: sanitizedScopes,
    },
    create: {
      userId: options.userId,
      clientId: options.clientId,
      scopes: sanitizedScopes,
    },
  });

  return sanitizedScopes;
}

export async function addUserOidcGrantScopes(options: {
  userId: string;
  clientId: string;
  scopes: Iterable<string> | string | null | undefined;
}): Promise<string[]> {
  const existingScopes = await getStoredOidcGrantScopes(
    options.userId,
    options.clientId,
  );
  const requestedScopes = normalizeScopeList(options.scopes).filter((scope) =>
    isOidcApiScope(scope),
  );

  if (requestedScopes.length === 0) {
    return existingScopes;
  }

  return setUserOidcGrantScopes({
    userId: options.userId,
    clientId: options.clientId,
    scopes: [...existingScopes, ...requestedScopes],
  });
}

export async function getUserOidcGrantMap(
  userId: string,
): Promise<Record<OidcClientKey, string[]>> {
  const byClient: Record<OidcClientKey, string[]> = {
    web: [],
    cli: [],
  };

  const delegate = getOidcUserGrantDelegate();
  if (!delegate) {
    return byClient;
  }

  let grantRows: Array<{ clientId: string; scopes?: string[] | null }>;
  try {
    grantRows = await delegate.findMany({
      where: { userId },
      select: {
        clientId: true,
        scopes: true,
      },
    });
  } catch (error) {
    if (isMissingOidcGrantStorageError(error)) {
      console.warn(
        "[oidc grants] Stored OIDC grant table is unavailable. Returning empty grant map.",
        error,
      );
      return byClient;
    }

    throw error;
  }

  for (const row of grantRows) {
    const clientKey = resolveOidcClientKey(row.clientId);
    if (!clientKey) {
      continue;
    }

    byClient[clientKey] = sanitizeGrantScopesForClient(clientKey, row.scopes);
  }

  return byClient;
}
