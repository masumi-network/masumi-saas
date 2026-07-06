"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { TopUpCanceledBanner } from "./top-up-return-alerts";
import { TopUpReturnSuccessBanner } from "./top-up-return-success";

type TopUpStripSessionQueryProps = {
  canceled?: boolean;
  successCredits?: number | null;
};

/**
 * Keep Stripe return notices visible while removing one-time checkout query
 * params and refreshing server data while the webhook grant catches up.
 */
export function TopUpStripSessionQuery({
  canceled = false,
  successCredits = null,
}: TopUpStripSessionQueryProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const strippedSearch = useRef<string | null>(null);
  const [visibleSuccessCredits] = useState<number | null>(successCredits);
  const [showCanceled] = useState(successCredits === null && canceled);
  const [refreshKey] = useState<string | null>(() =>
    successCredits !== null
      ? (searchParams.get("session_id") ?? String(successCredits))
      : null,
  );
  const timeoutIds = useRef<number[]>([]);
  const intervalIds = useRef<number[]>([]);

  useEffect(() => {
    const hasReturnParam =
      searchParams.has("session_id") || searchParams.has("canceled");
    if (!hasReturnParam) return;

    const currentSearch = searchParams.toString();
    if (strippedSearch.current === currentSearch) return;
    strippedSearch.current = currentSearch;

    const url = new URL(window.location.href);
    url.searchParams.delete("session_id");
    url.searchParams.delete("canceled");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [searchParams]);

  useEffect(() => {
    return () => {
      timeoutIds.current.forEach((id) => {
        window.clearTimeout(id);
      });
      intervalIds.current.forEach((id) => {
        window.clearInterval(id);
      });
      timeoutIds.current = [];
      intervalIds.current = [];
    };
  }, []);

  useEffect(() => {
    if (visibleSuccessCredits === null || refreshKey === null) return;

    let refreshCount = 0;
    let intervalId: number | undefined;
    const maxRefreshes = 6;

    const refresh = () => {
      refreshCount += 1;
      router.refresh();
      if (refreshCount >= maxRefreshes && intervalId !== undefined) {
        window.clearInterval(intervalId);
        intervalIds.current = intervalIds.current.filter(
          (id) => id !== intervalId,
        );
      }
    };

    const timeoutId = window.setTimeout(() => {
      refresh();
      intervalId = window.setInterval(refresh, 5_000);
      intervalIds.current.push(intervalId);
    }, 2_500);
    timeoutIds.current.push(timeoutId);
  }, [refreshKey, router, visibleSuccessCredits]);

  return (
    <>
      {showCanceled ? <TopUpCanceledBanner /> : null}
      {visibleSuccessCredits !== null ? (
        <TopUpReturnSuccessBanner credits={visibleSuccessCredits} />
      ) : null}
    </>
  );
}
