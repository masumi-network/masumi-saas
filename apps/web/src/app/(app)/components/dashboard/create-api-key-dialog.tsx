"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth/auth.client";

interface CreateApiKeyDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateApiKeyDialog({
  open,
  onClose,
  onSuccess,
}: CreateApiKeyDialogProps) {
  const tDashboard = useTranslations("App.Home.Dashboard.ApiKey");
  const t = useTranslations("App.ApiKeys");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const handleClose = () => {
    if (createdKey) onSuccess();
    setCreatedKey(null);
    setName("");
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const { data, error: createError } = await authClient.apiKey.create({
        name: name.trim() || undefined,
      });

      if (createError) {
        setError(createError.message || tDashboard("error"));
        return;
      }

      if (data?.key) {
        setCreatedKey(data.key);
      } else {
        setError(tDashboard("error"));
      }
    } catch {
      setError(tDashboard("error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const showKeyResult = createdKey && open;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !showKeyResult) handleClose();
      }}
    >
      <DialogContent
        className="sm:max-w-md max-h-[90vh] p-0 flex flex-col gap-0 overflow-hidden"
        closeButtonClassName="top-8 right-4 -translate-y-1/2"
        showCloseButton={!showKeyResult}
        {...(showKeyResult && {
          onInteractOutside: (e) => e.preventDefault(),
          onEscapeKeyDown: (e) => e.preventDefault(),
        })}
      >
        {showKeyResult ? (
          <>
            <div className="shrink-0 border-b bg-masumi-gradient px-6 py-5 pr-12">
              <DialogHeader>
                <DialogTitle>{tDashboard("createdTitle")}</DialogTitle>
              </DialogHeader>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-4">
                <code className="min-w-0 flex-1 break-all font-mono text-sm">
                  {createdKey}
                </code>
                <CopyButton value={createdKey ?? ""} className="shrink-0" />
              </div>
              <p className="text-xs text-muted-foreground">
                {tDashboard("copyWarning")}
              </p>
            </div>
            <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
              <Button variant="primary" onClick={handleClose}>
                {tDashboard("done")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col flex-1 min-h-0 overflow-hidden"
          >
            <div className="shrink-0 border-b bg-masumi-gradient px-6 py-5 pr-12">
              <DialogHeader>
                <DialogTitle>{t("addKeyTitle")}</DialogTitle>
              </DialogHeader>
            </div>
            <div className="flex-1 overflow-y-auto p-6 grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="api-key-name">{tDashboard("name")}</Label>
                <Input
                  id="api-key-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={tDashboard("namePlaceholder")}
                  disabled={isSubmitting}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                {tDashboard("cancel")}
              </Button>
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Spinner size={16} className="mr-2" />
                    {t("creating")}
                  </>
                ) : (
                  t("create")
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DashboardCreateApiKeyButton() {
  const t = useTranslations("App.ApiKeys");
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
          {t("addApiKey")}
        </Button>
      </div>
      <CreateApiKeyDialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </>
  );
}
