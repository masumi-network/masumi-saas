"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

type RegistrationState =
  | "RegistrationRequested"
  | "RegistrationInitiated"
  | "RegistrationConfirmed"
  | "RegistrationFailed"
  | "DeregistrationRequested"
  | "DeregistrationInitiated"
  | "DeregistrationConfirmed"
  | "DeregistrationFailed";

type VerificationStatus = "PENDING" | "VERIFIED" | "REVOKED" | "EXPIRED" | null;

interface AgentRow {
  id: string;
  name: string;
  apiUrl: string;
  registrationState: RegistrationState | string;
  verificationStatus: VerificationStatus | string | null;
  agentIdentifier: string | null;
  createdAt: string;
  ownerName: string;
  ownerEmail: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  total: number;
  limit: number;
}

interface AgentsListProps {
  agents: AgentRow[];
  pagination: PaginationInfo;
  currentSearch: string;
}

export default function AgentsList({
  agents,
  pagination,
  currentSearch,
}: AgentsListProps) {
  const t = useTranslations("Admin.Agents");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(currentSearch);

  useEffect(() => {
    setSearchInput(currentSearch);
  }, [currentSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== currentSearch) {
        const params = new URLSearchParams(window.location.search);
        if (searchInput) {
          params.set("search", searchInput);
        } else {
          params.delete("search");
        }
        params.set("page", "1");
        startTransition(() => {
          router.push(`/admin/agents?${params.toString()}`);
        });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, currentSearch, router]);

  const handleClearSearch = () => {
    setSearchInput("");
    startTransition(() => {
      router.push("/admin/agents");
    });
  };

  const getRegistrationLabel = (state: RegistrationState | string) => {
    const map: Record<RegistrationState, string> = {
      RegistrationConfirmed: t("registrationConfirmed"),
      RegistrationRequested: t("registrationRequested"),
      RegistrationInitiated: t("registrationInitiated"),
      RegistrationFailed: t("registrationFailed"),
      DeregistrationRequested: t("deregistrationRequested"),
      DeregistrationInitiated: t("deregistrationInitiated"),
      DeregistrationConfirmed: t("deregistrationConfirmed"),
      DeregistrationFailed: t("deregistrationFailed"),
    };
    return map[state as RegistrationState] ?? state;
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams();
    if (newPage > 1) params.set("page", String(newPage));
    if (currentSearch) params.set("search", currentSearch);
    const q = params.toString();
    startTransition(() => {
      router.push(q ? `/admin/agents?${q}` : "/admin/agents");
    });
  };

  const getVerificationLabel = (status: VerificationStatus | string | null) => {
    if (!status) return t("verificationPending");
    const map: Record<string, string> = {
      PENDING: t("verificationPending"),
      VERIFIED: t("verificationVerified"),
      REVOKED: t("verificationRevoked"),
      EXPIRED: t("verificationExpired"),
    };
    return map[status] ?? status;
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;
    if (pagination.totalPages <= maxVisiblePages) {
      for (let i = 1; i <= pagination.totalPages; i++) pages.push(i);
    } else {
      if (pagination.currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push("ellipsis");
        pages.push(pagination.totalPages);
      } else if (pagination.currentPage >= pagination.totalPages - 2) {
        pages.push(1);
        pages.push("ellipsis");
        for (let i = pagination.totalPages - 3; i <= pagination.totalPages; i++)
          pages.push(i);
      } else {
        pages.push(1);
        pages.push("ellipsis");
        for (
          let i = pagination.currentPage - 1;
          i <= pagination.currentPage + 1;
          i++
        )
          pages.push(i);
        pages.push("ellipsis");
        pages.push(pagination.totalPages);
      }
    }
    return pages;
  };

  const startIndex =
    pagination.total > 0
      ? (pagination.currentPage - 1) * pagination.limit + 1
      : 0;
  const endIndex = Math.min(
    pagination.currentPage * pagination.limit,
    pagination.total,
  );
  const isEmpty = agents.length === 0 && !currentSearch;
  const isNoResults = agents.length === 0 && currentSearch;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div aria-live="polite" className="sr-only">
            {isPending
              ? t("loading")
              : !isEmpty && !isNoResults
                ? t("showingRange", {
                    start: startIndex,
                    end: endIndex,
                    total: pagination.total,
                  })
                : ""}
          </div>

          <div className={isPending ? "opacity-50 pointer-events-none" : ""}>
            {isEmpty ? (
              <div className="text-center py-8 text-muted-foreground">
                {t("noAgents")}
              </div>
            ) : isNoResults ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">{t("noSearchResults")}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("noSearchResultsDescription")}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearSearch}
                  className="mt-4"
                >
                  {t("clearSearch")}
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("name")}</TableHead>
                    <TableHead>{t("owner")}</TableHead>
                    <TableHead>{t("agentIdentifier")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead>{t("verificationStatus")}</TableHead>
                    <TableHead>{t("createdAt")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell className="font-medium">
                        {agent.name}
                      </TableCell>
                      <TableCell>
                        <span className="block truncate max-w-[200px]">
                          {agent.ownerName}
                        </span>
                        <span className="block truncate max-w-[200px] text-sm text-muted-foreground">
                          {agent.ownerEmail}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 max-w-[260px]">
                          <span className="truncate font-mono text-xs text-muted-foreground">
                            {agent.agentIdentifier ?? "—"}
                          </span>
                          {agent.agentIdentifier ? (
                            <CopyButton
                              value={agent.agentIdentifier}
                              className="h-7 w-7 shrink-0"
                            />
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {getRegistrationLabel(agent.registrationState)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            agent.verificationStatus === "VERIFIED"
                              ? "default"
                              : "secondary"
                          }
                          className="font-normal"
                        >
                          {getVerificationLabel(agent.verificationStatus)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(agent.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {!isEmpty && !isNoResults && pagination.totalPages > 1 && (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                {t("showingRange", {
                  start: startIndex,
                  end: endIndex,
                  total: pagination.total,
                })}
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      text={t("previous")}
                      ariaLabel={t("paginationPrevious")}
                      onClick={() =>
                        handlePageChange(pagination.currentPage - 1)
                      }
                      aria-disabled={pagination.currentPage === 1}
                      className={
                        pagination.currentPage === 1
                          ? "pointer-events-none opacity-50"
                          : ""
                      }
                    />
                  </PaginationItem>
                  {getPageNumbers().map((p, i) =>
                    p === "ellipsis" ? (
                      <PaginationItem key={`ellipsis-${i}`}>
                        <PaginationEllipsis srText={t("page")} />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={p}>
                        <PaginationLink
                          onClick={() => handlePageChange(p as number)}
                          isActive={pagination.currentPage === p}
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    ),
                  )}
                  <PaginationItem>
                    <PaginationNext
                      text={t("next")}
                      ariaLabel={t("paginationNext")}
                      onClick={() =>
                        handlePageChange(pagination.currentPage + 1)
                      }
                      aria-disabled={
                        pagination.currentPage === pagination.totalPages
                      }
                      className={
                        pagination.currentPage === pagination.totalPages
                          ? "pointer-events-none opacity-50"
                          : ""
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
