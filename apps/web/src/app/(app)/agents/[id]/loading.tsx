import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";

import { AgentPageLoading } from "./components/agent-page-loading";
import { TabSkeleton } from "./components/agent-tab-skeletons";

function LoadingFallback() {
  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-12 pb-3 pt-1">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <Skeleton className="h-8 w-48 sm:w-64" />
          <Skeleton className="h-5 w-5 shrink-0 rounded" />
          <Skeleton className="ml-auto h-9 w-9 shrink-0 rounded-md" />
        </div>
        <div className="flex gap-6 border-b">
          <Skeleton className="h-4 w-16 pb-4" />
          <Skeleton className="h-4 w-24 pb-4" />
        </div>
      </div>
      <TabSkeleton tab="details" />
    </div>
  );
}

export default function AgentPageLoadingWrapper() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AgentPageLoading />
    </Suspense>
  );
}
