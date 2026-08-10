import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getBetterAuthInnerSession } from "@/lib/auth/session-types";
import { getAuthContext } from "@/lib/auth/utils";
import {
  buildNetworkKycVerifyUrl,
  fulfillNetworkRegistrationDraft,
} from "@/lib/network-registration";

import { NetworkRegisterFinishPoller } from "../components/network-register-finish-poller";
import { NetworkRegisterShell } from "../components/network-register-shell";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ draftId?: string }>;

function networkSiteRegisterUrl(): string {
  const base =
    process.env.NETWORK_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_NETWORK_SITE_URL?.trim() ||
    "http://localhost:3010";
  return new URL("/register", base).toString();
}

export default async function NetworkRegisterContinuePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { draftId } = await searchParams;
  if (!draftId?.trim()) {
    redirect(networkSiteRegisterUrl());
  }

  const trimmedDraftId = draftId.trim();
  const continuePath = `/network-register/continue?draftId=${encodeURIComponent(trimmedDraftId)}`;

  const authContext = await getAuthContext();
  if (!authContext.isAuthenticated || !authContext.session) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(continuePath)}`);
  }

  const activeOrganizationId =
    getBetterAuthInnerSession(authContext.session)?.activeOrganizationId ??
    null;

  const result = await fulfillNetworkRegistrationDraft({
    draftId: trimmedDraftId,
    user: {
      id: authContext.session.user.id,
      name: authContext.session.user.name ?? null,
      email: authContext.session.user.email ?? null,
    },
    activeOrganizationId,
  });

  if (!result.ok && result.needsKyc) {
    redirect(buildNetworkKycVerifyUrl(trimmedDraftId));
  }

  if (!result.ok) {
    const t = await getTranslations("App.NetworkRegister");
    return (
      <NetworkRegisterShell>
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-semibold">{t("continueFailedTitle")}</h1>
          <p className="text-muted-foreground text-sm">{result.error}</p>
          <Link
            href={networkSiteRegisterUrl()}
            className="inline-block text-sm font-medium underline underline-offset-2"
          >
            {t("backToRegistration")}
          </Link>
        </div>
      </NetworkRegisterShell>
    );
  }

  if (result.status === "pending") {
    return (
      <NetworkRegisterShell>
        <NetworkRegisterFinishPoller
          agentId={result.agentId}
          successUrl={result.networkSiteSuccessUrl}
        />
      </NetworkRegisterShell>
    );
  }

  redirect(result.networkSiteSuccessUrl);
}
