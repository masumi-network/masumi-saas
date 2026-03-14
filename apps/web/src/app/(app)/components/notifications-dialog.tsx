"use client";

import { AlertCircle, Bell, CheckCircle2, Info, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNotifications } from "@/lib/context/notifications-context";

const NOTIFICATION_ICONS = {
  success: CheckCircle2,
  info: Info,
  error: AlertCircle,
} as const;

export function NotificationsDialog() {
  const t = useTranslations("App.Notifications");
  const { notifications, dismissNotification, clearAll } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8 relative">
          <Bell className="h-4 w-4" />
          {notifications.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {notifications.length > 99 ? "99+" : notifications.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-96 p-0 overflow-hidden rounded-xl border-border/80 shadow-lg"
        align="end"
      >
        <div className="border-b bg-masumi-gradient px-4 py-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold tracking-tight">{t("title")}</h4>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={clearAll}
            >
              {t("clearAll")}
            </Button>
          )}
        </div>
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/80">
              <Bell className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          </div>
        ) : (
          <ul className="max-h-[min(70vh,24rem)] overflow-y-auto">
            {notifications.map((notification) => {
              const Icon = NOTIFICATION_ICONS[notification.type];
              const title = t(notification.titleKey);
              return (
                <li
                  key={notification.id}
                  className="border-b border-border/60 last:border-b-0"
                >
                  <div className="flex gap-3 px-4 py-3 hover:bg-muted/40">
                    <div className="shrink-0 mt-0.5">
                      <Icon
                        className={`h-4 w-4 ${
                          notification.type === "success"
                            ? "text-green-600"
                            : notification.type === "error"
                              ? "text-destructive"
                              : "text-muted-foreground"
                        }`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {title}
                      </p>
                      {notification.link && (
                        <Link
                          href={notification.link.href}
                          className="mt-1 inline-block text-xs text-primary hover:underline"
                          onClick={() => dismissNotification(notification.id)}
                        >
                          {t(notification.link.labelKey)}
                        </Link>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => dismissNotification(notification.id)}
                      aria-label={t("dismiss")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
