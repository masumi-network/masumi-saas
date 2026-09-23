import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  buildNetworkKycVerifyUrl,
  buildNetworkSiteSuccessUrl,
  fulfillNetworkRegistrationDraft,
} from "@/lib/network-registration";
import { resolveNetworkRegisterSession } from "@/lib/network-registration/session";

import { NetworkRegisterFinishPoller } from "../components/network-register-finish-poller";
import { NetworkRegisterShell } from "../components/network-register-shell";
import { NetworkRegisterSwitchAccount } from "../components/network-register-switch-account";

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

  const session = await resolveNetworkRegisterSession({
    draftId: trimmedDraftId,
    returnPath: continuePath,
  });

  if (session.kind === "not_found") {
    redirect(networkSiteRegisterUrl());
  }

  if (session.kind === "sign_in_required") {
    redirect(`/signin?callbackUrl=${encodeURIComponent(continuePath)}`);
  }

  if (session.kind === "wrong_account") {
    return (
      <NetworkRegisterShell>
        <NetworkRegisterSwitchAccount
          registrationEmail={session.registrationEmail}
          signedInEmail={session.signedInEmail}
          returnPath={session.returnPath}
          backToRegistrationUrl={networkSiteRegisterUrl()}
        />
      </NetworkRegisterShell>
    );
  }

  const { draft, user, activeOrganizationId } = session;

  if (draft.agentId && draft.status === "PROCESSING") {
    return (
      <NetworkRegisterShell>
        <NetworkRegisterFinishPoller
          agentId={draft.agentId}
          successUrl={buildNetworkSiteSuccessUrl(draft.agentId)}
        />
      </NetworkRegisterShell>
    );
  }

  const result = await fulfillNetworkRegistrationDraft({
    draftId: trimmedDraftId,
    user,
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
