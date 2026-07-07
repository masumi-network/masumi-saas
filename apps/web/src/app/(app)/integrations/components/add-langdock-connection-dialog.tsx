"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { dialogHeaderEnterClass } from "@/lib/dialog-motion";
import { cn } from "@/lib/utils";

export function AddLangdockConnectionDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const t = useTranslations("App.Integrations");
  const [saving, setSaving] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [agentId, setAgentId] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [name, setName] = useState("Langdock");

  useEffect(() => {
    if (!open) return;
    setApiKey("");
    setAgentId("");
    setBaseUrl("");
    setName("Langdock");
    setSaving(false);
  }, [open]);

  const saveConnection = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/integrations/langdock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          apiKey,
          agentId,
          baseUrl,
          name,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || t("saveError"));
      toast.success(t("saveSuccess"));
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        closeButtonClassName="top-8 right-4 -translate-y-1/2"
      >
        <div
          className={cn(
            "shrink-0 border-b bg-masumi-gradient px-6 py-5 pr-12",
            dialogHeaderEnterClass,
          )}
        >
          <DialogHeader className="text-left">
            <DialogTitle>{t("addLangdockConnection")}</DialogTitle>
          </DialogHeader>
        </div>

        <DialogBody className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("langdockDescription")}
          </p>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="langdock-name">
              {t("connectionName")}
            </label>
            <Input
              id="langdock-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="langdock-api-key">
              {t("apiKey")}
            </label>
            <Input
              id="langdock-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t("apiKeyPlaceholder")}
              className="h-11 font-mono text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="langdock-agent-id">
              {t("agentId")}
            </label>
            <Input
              id="langdock-agent-id"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              placeholder={t("agentIdPlaceholder")}
              className="h-11 font-mono text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="langdock-base-url">
              {t("baseUrl")}
            </label>
            <Input
              id="langdock-base-url"
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={t("baseUrlPlaceholder")}
              className="h-11 font-mono text-sm"
            />
          </div>
        </DialogBody>

        <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => void saveConnection()}
            disabled={saving || !apiKey.trim() || !agentId.trim()}
          >
            {saving && <Spinner size={16} className="mr-2" />}
            {t("testAndSave")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
