import { Building2 } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Org = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

export async function OrganizationsContent({
  organizations,
}: {
  organizations: Org[];
}) {
  const t = await getTranslations("App.Organizations");

  if (organizations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Building2 className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-center text-muted-foreground">{t("empty")}</p>
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
            return (
              <li key={org.id}>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{org.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {slugDisplay}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="capitalize">
                    {org.role}
                  </Badge>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
