import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache } from "react";

import { getOrganizationBySlugAction } from "@/lib/actions/organization.action";

import { OrganizationDetailContent } from "./components/organization-detail-content";

const getCachedOrganization = cache(getOrganizationBySlugAction);

interface OrganizationPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: OrganizationPageProps): Promise<Metadata> {
  const t = await getTranslations("App.Organizations.Detail");
  const { slug } = await params;
  const result = await getCachedOrganization(slug);

  if (!result.success) {
    return { title: `Masumi - ${t("title")}` };
  }

  return {
    title: `Masumi - ${result.data.name}`,
    description: t("description", { name: result.data.name }),
  };
}

export default async function OrganizationPage({
  params,
}: OrganizationPageProps) {
  const { slug } = await params;
  const result = await getCachedOrganization(slug);

  if (!result.success) {
    notFound();
  }

  return <OrganizationDetailContent organization={result.data} />;
}
