"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import type {
  OrientationCheck,
  OrientationEmployee,
  OrientationRosterResponse,
  OrientationStateResponse,
  OrientationTopic,
} from "../types/orientation.schema";

// orientationProvider.tsx — client fetch layer for the orientation API
// routes. Employee-keyed (todo 20): the roster loads once, per-employee state
// loads on selection, and check-off posts `{user_id, topic_id}` — no
// `profile_id`, no client-asserted actor role.

interface OrientationFetchContextType {
  employees: OrientationEmployee[];
  rosterLoading: boolean;
  rosterError: Error | null;
  topics: OrientationTopic[];
  checks: OrientationCheck[];
  done: boolean;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  loadEmployee: (userId: number) => Promise<void>;
  checkOff: (userId: number, topicId: string) => Promise<void>;
  refreshRoster: () => Promise<void>;
}

const OrientationFetchContext = createContext<
  OrientationFetchContextType | undefined
>(undefined);

const BASE = "/api/hrm/onboarding/orientation";

export function OrientationFetchProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  const [employees, setEmployees] = useState<OrientationEmployee[]>([]);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [rosterError, setRosterError] = useState<Error | null>(null);
  const [topics, setTopics] = useState<OrientationTopic[]>([]);
  const [checks, setChecks] = useState<OrientationCheck[]>([]);
  const [done, setDone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refreshRoster = useCallback(async () => {
    try {
      setRosterLoading(true);
      setRosterError(null);
      const res = await fetch(BASE, { cache: "no-store" });
      const body = (await res
        .json()
        .catch(() => null)) as OrientationRosterResponse | null;
      if (!res.ok || !body?.success) {
        throw new Error(body?.message || "Roster fetch failed");
      }
      setEmployees(
        Array.isArray(body.data?.employees) ? body.data.employees : []
      );
    } catch (err) {
      setRosterError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setRosterLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshRoster();
  }, [refreshRoster]);

  const loadEmployee = useCallback(async (userId: number) => {
    try {
      setIsLoading(true);
      setIsError(false);
      const res = await fetch(`${BASE}?user_id=${userId}`, {
        cache: "no-store",
      });
      const body = (await res
        .json()
        .catch(() => null)) as OrientationStateResponse | null;
      if (!res.ok || !body?.success) {
        throw new Error(body?.message || "Fetch failed");
      }
      setTopics(Array.isArray(body.data?.topics) ? body.data.topics : []);
      setChecks(Array.isArray(body.data?.checks) ? body.data.checks : []);
      setDone(body.data?.done === true);
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkOff = useCallback(
    async (userId: number, topicId: string) => {
      const res = await fetch(`${BASE}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, topic_id: topicId }),
      });
      const body = (await res.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
      } | null;
      if (!res.ok || !body?.success) {
        throw new Error(body?.message || "Check-off failed");
      }
      await loadEmployee(userId);
    },
    [loadEmployee]
  );

  return (
    <OrientationFetchContext.Provider
      value={{
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
        refreshRoster,
      }}
    >
      {children}
    </OrientationFetchContext.Provider>
  );
}

export function useOrientationFetch(): OrientationFetchContextType {
  const ctx = useContext(OrientationFetchContext);
  if (!ctx) {
    throw new Error(
      "useOrientationFetch must be used inside OrientationFetchProvider"
    );
  }
  return ctx;
}
