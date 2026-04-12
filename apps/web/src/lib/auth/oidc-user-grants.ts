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
  const requestedScopes = normalizeScopeList(options.requestedScopes);
  const clientKey = resolveOidcClientKey(options.clientId);

  if (!clientKey) {
    return requestedScopes.filter((scope) => isOidcStandardScope(scope));
  }

  const allowedScopes = new Set(getAllowedScopesForClient(clientKey));
  const standardScopes = requestedScopes.filter(
    (scope) => isOidcStandardScope(scope) && allowedScopes.has(scope),
  );

  if (!options.userId) {
    return standardScopes.concat(
      requestedScopes.filter(
        (scope) => isOidcApiScope(scope) && allowedScopes.has(scope),
      ),
    );
  }

  const storedGrantScopes = new Set(
    await getStoredOidcGrantScopes(options.userId, options.clientId),
  );

  return standardScopes.concat(
    requestedScopes.filter(
      (scope) =>
        isOidcApiScope(scope) &&
        allowedScopes.has(scope) &&
        storedGrantScopes.has(scope),
    ),
  );
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
