"use client";

import { Key, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const t = useTranslations("App.Home.Dashboard.ApiKey");
  const router = useRouter();
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const handleClose = () => {
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
        setError(createError.message || t("error"));
        return;
      }

      if (data?.key) {
        setCreatedKey(data.key);
        onSuccess();
        router.refresh();
      } else {
        setError(t("error"));
      }
    } catch {
      setError(t("error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const showKeyResult = createdKey && open;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        {showKeyResult ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("createdTitle")}</DialogTitle>
              <DialogDescription>{t("createdDescription")}</DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border bg-muted/50 p-4 font-mono text-sm break-all">
              {createdKey}
            </div>
            <p className="text-xs text-muted-foreground">{t("copyWarning")}</p>
            <DialogFooter>
              <Button onClick={handleClose}>{t("done")}</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{t("title")}</DialogTitle>
              <DialogDescription>{t("description")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="api-key-name">{t("name")}</Label>
                <Input
                  id="api-key-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("namePlaceholder")}
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("submitting")}
                  </>
                ) : (
                  t("submit")
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
          <Key className="h-4 w-4" />
          {t("createApiKey")}
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
