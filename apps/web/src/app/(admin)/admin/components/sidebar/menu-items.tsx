"use client";

import { Bot, LayoutDashboard, Users } from "lucide-react";
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
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface MenuItemConfig {
  key: string;
  href: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export default function AdminMenuItems() {
  const t = useTranslations("Admin.Sidebar.MenuItems");
  const pathname = usePathname();

  const items: MenuItemConfig[] = [
    {
      key: "dashboard",
      href: "/admin",
      label: t("dashboard"),
      Icon: LayoutDashboard,
    },
    {
      key: "users",
      href: "/admin/users",
      label: t("users"),
      Icon: Users,
    },
    {
      key: "agents",
      href: "/admin/agents",
      label: t("agents"),
      Icon: Bot,
    },
  ];

  return (
    <SidebarGroup className="w-full">
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map(({ key, href, label, Icon }) => {
            const isActive =
              href === "/admin" ? pathname === href : pathname.startsWith(href);

            return (
              <SidebarMenuItem key={key}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  className="rounded-lg px-3 py-3 transition-colors data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:shadow-none"
                >
                  <SheetClose asChild>
                    <Link
                      href={href}
                      aria-current={isActive ? "page" : undefined}
                      className="flex w-full items-center gap-3 text-sidebar-text"
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          isActive && "text-primary",
                        )}
                        aria-hidden
                      />
                      <span className="flex-1 truncate font-medium">
                        {label}
                      </span>
                    </Link>
                  </SheetClose>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
