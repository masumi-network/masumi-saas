"use client";

import { Building2, Check, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOrganizationContext } from "@/lib/context/organization-context";

export function OrganizationSelector() {
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

  const displayName = activeOrganization?.name ?? t("organizations");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2 min-w-0 max-w-[180px]"
          disabled={isLoading}
        >
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="truncate">{displayName}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{t("organizations")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => setActiveOrganization(org.id)}
            className="cursor-pointer"
          >
            {activeOrganization?.id === org.id ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <span className="mr-2 w-4" />
            )}
            <span className="truncate">{org.name}</span>
          </DropdownMenuItem>
        ))}
        {activeOrganization && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setActiveOrganization(null)}
              className="cursor-pointer"
            >
              <span className="mr-2 w-4" />
              {t("clearOrganization")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
