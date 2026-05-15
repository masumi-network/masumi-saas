"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { getKycStatusAction } from "@/lib/actions";

export type LiveKycStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "REVIEW"
  | null;

const POLL_INTERVAL_MS = 4000;
const MAX_POLL_ATTEMPTS = 120;

/**
 * Loads KYC via server action and polls Sumsub-backed status while in REVIEW so
 * APPROVED/REJECTED appears without a full page reload or revisiting the page.
 */
export function useKycStatusWithPolling(enabled: boolean): {
  kycStatus: LiveKycStatus;
  rejectionReason: string | null;
  kycCompletedAt: Date | null;
  isLoadingKyc: boolean;
} {
  const [kycStatus, setKycStatus] = useState<LiveKycStatus>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [kycCompletedAt, setKycCompletedAt] = useState<Date | null>(null);
  const [isLoadingKyc, setIsLoadingKyc] = useState(enabled);
  const [, startTransition] = useTransition();
  const pollAttemptsRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      const id = requestAnimationFrame(() => setIsLoadingKyc(false));
      return () => cancelAnimationFrame(id);
    }

    startTransition(() => {
      setIsLoadingKyc(true);
      void (async () => {
        const result = await getKycStatusAction();
        if (result.success && result.data) {
          setKycStatus(result.data.kycStatus);
          setRejectionReason(result.data.kycRejectionReason ?? null);
          setKycCompletedAt(result.data.kycCompletedAt ?? null);
        }
        setIsLoadingKyc(false);
      })();
    });
  }, [enabled, startTransition]);

  useEffect(() => {
    if (!enabled || kycStatus !== "REVIEW") {
      pollAttemptsRef.current = 0;
      return;
    }

    pollAttemptsRef.current = 0;
    let intervalId: number | undefined;

    const tick = async () => {
      pollAttemptsRef.current += 1;
      if (pollAttemptsRef.current > MAX_POLL_ATTEMPTS) {
        if (intervalId !== undefined) {
          window.clearInterval(intervalId);
        }
        return;
      }
      const result = await getKycStatusAction();
      if (result.success && result.data) {
        setKycStatus(result.data.kycStatus);
        setRejectionReason(result.data.kycRejectionReason ?? null);
        setKycCompletedAt(result.data.kycCompletedAt ?? null);
      }
    };

    void tick();
    intervalId = window.setInterval(() => void tick(), POLL_INTERVAL_MS);

    return () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
  }, [enabled, kycStatus]);

  return { kycStatus, rejectionReason, kycCompletedAt, isLoadingKyc };
}
