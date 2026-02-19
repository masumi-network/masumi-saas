import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { auth } from "@/lib/auth/auth";
import { getAdminAuthContext } from "@/lib/auth/utils";

import UsersList from "./components/users-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.Users");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

export default async function AdminUsersPage() {
  // Defense-in-depth: verify admin even though layout also checks
  const authContext = await getAdminAuthContext();
  if (!authContext.isAuthenticated || !authContext.isAdmin) {
    redirect("/admin/signin");
  }

  const t = await getTranslations("Admin.Users");
  const headersList = await headers();

  const currentUserId = authContext.session?.user?.id;

  // Fetch all users via Better Auth admin API
  const usersResponse = await auth.api.listUsers({
    headers: headersList,
    query: {
      limit: 100,
    },
  });

  const users = usersResponse?.users || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-light tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-2">{t("description")}</p>
      </div>

      <UsersList
        currentUserId={currentUserId}
        initialUsers={users.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role || "user",
          banned: user.banned || false,
          banReason: user.banReason || null,
          createdAt:
            user.createdAt instanceof Date
              ? user.createdAt.toISOString()
              : String(user.createdAt),
        }))}
      />
    </div>
  );
}
