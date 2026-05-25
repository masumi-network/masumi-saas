import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AppPage } from "@/components/app-page";
import { PageHeader } from "@/components/page-header";
import { getAdminAgents } from "@/lib/api/admin.server";

import AdminAgentsContent from "./components/admin-agents-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.Agents");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

type PageProps = {
  searchParams: Promise<{ page?: string; limit?: string; search?: string }>;
};

export default async function AdminAgentsPage({ searchParams }: PageProps) {
  const t = await getTranslations("Admin.Agents");
  const params = await searchParams;
  const page = Math.min(
    10_000,
    Math.max(1, Math.floor(Number(params.page) || 1)),
  );
  const limit = Math.min(
    50,
    Math.max(1, Math.floor(Number(params.limit) || 10)),
  );
  const search = params.search?.trim() ?? "";

  const result = await getAdminAgents({ page, limit, search });

  return (
    <AppPage>
      <PageHeader title={t("title")} description={t("description")} />
      <AdminAgentsContent result={result} />
    </AppPage>
  );
}
