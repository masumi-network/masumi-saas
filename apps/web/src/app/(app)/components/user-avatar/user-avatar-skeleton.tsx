import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

import UserAvatarContent from "./user-avatar-content";

interface UserAvatarSkeletonProps {
  noAnimation?: boolean;
}

export default function UserAvatarSkeleton({
  noAnimation,
}: UserAvatarSkeletonProps) {
  const t = useTranslations("Components.UserAvatar");
  return (
    <Button
      variant="outline"
      className="relative h-8 w-8 rounded-full"
      aria-label={t("loadingAriaLabel")}
      disabled
    >
      <UserAvatarContent className={noAnimation ? "" : "animate-pulse"} />
    </Button>
  );
}
