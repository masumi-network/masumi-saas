"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import UserProfile from "@/app/components/user-profile";
import { MasumiIcon } from "@/components/masumi-icon";
import MasumiLogo from "@/components/masumi-logo";
import { Button } from "@/components/ui/button";
import { SheetClose } from "@/components/ui/sheet";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import type { Session } from "@/lib/auth/auth";

import AdminMenuItems from "./menu-items";

interface AdminSidebarProps {
  session: Session;
}

export default function AdminSidebar({ session }: AdminSidebarProps) {
  const { isMobile, toggleSidebar } = useSidebar();
  const t = useTranslations("Admin");

  return (
    <ShadcnSidebar collapsible="icon" side={isMobile ? "right" : "left"}>
      <SidebarHeader className="h-16 md:border-b">
        <div className="flex items-center justify-between gap-2 p-2 group-data-[collapsible=icon]:pt-3! group-data-[collapsible=icon]:pl-2!">
          {!isMobile && (
            <SheetClose asChild>
              <Link href="/admin" className="flex items-center gap-2">
                <span className="group-data-[collapsible=icon]:hidden">
                  <MasumiLogo />
                </span>
                <MasumiIcon className="hidden size-6 group-data-[collapsible=icon]:block" />
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-medium group-data-[collapsible=icon]:hidden">
                  {t("badge")}
                </span>
              </Link>
            </SheetClose>
          )}
          {isMobile ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-8 w-8 ml-auto"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <SidebarTrigger className="group-data-[collapsible=icon]:hidden" />
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="min-h-0 w-full flex-1">
        <AdminMenuItems />
      </SidebarContent>
      <SidebarFooter className="shrink-0 px-0">
        <div className="flex flex-1 gap-2 p-4 pt-0 md:justify-start md:flex-1 group-data-[collapsible=icon]:justify-center">
          <UserProfile session={session} />
        </div>
      </SidebarFooter>
    </ShadcnSidebar>
  );
}
