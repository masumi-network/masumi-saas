"use client";

import { ArrowRight, Building2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { OrganizationRoleBadge } from "@/components/organizations";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useOrganizationContext } from "@/lib/context/organization-context";

export function DashboardOrgContextBanner() {
  const t = useTranslations("App.Home.Dashboard.orgContext");
  const { activeOrganization, isLoading } = useOrganizationContext();

  if (isLoading || !activeOrganization) return null;

  const orgHref = `/organizations/${activeOrganization.slug}?from=dashboard`;

  return (
    <div className="w-fit flex items-center gap-3 rounded-lg border border-border/60 bg-muted-surface px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{t("workingAs")}</span>
        <span className="min-w-0 truncate text-sm font-medium">
          {activeOrganization.name}
        </span>
        <OrganizationRoleBadge role={activeOrganization.role} />
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={t("viewDashboardAriaLabel")}
            asChild
          >
            <Link href={orgHref}>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">{t("viewDashboard")}</TooltipContent>
      </Tooltip>
    </div>
  );
}
