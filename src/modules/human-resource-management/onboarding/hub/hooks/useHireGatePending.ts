"use client";

import { useCallback, useEffect, useState } from "react";

import {
  HireGateResponseSchema,
  type HireGatePendingItem,
} from "@/modules/human-resource-management/onboarding/hire/types/hire-gate.schema";
import { HIRE_ROSTER_REFRESH_EVENT } from "./useHireRoster";

const PENDING_URL = "/api/hrm/onboarding/hire-gate?scope=pending";

export interface HireGatePendingState {
  pending: HireGatePendingItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useHireGatePending(): HireGatePendingState {
  const [pending, setPending] = useState<HireGatePendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(PENDING_URL, { cache: "no-store" });
      const body: unknown = await res.json().catch(() => null);
      const parsed = HireGateResponseSchema.safeParse(body);
      if (!res.ok || !parsed.success || !parsed.data.success) {
        setError("Failed to load applicants awaiting onboarding.");
        setPending([]);
        return;
      }
      setPending(parsed.data.data?.pending ?? []);
    } catch {
      setError("Failed to load applicants awaiting onboarding.");
      setPending([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = () => {
      void refresh();
    };
    window.addEventListener(HIRE_ROSTER_REFRESH_EVENT, handler);
    return () =>
      window.removeEventListener(HIRE_ROSTER_REFRESH_EVENT, handler);
  }, [refresh]);

  return { pending, loading, error, refresh };
}
