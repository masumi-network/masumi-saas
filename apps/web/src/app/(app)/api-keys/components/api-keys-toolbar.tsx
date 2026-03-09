"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { RefreshButton } from "@/components/ui/refresh-button";

import { CreateApiKeyDialog } from "../../components/dashboard/create-api-key-dialog";

export function ApiKeysToolbar() {
  const t = useTranslations("App.ApiKeys");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-2">
      <RefreshButton
        onRefresh={handleRefresh}
        isRefreshing={isPending}
        variant="icon-only"
        size="sm"
      />
      <Button onClick={() => setCreateOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" />
        {t("addApiKey")}
      </Button>
      <CreateApiKeyDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          setCreateOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
