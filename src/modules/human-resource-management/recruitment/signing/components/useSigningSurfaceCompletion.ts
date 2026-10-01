"use client";

import { useEffect, useState } from "react";
import type { SigningCompletion } from "../types/contracts";
import { useSigningEnvelopeFetch } from "../providers/signingEnvelopeProvider";
import { isCompletionPending } from "../signingCopy";

// useSigningSurfaceCompletion.ts — owns the surface's completion state and
// resolves the SPECIFIC hire-block reason on a cold load of a completed set
// whose applicant is not yet hired (S5 re-QA N1). Without this, a reviewer
// opening the set cold saw only the generic "completion pending" copy until
// they pressed Retry. Read-only: the precheck never writes.

interface UseSigningSurfaceCompletionInput {
  applicantId: number;
  envelopeStatus: string;
  applicantStatus: string | null;
}

/**
 * Completion state for one signing surface, seeded from a read-only
 * hire-prerequisite precheck when the set is complete but not yet hired.
 * @param input - Applicant id + envelope/applicant statuses.
 * @returns The current completion (null until known) and its setter, so
 * mutation handlers can replace it with the server's typed outcome.
 */
export function useSigningSurfaceCompletion(
  input: UseSigningSurfaceCompletionInput
) {
  const { previewHireBlockReason } = useSigningEnvelopeFetch();
  const [completion, setCompletion] = useState<SigningCompletion | null>(null);

  useEffect(() => {
    if (completion !== null) return;
    if (!isCompletionPending(input.envelopeStatus, input.applicantStatus)) {
      return;
    }
    let active = true;
    void previewHireBlockReason(input.applicantId)
      .then((reason) => {
        if (active && reason) setCompletion({ kind: "blocked", reason });
      })
      .catch(() => {
        // Best-effort: the generic pending banner + Retry remain available.
      });
    return () => {
      active = false;
    };
  }, [
    completion,
    input.applicantId,
    input.envelopeStatus,
    input.applicantStatus,
    previewHireBlockReason,
  ]);

  return [completion, setCompletion] as const;
}
