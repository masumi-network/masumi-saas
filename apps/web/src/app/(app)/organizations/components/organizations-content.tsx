"use client";

import { Building2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { OrganizationRoleBadge } from "@/components/organizations";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useOrganizationContext } from "@/lib/context/organization-context";

import { CreateOrganizationDialog } from "./create-organization-dialog";

type Org = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

interface OrganizationsContentProps {
  organizations: Org[];
}

export function OrganizationsContent({
  organizations,
}: OrganizationsContentProps) {
  const t = useTranslations("App.Organizations");
  const { activeOrganization } = useOrganizationContext();

  if (organizations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Building2 className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="mb-6 text-center text-muted-foreground">{t("empty")}</p>
          <CreateOrganizationDialog triggerVariant="default" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("listTitle")}</CardTitle>
        <CardDescription>{t("listDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {organizations.map((org) => {
            const slugDisplay = `@${org.slug}`;
            const isActive = activeOrganization?.id === org.id;

            return (
              <li key={org.id}>
                <Link
                  href={`/organizations/${org.slug}`}
                  className="block transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center justify-between rounded-lg border p-4 hover:border-muted-foreground/30">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{org.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {slugDisplay}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {isActive && (
                        <Badge variant="default" className="text-xs">
                          {t("current")}
                        </Badge>
                      )}
                      <OrganizationRoleBadge role={org.role} />
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
