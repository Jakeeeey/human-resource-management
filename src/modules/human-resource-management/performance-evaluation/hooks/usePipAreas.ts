"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CreatePipAreaInput, ReorderInput, UpdatePipAreaInput } from "../types/performance-evaluation-api.schema";
import type { PipCriterion } from "../types/performance-evaluation.schema";
import {
  createPipArea,
  deletePipArea,
  EvaluationClientError,
  listPipAreas,
  reorderPipAreas,
  updatePipArea,
} from "../providers/evaluationClient";

export interface PipAreasState {
  rows: PipCriterion[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (input: CreatePipAreaInput) => Promise<PipCriterion>;
  update: (id: number, input: UpdatePipAreaInput) => Promise<PipCriterion>;
  remove: (id: number) => Promise<void>;
  reorder: (input: ReorderInput) => Promise<PipCriterion[]>;
}

export function usePipAreas(): PipAreasState {
  const [rows, setRows] = useState<PipCriterion[]>([]);
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
      const next = await listPipAreas(true);
      if (!mountedRef.current) return;
      setRows(next);
    } catch (err) {
      if (!mountedRef.current) return;
      setRows([]);
      setError(
        err instanceof EvaluationClientError ? err.message : "Failed to load the PIP areas.",
      );
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: CreatePipAreaInput): Promise<PipCriterion> => {
      const row = await createPipArea(input);
      await refresh();
      return row;
    },
    [refresh],
  );

  const update = useCallback(
    async (id: number, input: UpdatePipAreaInput): Promise<PipCriterion> => {
      const row = await updatePipArea(id, input);
      await refresh();
      return row;
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: number): Promise<void> => {
      await deletePipArea(id);
      await refresh();
    },
    [refresh],
  );

  const reorder = useCallback(
    async (input: ReorderInput): Promise<PipCriterion[]> => {
      const next = await reorderPipAreas(input);
      await refresh();
      return next;
    },
    [refresh],
  );

  return { rows, loading, error, refresh, create, update, remove, reorder };
}
