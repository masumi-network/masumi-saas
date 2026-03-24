import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading placeholder for {@link DevelopersPageClient} (tabs + main panel).
 * Matches payment-service Developers layout: two tabs (Schema Validator, OpenAPI).
 */
export function DevelopersPageSkeleton() {
  return (
    <div
      className="min-w-0 space-y-6"
      aria-busy="true"
      aria-label="Loading developers tools"
    >
      <div className="w-full min-w-0 -mx-px">
        <div className="flex gap-6 border-b border-border pb-4">
          <Skeleton className="h-5 w-36 rounded-none bg-muted sm:w-40" />
          <Skeleton className="h-5 w-20 rounded-none bg-muted sm:w-24" />
        </div>
      </div>
      <div className="min-w-0 space-y-4 pt-0">
        <div className="space-y-3">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-full max-w-2xl" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
