"use client";

import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { credentialApiClient } from "@/lib/api/credential.client";
import { isAgentVerificationFlowEnabled } from "@/lib/config/verification.config";

interface PendingWalletAcceptanceBannerProps {
  agentId: string;
  onResume: (pendingCredentialId: string) => void;
  refreshKey?: number;
}

export function PendingWalletAcceptanceBanner({
  agentId,
  onResume,
  refreshKey = 0,
}: PendingWalletAcceptanceBannerProps) {
  const t = useTranslations("App.Agents.Details.Verification");
  const [pendingCredentialId, setPendingCredentialId] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);

  const loadPending = useCallback(async () => {
    if (!isAgentVerificationFlowEnabled()) {
      setPendingCredentialId(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await credentialApiClient.getPendingCredential(agentId);
      if (result.success) {
        setPendingCredentialId(result.data.pendingCredentialId);
      } else {
        setPendingCredentialId(null);
      }
    } catch {
      setPendingCredentialId(null);
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void loadPending();
  }, [loadPending, refreshKey]);

  if (isLoading || !pendingCredentialId) {
    return null;
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between"
      role="status"
    >
      <div className="flex gap-3 min-w-0">
        <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="space-y-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {t("pendingWalletAcceptanceBannerTitle")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("pendingWalletAcceptanceBannerDescription")}
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 border-amber-500/50 bg-background/80"
        onClick={() => onResume(pendingCredentialId)}
      >
        {t("resumeWalletAcceptance")}
      </Button>
    </div>
  );
}
