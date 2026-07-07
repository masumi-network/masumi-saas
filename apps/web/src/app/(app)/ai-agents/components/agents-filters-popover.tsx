"use client";

import { ListFilter } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FILTER_ALL = "__all__";

export type AgentRegistrationFilter = "registered" | "pending" | "failed";

export type AgentVerificationFilter =
  | "verified"
  | "pending"
  | "unverified"
  | "revoked"
  | "expired";

export type AgentListFilters = {
  registration?: AgentRegistrationFilter;
  verification?: AgentVerificationFilter;
};

const VERIFICATION_FILTER_VALUES = [
  "verified",
  "pending",
  "unverified",
  "revoked",
  "expired",
] as const satisfies readonly AgentVerificationFilter[];

function isAgentVerificationFilter(
  value: string,
): value is AgentVerificationFilter {
  return (VERIFICATION_FILTER_VALUES as readonly string[]).includes(value);
}

export function countAgentListFilters(filters: AgentListFilters): number {
  let count = 0;
  if (filters.registration) count += 1;
  if (filters.verification) count += 1;
  return count;
}

export function agentListFiltersToApi(filters: AgentListFilters) {
  const api: {
    verificationStatus?: "VERIFIED" | "PENDING" | "REVOKED" | "EXPIRED";
    unverified?: boolean;
    registrationState?: "RegistrationConfirmed";
    registrationStateIn?: string[];
  } = {};

  switch (filters.verification) {
    case "verified":
      api.verificationStatus = "VERIFIED";
      break;
    case "pending":
      api.verificationStatus = "PENDING";
      break;
    case "revoked":
      api.verificationStatus = "REVOKED";
      break;
    case "expired":
      api.verificationStatus = "EXPIRED";
      break;
    case "unverified":
      api.unverified = true;
      break;
  }

  switch (filters.registration) {
    case "registered":
      api.registrationState = "RegistrationConfirmed";
      break;
    case "pending":
      api.registrationStateIn = [
        "RegistrationRequested",
        "RegistrationInitiated",
        "UpdateRequested",
        "UpdateInitiated",
        "DeregistrationRequested",
        "DeregistrationInitiated",
      ];
      break;
    case "failed":
      api.registrationStateIn = [
        "RegistrationFailed",
        "DeregistrationFailed",
        "UpdateFailed",
      ];
      break;
  }

  return Object.keys(api).length > 0 ? api : undefined;
}

export function parseAgentListFilters(
  searchParams: URLSearchParams,
): AgentListFilters {
  const legacyTab = searchParams.get("tab");
  if (legacyTab && legacyTab !== "all") {
    switch (legacyTab) {
      case "verified":
        return { verification: "verified" };
      case "registered":
        return { registration: "registered" };
      case "pending":
        return { registration: "pending" };
      case "failed":
        return { registration: "failed" };
    }
  }

  const filters: AgentListFilters = {};
  const registration = searchParams.get("registration");
  if (
    registration === "registered" ||
    registration === "pending" ||
    registration === "failed"
  ) {
    filters.registration = registration;
  }

  const verification = searchParams.get("verification");
  if (verification && isAgentVerificationFilter(verification)) {
    filters.verification = verification;
  }

  return filters;
}

export function agentListFiltersToSearchParams(
  filters: AgentListFilters,
  base: URLSearchParams,
): URLSearchParams {
  const params = new URLSearchParams(base.toString());
  params.delete("tab");

  if (filters.registration) {
    params.set("registration", filters.registration);
  } else {
    params.delete("registration");
  }

  if (filters.verification) {
    params.set("verification", filters.verification);
  } else {
    params.delete("verification");
  }

  return params;
}

export function AgentsFiltersPopover({
  filters,
  activeFilterCount,
  onChange,
  onClear,
}: {
  filters: AgentListFilters;
  activeFilterCount: number;
  onChange: (next: AgentListFilters) => void;
  onClear: () => void;
}) {
  const t = useTranslations("App.Agents");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative h-9 w-9 shrink-0"
          aria-label={t("filtersAria")}
        >
          <ListFilter className="h-4 w-4" />
          {activeFilterCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {activeFilterCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 overflow-hidden rounded-xl border-border/80 p-0 shadow-lg"
        align="end"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-medium">{t("filters")}</p>
          {activeFilterCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={onClear}
            >
              {t("clearFilters")}
            </Button>
          ) : null}
        </div>
        <div className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="agents-filter-registration">
              {t("filterRegistration")}
            </Label>
            <Select
              value={filters.registration ?? FILTER_ALL}
              onValueChange={(value) =>
                onChange({
                  ...filters,
                  registration:
                    value === FILTER_ALL
                      ? undefined
                      : (value as AgentRegistrationFilter),
                })
              }
            >
              <SelectTrigger id="agents-filter-registration" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>
                  {t("allRegistrationStatuses")}
                </SelectItem>
                <SelectItem value="registered">
                  {t("tabs.registered")}
                </SelectItem>
                <SelectItem value="pending">{t("tabs.pending")}</SelectItem>
                <SelectItem value="failed">{t("tabs.failed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agents-filter-verification">
              {t("filterVerification")}
            </Label>
            <Select
              value={filters.verification ?? FILTER_ALL}
              onValueChange={(value) =>
                onChange({
                  ...filters,
                  verification:
                    value === FILTER_ALL
                      ? undefined
                      : (value as AgentVerificationFilter),
                })
              }
            >
              <SelectTrigger id="agents-filter-verification" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>
                  {t("allVerificationStatuses")}
                </SelectItem>
                <SelectItem value="verified">{t("tabs.verified")}</SelectItem>
                <SelectItem value="pending">
                  {t("verificationFilters.pending")}
                </SelectItem>
                <SelectItem value="unverified">
                  {t("verificationFilters.unverified")}
                </SelectItem>
                <SelectItem value="revoked">
                  {t("verificationFilters.revoked")}
                </SelectItem>
                <SelectItem value="expired">
                  {t("verificationFilters.expired")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
