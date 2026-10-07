"use client";

import { useFormatter, useNow, useTranslations } from "next-intl";
import { useMemo } from "react";

export function useFormatDate() {
  const format = useFormatter();
  const now = useNow({ updateInterval: 1000 });
  const t = useTranslations("Common");

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
      formatRelativeDate: (date: Date | string) => {
        const target = toDate(date);
        const intlNow = now instanceof Date ? now : new Date(now);
        // useNow can lag behind the client clock (SSR/hydration).
        const referenceMs = Math.max(intlNow.getTime(), Date.now());
        const referenceNow = new Date(referenceMs);
        const targetMs = target.getTime();
        // If the server clock is slightly ahead, treat age as 0 until client time catches up
        // (avoids "in X seconds") without pinning the label to "Just now" forever.
        const ageMs = Math.max(0, referenceMs - targetMs);
        if (ageMs < 2_000) {
          return t("justNow");
        }
        return format.relativeTime(new Date(targetMs), { now: referenceNow });
      },
    };
  }, [format, now, t]);
}
