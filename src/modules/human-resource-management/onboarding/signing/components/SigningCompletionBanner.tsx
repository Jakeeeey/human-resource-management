"use client";

import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
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
    const failed = completion?.kind === "failed";
    const reason =
      completion?.kind === "blocked" || completion?.kind === "failed"
        ? humanizeCompletionReason(completion.reason)
        : "the employee record has not been created yet";
    return (
      <Alert
        className={
          failed
            ? undefined
            : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
        }
        variant={failed ? "destructive" : "default"}
      >
        {failed ? (
          <AlertCircle className="h-4 w-4" />
        ) : (
          <Clock className="h-4 w-4" />
        )}
        <AlertTitle>
          {blocked
            ? "Completion blocked"
            : failed
              ? "Signed — employee creation failed"
              : "Completion pending"}
        </AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          <span>
            {blocked &&
              `The documents are signed, but ${reason}. Add it on the application, then retry completion.`}
            {failed &&
              `The documents are signed and the applicant is hired, but ${reason}. Retry completion to finish the hire.`}
            {!blocked &&
              !failed &&
              `The documents are signed, but ${reason}. Retry completion to finish the hire.`}
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

  const hired = applicantStatus === "hired" || completion?.kind === "hired";
  if (!hired) return null;

  const reused = completion?.kind === "hired" && !completion.userCreated;
  return (
    <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
      <CheckCircle2 className="h-4 w-4" />
      <AlertTitle>Hire finalized</AlertTitle>
      <AlertDescription>
        {completion?.kind === "hired"
          ? `The employee record was ${reused ? "matched to an existing user" : "created"} and the post-hire steps ran.`
          : "This signing set is complete and the applicant is hired — the employee record is in place and the post-hire steps ran."}
      </AlertDescription>
    </Alert>
  );
}
