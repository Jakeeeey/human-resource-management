"use client";

import type {
  StartTrainingAttemptInput,
  SubmitTrainingAttemptInput,
  TrainingActor,
  TrainingTakingAssignment,
  TrainingTakingResponse,
} from "../types/training-taking.schema";
import type {
  StartQuizResponse,
} from "@/modules/human-resource-management/quiz-file-management/quiz-taking/types";
import type { AssignmentCompletionScalars } from "../trainingAssignmentAdapter";

// trainingAssignmentProvider.tsx — client fetch layer for the
// training-assignments API routes. Thin context provider mirroring the
// onboarding profileProvider shape: list + get + create + transition +
// start + submit with loading/error flags. Server hydration only —
// DIRECTUS_STATIC_TOKEN never reaches the browser (all calls go through
// our assignment-scoped routes).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface StartAttemptResult {
  assignment: TrainingTakingAssignment;
  quiz: StartQuizResponse["quiz"];
  questions: StartQuizResponse["questions"];
  resumed: boolean;
}

export interface SubmitAttemptResult {
  assignment: TrainingTakingAssignment;
  attempt_id: number;
  score: number;
  percentage_score: number;
  passed: boolean;
  completion: AssignmentCompletionScalars;
}

export interface AbandonAttemptResult {
  assignment: TrainingTakingAssignment;
  abandoned: boolean;
  reason: string;
}

interface TrainingAssignmentFetchContextType {
  assignments: TrainingTakingAssignment[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  createAssignment: (data: {
    user_id: number;
    quiz_id: number;
    due?: string | null;
    application_id?: number | null;
  }) => Promise<TrainingTakingAssignment | null>;
  startAttempt: (
    assignmentId: number,
    input: StartTrainingAttemptInput
  ) => Promise<StartAttemptResult>;
  submitAttempt: (
    assignmentId: number,
    input: SubmitTrainingAttemptInput
  ) => Promise<SubmitAttemptResult | AbandonAttemptResult>;
}

const TrainingAssignmentFetchContext = createContext<
  TrainingAssignmentFetchContextType | undefined
>(undefined);

const BASE = "/api/hrm/onboarding/training-assignments";

async function readEnvelope(res: Response): Promise<TrainingTakingResponse> {
  return (await res.json().catch(() => null)) as TrainingTakingResponse;
}

function throwIfFailed(res: Response, body: TrainingTakingResponse): void {
  if (!res.ok || !body.success) {
    throw new Error(body?.message || `Request failed (${res.status})`);
  }
}

export function TrainingAssignmentFetchProvider({
  children,
  userId,
}: {
  children: React.ReactNode;
  userId?: number;
}): React.ReactNode {
  const [assignments, setAssignments] = useState<TrainingTakingAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsError(false);
      const params = new URLSearchParams();
      if (userId !== undefined) params.set("user_id", String(userId));
      const suffix = params.size > 0 ? `?${params.toString()}` : "";
      const res = await fetch(`${BASE}${suffix}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Fetch failed");
      const body = await readEnvelope(res);
      setAssignments(Array.isArray(body.data) ? (body.data as TrainingTakingAssignment[]) : []);
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const createAssignment = useCallback(
    async (data: {
      user_id: number;
      quiz_id: number;
      due?: string | null;
      application_id?: number | null;
    }) => {
      const res = await fetch(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await readEnvelope(res);
      throwIfFailed(res, body);
      await fetchData();
      return (body.data as TrainingTakingAssignment) ?? null;
    },
    [fetchData]
  );

  const startAttempt = useCallback(async (
    assignmentId: number,
    input: StartTrainingAttemptInput
  ): Promise<StartAttemptResult> => {
    const res = await fetch(`${BASE}/${assignmentId}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = await readEnvelope(res);
    throwIfFailed(res, body);
    await fetchData();
    return body.data as StartAttemptResult;
  }, [fetchData]);

  const submitAttempt = useCallback(async (
    assignmentId: number,
    input: SubmitTrainingAttemptInput
  ): Promise<SubmitAttemptResult | AbandonAttemptResult> => {
    const res = await fetch(`${BASE}/${assignmentId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = await readEnvelope(res);
    throwIfFailed(res, body);
    await fetchData();
    return body.data as SubmitAttemptResult | AbandonAttemptResult;
  }, [fetchData]);

  return (
    <TrainingAssignmentFetchContext.Provider
      value={{
        assignments,
        isLoading,
        isError,
        error,
        refetch: fetchData,
        createAssignment,
        startAttempt,
        submitAttempt,
      }}
    >
      {children}
    </TrainingAssignmentFetchContext.Provider>
  );
}

export function useTrainingAssignmentFetch(): TrainingAssignmentFetchContextType {
  const ctx = useContext(TrainingAssignmentFetchContext);
  if (!ctx) {
    throw new Error(
      "useTrainingAssignmentFetch must be used inside TrainingAssignmentFetchProvider"
    );
  }
  return ctx;
}

export type { TrainingActor };
