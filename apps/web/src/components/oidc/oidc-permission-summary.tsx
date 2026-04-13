"use client";

import { Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { OidcGroupedApiPermissionCatalogGroup } from "@/lib/config/oidc-scopes.config";

type OidcPermissionSummaryProps = {
  groups: OidcGroupedApiPermissionCatalogGroup[];
  emptyLabel: string;
  surfaceClassName?: string;
};

const COPY = {
  tooltipLabel: "Permission details",
} as const;

export function OidcPermissionSummary({
  groups,
  emptyLabel,
  surfaceClassName,
}: OidcPermissionSummaryProps) {
  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.key} className="space-y-2">
          <div className="text-sm font-medium">{group.label}</div>
          <div className="space-y-2">
            {group.permissions.map((permission) => (
              <div
                key={permission.key}
                className={
                  surfaceClassName ??
                  "rounded-md border bg-background px-3 py-3"
                }
              >
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
                <div className="mt-2 flex flex-wrap gap-2">
                  {permission.networks.map((network) => (
                    <Badge key={network.scope} variant="outline">
                      {network.label}
                    </Badge>
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
