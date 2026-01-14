import { Suspense } from "react";

import { Session } from "@/lib/auth/auth";

import UserAvatarClient from "./user-avatar.client";
import UserAvatarSkeleton from "./user-avatar-skeleton";

interface UserAvatarProps {
  session: Session;
}

export default function UserAvatar({ session }: UserAvatarProps) {
  return (
    <Suspense fallback={<UserAvatarSkeleton />}>
      <UserAvatarClient sessionUser={session.user} />
    </Suspense>
  );
}
