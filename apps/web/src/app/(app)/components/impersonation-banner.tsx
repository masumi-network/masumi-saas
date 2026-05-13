"use client";

import { LogOut, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth/auth.client";

interface ImpersonationBannerProps {
  activeUserName: string | null;
  activeUserEmail: string | null;
}

export function ImpersonationBanner({
  activeUserName,
  activeUserEmail,
}: ImpersonationBannerProps) {
  const t = useTranslations("App.ImpersonationBanner");
  const [isStopping, setIsStopping] = useState(false);

  const displayName =
    activeUserName?.trim() || activeUserEmail?.trim() || t("unknownUser");
  const shouldShowEmail =
    activeUserEmail?.trim() && activeUserEmail.trim() !== displayName;

  const handleStop = async () => {
    setIsStopping(true);
    try {
      const result = await authClient.admin.stopImpersonating();
      if (result.error) {
        toast.error(t("stopError"));
        setIsStopping(false);
        return;
      }

      toast.success(t("stopSuccess"));
      window.location.assign("/admin/users");
    } catch {
      toast.error(t("stopError"));
      setIsStopping(false);
    }
  };

  return (
    <div
      role="status"
      className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-foreground"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {t("title", { user: displayName })}
            </p>
            <p className="text-sm text-muted-foreground">
              {shouldShowEmail ? (
                <>
                  <span>{activeUserEmail}</span>
                  <span className="mx-1" aria-hidden>
                    /
                  </span>
                </>
              ) : null}
              {t("description")}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 border-amber-500/30 bg-background hover:bg-amber-500/10"
          onClick={handleStop}
          disabled={isStopping}
        >
          {isStopping ? (
            <Spinner size={14} className="mr-1" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
          {isStopping ? t("stopping") : t("stop")}
        </Button>
      </div>
    </div>
  );
}
