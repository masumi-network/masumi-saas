"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type AdminAgentRow,
  type AdminAgentsPagination,
  adminApiClient,
} from "@/lib/api/admin.client";

import AgentsList from "./agents-list";

function AgentsListSkeleton() {
  const t = useTranslations("Admin.Agents");
  const rows = 8;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <Skeleton className="h-10 w-64 rounded-md" />
        </div>
      </CardHeader>
      <CardContent>
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
            {Array.from({ length: rows }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-28 mb-1" />
                  <Skeleton className="h-3 w-40" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-44 font-mono" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

type AgentsData = {
  agents: AdminAgentRow[];
  pagination: AdminAgentsPagination;
  search: string;
};

export default function AdminAgentsContent() {
  const t = useTranslations("Admin.Agents");
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentsData | null>(null);

  const page = Math.max(1, Math.floor(Number(searchParams.get("page")) || 1));
  const limit = Math.min(
    50,
    Math.max(1, Math.floor(Number(searchParams.get("limit")) || 10)),
  );
  const search = searchParams.get("search")?.trim() ?? "";

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      adminApiClient
        .getAgents({ page, limit, search })
        .then((result) => {
          if (cancelled) return;
          if (result.success) {
            setAgents(result.data);
            setError(null);
          } else {
            setAgents(null);
            setError(result.error);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [page, limit, search]);

  if (loading && !agents) {
    return <AgentsListSkeleton />;
  }

  if (error && !agents) {
    return (
      <div className="rounded-lg border border-destructive p-6">
        <p className="text-destructive text-center">
          {t("errorLoadingAgents")}
        </p>
      </div>
    );
  }

  if (!agents) {
    return null;
  }

  return (
    <AgentsList
      agents={agents.agents}
      pagination={agents.pagination}
      currentSearch={agents.search}
    />
  );
}
