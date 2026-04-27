"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { AnyTARequest, TAFilterOptions, TAActionPayload, ApprovalLogEntry, Department } from "../types";
import { toast } from "sonner";

/**
 * useTAApproval
 *
 * Manages the manager approval queue + approval history logs.
 * User identity is resolved server-side from the vos_access_token cookie.
 * After an action, the affected row is updated IN PLACE — it never vanishes.
 * HR Head: sees all pending requests across all departments, with a department filter.
 */
export function useTAApproval() {
  const [managerQueue, setManagerQueue]                     = useState<AnyTARequest[]>([]);
  const [approvalLogs, setApprovalLogs]                     = useState<ApprovalLogEntry[]>([]);
  const [filters, setFilters]                               = useState<TAFilterOptions>({});
  const [isLoading, setIsLoading]                           = useState(false);
  const [isLogsLoading, setIsLogsLoading]                   = useState(false);
  const [isHRHead, setIsHRHead]                             = useState(false);
  const [departments, setDepartments]                       = useState<Department[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId]     = useState<number | undefined>(undefined);
  const [error, setError]                                   = useState<string | null>(null);
  const [lastUpdated, setLastUpdated]                       = useState<Date>(new Date());

  // ── Fetch all departments (for HR Head dropdown) ──────────────────────────
  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetch("/api/hrm/employee-admin/approval/time-attendance?action=departments");
      const result = await res.json();
      if (result.success) {

        setDepartments(result.data ?? []);
      } else {
        console.error("[useTAApproval] Failed to load departments:", result.error);
      }
    } catch (err: unknown) {
      console.error("[useTAApproval] Failed to fetch departments:", err);
    }
  }, []);

  // ── Fetch departments on mount (for filtering) ──────────────────────────
  useEffect(() => {
    if (departments.length === 0) {
      fetchDepartments();
    }
  }, [departments.length, fetchDepartments]);

  // ── Fetch manager queue ───────────────────────────────────────────────────
  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (filters.status && filters.status !== "all") query.append("status", filters.status);
      if (filters.types && filters.types.length > 0)  query.append("types", filters.types.join(","));
      if (filters.startDate) query.append("startDate", filters.startDate);
      if (filters.endDate)   query.append("endDate",   filters.endDate);
      if (selectedDepartmentId) query.append("departmentId", String(selectedDepartmentId));

      const res    = await fetch(`/api/hrm/employee-admin/approval/time-attendance?${query.toString()}`);
      const result = await res.json();

      if (result.success) {
        setManagerQueue(result.data);
        setLastUpdated(new Date());
        if (result.isHRHead !== undefined) {
          setIsHRHead(result.isHRHead as boolean);
        }
      } else {
        setError(result.error);
        toast.error(`Failed to load queue: ${result.error}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(`Network error: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, [filters, selectedDepartmentId]);

  // ── Fetch approval history logs ───────────────────────────────────────────
  const fetchApprovalLogs = useCallback(async () => {
    setIsLogsLoading(true);
    try {
      const query = new URLSearchParams();
      query.append("action", "logs");
      query.append("limit", "100");
      if (filters.startDate) query.append("startDate", filters.startDate);
      if (filters.endDate)   query.append("endDate",   filters.endDate);
      if (filters.departmentId) query.append("departmentId", String(filters.departmentId));

      const res    = await fetch(`/api/hrm/employee-admin/approval/time-attendance?${query.toString()}`);
      const result = await res.json();
      if (result.success) {
        setApprovalLogs(result.data);
      }
    } catch (err: unknown) {
      console.error("[useTAApproval] Failed to fetch logs:", err instanceof Error ? err.message : err);
    } finally {
      setIsLogsLoading(false);
    }
  }, [filters.startDate, filters.endDate, filters.departmentId]);

  // ── Single-request audit trail ────────────────────────────────────────────
  const fetchHistory = useCallback(async (requestId: number, type: string) => {
    try {
      const res = await fetch(
        `/api/hrm/employee-admin/approval/time-attendance?action=history&requestId=${requestId}&type=${type}`
      );
      const result = await res.json();
      return result.success ? result.data : [];
    } catch (err: unknown) {
      toast.error(`Failed to fetch history: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }, []);

  // ── Approve / Reject / Return / Override ──────────────────────────────────
  const performAction = useCallback(async (payload: TAActionPayload): Promise<boolean> => {
    try {
      const res = await fetch("/api/hrm/employee-admin/approval/time-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      if (result.success) {
        // Refresh the full queue and logs so all levels see the updated state
        fetchQueue();
        fetchApprovalLogs();

        const pastTense =
          payload.action === "approve"         ? "approved"   :
          payload.action === "reject"          ? "rejected"   :
          payload.action === "approve_override" ? "approved (override)" :
          payload.action === "reject_override"  ? "rejected (override)" :
          payload.action === "override"         ? "overridden" :
          "returned";
        toast.success(`Request ${pastTense} successfully`);
        return true;
      } else {
        toast.error(`Action failed: ${result.error}`);
        return false;
      }
    } catch (err: unknown) {
      toast.error(`Error: ${err instanceof Error ? err.message : err}`);
      return false;
    }
  }, [fetchQueue, fetchApprovalLogs]);

  // ── Smart Polling & Focus Refresh ──────────────────────────────────────────
  const lastFetchedRef = useRef<number>(0);
  const FETCH_COOLDOWN = 5000; // 5 seconds cooldown to prevent spamming

  const smartRefresh = useCallback(async (force = false) => {
    const now = Date.now();
    // Only refresh if forced or if enough time has passed since last fetch
    if (force || (now - lastFetchedRef.current > FETCH_COOLDOWN)) {
      if (document.visibilityState === "visible") {
        lastFetchedRef.current = now;
        await Promise.all([fetchQueue(), fetchApprovalLogs()]);
      }
    }
  }, [fetchQueue, fetchApprovalLogs]);

  useEffect(() => {
    // 1. Initial fetch when the component mounts
    smartRefresh(true);

    // 2. PASSIVE REFRESH: Only hit the server when the user returns to the tab.
    // This eliminates background load entirely while keeping data fresh when needed.
    const handleFocus = () => {

      smartRefresh();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [smartRefresh]);

  return {
    managerQueue,
    approvalLogs,
    filters,
    setFilters,
    isLoading,
    isLogsLoading,
    isHRHead,
    departments,
    selectedDepartmentId,
    setSelectedDepartmentId,
    error,
    lastUpdated,
    refresh: fetchQueue,
    refreshLogs: fetchApprovalLogs,
    fetchHistory,
    performAction,
  };
}
