"use client";

import gravatarUrl from "gravatar-url";
import {
  BookOpen,
  Building2,
  LogOut,
  MessageSquare,
  User as UserIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useGlobalModalsContext } from "@/components/modals/global-modals-context";
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
import type { SessionUser } from "@/lib/auth/auth";

import UserAvatarContent from "./user-avatar-content";

interface UserAvatarClientProps {
  sessionUser: SessionUser;
}

export default function UserAvatarClient({
  sessionUser,
}: UserAvatarClientProps) {
  const t = useTranslations("App.Header");
  const { showLogoutModal } = useGlobalModalsContext();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleSupport = () => {
    window.open("https://www.masumi.network/contact", "_blank");
  };

  const handleDocumentation = () => {
    window.open("https://docs.masumi.network", "_blank");
  };

  const router = useRouter();
  const { isMobile, toggleSidebar, setIsHovered, setPreventCollapse } =
    useSidebar();

  const handleDropdownOpenChange = (open: boolean) => {
    setDropdownOpen(open);
    if (!isMobile) {
      if (open) {
        setIsHovered(true);
        setPreventCollapse(true);
      } else {
        setPreventCollapse(false);
        setIsHovered(false);
      }
    }
  };

  const handleClick = (e: React.MouseEvent, path: string) => {
    e.preventDefault();

    if (!path) {
      return;
    }

    router.push(path);
    if (isMobile) {
      toggleSidebar();
    }
  };

  return (
    <>
      <DropdownMenu open={dropdownOpen} onOpenChange={handleDropdownOpenChange}>
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
                        size: 100,
                        default: "404",
                      })
                    }
                    imageAlt={sessionUser.name ?? "User avatar"}
                    fallbackName={sessionUser.name ?? sessionUser.email}
                  />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6} collisionPadding={12}>
              {sessionUser.email}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <DropdownMenuContent className="w-60" align="end" collisionPadding={8}>
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
            onClick={handleDocumentation}
          >
            <BookOpen className="text-muted-foreground" />
            {t("documentation")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2"
            onClick={handleSupport}
          >
            <MessageSquare className="text-muted-foreground" />
            {t("support")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2"
            onClick={() => showLogoutModal(sessionUser.email)}
          >
            <LogOut className="text-muted-foreground" />
            {t("logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
