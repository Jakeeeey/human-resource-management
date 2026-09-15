"use client";

import { useCallback, useEffect, useState } from "react";

import {
  HireRosterResponseSchema,
  type HireRosterRow,
} from "../types/hire-roster.schema";

// useHireRoster.ts — client data access for the hub roster (todo 27). One
// fetch through the local proxy; the response is boundary-parsed so a Directus
// error envelope or contract drift surfaces as an error state instead of a
// silent empty roster (the todo-6 false-empty lesson).

const ROSTER_URL = "/api/hrm/onboarding/hire-roster";

/** Window event the module header's Refresh button dispatches. */
export const HIRE_ROSTER_REFRESH_EVENT = "onboarding-hub:refresh";

export interface HireRosterState {
  rows: HireRosterRow[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useHireRoster(): HireRosterState {
  const [rows, setRows] = useState<HireRosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(ROSTER_URL, { cache: "no-store" });
      const body: unknown = await res.json().catch(() => null);
      const parsed = HireRosterResponseSchema.safeParse(body);
      if (!res.ok || !parsed.success || !parsed.data.success) {
        setError("Failed to load the onboarding roster.");
        setRows([]);
        return;
      }
      setRows(parsed.data.data?.hires ?? []);
    } catch {
      setError("Failed to load the onboarding roster. Please try again later.");
      setRows([]);
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

  return { rows, loading, error, refresh };
}
