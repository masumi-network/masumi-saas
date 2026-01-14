import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;

let mediaQueryList: MediaQueryList | null = null;

function getMediaQueryList() {
  if (!mediaQueryList && typeof window !== "undefined") {
    mediaQueryList = window.matchMedia(
      `(max-width: ${MOBILE_BREAKPOINT - 1}px)`,
    );
  }
  return mediaQueryList;
}

function subscribe(callback: () => void) {
  const mql = getMediaQueryList();
  if (!mql) {
    return () => {};
  }
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

function getServerSnapshot() {
  return false;
}

export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
