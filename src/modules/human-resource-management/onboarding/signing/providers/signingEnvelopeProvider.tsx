"use client";

import type { SigningEnvelopeResponse } from "../types/signing-envelope.schema";
import type { SigningEnvelope } from "../types/signing-envelope.schema";
import type { SigningInk } from "../signingStrokes";

// signingEnvelopeProvider.tsx — client fetch layer for the
// signing-envelopes API routes. Thin context provider mirroring the
// paperworkTemplateProvider shape: list + get + openDraft + saveDraft +
// finish with loading/error flags. Draft vs finish stay distinct calls
// (distinct server writes — never one blurred mutation).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface SigningEnvelopeFetchContextType {
  envelopes: SigningEnvelope[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  getEnvelope: (id: number) => Promise<SigningEnvelope | null>;
  openDraft: (profileId: number, templateId: number, attempt?: number) => Promise<SigningEnvelope | null>;
  saveDraft: (id: number, strokes: string) => Promise<SigningEnvelope | null>;
  finishEnvelope: (
    id: number,
    payload: {
      ink: SigningInk;
      stamps?: { id: string; page: number; x: number; y: number; strokes: { points: { x: number; y: number }[]; width: number; color: string }[] }[];
      pageSizes: Record<number, { width: number; height: number }>;
      actor: { role: "hiree" | "hr"; profile_id: number | null };
    }
  ) => Promise<SigningEnvelope | null>;
}

const SigningEnvelopeFetchContext = createContext<
  SigningEnvelopeFetchContextType | undefined
>(undefined);

const BASE = "/api/hrm/onboarding/signing-envelopes";

async function readEnvelope(res: Response): Promise<SigningEnvelopeResponse> {
  return (await res.json().catch(() => null)) as SigningEnvelopeResponse;
}

export function SigningEnvelopeFetchProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  const [envelopes, setEnvelopes] = useState<SigningEnvelope[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsError(false);
      const res = await fetch(BASE, { cache: "no-store" });
      if (!res.ok) throw new Error("Fetch failed");
      const body = await readEnvelope(res);
      setEnvelopes(Array.isArray(body.data) ? body.data : []);
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

  const getEnvelope = useCallback(async (id: number) => {
    const res = await fetch(`${BASE}/${id}`, { cache: "no-store" });
    const body = await readEnvelope(res);
    if (!res.ok || !body.success) {
      throw new Error(body?.message || "Fetch failed");
    }
    return (body.data as SigningEnvelope) ?? null;
  }, []);

  const openDraft = useCallback(
    async (profileId: number, templateId: number, attempt?: number) => {
      const res = await fetch(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: profileId,
          template_id: templateId,
          attempt,
        }),
      });
      const body = await readEnvelope(res);
      if (!res.ok || !body.success) {
        throw new Error(body?.message || "Open draft failed");
      }
      await fetchData();
      return (body.data as SigningEnvelope) ?? null;
    },
    [fetchData]
  );

  const saveDraft = useCallback(
    async (id: number, strokes: string) => {
      const res = await fetch(`${BASE}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strokes }),
      });
      const body = await readEnvelope(res);
      if (!res.ok || !body.success) {
        throw new Error(body?.message || "Save draft failed");
      }
      await fetchData();
      return (body.data as SigningEnvelope) ?? null;
    },
    [fetchData]
  );

  const finishEnvelope = useCallback(
    async (
      id: number,
      payload: {
        ink: SigningInk;
        stamps?: { id: string; page: number; x: number; y: number; strokes: { points: { x: number; y: number }[]; width: number; color: string }[] }[];
        pageSizes: Record<number, { width: number; height: number }>;
        actor: { role: "hiree" | "hr"; profile_id: number | null };
      }
    ) => {
      const res = await fetch(`${BASE}/${id}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await readEnvelope(res);
      if (!res.ok || !body.success) {
        throw new Error(body?.message || "Finish failed");
      }
      await fetchData();
      return (body.data as SigningEnvelope) ?? null;
    },
    [fetchData]
  );

  return (
    <SigningEnvelopeFetchContext.Provider
      value={{
        envelopes,
        isLoading,
        isError,
        error,
        refetch: fetchData,
        getEnvelope,
        openDraft,
        saveDraft,
        finishEnvelope,
      }}
    >
      {children}
    </SigningEnvelopeFetchContext.Provider>
  );
}

export function useSigningEnvelopeFetch(): SigningEnvelopeFetchContextType {
  const ctx = useContext(SigningEnvelopeFetchContext);
  if (!ctx) {
    throw new Error(
      "useSigningEnvelopeFetch must be used inside SigningEnvelopeFetchProvider"
    );
  }
  return ctx;
}
