"use client";

import {
  Bot,
  Building2,
  CreditCard,
  Key,
  LayoutDashboard,
  User,
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

  const items: MenuItemConfig[] = [
    {
      key: "dashboard",
      href: "/",
      label: t("dashboard"),
      Icon: LayoutDashboard,
    },
    {
      key: "agents",
      href: "/agents",
      label: t("agents"),
      Icon: Bot,
    },
    {
      key: "organizations",
      href: "/organizations",
      label: t("organizations"),
      Icon: Building2,
    },
    {
      key: "payment-methods",
      href: "/payment-methods",
      label: t("paymentMethods"),
      Icon: CreditCard,
    },
    {
      key: "api-keys",
      href: "/api-keys",
      label: t("apiKeys"),
      Icon: Key,
    },
    {
      key: "account",
      href: "/account",
      label: t("account"),
      Icon: User,
    },
  ];

  return (
    <SidebarGroup className={cn("w-full", isMobile && "px-3 py-2")}>
      <SidebarGroupContent>
        <SidebarMenu className={cn(isMobile && "flex flex-col gap-1.5")}>
          {items.map(({ key, href, label, Icon, disabled }) => {
            const isActive =
              pathname === href ||
              (href !== "/" && pathname.startsWith(href + "/"));

            return (
              <SidebarMenuItem key={key}>
                {disabled ? (
                  <SidebarMenuButton
                    disabled
                    className={cn(
                      "opacity-50 cursor-not-allowed",
                      isMobile ? "px-4 py-3.5 rounded-xl" : "px-4 py-5",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    <span className="flex-1 truncate">{label}</span>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    className="px-4 py-5"
                  >
                    <SheetClose asChild>
                      <Link
                        href={href}
                        aria-current={isActive ? "page" : undefined}
                        className="text-sidebar-text flex w-full items-center gap-3"
                      >
                        <Icon className="size-4 shrink-0" aria-hidden />
                        <span className="flex-1 truncate font-medium">
                          {label}
                        </span>
                      </Link>
                    </SheetClose>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
