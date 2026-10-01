"use client";

import { CheckCircle2, Clock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { SigningCompletion } from "../types/contracts";
import {
  completionNeedsAttention,
  humanizeCompletionReason,
  isCompletionPending,
} from "../signingCopy";

// SigningCompletionBanner.tsx — surfaces the hire outcome separately from the
// envelope rollup, so "envelope complete" can never masquerade as a finished
// hire. Blocked/failed states offer a retry that re-runs the completion
// commit (the signed item's evidence is re-submitted unchanged — idempotent).

interface SigningCompletionBannerProps {
  completion: SigningCompletion | null;
  envelopeStatus: string;
  applicantStatus: string | null;
  retrying: boolean;
  onRetry: () => void;
}

export function SigningCompletionBanner({
  completion,
  envelopeStatus,
  applicantStatus,
  retrying,
  onRetry,
}: SigningCompletionBannerProps) {
  const pending = isCompletionPending(envelopeStatus, applicantStatus);
  const attention =
    completionNeedsAttention(completion) || (completion === null && pending);

  if (attention) {
    const blocked = completion?.kind === "blocked";
    const reason =
      completion?.kind === "blocked"
        ? humanizeCompletionReason(completion.reason)
        : "the signing set has not been finalized yet";
    return (
      <Alert
        className={
          "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
        }
        variant="default"
      >
        <Clock className="h-4 w-4" />
        <AlertTitle>
          {blocked ? "Completion blocked" : "Completion pending"}
        </AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          <span>
            {blocked &&
              `The documents are signed, but ${reason}. Add it on the application, then retry completion.`}
            {!blocked &&
              `The documents are signed, but ${reason}. Retry completion to finish the signing.`}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={retrying}
            onClick={onRetry}
            className="min-h-8 w-full sm:w-auto"
          >
            {retrying ? "Retrying…" : "Retry completion"}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const completed =
    applicantStatus === "signing_complete" ||
    completion?.kind === "signing_complete";
  if (!completed) return null;

  return (
    <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
      <CheckCircle2 className="h-4 w-4" />
      <AlertTitle>Signing complete</AlertTitle>
      <AlertDescription>
        {completion?.kind === "signing_complete"
          ? "All required documents are signed and the set is finalized — the applicant is ready for the next onboarding step."
          : "This signing set is complete and the applicant is ready for the next onboarding step."}
      </AlertDescription>
    </Alert>
  );
}
