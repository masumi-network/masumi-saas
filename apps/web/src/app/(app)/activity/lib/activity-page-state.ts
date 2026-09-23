import type { ActivityFeedFilter } from "@/lib/schemas/activity";

export type ActivitySection = "all" | "lifecycle" | "transactions";

export const ACTIVITY_SECTIONS: ActivitySection[] = [
  "all",
  "lifecycle",
  "transactions",
];

export type ActivityTransactionTypeFilter =
  | "all"
  | "purchases"
  | "payments"
  | "refundRequests"
  | "disputes";

export const ACTIVITY_TRANSACTION_TYPE_FILTERS: ActivityTransactionTypeFilter[] =
  ["all", "purchases", "payments", "refundRequests", "disputes"];

const LEGACY_TAB_TRANSACTION_FILTERS = new Set<ActivityTransactionTypeFilter>([
  "purchases",
  "payments",
  "refundRequests",
  "disputes",
]);

export function parseActivityPageState(searchParams: URLSearchParams): {
  section: ActivitySection;
  transactionFilter: ActivityTransactionTypeFilter;
} {
  const tab = searchParams.get("tab");
  const typeParam = searchParams.get("type");

  if (
    tab &&
    LEGACY_TAB_TRANSACTION_FILTERS.has(tab as ActivityTransactionTypeFilter)
  ) {
    return {
      section: "transactions",
      transactionFilter: tab as ActivityTransactionTypeFilter,
    };
  }

  const section: ActivitySection =
    tab === "lifecycle" || tab === "transactions" ? tab : "all";

  const transactionFilter =
    typeParam &&
    ACTIVITY_TRANSACTION_TYPE_FILTERS.includes(
      typeParam as ActivityTransactionTypeFilter,
    ) &&
    typeParam !== "all"
      ? (typeParam as ActivityTransactionTypeFilter)
      : "all";

  return { section, transactionFilter };
}

export function resolveActivityApiFilter(
  section: ActivitySection,
  transactionFilter: ActivityTransactionTypeFilter,
): ActivityFeedFilter {
  if (section === "lifecycle") return "lifecycle";
  if (transactionFilter !== "all") return transactionFilter;
  return section;
}

export function countActivityFilters(
  section: ActivitySection,
  transactionFilter: ActivityTransactionTypeFilter,
): number {
  if (section === "lifecycle") return 0;
  return transactionFilter !== "all" ? 1 : 0;
}

export function activityPageStateToSearchParams(
  section: ActivitySection,
  transactionFilter: ActivityTransactionTypeFilter,
  base: URLSearchParams,
): URLSearchParams {
  const params = new URLSearchParams(base.toString());

  if (section === "all") {
    params.delete("tab");
  } else {
    params.set("tab", section);
  }

  if (transactionFilter === "all" || section === "lifecycle") {
    params.delete("type");
  } else {
    params.set("type", transactionFilter);
  }

  return params;
}
