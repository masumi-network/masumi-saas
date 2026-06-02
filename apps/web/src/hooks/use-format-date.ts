"use client";

import { useFormatter, useNow } from "next-intl";
import { useMemo } from "react";

export function useFormatDate() {
  const format = useFormatter();
  const now = useNow();

  return useMemo(() => {
    const toDate = (date: Date | string) =>
      date instanceof Date ? date : new Date(date);
    return {
      formatDate: (date: Date | string) =>
        format.dateTime(toDate(date), { dateStyle: "long" }),
      formatDateTime: (date: Date | string) =>
        format.dateTime(toDate(date), {
          dateStyle: "short",
          timeStyle: "short",
        }),
      formatRelativeDate: (date: Date | string) =>
        format.relativeTime(toDate(date), { now }),
    };
  }, [format, now]);
}
