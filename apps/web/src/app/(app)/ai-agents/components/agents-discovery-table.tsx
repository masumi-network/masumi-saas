"use client";

import { Eye, MoreVertical } from "lucide-react";
import { useTranslations } from "next-intl";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HorizontalScrollArea } from "@/components/ui/horizontal-scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFormatDate } from "@/hooks/use-format-date";
import type { RegistryEntry } from "@/lib/api/registry-discovery.client";
import { formatUnitAmount } from "@/lib/payment-node/format";
import { getInitials, shortenAddress } from "@/lib/utils";

export function getDiscoveryStatusBadgeVariant(
  status: RegistryEntry["status"],
) {
  switch (status) {
    case "Online":
      return "success" as const;
    case "Offline":
      return "secondary-muted" as const;
    case "Invalid":
      return "destructive" as const;
    case "Deregistered":
      return "outline-muted" as const;
    default:
      return "secondary" as const;
  }
}

function formatPricing(
  entry: RegistryEntry,
  free: string,
  dynamic: string,
  unavailable: string,
) {
  const pricing = entry.AgentPricing;

  if (pricing.pricingType === "Free") return free;
  if (pricing.pricingType === "Dynamic") return dynamic;
  if ("FixedPricing" in pricing && pricing.FixedPricing.Amounts.length > 0) {
    return pricing.FixedPricing.Amounts.map((amount) =>
      formatUnitAmount(amount.unit, amount.amount),
    ).join(", ");
  }

  return unavailable;
}

function formatPublisher(entry: RegistryEntry, fallback: string) {
  const parts = [entry.authorName, entry.authorOrganization].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : fallback;
}

function formatCapability(entry: RegistryEntry, fallback: string) {
  if (!entry.Capability?.name) return fallback;
  return entry.Capability.version
    ? `${entry.Capability.name} v${entry.Capability.version}`
    : entry.Capability.name;
}

export function AgentsDiscoveryTable({
  entries,
  onSelect,
}: {
  entries: RegistryEntry[];
  onSelect: (entry: RegistryEntry) => void;
}) {
  const t = useTranslations("App.Agents");
  const { formatRelativeDate } = useFormatDate();

  if (entries.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/80">
      <HorizontalScrollArea>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t("table.name")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
              <TableHead>{t("table.price")}</TableHead>
              <TableHead>{t("Discovery.capability")}</TableHead>
              <TableHead>{t("Discovery.publisher")}</TableHead>
              <TableHead>{t("table.agentId")}</TableHead>
              <TableHead>{t("Discovery.updated")}</TableHead>
              <TableHead className="text-right sticky right-0 z-10 w-48 min-w-48 bg-gradient-to-r from-transparent via-background/80 to-background">
                {t("table.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry, index) => {
              const pricingLabel = formatPricing(
                entry,
                t("Discovery.pricing.free"),
                t("Discovery.pricing.dynamic"),
                t("Discovery.pricing.unavailable"),
              );
              const publisher = formatPublisher(
                entry,
                t("Discovery.authorFallback"),
              );
              const capability = formatCapability(
                entry,
                t("Discovery.noCapability"),
              );
              const description =
                entry.description?.trim() || t("Details.noDescription");

              return (
                <TableRow
                  key={entry.id}
                  className="cursor-pointer hover:bg-muted/50 group animate-table-row-in"
                  style={{ animationDelay: `${Math.min(index, 9) * 40}ms` }}
                  onClick={() => onSelect(entry)}
                >
                  <TableCell className="max-w-56">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="h-9 w-9 shrink-0 border border-border/70">
                        <AvatarImage
                          src={entry.image ?? undefined}
                          alt={entry.name}
                        />
                        <AvatarFallback>
                          {getInitials(entry.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 space-y-1">
                        <div className="truncate text-sm font-medium">
                          {entry.name}
                        </div>
                        <div className="line-clamp-1 text-xs text-muted-foreground">
                          {description}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={getDiscoveryStatusBadgeVariant(entry.status)}
                    >
                      {entry.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {pricingLabel}
                  </TableCell>
                  <TableCell className="max-w-40 truncate text-sm text-muted-foreground">
                    {capability}
                  </TableCell>
                  <TableCell className="max-w-44 truncate text-sm text-muted-foreground">
                    {publisher}
                  </TableCell>
                  <TableCell className="max-w-44">
                    <div
                      className="flex items-center gap-2"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <span className="truncate font-mono text-xs">
                        {shortenAddress(entry.agentIdentifier, 8)}
                      </span>
                      <CopyButton
                        value={entry.agentIdentifier}
                        className="h-8 w-8 shrink-0"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                    {formatRelativeDate(entry.updatedAt)}
                  </TableCell>
                  <TableCell className="text-right sticky right-0 z-10 w-48 min-w-48 bg-gradient-to-r from-transparent via-background/80 to-background pointer-events-none [&>*]:pointer-events-auto">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label={t("table.actions")}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="min-w-[140px]"
                      >
                        <DropdownMenuItem onClick={() => onSelect(entry)}>
                          <Eye className="mr-2 h-4 w-4 shrink-0" />
                          {t("Discovery.viewDetails")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </HorizontalScrollArea>
    </div>
  );
}
