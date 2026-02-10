import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AgentPageLoading() {
  return (
    <div className="w-full space-y-8">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-8 w-48 sm:w-64" />
        </div>
      </div>

      <div className="flex gap-6 border-b">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-4 w-20 pb-4" />
        ))}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Left column — details, metadata, danger zone (max-w-3xl) */}
        <div className="w-full max-w-3xl space-y-6">
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
              <Skeleton className="h-10 w-full rounded-lg" />
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
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
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
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>

        {/* Right column — credential issuing card only */}
        <div className="w-full shrink-0 lg:w-auto">
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-full max-w-xs mt-2" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full rounded-md" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
