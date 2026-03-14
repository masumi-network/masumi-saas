"use client";

import { createContext, useCallback, useContext, useId, useState } from "react";

export type AppNotification = {
  id: string;
  type: "success" | "info" | "error";
  titleKey: string;
  link?: { href: string; labelKey: string };
  createdAt: Date;
};

export type NotificationsContextValue = {
  notifications: AppNotification[];
  addNotification: (
    notification: Omit<AppNotification, "id" | "createdAt">,
  ) => void;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null,
);

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error(
      "useNotifications must be used within NotificationsProvider",
    );
  }
  return ctx;
}

const MAX_NOTIFICATIONS = 50;

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const idPrefix = useId();

  const addNotification = useCallback(
    (notification: Omit<AppNotification, "id" | "createdAt">) => {
      const id = `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const entry: AppNotification = {
        ...notification,
        id,
        createdAt: new Date(),
      };
      setNotifications((prev) => {
        const next = [entry, ...prev].slice(0, MAX_NOTIFICATIONS);
        return next;
      });
    },
    [idPrefix],
  );

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const value: NotificationsContextValue = {
    notifications,
    addNotification,
    dismissNotification,
    clearAll,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}
