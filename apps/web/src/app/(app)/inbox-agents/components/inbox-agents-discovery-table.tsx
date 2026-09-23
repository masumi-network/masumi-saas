"use client";

import { Eye, MoreVertical } from "lucide-react";
import { useTranslations } from "next-intl";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import type { InboxAgentRegistration } from "@/lib/api/registry-discovery.client";
import { getInitials, shortenAddress } from "@/lib/utils";

function getInboxRegistrationBadgeVariant(
  status: InboxAgentRegistration["status"],
) {
  switch (status) {
    case "Verified":
      return "success" as const;
    case "Pending":
      return "secondary-muted" as const;
    case "Invalid":
      return "destructive" as const;
    case "Deregistered":
      return "outline-muted" as const;
    default:
      return "secondary" as const;
  }
}

export function InboxAgentsDiscoveryTable({
  registrations,
  onSelect,
}: {
  registrations: InboxAgentRegistration[];
  onSelect: (registration: InboxAgentRegistration) => void;
}) {
  const tAgents = useTranslations("App.Agents");
  const t = useTranslations("App.InboxAgents");
  const { formatRelativeDate } = useFormatDate();

  if (registrations.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/80">
      <HorizontalScrollArea>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t("table.name")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
              <TableHead>{t("table.inboxSlug")}</TableHead>
              <TableHead>{tAgents("Discovery.policyId")}</TableHead>
              <TableHead>{tAgents("Discovery.verifiedUpdated")}</TableHead>
              <TableHead className="text-right sticky right-0 z-10 w-48 min-w-48 bg-gradient-to-r from-transparent via-background/80 to-background">
                {t("table.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registrations.map((registration, index) => {
              const policyId = registration.RegistrySource.policyId;
              const description = registration.description?.trim();

              return (
                <TableRow
                  key={registration.id}
                  className="cursor-pointer hover:bg-muted/50 group animate-table-row-in"
                  style={{ animationDelay: `${Math.min(index, 9) * 40}ms` }}
                  onClick={() => onSelect(registration)}
                >
                  <TableCell className="max-w-56">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="h-9 w-9 shrink-0 border border-border/70">
                        <AvatarFallback>
                          {getInitials(registration.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 space-y-1">
                        <div className="truncate text-sm font-medium">
                          {registration.name}
                        </div>
                        {description ? (
                          <div className="line-clamp-1 text-xs text-muted-foreground">
                            {description}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={getInboxRegistrationBadgeVariant(
                        registration.status,
                      )}
                    >
                      {registration.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {registration.agentSlug}
                  </TableCell>
                  <TableCell className="max-w-44">
                    {policyId ? (
                      <div
                        className="flex items-center gap-2"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <span className="truncate font-mono text-xs">
                          {shortenAddress(policyId, 8)}
                        </span>
                        <CopyButton
                          value={policyId}
                          className="h-8 w-8 shrink-0"
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {tAgents("Discovery.noPolicyId")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                    {formatRelativeDate(registration.statusUpdatedAt)}
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
                        <DropdownMenuItem
                          onClick={() => onSelect(registration)}
                        >
                          <Eye className="mr-2 h-4 w-4 shrink-0" />
                          {t("details")}
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
