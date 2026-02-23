"use client";

import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function NotificationsDialog() {
  const t = useTranslations("App.Notifications");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8 relative">
          <Bell className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-96 p-0 overflow-hidden rounded-xl border-border/80 shadow-lg"
        align="end"
      >
        <div className="border-b bg-masumi-gradient px-4 py-3">
          <h4 className="text-sm font-semibold tracking-tight">{t("title")}</h4>
        </div>
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/80">
            <Bell className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
