"use client";

import { Building2, Check } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useOrganizationContext } from "@/lib/context/organization-context";

/**
 * Inline organization switcher for use inside dropdown menus (e.g. user avatar).
 * Renders a list of organizations; clicking one switches context.
 */
export function OrganizationSelectorInline() {
  const t = useTranslations("App.Header");
  const {
    activeOrganization,
    organizations,
    isLoading,
    setActiveOrganization,
  } = useOrganizationContext();

  if (organizations.length === 0) {
    return null;
  }

  return (
    <>
      <DropdownMenuLabel>{t("organizations")}</DropdownMenuLabel>
      {organizations.map((org) => (
        <DropdownMenuItem
          key={org.id}
          onClick={() => setActiveOrganization(org.id)}
          className="cursor-pointer"
          disabled={isLoading}
        >
          {activeOrganization?.id === org.id ? (
            <Check className="mr-2 h-4 w-4 shrink-0" />
          ) : (
            <Building2 className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{org.name}</span>
        </DropdownMenuItem>
      ))}
      {activeOrganization && (
        <DropdownMenuItem
          onClick={() => setActiveOrganization(null)}
          className="cursor-pointer"
          disabled={isLoading}
        >
          <span className="mr-2 w-4" />
          {t("clearOrganization")}
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
    </>
  );
}
