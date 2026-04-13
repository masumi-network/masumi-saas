"use client";

import { Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { OidcGroupedApiPermissionCatalogGroup } from "@/lib/config/oidc-scopes.config";

type OidcPermissionCheckboxGroupsProps = {
  groups: OidcGroupedApiPermissionCatalogGroup[];
  selectedScopes: string[];
};

const COPY = {
  tooltipLabel: "Permission details",
} as const;

export function OidcPermissionCheckboxGroups({
  groups,
  selectedScopes,
}: OidcPermissionCheckboxGroupsProps) {
  const selectedScopeSet = new Set(selectedScopes);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.key} className="space-y-3">
          <div>
            <h2 className="text-sm font-medium">{group.label}</h2>
          </div>
          <div className="space-y-3">
            {group.permissions.map((permission) => (
              <div key={permission.key} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-medium">{permission.label}</div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        aria-label={COPY.tooltipLabel}
                        className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        type="button"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs space-y-2">
                      {permission.networks.map((network) => (
                        <div key={network.scope} className="space-y-1">
                          <div className="font-medium">{network.label}</div>
                          <div>{network.description}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {network.scope}
                          </div>
                        </div>
                      ))}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  {permission.networks.map((network) => (
                    <label
                      key={network.scope}
                      className="flex items-center gap-2 rounded-md border px-3 py-2"
                    >
                      <input
                        className="h-4 w-4 accent-primary"
                        defaultChecked={selectedScopeSet.has(network.scope)}
                        name="scopes"
                        type="checkbox"
                        value={network.scope}
                      />
                      <Badge variant="outline">{network.label}</Badge>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
