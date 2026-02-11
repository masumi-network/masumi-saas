import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AgentPageLoading() {
  return (
    <div className="w-full space-y-4">
      {/* Header + Tabs */}
      <div className="flex flex-col gap-12 pb-3 pt-1">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <Skeleton className="h-8 w-48 sm:w-64" />
          <Skeleton className="h-5 w-5 shrink-0 rounded" />
          <Skeleton className="h-9 w-9 shrink-0 rounded-md ml-auto" />
        </div>

        <div className="flex gap-6 border-b">
          <Skeleton className="h-4 w-16 pb-4" />
          <Skeleton className="h-4 w-24 pb-4" />
        </div>
      </div>

      {/* Details tab content (default) */}
      <div className="w-full max-w-3xl space-y-8">
        <div className="flex flex-col gap-2">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full max-w-md" />
              <Skeleton className="h-4 w-full max-w-sm mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-16" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-row items-center justify-between py-2 gap-2 bg-muted/40 p-2 rounded-lg border">
                <Skeleton className="h-4 w-14" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-32 sm:w-48" />
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-12" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-14 rounded-full" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <Skeleton className="h-px flex-1" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-px flex-1" />
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <Skeleton className="h-px flex-1" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-px flex-1" />
          </div>
          <Card>
            <CardContent>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between py-2">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-10 w-full sm:w-auto min-w-[120px]" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
