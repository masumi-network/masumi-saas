import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { switchAccountAction } from "@/lib/actions/auth.action";
import { sanitizeCallbackUrl } from "@/lib/auth/callback-url";
import { getSession } from "@/lib/auth/utils";
import { getTrustedOidcClients } from "@/lib/config/oidc.config";

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
  scopesLabel: "Requested scopes",
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
  const switchAccountCallbackUrl =
    continueUrl ?? buildConsentCallbackUrl(resolvedSearchParams);
  const switchAccount = switchAccountAction.bind(
    null,
    switchAccountCallbackUrl,
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{PAGE_COPY.protocolBadge}</Badge>
            <Badge variant="outline">{clientLabel}</Badge>
          </div>
          <CardTitle>
            {PAGE_COPY.titlePrefix} {session.user.email}
          </CardTitle>
          <CardDescription>
            {clientLabel} {PAGE_COPY.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <p className="text-sm font-medium">{PAGE_COPY.scopesLabel}</p>
            <div className="flex flex-wrap gap-2">
              {scopes.length === 0 ? (
                <Badge variant="outline">{PAGE_COPY.defaultScope}</Badge>
              ) : (
                scopes.map((scope) => (
                  <Badge key={scope} variant="outline">
                    {scope}
                  </Badge>
                ))
              )}
            </div>
          </div>
          {!emailVerified ? (
            <EmailVerificationPanel
              email={session.user.email}
              continueUrl={continueUrl}
            />
          ) : null}
        </CardContent>
        <CardFooter>
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
              <input
                type="hidden"
                name="continueUrl"
                value={continueUrl ?? ""}
              />
              <Button
                type="submit"
                name="accept"
                value="false"
                variant="outline"
              >
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
        </CardFooter>
      </Card>
    </main>
  );
}
