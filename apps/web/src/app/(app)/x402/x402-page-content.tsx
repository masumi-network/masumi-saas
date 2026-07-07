"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo } from "react";

import { Tabs } from "@/components/ui/tabs";
import { AlertsTab } from "@/components/x402/alerts-tab";
import { BudgetsTab } from "@/components/x402/budgets-tab";
import { ChainsTab } from "@/components/x402/chains-tab";
import { PaymentsTab } from "@/components/x402/payments-tab";
import { WalletsTab } from "@/components/x402/wallets-tab";
import { X402SetupBanner } from "@/components/x402/x402-setup-banner";
import { X402SetupDialogProvider } from "@/components/x402/x402-setup-dialog";
import { canAccessX402Workspace } from "@/lib/auth/org-roles";
import { useOrganizationContext } from "@/lib/context/organization-context";

const ALL_TABS = [
  "Chains",
  "Wallets",
  "Budgets",
  "Alerts",
  "Payments",
] as const;
type TabName = (typeof ALL_TABS)[number];

function isTabName(value: unknown): value is TabName {
  return (
    typeof value === "string" && (ALL_TABS as readonly string[]).includes(value)
  );
}

function X402PageContentInner() {
  const t = useTranslations("App.X402");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeOrganization, activeOrganizationId } = useOrganizationContext();

  const showBudgetsTab = canAccessX402Workspace(
    activeOrganizationId,
    activeOrganization?.role,
  );

  const tabs = useMemo(() => {
    const names = showBudgetsTab
      ? ALL_TABS
      : ALL_TABS.filter((name) => name !== "Budgets");
    return names.map((name) => ({ name: t(`tabs.${name}`), key: name }));
  }, [showBudgetsTab, t]);

  const activeTab: TabName = useMemo(() => {
    const fromQuery = searchParams.get("tab");
    if (fromQuery === "Budgets" && !showBudgetsTab) {
      return "Chains";
    }
    return isTabName(fromQuery) ? fromQuery : "Chains";
  }, [searchParams, showBudgetsTab]);

  useEffect(() => {
    if (searchParams.get("tab") === "Budgets" && !showBudgetsTab) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "Chains");
      router.replace(`/x402?${params.toString()}`);
    }
  }, [router, searchParams, showBudgetsTab]);

  const setActiveTab = useCallback(
    (name: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", name);
      router.replace(`/x402?${params.toString()}`);
    },
    [router, searchParams],
  );

  return (
    <div className="space-y-6">
      <X402SetupBanner />

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <div>
        {activeTab === "Chains" && <ChainsTab />}
        {activeTab === "Wallets" && <WalletsTab />}
        {activeTab === "Budgets" && showBudgetsTab && <BudgetsTab />}
        {activeTab === "Alerts" && <AlertsTab />}
        {activeTab === "Payments" && <PaymentsTab />}
      </div>
    </div>
  );
}

export function X402PageContent() {
  return (
    <X402SetupDialogProvider>
      <X402PageContentInner />
    </X402SetupDialogProvider>
  );
}
