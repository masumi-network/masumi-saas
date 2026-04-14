"use client";

import { ChevronDown, Info } from "lucide-react";
import { useState } from "react";

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
  showDetails: "View details",
  hideDetails: "Hide details",
  moreAreas: "more",
} as const;

export function OidcPermissionSummary({
  groups,
  emptyLabel,
  surfaceClassName,
}: OidcPermissionSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (groups.length === 0) {
    if (!emptyLabel) return null;
    return <p className="text-sm italic text-muted-foreground">{emptyLabel}</p>;
  }

  const visibleGroupLabels = groups.slice(0, 3).map((group) => group.label);
  const hiddenGroupCount = Math.max(
    groups.length - visibleGroupLabels.length,
    0,
  );
  const moreAreasLabel = `+${hiddenGroupCount} ${COPY.moreAreas}`;

  return (
    <div className={surfaceClassName ?? "rounded-lg border bg-background p-3"}>
      <div className="flex flex-wrap gap-2">
        {visibleGroupLabels.map((label) => (
          <Badge key={label} variant="outline">
            {label}
          </Badge>
        ))}
        {hiddenGroupCount > 0 ? (
          <Badge variant="secondary">{moreAreasLabel}</Badge>
        ) : null}
      </div>

      <button
        className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <span>{isExpanded ? COPY.hideDetails : COPY.showDetails}</span>
        <ChevronDown
          className={`h-3 w-3 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>

      <div
        className="grid-expand-wrapper"
        data-expanded={isExpanded ? "true" : "false"}
      >
        <div className="grid-expand-inner">
          <div className="mt-3 space-y-4">
            {groups.map((group) => (
              <div key={group.key}>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </div>
                <div className="divide-y divide-border/50">
                  {group.permissions.map((permission) => (
                    <div
                      key={permission.key}
                      className="flex items-start justify-between gap-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">
                          {permission.label}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {permission.networks.map((network) => (
                            <Badge
                              key={network.scope}
                              variant="outline"
                              className="text-[11px]"
                            >
                              {network.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            aria-label={COPY.tooltipLabel}
                            className="mt-0.5 shrink-0 rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                            type="button"
                          >
                            <Info className="h-3.5 w-3.5" />
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
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
