"use client";

import type {
  CreatePaperworkTemplateInput,
  PaperworkTemplate,
  PaperworkTemplateResponse,
  UpdatePaperworkTemplateInput,
} from "../types/paperwork-template.schema";

// paperworkTemplateProvider.tsx — client fetch layer for the
// paperwork-templates API routes. Thin context provider mirroring the hub
// profileProvider shape: list + get + create + update + refetch with
// loading/error flags.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface PaperworkTemplateFetchContextType {
  templates: PaperworkTemplate[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  createTemplate: (
    data: CreatePaperworkTemplateInput
  ) => Promise<PaperworkTemplate | null>;
  updateTemplate: (
    id: number,
    data: UpdatePaperworkTemplateInput
  ) => Promise<PaperworkTemplate | null>;
}

const PaperworkTemplateFetchContext = createContext<
  PaperworkTemplateFetchContextType | undefined
>(undefined);

const BASE = "/api/hrm/onboarding/paperwork-templates";

async function readEnvelope(res: Response): Promise<PaperworkTemplateResponse> {
  return (await res.json().catch(() => null)) as PaperworkTemplateResponse;
}

export function PaperworkTemplateFetchProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  const [templates, setTemplates] = useState<PaperworkTemplate[]>([]);
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
      setTemplates(Array.isArray(body.data) ? body.data : []);
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

  const createTemplate = useCallback(
    async (data: CreatePaperworkTemplateInput) => {
      const res = await fetch(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await readEnvelope(res);
      if (!res.ok || !body.success) {
        throw new Error(body?.message || "Create failed");
      }
      await fetchData();
      return (body.data as PaperworkTemplate) ?? null;
    },
    [fetchData]
  );

  const updateTemplate = useCallback(
    async (id: number, data: UpdatePaperworkTemplateInput) => {
      const res = await fetch(`${BASE}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await readEnvelope(res);
      if (!res.ok || !body.success) {
        throw new Error(body?.message || "Update failed");
      }
      await fetchData();
      return (body.data as PaperworkTemplate) ?? null;
    },
    [fetchData]
  );

  return (
    <PaperworkTemplateFetchContext.Provider
      value={{
        templates,
        isLoading,
        isError,
        error,
        refetch: fetchData,
        createTemplate,
        updateTemplate,
      }}
    >
      {children}
    </PaperworkTemplateFetchContext.Provider>
  );
}

export function usePaperworkTemplateFetch(): PaperworkTemplateFetchContextType {
  const ctx = useContext(PaperworkTemplateFetchContext);
  if (!ctx) {
    throw new Error(
      "usePaperworkTemplateFetch must be used inside PaperworkTemplateFetchProvider"
    );
  }
  return ctx;
}
