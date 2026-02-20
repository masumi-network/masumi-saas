"use client";

import { Building2, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { OrganizationRoleBadge } from "@/components/organizations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { OrganizationInfo } from "@/lib/actions/organization.action";
import { useOrganizationContext } from "@/lib/context/organization-context";

interface OrganizationDetailContentProps {
  organization: OrganizationInfo;
}

export function OrganizationDetailContent({
  organization,
}: OrganizationDetailContentProps) {
  const t = useTranslations("App.Organizations.Detail");
  const tSidebar = useTranslations("App.Sidebar.MenuItems");
  const { activeOrganization, setActiveOrganization } =
    useOrganizationContext();
  const isActive = activeOrganization?.id === organization.id;
  const backHref = "/organizations";
  const slugDisplay = `@${organization.slug}`;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              asChild
              className="-ml-2 h-8 w-8 shrink-0 rounded-full"
            >
              <Link href={backHref}>
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("back")}</TooltipContent>
        </Tooltip>
        <Link
          href={backHref}
          className="text-muted-foreground text-sm transition-colors hover:text-foreground"
        >
          {tSidebar("organizations")}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                <Building2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-xl">{organization.name}</CardTitle>
                <CardDescription>{slugDisplay}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <OrganizationRoleBadge role={organization.role} />
              {isActive && <Badge variant="default">{t("current")}</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!isActive && (
            <Button
              variant="default"
              onClick={() => setActiveOrganization(organization.id)}
            >
              {t("switchTo")}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
