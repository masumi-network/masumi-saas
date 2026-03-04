import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache, Suspense } from "react";

import {
  getOrganizationDashboardAction,
  getOrganizationMembersAction,
  getOrganizationPendingInvitationsAction,
} from "@/lib/actions/organization.action";

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
  const [dashboardResult, membersResult, invitationsResult] = await Promise.all(
    [
      getCachedOrganizationDashboard(slug),
      getOrganizationMembersAction(slug),
      getOrganizationPendingInvitationsAction(slug),
    ],
  );

  if (!dashboardResult.success) {
    notFound();
  }

  return (
    <OrganizationDashboardOverview
      data={dashboardResult.data}
      members={membersResult.success ? membersResult.data : []}
      pendingInvitations={
        invitationsResult.success ? invitationsResult.data : []
      }
    />
  );
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
