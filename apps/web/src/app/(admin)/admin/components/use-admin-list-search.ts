"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

/**
 * Debounced search that syncs input to URL search param.
 * @param currentSearch - Current value from URL (e.g. searchParams.get("search") ?? "")
 * @param pathPrefix - Base path for navigation; if empty, uses current pathname (e.g. "/admin/agents" or "")
 */
export function useAdminListSearch(
  currentSearch: string,
  pathPrefix: string = "",
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
      if (searchInput === currentSearch) return;
      const params = new URLSearchParams(window.location.search);
      if (searchInput) {
        params.set("search", searchInput);
      } else {
        params.delete("search");
      }
      params.set("page", "1");
      const base = pathPrefix || pathname;
      const q = params.toString();
      const url = q ? `${base}?${q}` : base;
      startTransition(() => {
        router.push(url);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, currentSearch, router, pathname, pathPrefix]);

  const handleClearSearch = () => {
    setSearchInput("");
    const base = pathPrefix || pathname;
    startTransition(() => {
      router.push(base);
    });
  };

  return { searchInput, setSearchInput, handleClearSearch, isPending };
}
