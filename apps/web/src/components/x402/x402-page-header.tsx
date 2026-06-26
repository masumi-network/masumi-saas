"use client";

import { useTranslations } from "next-intl";

import { OrgContextBanner } from "@/components/organizations";
import { PageHeader } from "@/components/page-header";
import { X402PageTitle } from "@/components/x402/x402-page-title";
import { useOrganizationContext } from "@/lib/context/organization-context";

export function X402PageHeader() {
  const t = useTranslations("App.X402");
  const { activeOrganization, isLoading } = useOrganizationContext();

  return (
    <PageHeader
      title={<X402PageTitle label={t("title")} />}
      description={t("description")}
      actions={
        !isLoading && activeOrganization ? (
          <OrgContextBanner orgHrefSuffix="x402" />
        ) : null
      }
    />
  );
}
