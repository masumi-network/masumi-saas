import { Skeleton } from "@/components/ui/skeleton";
import { X402PageSkeleton } from "@/components/x402/x402-page-skeleton";

export default function X402Loading() {
  return (
    <div className="min-w-0 space-y-8">
      <div className="space-y-1.5">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-4 border-b">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-20" />
          ))}
        </div>

        <X402PageSkeleton />
      </div>
    </div>
  );
}
