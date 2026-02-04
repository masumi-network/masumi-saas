import { Skeleton } from "@/components/ui/skeleton";

import { AgentsTableSkeleton } from "./components/agents-table-skeleton";

export default function AgentsLoading() {
  return (
    <div className="w-full space-y-12 px-2">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-96" />
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-4 border-b">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="relative w-64">
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-32 hidden md:block" />
            <Skeleton className="h-9 w-9 md:hidden" />
          </div>
        </div>

        <AgentsTableSkeleton />
      </div>
    </div>
  );
}
