export type OidcClientKey = "web" | "cli";

export const OIDC_STANDARD_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
] as const;

export type OidcStandardScope = (typeof OIDC_STANDARD_SCOPES)[number];

type OidcApiScopeDescriptor = {
  scope: string;
  label: string;
  description: string;
};

type OidcStandardScopeDescriptor = {
  scope: OidcStandardScope;
  label: string;
  description: string;
};

const OIDC_STANDARD_SCOPE_DESCRIPTORS: readonly OidcStandardScopeDescriptor[] =
  [
    {
      scope: "openid",
      label: "OpenID sign-in",
      description: "Use your Masumi identity to complete sign-in.",
    },
    {
      scope: "profile",
      label: "Profile",
      description: "Read your public profile claims such as name or picture.",
    },
    {
      scope: "email",
      label: "Email",
      description: "Read your email address and email verification status.",
    },
    {
      scope: "offline_access",
      label: "Offline access",
      description:
        "Issue a refresh token so the client can renew access without a full re-login.",
    },
  ] as const;

export const OIDC_API_SCOPE_GROUPS = [
  {
    key: "agents",
    label: "Agents",
    scopes: [
      {
        scope: "agents:read:preprod",
        label: "Read agents (Preprod)",
        description:
          "View agents, details, counts, transactions, and earnings on Preprod.",
      },
      {
        scope: "agents:write:preprod",
        label: "Manage agents (Preprod)",
        description:
          "Register, update, verify, deregister, or delete agents on Preprod.",
      },
      {
        scope: "agents:read:mainnet",
        label: "Read agents (Mainnet)",
        description:
          "View agents, details, counts, transactions, and earnings on Mainnet.",
      },
      {
        scope: "agents:write:mainnet",
        label: "Manage agents (Mainnet)",
        description:
          "Register, update, verify, deregister, or delete agents on Mainnet.",
      },
    ],
  },
  {
    key: "credentials",
    label: "Credentials",
    scopes: [
      {
        scope: "credentials:read:preprod",
        label: "Read credentials (Preprod)",
        description:
          "Inspect credential status and issuer metadata tied to Preprod agents.",
      },
      {
        scope: "credentials:write:preprod",
        label: "Issue credentials (Preprod)",
        description: "Issue or reconcile credentials tied to Preprod agents.",
      },
      {
        scope: "credentials:read:mainnet",
        label: "Read credentials (Mainnet)",
        description:
          "Inspect credential status and issuer metadata tied to Mainnet agents.",
      },
      {
        scope: "credentials:write:mainnet",
        label: "Issue credentials (Mainnet)",
        description: "Issue or reconcile credentials tied to Mainnet agents.",
      },
    ],
  },
  {
    key: "activity",
    label: "Activity",
    scopes: [
      {
        scope: "activity:read:preprod",
        label: "Read activity (Preprod)",
        description: "View activity feed and transaction details on Preprod.",
      },
      {
        scope: "activity:read:mainnet",
        label: "Read activity (Mainnet)",
        description: "View activity feed and transaction details on Mainnet.",
      },
    ],
  },
  {
    key: "earnings",
    label: "Earnings",
    scopes: [
      {
        scope: "earnings:read:preprod",
        label: "Read earnings (Preprod)",
        description: "View aggregated earnings on Preprod.",
      },
      {
        scope: "earnings:read:mainnet",
        label: "Read earnings (Mainnet)",
        description: "View aggregated earnings on Mainnet.",
      },
    ],
  },
  {
    key: "dashboard",
    label: "Dashboard",
    scopes: [
      {
        scope: "dashboard:read:preprod",
        label: "Read dashboard (Preprod)",
        description: "View dashboard overview metrics on Preprod.",
      },
      {
        scope: "dashboard:read:mainnet",
        label: "Read dashboard (Mainnet)",
        description: "View dashboard overview metrics on Mainnet.",
      },
    ],
  },
] as const satisfies Array<{
  key: string;
  label: string;
  scopes: readonly OidcApiScopeDescriptor[];
}>;

export const OIDC_API_SCOPES = OIDC_API_SCOPE_GROUPS.flatMap((group) =>
  group.scopes.map((scope) => scope.scope),
) as string[];

export type OidcApiScope = (typeof OIDC_API_SCOPES)[number];

const OIDC_STANDARD_SCOPE_SET = new Set<string>(OIDC_STANDARD_SCOPES);
const OIDC_API_SCOPE_SET = new Set<string>(OIDC_API_SCOPES);

export const OIDC_CLIENT_ALLOWED_API_SCOPES: Record<OidcClientKey, string[]> = {
  web: [...OIDC_API_SCOPES],
  cli: [...OIDC_API_SCOPES],
};

export const OIDC_CLIENT_ALLOWED_SCOPES: Record<OidcClientKey, string[]> = {
  web: [...OIDC_STANDARD_SCOPES, ...OIDC_CLIENT_ALLOWED_API_SCOPES.web],
  cli: [...OIDC_STANDARD_SCOPES, ...OIDC_CLIENT_ALLOWED_API_SCOPES.cli],
};

export const OIDC_SUPPORTED_SCOPES = [
  ...OIDC_STANDARD_SCOPES,
  ...OIDC_API_SCOPES,
] as string[];

export function normalizeScopeList(
  input: Iterable<string> | string | null | undefined,
): string[] {
  const rawValues =
    typeof input === "string"
      ? input.split(" ")
      : input
        ? Array.from(input)
        : [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const rawValue of rawValues) {
    const value = rawValue.trim();
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    normalized.push(value);
  }

  return normalized;
}

export function serializeScopeList(scopes: Iterable<string>): string {
  return normalizeScopeList(scopes).join(" ");
}

export function isOidcStandardScope(scope: string): scope is OidcStandardScope {
  return OIDC_STANDARD_SCOPE_SET.has(scope);
}

export function isOidcApiScope(scope: string): scope is OidcApiScope {
  return OIDC_API_SCOPE_SET.has(scope);
}

export function isOidcSupportedScope(scope: string): boolean {
  return isOidcStandardScope(scope) || isOidcApiScope(scope);
}

export function getAllowedScopesForClient(clientKey: OidcClientKey): string[] {
  return [...OIDC_CLIENT_ALLOWED_SCOPES[clientKey]];
}

export function getAllowedApiScopesForClient(
  clientKey: OidcClientKey,
): string[] {
  return [...OIDC_CLIENT_ALLOWED_API_SCOPES[clientKey]];
}

export function normalizeNetworkScopeSegment(
  network: "Mainnet" | "Preprod" | "mainnet" | "preprod",
): "mainnet" | "preprod" {
  return network.toLowerCase() === "mainnet" ? "mainnet" : "preprod";
}

export function buildNetworkedOidcScope(
  resource: "agents" | "credentials" | "activity" | "earnings" | "dashboard",
  action: "read" | "write",
  network: "Mainnet" | "Preprod" | "mainnet" | "preprod",
): string {
  return `${resource}:${action}:${normalizeNetworkScopeSegment(network)}`;
}

export function getOidcApiScopeCatalog() {
  return OIDC_API_SCOPE_GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    scopes: group.scopes.map((scope) => ({ ...scope })),
  }));
}

export function getOidcScopeDisplayItems(scopes: Iterable<string> | string) {
  const normalizedScopes = normalizeScopeList(scopes);
  const apiDescriptors = new Map<string, OidcApiScopeDescriptor>(
    OIDC_API_SCOPE_GROUPS.flatMap((group) =>
      group.scopes.map((scope) => [scope.scope, scope] as const),
    ),
  );
  const standardDescriptors = new Map(
    OIDC_STANDARD_SCOPE_DESCRIPTORS.map(
      (scope) => [scope.scope, scope] as const,
    ),
  );

  return normalizedScopes.map((scope) => {
    const standardDescriptor = standardDescriptors.get(
      scope as OidcStandardScope,
    );
    if (standardDescriptor) {
      return {
        scope,
        label: standardDescriptor.label,
        description: standardDescriptor.description,
        type: "standard" as const,
      };
    }

    const apiDescriptor = apiDescriptors.get(scope);
    if (apiDescriptor) {
      return {
        scope,
        label: apiDescriptor.label,
        description: apiDescriptor.description,
        type: "api" as const,
      };
    }

    return {
      scope,
      label: scope,
      description: "",
      type: "unknown" as const,
    };
  });
}
