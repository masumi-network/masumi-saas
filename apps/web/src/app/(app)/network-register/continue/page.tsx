import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getBetterAuthInnerSession } from "@/lib/auth/session-types";
import { getAuthContext } from "@/lib/auth/utils";
import {
  buildNetworkKycReturnUrl,
  fulfillNetworkRegistrationDraft,
} from "@/lib/network-registration";

type SearchParams = Promise<{ draftId?: string }>;

export default async function NetworkRegisterContinuePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { draftId } = await searchParams;
  if (!draftId?.trim()) {
    redirect("/ai-agents");
  }

  const authContext = await getAuthContext();
  if (!authContext.isAuthenticated || !authContext.session) {
    redirect(
      `/signin?callbackUrl=${encodeURIComponent(`/network-register/continue?draftId=${draftId}`)}`,
    );
  }

  const activeOrganizationId =
    getBetterAuthInnerSession(authContext.session)?.activeOrganizationId ??
    null;

  const result = await fulfillNetworkRegistrationDraft({
    draftId: draftId.trim(),
    user: {
      id: authContext.session.user.id,
      name: authContext.session.user.name ?? null,
      email: authContext.session.user.email ?? null,
    },
    activeOrganizationId,
  });

  if (!result.ok && result.needsKyc) {
    const returnTo = buildNetworkKycReturnUrl(draftId.trim());
    redirect(`/verification?returnTo=${encodeURIComponent(returnTo)}`);
  }

  if (!result.ok) {
    const t = await getTranslations("App.NetworkRegister");
    return (
      <div className="mx-auto max-w-lg space-y-4 py-10">
        <h1 className="text-2xl font-semibold">{t("continueFailedTitle")}</h1>
        <p className="text-muted-foreground text-sm">{result.error}</p>
        <Link href="/ai-agents" className="text-sm underline">
          {t("openAiAgents")}
        </Link>
      </div>
    );
  }

  redirect(result.networkSiteSuccessUrl);
}
