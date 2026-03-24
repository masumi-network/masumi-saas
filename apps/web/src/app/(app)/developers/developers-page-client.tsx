"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";

import { InputSchemaValidator } from "@/components/developers/InputSchemaValidator";
import { OpenApiExplorerEmbed } from "@/components/developers/open-api-explorer-embed";
import { Tabs } from "@/components/ui/tabs";

/** Default tab is OpenAPI so Masumi SaaS API docs are visible immediately. `?tab=schema` for the validator. */
const TAB_SCHEMA = "schema";
const TAB_OPENAPI = "openapi";

export function DevelopersPageClient() {
  const t = useTranslations("Developers");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTab = useMemo(() => {
    const tab = searchParams.get("tab");
    if (tab === TAB_SCHEMA) return TAB_SCHEMA;
    return TAB_OPENAPI;
  }, [searchParams]);

  const setTab = useCallback(
    (tab: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === TAB_OPENAPI) {
        params.delete("tab");
      } else if (tab === TAB_SCHEMA) {
        params.set("tab", TAB_SCHEMA);
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
    ],
    [t],
  );

  return (
    <div className="space-y-6 min-w-0">
      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setTab} />
      <div className="min-w-0">
        {activeTab === TAB_OPENAPI ? (
          <OpenApiExplorerEmbed />
        ) : (
          <div className="animate-fade-in-up opacity-0">
            <InputSchemaValidator />
          </div>
        )}
      </div>
    </div>
  );
}
