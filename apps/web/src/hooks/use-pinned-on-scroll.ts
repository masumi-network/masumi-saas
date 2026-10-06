"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** Matches Tailwind `lg` — two-column agent details layout. */
const PIN_LAYOUT_MEDIA = "(min-width: 1024px)";

/** Gap between the app header and the pinned panel. */
const PIN_BUFFER_BELOW_HEADER_PX = 32;

function getPinTopOffsetPx(): number {
  const header = document.querySelector<HTMLElement>("[data-app-header]");
  const headerHeight = header?.getBoundingClientRect().height ?? 0;
  return headerHeight + PIN_BUFFER_BELOW_HEADER_PX;
}

type PinLayout =
  | { mode: "static" }
  | { mode: "fixed"; top: number; left: number; width: number };

export function usePinnedOnScroll() {
  const anchorRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<PinLayout>({ mode: "static" });
  const [spacerHeight, setSpacerHeight] = useState(0);

  useLayoutEffect(() => {
    const mq = window.matchMedia(PIN_LAYOUT_MEDIA);

    const update = () => {
      const anchor = anchorRef.current;
      const pinned = pinnedRef.current;
      if (!anchor || !pinned) {
        return;
      }

      if (!mq.matches) {
        setLayout({ mode: "static" });
        setSpacerHeight(0);
        return;
      }

      const pinnedHeight = pinned.getBoundingClientRect().height;
      if (pinnedHeight <= 0) {
        return;
      }

      const pinTop = getPinTopOffsetPx();
      const anchorRect = anchor.getBoundingClientRect();

      if (anchorRect.top > pinTop) {
        setLayout({ mode: "static" });
        setSpacerHeight(0);
        return;
      }

      setLayout({
        mode: "fixed",
        top: pinTop,
        left: anchorRect.left,
        width: anchorRect.width,
      });
      setSpacerHeight(pinnedHeight);
    };

    const scrollRoot = () =>
      document.querySelector<HTMLElement>("[data-app-main-scroll]");

    const onScroll = () => {
      requestAnimationFrame(update);
    };

    mq.addEventListener("change", update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", onScroll, { passive: true });

    const root = scrollRoot();
    root?.addEventListener("scroll", onScroll, { passive: true });

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(update);
    });
    if (anchorRef.current) {
      ro.observe(anchorRef.current);
    }
    if (pinnedRef.current) {
      ro.observe(pinnedRef.current);
    }

    const header = document.querySelector<HTMLElement>("[data-app-header]");
    header && ro.observe(header);

    update();

    return () => {
      mq.removeEventListener("change", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", onScroll);
      root?.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, []);

  return { anchorRef, pinnedRef, layout, spacerHeight };
}
