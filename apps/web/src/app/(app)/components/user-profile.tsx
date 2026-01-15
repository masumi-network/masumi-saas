import { getTranslations } from "next-intl/server";

import { Session } from "@/lib/auth/auth";
import { formatName } from "@/lib/utils";

import UserAvatar from "./user-avatar/user-avatar";

interface UserProfileProps {
  session: Session;
}

export default async function UserProfile({ session }: UserProfileProps) {
  const user = session.user;
  const t = await getTranslations("App.UserProfile");

  if (!user) {
    return (
      <div className="text-muted-foreground text-sm">{t("unavailable")}</div>
    );
  }

  return (
    <div className="flex md:flex-1 flex-col-reverse gap-4 md:flex-initial md:flex-row md:items-center">
      <div className="flex items-center gap-2">
        <UserAvatar session={session} />
        <div className="flex-col gap-0.5 md:flex md:items-end group-data-[collapsible=icon]:hidden">
          <div className="text-sm font-semibold truncate">
            {formatName(user.name) || user.email || "User"}
          </div>
        </div>
      </div>
    </div>
  );
}
