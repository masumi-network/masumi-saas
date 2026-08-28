import { Skeleton } from "@/components/ui/skeleton";

import { X402TableSkeleton } from "./x402-table-ui";

export function X402PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <Skeleton className="h-10 w-full max-w-sm rounded-lg" />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="hidden h-9 w-32 rounded-md md:block" />
          <Skeleton className="h-9 w-9 rounded-md md:hidden" />
        </div>
      </div>

      <X402TableSkeleton columns={5} withActions />
    </div>
  );
}
