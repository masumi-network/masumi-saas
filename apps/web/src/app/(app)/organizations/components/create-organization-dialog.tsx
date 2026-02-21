"use client";

import { CircleHelp, Plus } from "lucide-react";
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
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { authClient } from "@/lib/auth/auth.client";
import { useOrganizationContextOptional } from "@/lib/context/organization-context";

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isValidSlug(slug: string): boolean {
  if (!slug.trim()) return false;
  return SLUG_REGEX.test(slug);
}

/** Derive a slug from a name: lowercase, strip accents, remove special chars, collapse spaces to hyphens */
function deriveSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

interface CreateOrganizationDialogProps {
  /** Variant for the trigger button. Use "default" for primary (e.g. in empty state). */
  triggerVariant?:
    | "default"
    | "outline"
    | "ghost"
    | "secondary"
    | "link"
    | "destructive";
  /** Custom trigger element. When provided, used instead of the default Button. */
  trigger?: React.ReactNode;
  /** Controlled open state. When provided with onOpenChange, dialog is controlled (no trigger rendered). */
  open?: boolean;
  /** Called when dialog open state changes. Use with open for controlled mode. */
  onOpenChange?: (open: boolean) => void;
}

export function CreateOrganizationDialog({
  triggerVariant = "default",
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: CreateOrganizationDialogProps) {
  const t = useTranslations("App.Organizations.Create");
  const orgContext = useOrganizationContextOptional();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled =
    controlledOpen !== undefined && controlledOnOpenChange !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugError, setSlugError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setName("");
    setSlug("");
    setSlugError(null);
    setError(null);
    setIsSubmitting(false);
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) {
        resetForm();
      }
    },
    [resetForm, setOpen],
  );

  useEffect(() => {
    if (open) {
      setTimeout(() => nameInputRef.current?.focus(), 0);
    }
  }, [open]);

  const handleNameChange = (value: string) => {
    setName(value);
    const derivedSlug = deriveSlugFromName(value);
    const wasAutoDerived = !slug || slug === deriveSlugFromName(name);
    if (wasAutoDerived) {
      setSlug(derivedSlug);
      setSlugError(
        derivedSlug && !isValidSlug(derivedSlug) ? t("slugInvalid") : null,
      );
    }
  };

  const handleSlugChange = (value: string) => {
    setSlug(value);
    setSlugError(value && !isValidSlug(value) ? t("slugInvalid") : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSlugError(null);

    const finalSlug = slug.trim() || deriveSlugFromName(name);
    if (!isValidSlug(finalSlug)) {
      setSlugError(t("slugInvalid"));
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error: createError } = await authClient.organization.create(
        {
          name: name.trim(),
          slug: finalSlug,
        },
      );

      if (createError) {
        setError(createError.message || t("error"));
        return;
      }

      if (data) {
        await orgContext?.setActiveOrganization(data.id);
        orgContext?.refetch({ skipRefresh: true });
        handleOpenChange(false);
        toast.success(t("success"));
      }
    } catch {
      setError(t("error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const defaultTrigger = (
    <Button variant={triggerVariant} className="flex items-center gap-2">
      <Plus className="h-4 w-4" />
      {t("trigger")}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isControlled && (
        <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      )}
      <DialogContent
        className="sm:max-w-lg max-h-[90vh] overflow-hidden p-0 flex flex-col gap-0"
        closeButtonClassName="top-8 right-4 -translate-y-1/2"
      >
        <div className="shrink-0 border-b bg-masumi-gradient px-6 py-5 pr-12">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {t("title")}
            </DialogTitle>
          </DialogHeader>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col min-h-0 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <p className="text-muted-foreground text-sm">{t("description")}</p>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <div className="grid gap-2">
              <Label htmlFor="name">{t("name")}</Label>
              <Input
                ref={nameInputRef}
                id="name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={t("namePlaceholder")}
                required
                disabled={isSubmitting}
                className="h-11"
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="slug">{t("slug")}</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-help text-muted-foreground hover:text-foreground">
                      <CircleHelp className="h-4 w-4" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{t("slugHint")}</TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder={t("slugPlaceholder")}
                disabled={isSubmitting}
                className="h-11"
              />
              {slugError && (
                <p className="text-destructive text-sm">{slugError}</p>
              )}
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting && <Spinner size={16} className="mr-2" />}
              {isSubmitting ? t("submitting") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
