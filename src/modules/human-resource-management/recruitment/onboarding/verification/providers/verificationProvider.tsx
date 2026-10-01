"use client";

import type { DocumentDecisionInput } from "../types/document-verification.schema";
import type {
  QueueAggregate,
  VerificationDecisionInput,
  VerificationQueueResponse,
} from "../types/verification-queue.schema";

// verificationProvider.tsx — client fetch layer for the verification queue.
// Thin context provider mirroring the hub profileProvider shape: queue
// aggregate + decision mutations with error + refetch-retry.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface VerificationFetchContextType {
  queue: QueueAggregate | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  decide: (
    input: VerificationDecisionInput
  ) => Promise<{ success: boolean; message?: string }>;
  decideDocument: (
    input: DocumentDecisionInput
  ) => Promise<{ success: boolean; message?: string }>;
}

const VerificationFetchContext = createContext<
  VerificationFetchContextType | undefined
>(undefined);

const QUEUE_BASE = "/api/hrm/onboarding/verifications";

async function readQueue(res: Response): Promise<VerificationQueueResponse> {
  return (await res.json().catch(() => null)) as VerificationQueueResponse;
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

  const decideDocument = useCallback(
    async (input: DocumentDecisionInput) => {
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

  return (
    <VerificationFetchContext.Provider
      value={{
        queue,
        isLoading,
        isError,
        error,
        refetch: fetchData,
        decide,
        decideDocument,
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
