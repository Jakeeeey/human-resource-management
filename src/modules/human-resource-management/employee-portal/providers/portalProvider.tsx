"use client";

// portalProvider.tsx — client fetch layer for the hiree-scoped portal API.
// Thin context provider mirroring the hub profileProvider shape: session +
// checklist + link with loading/error flags. Uploads travel ONLY
// via the application-form upload canon (`uploadApplicationFile` — kind/
// size/mime server-validated, folder-routed); the form holds `File|null`
// and this layer persists only the returned `data.id` UUID via the link
// route. DIRECTUS_STATIC_TOKEN never reaches the browser (server hydration
// only — every fetch below hits our own Next routes).
// Signing envelopes are NOT fetched here (Todo 19) — kiosk signing runs on
// the HR-operated signing desk (`hrm/onboarding/signing`).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { PortalChecklistItem } from "@/modules/human-resource-management/employee-portal/types/portal-checklist.schema";
import { uploadApplicationFile } from "@/modules/human-resource-management/application-form/providers/fetchProvider";

interface PortalSession {
  profile_id: number;
  employee_id: number;
}

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

function scopeHeaders(session: PortalSession | null): Record<string, string> {
  if (!session) return {};
  return {
    "x-actor-role": "hiree",
    "x-hiree-profile-id": String(session.profile_id),
  };
}

export function PortalFetchProvider({
  initialProfileId,
  children,
}: {
  initialProfileId: number | null;
  children: React.ReactNode;
}): React.ReactNode {
  const [session, setSession] = useState<PortalSession | null>(
    initialProfileId !== null
      ? { profile_id: initialProfileId, employee_id: 0 }
      : null
  );
  const [checklist, setChecklist] = useState<PortalChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsError(false);
      let active: PortalSession | null = session;
      if (!active) {
        const sessionRes = await fetch(`${BASE}/session`, { cache: "no-store" });
        const sessionBody = await readJson(sessionRes);
        if (!sessionRes.ok || !sessionBody.success) {
          throw new Error(
            (sessionBody.message as string) || "Hiree session not found"
          );
        }
        const data = sessionBody.data as PortalSession;
        active = { profile_id: data.profile_id, employee_id: data.employee_id };
        setSession(active);
      }
      const headers = scopeHeaders(active);
      const checklistRes = await fetch(`${BASE}/checklist?profile_id=${active?.profile_id}`, {
        cache: "no-store",
        headers,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        headers: { "Content-Type": "application/json", ...scopeHeaders(session) },
        body: JSON.stringify({
          profile_id: session.profile_id,
          doc_key: docKey,
          file_id: fileId,
        }),
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
