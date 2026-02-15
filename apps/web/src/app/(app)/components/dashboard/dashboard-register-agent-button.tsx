"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { RegisterAgentDialog } from "../../ai-agents/components/register-agent-dialog";

export function DashboardRegisterAgentButton() {
  const t = useTranslations("App.Home.Dashboard");
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <Button
          className="flex items-center gap-2"
          onClick={() => setIsOpen(true)}
        >
          <Plus className="h-4 w-4" />
          {t("registerAgent")}
        </Button>
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
