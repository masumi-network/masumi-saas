"use client";

import gravatarUrl from "gravatar-url";
import { Building2, CircleHelp, LogOut, User as UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { signOutAction } from "@/lib/actions/auth.action";
import type { SessionUser } from "@/lib/auth/auth";

import UserAvatarContent from "./user-avatar-content";

interface UserAvatarClientProps {
  sessionUser: SessionUser;
}

export default function UserAvatarClient({
  sessionUser,
}: UserAvatarClientProps) {
  const t = useTranslations("App.Header");

  const handleSupport = () => {
    window.open("https://www.masumi.network/contact", "_blank");
  };

  const router = useRouter();
  const { isMobile, toggleSidebar } = useSidebar();

  const handleClick = (e: React.MouseEvent, path: string) => {
    e.preventDefault();

    if (!path) {
      return;
    }

    router.push(path);
    // Close sidebar if on mobile
    if (isMobile) {
      toggleSidebar();
    }
  };

  return (
    <>
      <DropdownMenu>
        <TooltipProvider disableHoverableContent>
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="relative h-8 w-8 rounded-full px-2 md:h-10 md:w-10 md:px-4"
                  aria-label={`User profile for ${sessionUser.name ?? "current user"}`}
                >
                  <UserAvatarContent
                    imageUrl={
                      sessionUser.image ??
                      gravatarUrl(sessionUser.email, {
                        size: 80,
                        default: "404",
                      })
                    }
                    imageAlt={sessionUser.name ?? "User avatar"}
                  />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">{sessionUser.email}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <DropdownMenuContent className="w-60" align="end">
          <div className="px-2 py-1.5">
            <div className="text-sm font-semibold">
              {sessionUser.name || sessionUser.email || "User"}
            </div>
            <div className="text-xs text-muted-foreground">
              {sessionUser.email}
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="flex cursor-pointer items-center gap-2"
              onClick={(e) => handleClick(e, "/account")}
            >
              <UserIcon className="text-muted-foreground" />
              {t("account")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex cursor-pointer items-center gap-2"
              onClick={(e) => handleClick(e, "/organizations")}
            >
              <Building2 className="text-muted-foreground" />
              {t("organizations")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2"
            onClick={handleSupport}
          >
            <CircleHelp className="text-muted-foreground" />
            {t("support")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <form action={signOutAction}>
            <DropdownMenuItem asChild>
              <button
                type="submit"
                className="flex w-full cursor-pointer items-center gap-2"
              >
                <LogOut className="text-muted-foreground" />
                {t("logout")}
              </button>
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
