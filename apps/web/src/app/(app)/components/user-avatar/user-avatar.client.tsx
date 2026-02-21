"use client";

import gravatarUrl from "gravatar-url";
import {
  BookOpen,
  Building2,
  Check,
  ChevronsUpDown,
  LogOut,
  MessageSquare,
  Plus,
  User as UserIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { CreateOrganizationDialog } from "@/app/organizations/components/create-organization-dialog";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSidebar } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SessionUser } from "@/lib/auth/auth";
import { useOrganizationContextOptional } from "@/lib/context/organization-context";

import UserAvatarContent from "./user-avatar-content";

interface UserAvatarClientProps {
  sessionUser: SessionUser;
}

interface WorkspaceItem {
  id: string | null;
  name: string;
  isOrganization: boolean;
  isLoadingPlaceholder?: boolean;
}

function getOrderedWorkspaces(
  workspaces: WorkspaceItem[],
  activeId: string | null,
): WorkspaceItem[] {
  const activeIndex = workspaces.findIndex((w) => w.id === activeId);
  if (activeIndex <= 0) return workspaces;
  return [
    workspaces[activeIndex]!,
    ...workspaces.slice(0, activeIndex),
    ...workspaces.slice(activeIndex + 1),
  ];
}

export default function UserAvatarClient({
  sessionUser,
}: UserAvatarClientProps) {
  const t = useTranslations("App.Header");
  const tCreate = useTranslations("App.Organizations.Create");
  const { showLogoutModal } = useGlobalModalsContext();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [workspacePopoverOpen, setWorkspacePopoverOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const orgContext = useOrganizationContextOptional();

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
    if (!open) setWorkspacePopoverOpen(false);
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
    if (!path) return;
    router.push(path);
    if (isMobile) toggleSidebar();
  };

  const handleSelectWorkspace = (organizationId: string | null) => {
    orgContext?.setActiveOrganization(organizationId);
    setWorkspacePopoverOpen(false);
  };

  const workspaces: WorkspaceItem[] = [
    {
      id: null,
      name: sessionUser.name ?? t("personalAccount"),
      isOrganization: false,
    },
    ...(orgContext?.organizations ?? []).map((org) => ({
      id: org.id,
      name: org.name,
      isOrganization: true,
    })),
  ];

  const activeId = orgContext?.activeOrganizationId ?? null;

  const orderedWorkspaces =
    workspaces.length > 1
      ? getOrderedWorkspaces(workspaces, activeId)
      : workspaces;

  const activeWorkspace =
    workspaces.find((w) =>
      w.id === null ? activeId === null : activeId === w.id,
    ) ??
    (activeId && orgContext?.isLoading
      ? {
          id: activeId,
          name: "",
          isOrganization: true,
          isLoadingPlaceholder: true,
        }
      : workspaces[0]);

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

        <DropdownMenuContent className="w-72" align="end" collisionPadding={8}>
          {/* Workspace switcher - active workspace + popover trigger */}
          <DropdownMenuGroup>
            <Popover
              open={workspacePopoverOpen}
              onOpenChange={setWorkspacePopoverOpen}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-3 rounded-sm p-2.5 text-left outline-none hover:bg-muted-surface focus:bg-muted-surface"
                >
                  {activeWorkspace?.isOrganization ? (
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Building2 className="size-4 text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="size-9 shrink-0 overflow-hidden rounded-full">
                      <UserAvatarContent
                        imageUrl={
                          sessionUser.image ??
                          gravatarUrl(sessionUser.email, {
                            size: 36,
                            default: "404",
                          })
                        }
                        imageAlt={sessionUser.name ?? "User avatar"}
                        fallbackName={sessionUser.name ?? sessionUser.email}
                        className="!h-9 !w-9"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {activeWorkspace?.isLoadingPlaceholder ? (
                      <Spinner size={14} className="shrink-0" />
                    ) : (
                      <div className="truncate text-sm font-semibold">
                        {activeWorkspace?.name}
                      </div>
                    )}
                  </div>
                  <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-64 p-1"
                align="start"
                side="top"
                sideOffset={-4}
                alignOffset={11}
                collisionPadding={8}
              >
                <div className="max-h-64 overflow-y-auto">
                  {orderedWorkspaces.map((workspace) => {
                    const isActive =
                      workspace.id === null
                        ? activeId === null
                        : activeId === workspace.id;

                    return (
                      <button
                        key={workspace.id ?? "personal"}
                        type="button"
                        onClick={() => handleSelectWorkspace(workspace.id)}
                        disabled={orgContext?.isLoading}
                        className="flex w-full cursor-pointer items-center gap-3 rounded-sm py-2.5 px-2 text-left outline-none hover:bg-muted-surface focus:bg-muted-surface disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          {workspace.isOrganization ? (
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                              <Building2 className="size-4 text-muted-foreground" />
                            </div>
                          ) : (
                            <div className="size-9 shrink-0 overflow-hidden rounded-full">
                              <UserAvatarContent
                                imageUrl={
                                  sessionUser.image ??
                                  gravatarUrl(sessionUser.email, {
                                    size: 36,
                                    default: "404",
                                  })
                                }
                                imageAlt={sessionUser.name ?? "User avatar"}
                                fallbackName={
                                  sessionUser.name ?? sessionUser.email
                                }
                                className="!h-9 !w-9"
                              />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold">
                              {workspace.name}
                            </div>
                          </div>
                        </div>
                        {isActive && (
                          <Check className="size-4 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-border mt-1 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setWorkspacePopoverOpen(false);
                      handleDropdownOpenChange(false);
                      setCreateDialogOpen(true);
                    }}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-sm py-2.5 px-2 text-left outline-none hover:bg-muted-surface focus:bg-muted-surface"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Plus className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">
                        {tCreate("trigger")}
                      </div>
                    </div>
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </DropdownMenuGroup>

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
      <CreateOrganizationDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  );
}
