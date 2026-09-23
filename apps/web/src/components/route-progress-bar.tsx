"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Thin top-of-viewport progress bar for client-side navigations. Mirrors the
 * payment-service admin RouteProgressBar, adapted for the App Router.
 */
export function RouteProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigatingRef = useRef(false);
  const routeKey = `${pathname}?${searchParams.toString()}`;

  useEffect(() => {
    const clearTimers = () => {
      if (trickleRef.current) clearInterval(trickleRef.current);
      if (hideRef.current) clearTimeout(hideRef.current);
      trickleRef.current = null;
      hideRef.current = null;
    };

    const start = () => {
      if (navigatingRef.current) return;
      navigatingRef.current = true;
      clearTimers();
      setVisible(true);
      setProgress(12);
      trickleRef.current = setInterval(() => {
        setProgress((value) =>
          value >= 90 ? value : value + Math.max(0.5, (90 - value) * 0.12),
        );
      }, 200);
    };

    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a");
      if (!anchor) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        return;
      }

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;

      const next = `${url.pathname}${url.search}`;
      const current = `${window.location.pathname}${window.location.search}`;
      if (next === current) return;

      start();
    };

    const handlePopState = () => {
      start();
    };

    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
      clearTimers();
    };
  }, []);

  useEffect(() => {
    if (!navigatingRef.current) return;

    const completeId = setTimeout(() => {
      if (trickleRef.current) clearInterval(trickleRef.current);
      if (hideRef.current) clearTimeout(hideRef.current);
      trickleRef.current = null;
      hideRef.current = null;

      setProgress(100);
      hideRef.current = setTimeout(() => {
        navigatingRef.current = false;
        setVisible(false);
        setProgress(0);
      }, 220);
    }, 0);

    return () => {
      clearTimeout(completeId);
      if (hideRef.current) clearTimeout(hideRef.current);
    };
  }, [routeKey]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[2000] h-0.5"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms ease" }}
    >
      <div
        className="h-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]"
        style={{ width: `${progress}%`, transition: "width 200ms ease" }}
      />
    </div>
  );
}
