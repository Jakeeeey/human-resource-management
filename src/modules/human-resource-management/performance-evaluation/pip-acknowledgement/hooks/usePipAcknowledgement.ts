"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  EmployeePip,
  EmployeePipActionPlan,
  EmployeePipArea,
} from "../types/performance-evaluation.schema";
import {
  acknowledgePip,
  EvaluationClientError,
  getMyPip,
  getMyPips,
  markPipViewed,
} from "../providers/evaluationClient";

export interface PipAcknowledgementState {
  pip: EmployeePip | null;
  areas: EmployeePipArea[];
  actionPlans: EmployeePipActionPlan[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markViewed: () => Promise<void>;
  acknowledge: () => Promise<void>;
}

export function usePipAcknowledgement(pipId: number | null): PipAcknowledgementState {
  const [pip, setPip] = useState<EmployeePip | null>(null);
  const [areas, setAreas] = useState<EmployeePipArea[]>([]);
  const [actionPlans, setActionPlans] = useState<EmployeePipActionPlan[]>([]);
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
    if (pipId === null) return;
    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }
    try {
      const next = await getMyPip(pipId);
      if (!mountedRef.current) return;
      setPip(next.pip);
      setAreas(next.areas);
      setActionPlans(next.actionPlans);
    } catch (err) {
      if (!mountedRef.current) return;
      setPip(null);
      setAreas([]);
      setActionPlans([]);
      setError(err instanceof EvaluationClientError ? err.message : "Failed to load this PIP.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [pipId]);

  useEffect(() => {
    if (pipId === null) {
      setPip(null);
      setAreas([]);
      setActionPlans([]);
      setError(null);
      setLoading(false);
      return;
    }
    void refresh();
  }, [pipId, refresh]);

  const markViewed = useCallback(async (): Promise<void> => {
    if (pipId === null) return;
    await markPipViewed(pipId);
    await refresh();
  }, [pipId, refresh]);

  const acknowledge = useCallback(async (): Promise<void> => {
    if (pipId === null) return;
    await acknowledgePip(pipId);
    await refresh();
  }, [pipId, refresh]);

  return { pip, areas, actionPlans, loading, error, refresh, markViewed, acknowledge };
}

export interface MyPipsState {
  pips: EmployeePip[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useMyPips(): MyPipsState {
  const [pips, setPips] = useState<EmployeePip[]>([]);
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
      const next = await getMyPips();
      if (!mountedRef.current) return;
      setPips(next);
    } catch (err) {
      if (!mountedRef.current) return;
      setPips([]);
      setError(err instanceof EvaluationClientError ? err.message : "Failed to load your PIPs.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { pips, loading, error, refresh };
}
