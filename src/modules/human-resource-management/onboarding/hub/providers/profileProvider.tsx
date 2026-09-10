"use client";

import type {
  CreateOnboardingProfileInput,
  OnboardingProfile,
  OnboardingProfileResponse,
  UpdateOnboardingProfileInput,
} from "../types/onboarding-profile.schema";

// profileProvider.tsx — client fetch layer for the profiles API routes.
// Thin context provider mirroring the quiz-management fetchProvider shape:
// list + get + create + update + refetch with loading/error flags.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface OnboardingProfileFetchContextType {
  profiles: OnboardingProfile[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  createProfile: (
    data: CreateOnboardingProfileInput
  ) => Promise<OnboardingProfile | null>;
  updateProfile: (
    id: number,
    data: UpdateOnboardingProfileInput
  ) => Promise<OnboardingProfile | null>;
}

const OnboardingProfileFetchContext = createContext<
  OnboardingProfileFetchContextType | undefined
>(undefined);

const BASE = "/api/hrm/onboarding/profiles";

async function readEnvelope(res: Response): Promise<OnboardingProfileResponse> {
  return (await res.json().catch(() => null)) as OnboardingProfileResponse;
}

export function OnboardingProfileFetchProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  const [profiles, setProfiles] = useState<OnboardingProfile[]>([]);
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
      setProfiles(Array.isArray(body.data) ? body.data : []);
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

  const createProfile = useCallback(
    async (data: CreateOnboardingProfileInput) => {
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
      return (body.data as OnboardingProfile) ?? null;
    },
    [fetchData]
  );

  const updateProfile = useCallback(
    async (id: number, data: UpdateOnboardingProfileInput) => {
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
      return (body.data as OnboardingProfile) ?? null;
    },
    [fetchData]
  );

  return (
    <OnboardingProfileFetchContext.Provider
      value={{
        profiles,
        isLoading,
        isError,
        error,
        refetch: fetchData,
        createProfile,
        updateProfile,
      }}
    >
      {children}
    </OnboardingProfileFetchContext.Provider>
  );
}

export function useOnboardingProfileFetch(): OnboardingProfileFetchContextType {
  const ctx = useContext(OnboardingProfileFetchContext);
  if (!ctx) {
    throw new Error(
      "useOnboardingProfileFetch must be used inside OnboardingProfileFetchProvider"
    );
  }
  return ctx;
}
