import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthorizationRequestCard } from "@/components/oidc/authorization-request-card";
import { OidcPermissionSummary } from "@/components/oidc/oidc-permission-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { switchAccountAction } from "@/lib/actions/auth.action";
import { sanitizeCallbackUrl } from "@/lib/auth/callback-url";
import { getStoredOidcGrantScopes } from "@/lib/auth/oidc-user-grants";
import { getSession } from "@/lib/auth/utils";
import { getTrustedOidcClients } from "@/lib/config/oidc.config";
import {
  getGroupedOidcApiPermissionItems,
  getOidcScopeDisplayItems,
  isOidcApiScope,
  isOidcStandardScope,
} from "@/lib/config/oidc-scopes.config";

import { EmailVerificationPanel } from "./components/email-verification-panel";

export const metadata: Metadata = {
  title: "Masumi - OIDC Authorization",
  description: "Confirm OIDC authorization for an external Masumi client",
};

const PAGE_COPY = {
  protocolBadge: "OIDC",
  titlePrefix: "Authorize as",
  description:
    "wants to use your Masumi account for sign-in and SpacetimeDB access. Confirm to authorize without logging in again.",
  accountLabel: "Account",
  identityScopesLabel: "Identity scopes",
  newPermissionsLabel: "New API permissions requested",
  newPermissionsDescription:
    "This client is asking for additional API permissions it did not have before.",
  grantedPermissionsLabel: "Already granted API permissions",
  grantedPermissionsDescription:
    "These API permissions are already approved for this client.",
  noNewPermissions: "No additional API permissions are being requested.",
  noGrantedPermissions: "No API permissions have been granted yet.",
  defaultScope: "openid",
  cancel: "Cancel",
  switchAccount: "Switch account",
  continue: "Authorize",
} as const;

interface OidcConsentPageProps {
  searchParams: Promise<{
    consent_code?: string;
    client_id?: string;
    scope?: string;
    continueUrl?: string;
    error?: string;
  }>;
}

function normalizeScopes(value: string | undefined): string[] {
  return (
    value
      ?.split(" ")
      .map((scope) => scope.trim())
      .filter(Boolean) ?? []
  );
}

function getClientLabel(clientId: string | undefined): string {
  if (!clientId) {
    return "Masumi client";
  }

  const client = getTrustedOidcClients().find(
    (item) => item.clientId === clientId,
  );
  return client?.name ?? clientId;
}

function buildConsentCallbackUrl(searchParams: {
  consent_code?: string;
  client_id?: string;
  scope?: string;
  continueUrl?: string;
}): string {
  const params = new URLSearchParams();
  if (searchParams.consent_code) {
    params.set("consent_code", searchParams.consent_code);
  }
  if (searchParams.client_id) {
    params.set("client_id", searchParams.client_id);
  }
  if (searchParams.scope) {
    params.set("scope", searchParams.scope);
  }
  const safeContinueUrl = sanitizeCallbackUrl(searchParams.continueUrl);
  if (safeContinueUrl) {
    params.set("continueUrl", safeContinueUrl);
  }

  const query = params.toString();
  return query ? `/oidc/consent?${query}` : "/oidc/consent";
}

export default async function OidcConsentPage({
  searchParams,
}: OidcConsentPageProps) {
  const resolvedSearchParams = await searchParams;
  const consentCode = resolvedSearchParams.consent_code?.trim();

  if (!consentCode) {
    redirect("/");
  }

  const session = await getSession();
  if (!session?.user) {
    redirect(
      `/signin?callbackUrl=${encodeURIComponent(buildConsentCallbackUrl(resolvedSearchParams))}`,
    );
  }

  const clientLabel = getClientLabel(resolvedSearchParams.client_id);
  const scopes = normalizeScopes(resolvedSearchParams.scope);
  const errorMessage = resolvedSearchParams.error?.trim();
  const continueUrl = sanitizeCallbackUrl(resolvedSearchParams.continueUrl);
  const emailVerified = session.user.emailVerified === true;
  const grantedApiScopes = resolvedSearchParams.client_id
    ? await getStoredOidcGrantScopes(
        session.user.id,
        resolvedSearchParams.client_id,
      )
    : [];
  const grantedApiScopeSet = new Set(grantedApiScopes);
  const requestedIdentityScopes = scopes.filter((scope) =>
    isOidcStandardScope(scope),
  );
  const requestedApiScopes = scopes.filter((scope) => isOidcApiScope(scope));
  const newlyRequestedApiScopes = requestedApiScopes.filter(
    (scope) => !grantedApiScopeSet.has(scope),
  );
  const alreadyGrantedApiScopes = requestedApiScopes.filter((scope) =>
    grantedApiScopeSet.has(scope),
  );
  const identityScopeItems = getOidcScopeDisplayItems(requestedIdentityScopes);
  const newApiPermissionGroups = getGroupedOidcApiPermissionItems(
    newlyRequestedApiScopes,
  );
  const existingApiPermissionGroups = getGroupedOidcApiPermissionItems(
    alreadyGrantedApiScopes,
  );
  const switchAccountCallbackUrl =
    continueUrl ?? buildConsentCallbackUrl(resolvedSearchParams);
  const switchAccount = switchAccountAction.bind(
    null,
    switchAccountCallbackUrl,
  );

  return (
    <AuthorizationRequestCard
      protocolBadge={PAGE_COPY.protocolBadge}
      clientLabel={clientLabel}
      title={
        <>
          {PAGE_COPY.titlePrefix} {session.user.email}
        </>
      }
      description={
        <>
          {clientLabel} {PAGE_COPY.description}
        </>
      }
      footer={
        <div className="flex w-full flex-col gap-3">
          <form
            action="/oidc/consent/submit"
            method="post"
            className="flex w-full flex-col gap-3 sm:flex-row"
          >
            <input type="hidden" name="consentCode" value={consentCode} />
            <input
              type="hidden"
              name="clientId"
              value={resolvedSearchParams.client_id ?? ""}
            />
            <input
              type="hidden"
              name="scope"
              value={resolvedSearchParams.scope ?? ""}
            />
            <input type="hidden" name="continueUrl" value={continueUrl ?? ""} />
            <Button type="submit" name="accept" value="false" variant="outline">
              {PAGE_COPY.cancel}
            </Button>
            {emailVerified ? (
              <Button
                type="submit"
                name="accept"
                value="true"
                variant="primary"
              >
                {PAGE_COPY.continue}
              </Button>
            ) : null}
          </form>
          <form action={switchAccount} className="w-full">
            <Button type="submit" variant="ghost" className="w-full">
              {PAGE_COPY.switchAccount}
            </Button>
          </form>
        </div>
      }
    >
      <div className="space-y-4">
        {errorMessage ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}
        <div className="space-y-2">
          <p className="text-sm font-medium">{PAGE_COPY.accountLabel}</p>
          <p className="text-sm text-muted-foreground">
            {session.user.name?.trim() || session.user.email}
          </p>
          <p className="break-all font-mono text-xs text-muted-foreground">
            {session.user.email}
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">{PAGE_COPY.identityScopesLabel}</p>
          <div className="flex flex-wrap gap-2">
            {identityScopeItems.length === 0 ? (
              <Badge variant="outline">{PAGE_COPY.defaultScope}</Badge>
            ) : (
              identityScopeItems.map((scopeItem) => (
                <Badge key={scopeItem.scope} variant="outline">
                  {scopeItem.label}
                </Badge>
              ))
            )}
          </div>
        </div>
        <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-medium">{PAGE_COPY.newPermissionsLabel}</p>
          <p className="text-sm text-muted-foreground">
            {PAGE_COPY.newPermissionsDescription}
          </p>
          <OidcPermissionSummary
            emptyLabel={PAGE_COPY.noNewPermissions}
            groups={newApiPermissionGroups}
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {PAGE_COPY.grantedPermissionsLabel}
          </p>
          <p className="text-sm text-muted-foreground">
            {PAGE_COPY.grantedPermissionsDescription}
          </p>
          <OidcPermissionSummary
            emptyLabel={PAGE_COPY.noGrantedPermissions}
            groups={existingApiPermissionGroups}
            surfaceClassName="rounded-md border px-3 py-3"
          />
        </div>
        {!emailVerified ? (
          <EmailVerificationPanel
            email={session.user.email}
            continueUrl={continueUrl}
          />
        ) : null}
      </div>
    </AuthorizationRequestCard>
  );
}
