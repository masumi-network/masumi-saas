import { Skeleton } from "@/components/ui/skeleton";

/**
 * Generic loading skeleton for app pages. Used by the shared (app) loading
 * boundary so non-dashboard routes (e.g. /agents, /organizations, /top-up)
 * don't show dashboard-specific placeholders.
 */
export function AppPageSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="space-y-6">
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    </div>
  );
}
