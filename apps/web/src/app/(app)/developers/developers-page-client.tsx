"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";

import { InputSchemaValidator } from "@/components/developers/InputSchemaValidator";
import { OpenApiExplorerEmbed } from "@/components/developers/open-api-explorer-embed";
import { DevelopersTestingPanel } from "@/components/developers/testing/developers-testing-panel";
import { Tabs } from "@/components/ui/tabs";

/** Default tab is OpenAPI so Masumi SaaS API docs are visible immediately. `?tab=schema` | `?tab=testing`. */
const TAB_SCHEMA = "schema";
const TAB_OPENAPI = "openapi";
const TAB_TESTING = "testing";

export function DevelopersPageClient() {
  const t = useTranslations("Developers");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTab = useMemo(() => {
    const tab = searchParams.get("tab");
    if (tab === TAB_SCHEMA) return TAB_SCHEMA;
    if (tab === TAB_TESTING) return TAB_TESTING;
    return TAB_OPENAPI;
  }, [searchParams]);

  const setTab = useCallback(
    (tab: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === TAB_OPENAPI) {
        params.delete("tab");
      } else if (tab === TAB_SCHEMA) {
        params.set("tab", TAB_SCHEMA);
      } else if (tab === TAB_TESTING) {
        params.set("tab", TAB_TESTING);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  const tabs = useMemo(
    () => [
      { name: t("tabs.openApi"), key: TAB_OPENAPI },
      { name: t("tabs.schemaValidator"), key: TAB_SCHEMA },
      { name: t("tabs.testing"), key: TAB_TESTING },
    ],
    [t],
  );

  return (
    <div className="space-y-6 min-w-0">
      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setTab} />
      <div className="min-w-0">
        {activeTab === TAB_OPENAPI ? (
          <OpenApiExplorerEmbed />
        ) : activeTab === TAB_SCHEMA ? (
          <div className="animate-fade-in-up opacity-0">
            <InputSchemaValidator />
          </div>
        ) : (
          <DevelopersTestingPanel />
        )}
      </div>
    </div>
  );
}
