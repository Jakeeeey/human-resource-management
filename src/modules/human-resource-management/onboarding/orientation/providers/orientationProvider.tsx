"use client";

import type {
  OrientationCheck,
  OrientationStateResponse,
  OrientationTopic,
} from "../types/orientation.schema";

// orientationProvider.tsx — client fetch layer for the orientation API
// routes. Thin context provider mirroring the hub profileProvider shape:
// state per hire (topics + checks + done predicate) + check-off + refetch
// with loading/error flags.

import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";

interface OrientationFetchContextType {
  topics: OrientationTopic[];
  checks: OrientationCheck[];
  done: boolean;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  loadHire: (profileId: number) => Promise<void>;
  checkOff: (
    profileId: number,
    topicId: string,
    role: "hr" | "department"
  ) => Promise<void>;
}

const OrientationFetchContext = createContext<
  OrientationFetchContextType | undefined
>(undefined);

const BASE = "/api/hrm/onboarding/orientation";

async function readEnvelope(res: Response): Promise<OrientationStateResponse> {
  return (await res.json().catch(() => null)) as OrientationStateResponse;
}

export function OrientationFetchProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  const [topics, setTopics] = useState<OrientationTopic[]>([]);
  const [checks, setChecks] = useState<OrientationCheck[]>([]);
  const [done, setDone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const applyState = useCallback((body: OrientationStateResponse) => {
    setTopics(Array.isArray(body.data?.topics) ? body.data.topics : []);
    setChecks(Array.isArray(body.data?.checks) ? body.data.checks : []);
    setDone(body.data?.done === true);
  }, []);

  const loadHire = useCallback(
    async (profileId: number) => {
      try {
        setIsLoading(true);
        setIsError(false);
        const res = await fetch(`${BASE}?profile_id=${profileId}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Fetch failed");
        const body = await readEnvelope(res);
        applyState(body);
      } catch (err) {
        setIsError(true);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    },
    [applyState]
  );

  const checkOff = useCallback(
    async (profileId: number, topicId: string, role: "hr" | "department") => {
      const res = await fetch(`${BASE}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: profileId,
          topic_id: topicId,
          actor: { role },
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
      } | null;
      if (!res.ok || !body?.success) {
        throw new Error(body?.message || "Check-off failed");
      }
      await loadHire(profileId);
    },
    [loadHire]
  );

  return (
    <OrientationFetchContext.Provider
      value={{
        topics,
        checks,
        done,
        isLoading,
        isError,
        error,
        loadHire,
        checkOff,
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
