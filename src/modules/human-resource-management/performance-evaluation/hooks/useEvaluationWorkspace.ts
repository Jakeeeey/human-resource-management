"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { WorkspaceBundle } from "../types/performance-evaluation.schema";
import {
  EvaluationClientError,
  getWorkspace,
  type EvaluationScope,
} from "../providers/evaluationClient";

export interface EvaluationWorkspaceState {
  bundle: WorkspaceBundle | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useEvaluationWorkspace(
  scope: EvaluationScope,
  userId: number | null,
): EvaluationWorkspaceState {
  const [bundle, setBundle] = useState<WorkspaceBundle | null>(null);
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
    if (userId === null) return;
    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }
    try {
      const next = await getWorkspace(scope, userId);
      if (!mountedRef.current) return;
      setBundle(next);
    } catch (err) {
      if (!mountedRef.current) return;
      setBundle(null);
      setError(
        err instanceof EvaluationClientError ? err.message : "Failed to load this workspace.",
      );
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [scope, userId]);

  useEffect(() => {
    if (userId === null) {
      setBundle(null);
      setError(null);
      setLoading(false);
      return;
    }
    void refresh();
  }, [userId, refresh]);

  return { bundle, loading, error, refresh };
}
