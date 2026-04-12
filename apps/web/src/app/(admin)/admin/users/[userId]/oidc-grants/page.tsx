import prisma from "@masumi/database/client";
import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getUserOidcGrantMap,
  setUserOidcGrantScopes,
} from "@/lib/auth/oidc-user-grants";
import { getAdminAuthContext } from "@/lib/auth/utils";
import { oidcEnvConfig } from "@/lib/config/oidc.config";
import {
  getOidcApiScopeCatalog,
  type OidcClientKey,
} from "@/lib/config/oidc-scopes.config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.OidcGrants");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

const CLIENTS: Array<{
  key: OidcClientKey;
  clientId: string;
  name: string;
}> = [
  {
    key: "web",
    clientId: oidcEnvConfig.web.clientId,
    name: oidcEnvConfig.web.clientName,
  },
  {
    key: "cli",
    clientId: oidcEnvConfig.cli.clientId,
    name: oidcEnvConfig.cli.clientName,
  },
];

const USER_IDENTITY_SEPARATOR = "·";
const ALWAYS_INCLUDED_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
] as const;

interface AdminOidcGrantsPageProps {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ saved?: string }>;
}

export default async function AdminOidcGrantsPage({
  params,
  searchParams,
}: AdminOidcGrantsPageProps) {
  const authContext = await getAdminAuthContext();
  if (!authContext.isAuthenticated || !authContext.isAdmin) {
    redirect("/admin/signin");
  }

  const { userId } = await params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
    },
  });

  if (!user) {
    notFound();
  }

  const t = await getTranslations("Admin.OidcGrants");
  const catalog = getOidcApiScopeCatalog();
  const grantMap = await getUserOidcGrantMap(user.id);
  const resolvedSearchParams = await searchParams;

  async function saveOidcGrants(formData: FormData) {
    "use server";

    const adminContext = await getAdminAuthContext();
    if (!adminContext.isAuthenticated || !adminContext.isAdmin) {
      redirect("/admin/signin");
    }

    const formUserId = String(formData.get("userId") ?? "");
    const clientId = String(formData.get("clientId") ?? "");
    const scopes = formData
      .getAll("scopes")
      .map((value) => String(value))
      .filter(Boolean);

    await setUserOidcGrantScopes({
      userId: formUserId,
      clientId,
      scopes,
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${formUserId}/oidc-grants`);
    redirect(`/admin/users/${formUserId}/oidc-grants?saved=1`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{t("badge")}</Badge>
            {user.emailVerified ? (
              <Badge variant="default">{t("verified")}</Badge>
            ) : (
              <Badge variant="outline">{t("unverified")}</Badge>
            )}
          </div>
          <h1 className="text-3xl font-light tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
          <p className="text-sm text-muted-foreground">
            {user.name} {USER_IDENTITY_SEPARATOR} {user.email}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/users">{t("backToUsers")}</Link>
        </Button>
      </div>

      {resolvedSearchParams.saved === "1" ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          {t("saved")}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("alwaysIncludedTitle")}</CardTitle>
          <CardDescription>{t("alwaysIncludedDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {ALWAYS_INCLUDED_SCOPES.map((scope) => (
              <Badge key={scope} variant="outline">
                {scope}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        {CLIENTS.map((client) => {
          const selectedScopes = new Set(grantMap[client.key]);

          return (
            <Card key={client.key}>
              <form action={saveOidcGrants}>
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="clientId" value={client.clientId} />
                <CardHeader>
                  <CardTitle>{client.name}</CardTitle>
                  <CardDescription>
                    {t("clientDescription", { clientId: client.clientId })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {catalog.map((group) => (
                    <div key={group.key} className="space-y-3">
                      <div>
                        <h2 className="text-sm font-medium">{group.label}</h2>
                      </div>
                      <div className="space-y-3">
                        {group.scopes.map((scope) => (
                          <label
                            key={scope.scope}
                            className="flex items-start gap-3 rounded-lg border p-3"
                          >
                            <input
                              type="checkbox"
                              name="scopes"
                              value={scope.scope}
                              defaultChecked={selectedScopes.has(scope.scope)}
                              className="mt-1 h-4 w-4 accent-primary"
                            />
                            <div className="space-y-1">
                              <div className="text-sm font-medium">
                                {scope.label}
                              </div>
                              <div className="font-mono text-xs text-muted-foreground">
                                {scope.scope}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {scope.description}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
                <CardFooter className="justify-end">
                  <Button type="submit">{t("saveButton")}</Button>
                </CardFooter>
              </form>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
