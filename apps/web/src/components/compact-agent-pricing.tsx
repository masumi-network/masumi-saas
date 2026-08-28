import { cn } from "@/lib/utils";
import {
  type AgentPricing,
  getPricingDisplayCompactParts,
} from "@/lib/utils/format-price";

const EMPTY_CELL = "\u2014";
const EXTRA_COUNT_PREFIX = "+";

export function CompactAgentPricing({
  pricing,
  className,
}: {
  pricing: AgentPricing | null | undefined | Record<string, unknown>;
  className?: string;
}) {
  const parts = getPricingDisplayCompactParts(pricing);
  if (!parts) {
    return <span className={className}>{EMPTY_CELL}</span>;
  }

  return (
    <span className={cn("tabular-nums", className)}>
      {parts.primary}
      {parts.extraCount > 0 ? (
        <span className="text-muted-foreground">
          {EXTRA_COUNT_PREFIX}
          {parts.extraCount}
        </span>
      ) : null}
    </span>
  );
}
