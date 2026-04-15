import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import UserAvatarContent from "./user-avatar-content";

interface UserAvatarSkeletonProps {
  noAnimation?: boolean;
}

export default function UserAvatarSkeleton({
  noAnimation,
}: UserAvatarSkeletonProps) {
  return (
    <Button
      variant="ghost"
      className="relative h-auto min-h-14 w-full justify-start rounded-2xl border border-sidebar-border/70 bg-sidebar-accent/20 px-2.5 py-2.5 group-data-[collapsible=icon]:h-11 group-data-[collapsible=icon]:min-h-0 group-data-[collapsible=icon]:w-11 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center"
      aria-label="Loading user profile"
      disabled
    >
      <UserAvatarContent
        className={noAnimation ? "!h-8 !w-8" : "!h-8 !w-8 animate-pulse"}
      />
      <div className="ml-2.5 flex min-w-0 flex-1 flex-col gap-1.5 group-data-[collapsible=icon]:hidden">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
    </Button>
  );
}
