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
    <div className="flex min-w-0 w-full items-center gap-2">
      <UserAvatar session={session} />
    </div>
  );
}
