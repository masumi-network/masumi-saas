"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";

import { InputSchemaValidator } from "@/components/developers/InputSchemaValidator";
import { OpenApiExplorerEmbed } from "@/components/developers/open-api-explorer-embed";
import { Tabs } from "@/components/ui/tabs";

/** Default tab — URL omits `tab` (matches payment-service “Schema Validator” first). */
const TAB_SCHEMA = "schema";
const TAB_OPENAPI = "openapi";

export function DevelopersPageClient() {
  const t = useTranslations("Developers");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTab = useMemo(() => {
    const tab = searchParams.get("tab");
    if (tab === TAB_OPENAPI) return TAB_OPENAPI;
    return TAB_SCHEMA;
  }, [searchParams]);

  const setTab = useCallback(
    (tab: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === TAB_SCHEMA) {
        params.delete("tab");
      } else if (tab === TAB_OPENAPI) {
        params.set("tab", TAB_OPENAPI);
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
      { name: t("tabs.schemaValidator"), key: TAB_SCHEMA },
      { name: t("tabs.openApi"), key: TAB_OPENAPI },
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
