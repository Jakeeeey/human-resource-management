"use client";

// portalProvider.tsx — client fetch layer for the hiree-scoped portal API.
// The identity is resolved SERVER-SIDE from the session cookie
// (`/portal/session`) and echoed back — an applicant before hiring, an
// employee after the hire. The browser no longer asserts any identity header
// and never receives the Directus token (every fetch below hits our own Next
// routes). Signing envelopes are NOT fetched here: kiosk signing runs on the
// HR-operated, applicant-scoped signing desk (`hrm/onboarding/signing`).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type {
  PortalChecklistItem,
  PortalSession,
} from "@/modules/human-resource-management/employee-portal/types/portal-checklist.schema";
import { uploadApplicationFile } from "@/modules/human-resource-management/application-form/providers/fetchProvider";

interface PortalFetchContextType {
  session: PortalSession | null;
  checklist: PortalChecklistItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  uploadDocument: (docKey: string, file: File) => Promise<string>;
}

const PortalFetchContext = createContext<PortalFetchContextType | undefined>(
  undefined
);

const BASE = "/api/hrm/onboarding/portal";

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json().catch(() => null)) as Record<string, unknown>;
}

export function PortalFetchProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  const [session, setSession] = useState<PortalSession | null>(null);
  const [checklist, setChecklist] = useState<PortalChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsError(false);
      const sessionRes = await fetch(`${BASE}/session`, { cache: "no-store" });
      const sessionBody = await readJson(sessionRes);
      if (!sessionRes.ok || !sessionBody.success) {
        throw new Error(
          (sessionBody.message as string) || "Hiree session not found"
        );
      }
      setSession(sessionBody.data as PortalSession);

      const checklistRes = await fetch(`${BASE}/checklist`, {
        cache: "no-store",
      });
      if (!checklistRes.ok) throw new Error("Checklist fetch failed");
      const checklistBody = await readJson(checklistRes);
      setChecklist(
        Array.isArray(checklistBody.data)
          ? (checklistBody.data as PortalChecklistItem[])
          : []
      );
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

  // Upload canon round-trip: form-held File → canon route (server validates
  // kind/size/mime, folder-routed) → UUID → link route persists `data.id`.
  const uploadDocument = useCallback(
    async (docKey: string, file: File): Promise<string> => {
      if (!session) throw new Error("Hiree session not ready");
      const fileId = await uploadApplicationFile(
        file,
        "attachment",
        file.name
      );
      const res = await fetch(`${BASE}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_key: docKey, file_id: fileId }),
      });
      const body = await readJson(res);
      if (!res.ok || !body.success) {
        throw new Error((body.message as string) || "Document link failed");
      }
      await fetchData();
      return fileId;
    },
    [session, fetchData]
  );

  return (
    <PortalFetchContext.Provider
      value={{
        session,
        checklist,
        isLoading,
        isError,
        error,
        refetch: fetchData,
        uploadDocument,
      }}
    >
      {children}
    </PortalFetchContext.Provider>
  );
}

export function usePortalFetch(): PortalFetchContextType {
  const ctx = useContext(PortalFetchContext);
  if (!ctx) {
    throw new Error("usePortalFetch must be used inside PortalFetchProvider");
  }
  return ctx;
}
