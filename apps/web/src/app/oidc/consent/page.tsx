import {
  AlertCircle,
  CheckCircle2,
  Fingerprint,
  Lock,
  MessageSquare,
} from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthorizationRequestCard } from "@/components/oidc/authorization-request-card";
import { OidcPermissionSummary } from "@/components/oidc/oidc-permission-summary";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
import { OidcSwitchAccountButton } from "./components/oidc-switch-account-button";

export const metadata: Metadata = {
  title: "Masumi - OIDC Authorization",
  description: "Confirm OIDC authorization for an external Masumi client",
};

const PAGE_COPY = {
  titlePrefix: "Authorize",
  descriptionSuffix: "wants to access your Masumi account.",
  identityScopesLabel: "Identity scopes",
  newPermissionsLabel: "New API permissions",
  grantedPermissionsLabel: "Granted API permissions",
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
    return "Agent Messenger";
  }

  const client = getTrustedOidcClients().find(
    (item) => item.clientId === clientId,
  );
  return client?.name ?? "Agent Messenger";
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

function getInitial(name: string | null | undefined, email: string): string {
  const source = name?.trim() || email;
  return source.charAt(0).toUpperCase();
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
  return (
    <AuthorizationRequestCard
      icon={<MessageSquare className="h-6 w-6 text-primary" />}
      title={`${PAGE_COPY.titlePrefix} ${clientLabel}`}
      description={`${clientLabel} ${PAGE_COPY.descriptionSuffix}`}
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
            {emailVerified ? (
              <Button
                type="submit"
                name="accept"
                value="true"
                variant="primary"
                className="flex-1"
              >
                {PAGE_COPY.continue}
              </Button>
            ) : null}
            <Button
              type="submit"
              name="accept"
              value="false"
              variant="ghost"
              className="flex-1"
            >
              {PAGE_COPY.cancel}
            </Button>
          </form>
          <Separator />
          <OidcSwitchAccountButton
            callbackUrl={switchAccountCallbackUrl}
            label={PAGE_COPY.switchAccount}
          />
        </div>
      }
    >
      <div className="space-y-5">
        {errorMessage ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        <div className="animate-fade-in-up animate-stagger-1 flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="text-xs font-medium">
              {getInitial(session.user.name, session.user.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {session.user.name?.trim() || session.user.email}
            </p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {session.user.email}
            </p>
          </div>
        </div>

        {!emailVerified ? (
          <EmailVerificationPanel
            email={session.user.email}
            continueUrl={continueUrl}
          />
        ) : null}

        <div className="animate-fade-in-up animate-stagger-2 space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Fingerprint className="h-4 w-4 text-muted-foreground" />
            {PAGE_COPY.identityScopesLabel}
          </p>
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

        {newApiPermissionGroups.length > 0 ? (
          <div className="animate-fade-in-up animate-stagger-3 space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Lock className="h-4 w-4 text-primary" />
              {PAGE_COPY.newPermissionsLabel}
            </p>
            <OidcPermissionSummary
              emptyLabel=""
              groups={newApiPermissionGroups}
            />
          </div>
        ) : null}

        {existingApiPermissionGroups.length > 0 ? (
          <div className="animate-fade-in-up animate-stagger-4 space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              {PAGE_COPY.grantedPermissionsLabel}
            </p>
            <OidcPermissionSummary
              emptyLabel=""
              groups={existingApiPermissionGroups}
              surfaceClassName="rounded-lg border p-3"
            />
          </div>
        ) : null}
      </div>
    </AuthorizationRequestCard>
  );
}
