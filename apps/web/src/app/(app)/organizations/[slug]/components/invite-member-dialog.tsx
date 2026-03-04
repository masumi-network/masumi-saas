"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { inviteMemberAction } from "@/lib/actions/organization.action";

interface InviteMemberDialogProps {
  organizationId: string;
  onSuccess: () => void;
}

export function InviteMemberDialog({
  organizationId,
  onSuccess,
}: InviteMemberDialogProps) {
  const t = useTranslations("App.Organizations.Dashboard.quickActions");
  const emailInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setEmail("");
    setRole("member");
    setError(null);
    setIsSubmitting(false);
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) resetForm();
    },
    [resetForm],
  );

  useEffect(() => {
    if (open) {
      setTimeout(() => emailInputRef.current?.focus(), 0);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await inviteMemberAction({
        organizationId,
        email: trimmedEmail,
        role,
      });

      if (!result.success) {
        setError(result.error ?? t("inviteError"));
        return;
      }

      toast.success(t("inviteSuccess"));
      handleOpenChange(false);
      onSuccess();
    } catch {
      setError(t("inviteError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {t("inviteMember")}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-md max-h-[90vh] overflow-hidden p-0 flex flex-col gap-0"
        closeButtonClassName="top-8 right-4 -translate-y-1/2"
      >
        <div className="shrink-0 border-b bg-masumi-gradient px-6 py-5 pr-12">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {t("inviteDialogTitle")}
            </DialogTitle>
          </DialogHeader>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col min-h-0 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <p className="text-muted-foreground text-sm">
              {t("inviteDialogDescription")}
            </p>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <div className="grid gap-2">
              <Label htmlFor="invite-email">{t("inviteEmailLabel")}</Label>
              <Input
                ref={emailInputRef}
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("inviteEmailPlaceholder")}
                required
                disabled={isSubmitting}
                className="h-11"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="invite-role">{t("inviteRoleLabel")}</Label>
              <Select
                value={role}
                onValueChange={setRole}
                disabled={isSubmitting}
              >
                <SelectTrigger id="invite-role" className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">
                    {t("inviteRoleMember")}
                  </SelectItem>
                  <SelectItem value="admin">{t("inviteRoleAdmin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              {t("inviteCancel")}
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting && <Spinner size={16} className="mr-2" />}
              {isSubmitting ? t("inviteSubmitting") : t("inviteSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
