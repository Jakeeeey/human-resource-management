"use client";

import { useCallback, useEffect, useState } from "react";

import { useOrientationFetch } from "../providers/orientationProvider";

// useOrientation.ts — Orientation section intent hook for ONE employee
// (`user_id`). The employee is the canonical hire from the workspace route, so
// there is no roster selection here — only per-employee topic state + check-off.

export function useOrientation(userId: number) {
  const {
    employees,
    rosterLoading,
    rosterError,
    topics,
    checks,
    done,
    isLoading,
    isError,
    error,
    loadEmployee,
    checkOff,
  } = useOrientationFetch();

  const [actionError, setActionError] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  useEffect(() => {
    void loadEmployee(userId);
  }, [userId, loadEmployee]);

  const checkTopic = useCallback(
    async (topicId: string) => {
      setCheckingId(topicId);
      setActionError(null);
      try {
        await checkOff(userId, topicId);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : String(err));
      } finally {
        setCheckingId(null);
      }
    },
    [userId, checkOff]
  );

  const checkedIds = new Set(checks.map((c) => c.topic_id));
  const companyTopics = topics.filter((t) => t.track === "company");
  const departmentTopics = topics.filter((t) => t.track === "department");
  const selectedEmployee =
    employees.find((e) => e.user_id === userId) ?? null;

  return {
    employees,
    selectedEmployee,
    userId,
    companyTopics,
    departmentTopics,
    checkedIds,
    done,
    isLoading: isLoading || rosterLoading,
    isError,
    error,
    rosterError,
    actionError,
    checkingId,
    checkTopic,
  };
}
