"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { RosterRow } from "../types/performance-evaluation.schema";
import {
  EvaluationClientError,
  getRoster,
  type EvaluationScope,
} from "../providers/evaluationClient";

export interface EvaluationRosterState {
  rows: RosterRow[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useEvaluationRoster(
  scope: EvaluationScope,
  opts?: { includeRegular?: boolean },
): EvaluationRosterState {
  const includeRegular = opts?.includeRegular ?? false;
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }
    try {
      const next = await getRoster(scope, { includeRegular });
      if (!mountedRef.current) return;
      setRows(next);
    } catch (err) {
      if (!mountedRef.current) return;
      setRows([]);
      setError(
        err instanceof EvaluationClientError ? err.message : "Failed to load the evaluation roster.",
      );
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [scope, includeRegular]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { rows, loading, error, refresh };
}
