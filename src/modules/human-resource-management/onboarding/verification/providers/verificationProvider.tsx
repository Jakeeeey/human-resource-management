"use client";

import type {
  AcknowledgementLog,
  AcknowledgementLogResponse,
  CreateAcknowledgementLogInput,
} from "../types/acknowledgement-log.schema";
import type {
  QueueAggregate,
  VerificationDecisionInput,
  VerificationQueueResponse,
} from "../types/verification-queue.schema";

// verificationProvider.tsx — client fetch layer for the verification queue +
// acknowledgement-log routes. Thin context provider mirroring the hub
// profileProvider shape: queue aggregate + decision mutations + per-doc trail
// fetch with error + refetch-retry (memo-ack retry-read pattern, ported).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface TrailState {
  docRef: string | null;
  logs: AcknowledgementLog[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

interface VerificationFetchContextType {
  queue: QueueAggregate | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  decide: (
    input: VerificationDecisionInput
  ) => Promise<{ success: boolean; message?: string }>;
  recordAck: (
    input: CreateAcknowledgementLogInput
  ) => Promise<AcknowledgementLog | null>;
  trail: TrailState;
  fetchTrail: (docRef: string) => Promise<void>;
  retryTrail: () => Promise<void>;
  clearTrail: () => void;
}

const VerificationFetchContext = createContext<
  VerificationFetchContextType | undefined
>(undefined);

const QUEUE_BASE = "/api/hrm/onboarding/verifications";
const ACK_BASE = "/api/hrm/onboarding/acknowledgement-logs";

async function readQueue(res: Response): Promise<VerificationQueueResponse> {
  return (await res.json().catch(() => null)) as VerificationQueueResponse;
}

async function readAck(res: Response): Promise<AcknowledgementLogResponse> {
  return (await res.json().catch(() => null)) as AcknowledgementLogResponse;
}

export function VerificationFetchProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  const [queue, setQueue] = useState<QueueAggregate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [trail, setTrail] = useState<TrailState>({
    docRef: null,
    logs: [],
    isLoading: false,
    isError: false,
    error: null,
  });

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsError(false);
      const res = await fetch(QUEUE_BASE, { cache: "no-store" });
      if (!res.ok) throw new Error("Fetch failed");
      const body = await readQueue(res);
      if (!body.success) throw new Error(body.message || "Fetch failed");
      const data = body.data as QueueAggregate | null;
      setQueue(data ?? { rows: [], counts: { pending: 0, returned: 0, approved: 0 } });
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const decide = useCallback(
    async (input: VerificationDecisionInput) => {
      const res = await fetch(QUEUE_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await readQueue(res);
      if (!res.ok || !body.success) {
        throw new Error(body?.message || "Decision failed");
      }
      await fetchData();
      return { success: true as const, message: body.message };
    },
    [fetchData]
  );

  const recordAck = useCallback(
    async (input: CreateAcknowledgementLogInput) => {
      const res = await fetch(ACK_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await readAck(res);
      if (!res.ok || !body.success) {
        throw new Error(body?.message || "Acknowledgement failed");
      }
      await fetchData();
      return (body.data as AcknowledgementLog) ?? null;
    },
    [fetchData]
  );

  const fetchTrail = useCallback(async (docRef: string) => {
    const ref = docRef.trim();
    if (ref.length === 0) return;
    try {
      setTrail((prev) => ({
        ...prev,
        docRef: ref,
        logs: [],
        isLoading: true,
        isError: false,
        error: null,
      }));
      const res = await fetch(
        `${ACK_BASE}?doc_ref=${encodeURIComponent(ref)}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Trail fetch failed");
      const body = await readAck(res);
      if (!body.success) throw new Error(body.message || "Trail fetch failed");
      const logs = Array.isArray(body.data)
        ? (body.data as AcknowledgementLog[])
        : [];
      setTrail({ docRef: ref, logs, isLoading: false, isError: false, error: null });
    } catch (err) {
      setTrail((prev) => ({
        ...prev,
        isLoading: false,
        isError: true,
        error: err instanceof Error ? err : new Error(String(err)),
      }));
    }
  }, []);

  // Retry-read port: clear the error first so the dialog returns to loading,
  // then refetch the same doc_ref (memo-ack handleRetryCompanyLogs shape).
  const retryTrail = useCallback(async () => {
    const ref = trail.docRef;
    if (!ref) return;
    setTrail((prev) => ({ ...prev, isError: false, error: null }));
    await fetchTrail(ref);
  }, [trail.docRef, fetchTrail]);

  const clearTrail = useCallback(() => {
    setTrail({
      docRef: null,
      logs: [],
      isLoading: false,
      isError: false,
      error: null,
    });
  }, []);

  return (
    <VerificationFetchContext.Provider
      value={{
        queue,
        isLoading,
        isError,
        error,
        refetch: fetchData,
        decide,
        recordAck,
        trail,
        fetchTrail,
        retryTrail,
        clearTrail,
      }}
    >
      {children}
    </VerificationFetchContext.Provider>
  );
}

export function useVerificationFetch(): VerificationFetchContextType {
  const ctx = useContext(VerificationFetchContext);
  if (!ctx) {
    throw new Error(
      "useVerificationFetch must be used inside VerificationFetchProvider"
    );
  }
  return ctx;
}
