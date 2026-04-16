"use client";

import { useTranslations } from "next-intl";

import { Session } from "@/lib/auth/auth";

import UserAvatar from "./user-avatar/user-avatar";

interface UserProfileProps {
  session: Session;
}

export default function UserProfile({ session }: UserProfileProps) {
  const user = session.user;
  const t = useTranslations("App.UserProfile");

  if (!user) {
    return (
      <div className="text-muted-foreground text-sm">{t("unavailable")}</div>
    );
  }

  return (
    <div className="flex min-w-0 w-full max-w-full flex-col-reverse gap-4 md:flex-initial md:flex-row md:items-center">
      <div className="flex min-w-0 w-full items-center gap-2 group-data-[collapsible=icon]:justify-center">
        <UserAvatar session={session} />
      </div>
    </div>
  );
}
