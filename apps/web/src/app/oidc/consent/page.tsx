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
import { auth } from "@/lib/auth/auth";
import { getRequestHeaders, getSession } from "@/lib/auth/utils";
import { getTrustedOidcClients } from "@/lib/config/oidc.config";

export const metadata: Metadata = {
  title: "Masumi - OIDC Authorization",
  description: "Confirm OIDC authorization for an external Masumi client",
};

const PAGE_COPY = {
  protocolBadge: "OIDC",
  titlePrefix: "Continue as",
  description:
    "wants to use your Masumi account for sign-in and SpacetimeDB access. Confirm to continue without logging in again.",
  accountLabel: "Account",
  scopesLabel: "Requested scopes",
  defaultScope: "openid",
  cancel: "Cancel",
  continue: "Continue",
} as const;

interface OidcConsentPageProps {
  searchParams: Promise<{
    consent_code?: string;
    client_id?: string;
    scope?: string;
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

  async function handleConsent(formData: FormData) {
    "use server";

    const consentCode = formData.get("consentCode");
    const accept = formData.get("accept") === "true";

    if (typeof consentCode !== "string" || consentCode.trim().length === 0) {
      redirect("/");
    }

    const headersList = await getRequestHeaders();
    const result = await auth.api.oAuthConsent({
      headers: headersList,
      body: {
        accept,
        consent_code: consentCode,
      },
    });

    redirect(result.redirectURI);
  }

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
        </CardContent>
        <CardFooter>
          <form
            action={handleConsent}
            className="flex w-full flex-col gap-3 sm:flex-row"
          >
            <input type="hidden" name="consentCode" value={consentCode} />
            <Button type="submit" name="accept" value="false" variant="outline">
              {PAGE_COPY.cancel}
            </Button>
            <Button type="submit" name="accept" value="true" variant="primary">
              {PAGE_COPY.continue}
            </Button>
          </form>
        </CardFooter>
      </Card>
    </main>
  );
}
