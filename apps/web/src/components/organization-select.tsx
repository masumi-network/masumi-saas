"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { CreateOrganizationDialog } from "@/app/organizations/components/create-organization-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrganizationContext } from "@/lib/context/organization-context";

const PERSONAL_VALUE = "__personal__";

/**
 * Select-based organization switcher matching the agent-transactions filter pattern.
 * Use on the account page and similar settings views.
 */
export function OrganizationSelect() {
  const t = useTranslations("App.Header");
  const tCreate = useTranslations("App.Organizations.Create");
  const tAccount = useTranslations("App.Account");
  const label = tAccount("activeWorkspace");
  const {
    activeOrganization,
    organizations,
    isLoading,
    setActiveOrganization,
  } = useOrganizationContext();
  const [selectOpen, setSelectOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const value = activeOrganization?.id ?? PERSONAL_VALUE;

  const handleCreateClick = () => {
    setSelectOpen(false);
    setDialogOpen(true);
  };

  return (
    <div className="text-sm flex items-center gap-2 self-end sm:self-auto">
      <span>{label}</span>
      <Select
        value={value}
        onValueChange={(v) =>
          setActiveOrganization(v === PERSONAL_VALUE ? null : v)
        }
        disabled={isLoading}
        open={selectOpen}
        onOpenChange={setSelectOpen}
      >
        <SelectTrigger className="w-fit max-w-64 flex items-center gap-2">
          <div className="min-w-0 flex-1 overflow-hidden [&_span]:block [&_span]:truncate [&_span]:min-w-0">
            <SelectValue className="text-sm" />
          </div>
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value={PERSONAL_VALUE}>{t("personalAccount")}</SelectItem>
          {organizations.map((org) => (
            <SelectItem key={org.id} value={org.id}>
              {org.name}
            </SelectItem>
          ))}
          <div className="border-t border-border mt-1 pt-1">
            <button
              type="button"
              onClick={handleCreateClick}
              className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
            >
              <Plus className="absolute left-2 h-4 w-4 shrink-0" />
              {tCreate("trigger")}
            </button>
          </div>
        </SelectContent>
      </Select>
      <CreateOrganizationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
