import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache, Suspense } from "react";

import { getOrganizationDashboardAction } from "@/lib/actions/organization.action";

import {
  OrganizationDashboardOverview,
  OrganizationDashboardSkeleton,
} from "./components/organization-dashboard-overview";

const getCachedOrganizationDashboard = cache(getOrganizationDashboardAction);

interface OrganizationPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: OrganizationPageProps): Promise<Metadata> {
  const t = await getTranslations("App.Organizations.Detail");
  const { slug } = await params;
  const result = await getCachedOrganizationDashboard(slug);

  if (!result.success) {
    return { title: `Masumi - ${t("title")}` };
  }

  return {
    title: `Masumi - ${result.data.organization.name}`,
    description: t("description", { name: result.data.organization.name }),
  };
}

async function OrganizationPageContent({ slug }: { slug: string }) {
  const result = await getCachedOrganizationDashboard(slug);

  if (!result.success) {
    notFound();
  }

  return <OrganizationDashboardOverview data={result.data} />;
}

export default async function OrganizationPage({
  params,
}: OrganizationPageProps) {
  const { slug } = await params;

  return (
    <Suspense fallback={<OrganizationDashboardSkeleton />}>
      <OrganizationPageContent slug={slug} />
    </Suspense>
  );
}
