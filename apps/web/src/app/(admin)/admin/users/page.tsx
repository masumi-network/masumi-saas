import type { Prisma } from "@masumi/database";
import prisma from "@masumi/database/client";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getAdminAuthContext } from "@/lib/auth/utils";

import UsersList from "./components/users-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.Users");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

interface AdminUsersPageProps {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    search?: string;
    filter?: string;
  }>;
}

export default async function AdminUsersPage({
  searchParams,
}: AdminUsersPageProps) {
  // Defense-in-depth: verify admin even though layout also checks
  const authContext = await getAdminAuthContext();
  if (!authContext.isAuthenticated || !authContext.isAdmin) {
    redirect("/admin/signin");
  }

  const t = await getTranslations("Admin.Users");
  const params = await searchParams;

  // Sanitize and validate URL parameters
  const page = Math.max(1, Math.floor(Number(params.page)) || 1);
  const limit = Math.min(
    50,
    Math.max(1, Math.floor(Number(params.limit)) || 10),
  );
  const search = String(params.search || "")
    .trim()
    .slice(0, 200);
  const filter = ["all", "verified", "unverified"].includes(params.filter || "")
    ? (params.filter as "all" | "verified" | "unverified")
    : "all";

  // Escape ILIKE wildcards to prevent wildcard injection.
  // Backslashes must be included in the same pass — if escaped separately after
  // _ and %, the new backslashes introduced by escaping would themselves be doubled.
  const escapedSearch = search
    ? search.replace(/[\\_%]/g, (match) => "\\" + match)
    : "";

  // Build Prisma WHERE clause with inline typing
  const searchCondition = escapedSearch
    ? {
        OR: [
          { name: { contains: escapedSearch, mode: "insensitive" as const } },
          { email: { contains: escapedSearch, mode: "insensitive" as const } },
        ],
      }
    : {};

  const filterCondition =
    filter === "verified"
      ? { emailVerified: true }
      : filter === "unverified"
        ? { emailVerified: false }
        : {};

  const where = { ...searchCondition, ...filterCondition };

  // Extracted select shape as const for type inference via Prisma.UserGetPayload
  const userSelect = {
    id: true,
    name: true,
    email: true,
    emailVerified: true,
    role: true,
    banned: true,
    banReason: true,
    createdAt: true,
    kycVerification: { select: { status: true } },
  } as const satisfies Prisma.UserSelect;

  type UserWithKyc = Prisma.UserGetPayload<{ select: typeof userSelect }>;

  // Parallel query: users + total count with error handling
  let users: UserWithKyc[] = [];
  let total = 0;
  let hasError = false;

  try {
    [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.user.count({ where }),
    ]);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    hasError = true;
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(page, totalPages);

  const currentUserId = authContext.session?.user?.id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-light tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-2">{t("description")}</p>
      </div>

      {hasError ? (
        <div className="rounded-lg border border-destructive p-6">
          <p className="text-destructive text-center">
            {t("errorLoadingUsers")}
          </p>
        </div>
      ) : (
        <UsersList
          currentUserId={currentUserId}
          users={users.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            emailVerified: u.emailVerified,
            kycStatus: u.kycVerification?.status ?? null,
            role: u.role || "user",
            banned: u.banned,
            banReason: u.banReason,
            createdAt: u.createdAt.toISOString(),
          }))}
          pagination={{ currentPage, totalPages, total, limit }}
          currentSearch={search}
          currentFilter={filter}
        />
      )}
    </div>
  );
}
