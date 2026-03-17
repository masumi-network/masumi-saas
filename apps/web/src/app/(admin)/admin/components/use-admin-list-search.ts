"use client";

import { usePathname, useRouter } from "next/navigation";
import type { MutableRefObject } from "react";
import { useEffect, useState, useTransition } from "react";

export type UseAdminListSearchOptions = {
  /** When set to true by the caller before updating input/URL, the next debounced push is skipped (avoids double navigation on clear). */
  skipNextPushRef?: MutableRefObject<boolean>;
  /** When provided, called instead of router.push(base) on clear; use to preserve or clear other params (e.g. filter, limit). */
  onClearSearch?: () => void;
};

/**
 * Debounced search that syncs input to URL search param.
 * @param currentSearch - Current value from URL (e.g. searchParams.get("search") ?? "")
 * @param pathPrefix - Base path for navigation; if empty, uses current pathname (e.g. "/admin/agents" or "")
 */
export function useAdminListSearch(
  currentSearch: string,
  pathPrefix: string = "",
  options?: UseAdminListSearchOptions,
) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(currentSearch);

  useEffect(() => {
    setSearchInput(currentSearch);
  }, [currentSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (options?.skipNextPushRef?.current) {
        options.skipNextPushRef.current = false;
        return;
      }
      if (searchInput === currentSearch) return;
      const params = new URLSearchParams(window.location.search);
      if (searchInput) {
        params.set("search", searchInput);
      } else {
        params.delete("search");
      }
      params.delete("page");
      const base = pathPrefix || pathname;
      const q = params.toString();
      const url = q ? `${base}?${q}` : base;
      startTransition(() => {
        router.push(url);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [
    searchInput,
    currentSearch,
    router,
    pathname,
    pathPrefix,
    options?.skipNextPushRef,
  ]);

  const handleClearSearch = () => {
    const skipRef = options?.skipNextPushRef;
    // MutableRefObject is intentionally mutable; immutability rule does not apply to ref.current
    if (skipRef) {
      // eslint-disable-next-line react-hooks/immutability -- mutating ref.current is by design
      skipRef.current = true;
    }
    setSearchInput("");
    if (options?.onClearSearch) {
      options.onClearSearch();
    } else {
      const base = pathPrefix || pathname;
      startTransition(() => {
        router.push(base);
      });
    }
  };

  return { searchInput, setSearchInput, handleClearSearch, isPending };
}
