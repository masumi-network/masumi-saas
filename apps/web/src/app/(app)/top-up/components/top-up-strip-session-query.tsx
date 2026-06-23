"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Remove `session_id` from the URL after returning from Stripe so the balance
 * view isn’t glued to checkout query params forever.
 */
export function TopUpStripSessionQuery() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const didReplace = useRef(false);

  useEffect(() => {
    if (didReplace.current) return;
    const sessionId = searchParams.get("session_id");
    if (!sessionId) return;
    didReplace.current = true;
    router.replace("/top-up", { scroll: false });
    // Runs again when Stripe strips `session_id`; ref prevents repeat.
  }, [router, searchParams]);

  return null;
}
