"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { completeRegistrationIfReadyAction } from "@/lib/actions/agent.action";

import { NetworkRegisterHeader } from "./network-register-header";

const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 120;

type NetworkRegisterFinishPollerProps = {
  agentId: string;
  successUrl: string;
};

export function NetworkRegisterFinishPoller({
  agentId,
  successUrl,
}: NetworkRegisterFinishPollerProps) {
  const t = useTranslations("App.NetworkRegister");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | undefined;
    let attempts = 0;

    const tick = async () => {
      if (cancelled) return;
      attempts += 1;

      if (attempts > MAX_POLL_ATTEMPTS) {
        setError(t("finishTimedOut"));
        if (intervalId !== undefined) {
          window.clearInterval(intervalId);
        }
        return;
      }

      const result = await completeRegistrationIfReadyAction(agentId);
      if (cancelled) return;

      if (result.status === "registered") {
        if (intervalId !== undefined) {
          window.clearInterval(intervalId);
        }
        window.location.assign(successUrl);
        return;
      }

      if (result.status === "error") {
        setError(result.error);
        if (intervalId !== undefined) {
          window.clearInterval(intervalId);
        }
      }
    };

    void tick();
    intervalId = window.setInterval(() => void tick(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
  }, [agentId, successUrl, t]);

  if (error) {
    return (
      <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-semibold">{t("continueFailedTitle")}</h1>
        <p className="text-muted-foreground text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 rounded-2xl border border-border bg-card px-6 py-10 shadow-sm sm:p-8">
      <NetworkRegisterHeader
        title={t("finishTitle")}
        description={t("finishMessage")}
      />
      <div className="flex justify-center">
        <Spinner size={48} className="text-primary" />
      </div>
    </div>
  );
}
