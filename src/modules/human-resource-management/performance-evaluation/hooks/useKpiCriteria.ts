"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CreateKpiCriterionInput, ReorderInput, UpdateKpiCriterionInput } from "../types/performance-evaluation-api.schema";
import type { EvaluationCriterion } from "../types/performance-evaluation.schema";
import {
  createKpiCriterion,
  deleteKpiCriterion,
  EvaluationClientError,
  listKpiCriteria,
  reorderKpiCriteria,
  updateKpiCriterion,
} from "../providers/evaluationClient";

export interface KpiCriteriaState {
  rows: EvaluationCriterion[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (input: CreateKpiCriterionInput) => Promise<EvaluationCriterion>;
  update: (id: number, input: UpdateKpiCriterionInput) => Promise<EvaluationCriterion>;
  remove: (id: number) => Promise<void>;
  reorder: (input: ReorderInput) => Promise<EvaluationCriterion[]>;
}

export function useKpiCriteria(): KpiCriteriaState {
  const [rows, setRows] = useState<EvaluationCriterion[]>([]);
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
      const next = await listKpiCriteria(true);
      if (!mountedRef.current) return;
      setRows(next);
    } catch (err) {
      if (!mountedRef.current) return;
      setRows([]);
      setError(
        err instanceof EvaluationClientError ? err.message : "Failed to load the KPI criteria.",
      );
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: CreateKpiCriterionInput): Promise<EvaluationCriterion> => {
      const row = await createKpiCriterion(input);
      await refresh();
      return row;
    },
    [refresh],
  );

  const update = useCallback(
    async (id: number, input: UpdateKpiCriterionInput): Promise<EvaluationCriterion> => {
      const row = await updateKpiCriterion(id, input);
      await refresh();
      return row;
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: number): Promise<void> => {
      await deleteKpiCriterion(id);
      await refresh();
    },
    [refresh],
  );

  const reorder = useCallback(
    async (input: ReorderInput): Promise<EvaluationCriterion[]> => {
      const next = await reorderKpiCriteria(input);
      await refresh();
      return next;
    },
    [refresh],
  );

  return { rows, loading, error, refresh, create, update, remove, reorder };
}
