"use client";

import {
  Activity,
  Bot,
  Code,
  Coins,
  Inbox,
  Key,
  LayoutDashboard,
  Plug,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ComponentType, SVGProps } from "react";

import { SheetClose } from "@/components/ui/sheet";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { canAccessX402Workspace } from "@/lib/auth/org-roles";
import { useOrganizationContext } from "@/lib/context/organization-context";
import { cn } from "@/lib/utils";

interface MenuItemConfig {
  key: string;
  href: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  disabled?: boolean;
}

export default function MenuItems() {
  const t = useTranslations("App.Sidebar.MenuItems");
  const pathname = usePathname();
  const { isMobile } = useSidebar();
  const { activeOrganization, activeOrganizationId } = useOrganizationContext();
  const canAccessX402 = canAccessX402Workspace(
    activeOrganizationId,
    activeOrganization?.role,
  );

  const primaryItems: MenuItemConfig[] = [
    {
      key: "dashboard",
      href: "/",
      label: t("dashboard"),
      Icon: LayoutDashboard,
    },
    {
      key: "agents",
      href: "/ai-agents",
      label: t("agents"),
      Icon: Bot,
    },
    {
      key: "inbox-agents",
      href: "/inbox-agents",
      label: t("inboxAgents"),
      Icon: Inbox,
    },
    {
      key: "activity",
      href: "/activity",
      label: t("activity"),
      Icon: Activity,
    },
    {
      key: "earnings",
      href: "/earnings",
      label: t("earnings"),
      Icon: TrendingUp,
    },
    ...(canAccessX402
      ? [
          {
            key: "x402",
            href: "/x402",
            label: t("x402"),
            Icon: Coins,
          } satisfies MenuItemConfig,
        ]
      : []),
    {
      key: "integrations",
      href: "/integrations",
      label: t("integrations"),
      Icon: Plug,
    },
  ];
  const developerSectionItems: MenuItemConfig[] = [
    {
      key: "api-keys",
      href: "/api-keys",
      label: t("apiKeys"),
      Icon: Key,
    },
    {
      key: "developers",
      href: "/developers",
      label: t("developers"),
      Icon: Code,
    },
  ];

  const renderItem = ({
    key,
    href,
    label,
    Icon,
    disabled,
    className,
    linkClassName,
  }: MenuItemConfig & { className?: string; linkClassName?: string }) => {
    const isActive =
      pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

    return (
      <SidebarMenuItem key={key}>
        {disabled ? (
          <SidebarMenuButton
            disabled
            className={cn(
              "opacity-50 cursor-not-allowed",
              isMobile ? "px-4 py-3.5 rounded-xl" : "px-4 py-5",
              className,
            )}
          >
            <Icon className="size-4" aria-hidden />
            <span className="flex-1 truncate">{label}</span>
          </SidebarMenuButton>
        ) : (
          <SidebarMenuButton
            asChild
            isActive={isActive}
            className={cn(
              "rounded-lg px-3 py-3 transition-colors data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:shadow-none",
              isMobile ? "px-4 py-3.5" : "py-3",
              className,
            )}
          >
            <SheetClose asChild>
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 text-sidebar-text data-[active=true]:text-primary",
                  linkClassName,
                )}
              >
                <Icon
                  className={cn("size-4 shrink-0", isActive && "text-primary")}
                  aria-hidden
                />
                <span className="flex-1 truncate font-medium">{label}</span>
              </Link>
            </SheetClose>
          </SidebarMenuButton>
        )}
      </SidebarMenuItem>
    );
  };

  return (
    <>
      <SidebarGroup className={cn("w-full", isMobile && "px-3 py-2")}>
        <SidebarGroupContent>
          <SidebarMenu className={cn(isMobile && "flex flex-col gap-1.5")}>
            {primaryItems.map((item) => renderItem(item))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup className={cn("w-full mt-4 pt-0", isMobile && "px-3 py-2")}>
        <div
          className={cn(
            "mx-4 mb-4 h-px bg-sidebar-border/80",
            isMobile && "mx-2.5 mb-3",
          )}
        />
        <SidebarGroupContent>
          <SidebarMenu className={cn(isMobile && "flex flex-col gap-1.5")}>
            {developerSectionItems.map((item) =>
              renderItem(
                item.key === "developers"
                  ? {
                      ...item,
                      className:
                        "border-0 bg-transparent shadow-none text-pink-700 hover:bg-transparent hover:text-pink-800 data-[active=true]:bg-transparent data-[active=true]:text-pink-800 dark:text-pink-600 dark:hover:text-pink-500 dark:data-[active=true]:text-pink-400",
                      linkClassName:
                        "text-pink-700 hover:text-pink-800 dark:text-pink-600 dark:hover:text-pink-500",
                    }
                  : item,
              ),
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}
