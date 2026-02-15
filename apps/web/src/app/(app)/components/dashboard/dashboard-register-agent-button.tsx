"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { RegisterAgentDialog } from "../../ai-agents/components/register-agent-dialog";

export function DashboardRegisterAgentButton({
  agentCount = 0,
}: {
  agentCount?: number;
}) {
  const t = useTranslations("App.Home.Dashboard");
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const showViewAll = agentCount > 10;

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <Button
          className="flex items-center gap-2"
          onClick={() => setIsOpen(true)}
        >
          <Plus className="h-4 w-4" />
          {t("registerAgent")}
        </Button>
        {showViewAll && (
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
          >
            <Link href="/ai-agents">{t("viewAll")}</Link>
          </Button>
        )}
      </div>
      <RegisterAgentDialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </>
  );
}
