"use client";

import {
  Bot,
  Building2,
  Code,
  CreditCard,
  Key,
  LayoutDashboard,
  User,
  Wallet,
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
} from "@/components/ui/sidebar";

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
    // TODO: Enable when /wallets page is implemented
    {
      key: "wallets",
      href: "/wallets",
      label: t("wallets"),
      Icon: Wallet,
      disabled: true,
    },
    // TODO: Enable when /payment-methods page is implemented
    {
      key: "payment-methods",
      href: "/payment-methods",
      label: t("paymentMethods"),
      Icon: CreditCard,
      disabled: true,
    },
    // TODO: Enable when API keys page has full list/revoke UI (dashboard already has create)
    {
      key: "api-keys",
      href: "/api-keys",
      label: t("apiKeys"),
      Icon: Key,
      disabled: true,
    },
    {
      key: "developers",
      href: "/developers",
      label: t("developers"),
      Icon: Code,
    },
    {
      key: "account",
      href: "/account",
      label: t("account"),
      Icon: User,
    },
  ];

  return (
    <SidebarGroup className="w-full">
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map(({ key, href, label, Icon, disabled }) => {
            const isActive = pathname === href;

            return (
              <SidebarMenuItem key={key}>
                {disabled ? (
                  <SidebarMenuButton
                    disabled
                    className="px-4 py-5 opacity-50 cursor-not-allowed"
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
                        className="text-sidebar-text flex w-full items-center gap-2"
                      >
                        <Icon className="size-4" aria-hidden />
                        <span className="flex-1 truncate">{label}</span>
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
