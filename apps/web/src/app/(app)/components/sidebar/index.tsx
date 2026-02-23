"use client";

import { X } from "lucide-react";
import Link from "next/link";

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
import { Session } from "@/lib/auth/auth";
import { cn } from "@/lib/utils";

import UserProfile from "../user-profile";
import MenuItems from "./menu-items";

interface SidebarProps {
  session: Session;
}

export default function Sidebar({ session }: SidebarProps) {
  const { isMobile, toggleSidebar } = useSidebar();

  return (
    <ShadcnSidebar collapsible="icon" side={"left"}>
      <SidebarHeader
        className={cn(
          "h-16 md:border-b",
          isMobile && "border-b border-sidebar-border",
        )}
      >
        <div className="flex items-center justify-between gap-2 p-2 group-data-[collapsible=icon]:pt-3! group-data-[collapsible=icon]:pl-2!">
          {isMobile ? (
            <>
              <SheetClose asChild>
                <Link href="/" className="flex items-center shrink-0">
                  <MasumiLogo />
                </Link>
              </SheetClose>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-9 w-9 rounded-full hover:bg-sidebar-accent"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <SheetClose asChild>
                <Link href="/">
                  <span className="group-data-[collapsible=icon]:hidden">
                    <MasumiLogo />
                  </span>
                  <MasumiIcon className="hidden size-6 group-data-[collapsible=icon]:block" />
                </Link>
              </SheetClose>
              <SidebarTrigger className="group-data-[collapsible=icon]:hidden" />
            </>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="min-h-0 w-full flex-1">
        <MenuItems />
      </SidebarContent>
      <SidebarFooter
        className={cn(
          "shrink-0 px-0",
          isMobile && "border-t border-sidebar-border py-4",
        )}
      >
        <div
          className={cn(
            "flex flex-1 gap-2 p-4 pb-4 pt-0 md:justify-start md:flex-1 group-data-[collapsible=icon]:px-2  ease-in-out transition-all duration-300",
            isMobile && "px-4 py-0",
          )}
        >
          <UserProfile session={session} />
        </div>
      </SidebarFooter>
    </ShadcnSidebar>
  );
}
