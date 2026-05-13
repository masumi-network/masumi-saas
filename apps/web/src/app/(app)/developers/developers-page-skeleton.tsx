import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading placeholder for {@link DevelopersPageClient} (tabs + main panel).
 * Three tabs: OpenAPI, Schema Validator, Testing — widths approximate label length to limit CLS.
 */
export function DevelopersPageSkeleton() {
  const t = useTranslations("Developers");
  return (
    <div
      className="min-w-0 space-y-6"
      aria-busy="true"
      aria-label={t("skeletonAriaLabel")}
    >
      <div className="w-full min-w-0 -mx-px">
        <div className="flex gap-6 border-b border-border pb-4">
          <Skeleton className="h-5 w-24 rounded-none bg-muted sm:w-28" />
          <Skeleton className="h-5 w-40 rounded-none bg-muted sm:w-44" />
          <Skeleton className="h-5 w-16 rounded-none bg-muted sm:w-20" />
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
