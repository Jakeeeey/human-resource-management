// statusMachine.ts — `onboarding_profiles.status` transition machine.
//
// Order is EXACTLY the onboarding.pdf flow (underscored to match the Todo 2
// row shape): FOR_ONBOARDING → … → ONBOARDING_COMPLETED. No invented stages.
// Movement is forward single-step only; leaving a stage requires that
// stage's done-predicate. Predicates owned by later todos (10-13) read
// evidence counts; until those todos wire real counts they answer false,
// which is the safe default (status advances only when predicates pass).
// Pure logic — no imports, safe for route + client + harness use.

import type { OnboardingProfile } from "./types/onboarding-profile.schema";
import { ONBOARDING_STATUSES } from "./types/onboarding-profile.schema";
import type { OnboardingStatus } from "./types/onboarding-profile.schema";

/** Canonical forward order of the machine (index = rank). */
export const STATUS_ORDER: readonly OnboardingStatus[] = ONBOARDING_STATUSES;

/** Evidence counts feeding per-stage done-predicates (later todos wire). */
export interface StageEvidence {
  offerAccepted: boolean;
  documentsSubmitted: boolean;
  documentsVerified: boolean;
  orientationDone: boolean;
  trainingStarted: boolean;
  trainingDone: boolean;
  equipmentDone: boolean;
}

export function emptyEvidence(): StageEvidence {
  return {
    offerAccepted: false,
    documentsSubmitted: false,
    documentsVerified: false,
    orientationDone: false,
    trainingStarted: false,
    trainingDone: false,
    equipmentDone: false,
  };
}

/** Evidence derived from a profile row alone (Directus booleans read 0/1). */
export function evidenceFromProfile(
  profile: Pick<OnboardingProfile, "offer_accepted">
): StageEvidence {
  return { ...emptyEvidence(), offerAccepted: profile.offer_accepted === true };
}

export function isKnownStatus(value: unknown): value is OnboardingStatus {
  return (
    typeof value === "string" &&
    (STATUS_ORDER as readonly string[]).includes(value)
  );
}

export function statusRank(status: OnboardingStatus): number {
  return STATUS_ORDER.indexOf(status);
}

/** True iff `to` is exactly the next stage after `from` (no skip-ahead). */
export function isNextStage(
  from: OnboardingStatus,
  to: OnboardingStatus
): boolean {
  return statusRank(to) === statusRank(from) + 1;
}

// Per-stage done-predicates: may the row LEAVE `stage`?
// - FOR_ONBOARDING → offer-acceptance record feeds creation (Todo 5 owns).
// - DOCUMENTS_PENDING → submission checklist (Todo 9 portal owns).
// - DOCUMENTS_SUBMITTED → verification queue (Todo 10 owns).
// - HR_VERIFIED / PRE_BOARDING_IN_PROGRESS → the state itself is the proof
//   (entry already proved verification); exit is an HR drive-forward action.
// - ORIENTATION_COMPLETED → the state itself asserts both tracks done
//   (Todo 11 owns entry via its own both-tracks predicate); exit is free.
// - TRAINING_ASSIGNED → taking started (Todo 12 owns over the Todo 4 adapter).
// - TRAINING_IN_PROGRESS → taking passed/completed (Todo 12 owns).
// - TRAINING_COMPLETED / FULLY_EQUIPPED → the state itself is the proof
//   (Todos 12/13 own entry); the Todo 14 orchestrator re-checks the full
//   §10 checklist before writing ONBOARDING_COMPLETED.
// - ONBOARDING_COMPLETED is terminal.
const DONE_PREDICATES: Record<OnboardingStatus, (e: StageEvidence) => boolean> =
  {
    FOR_ONBOARDING: (e) => e.offerAccepted,
    DOCUMENTS_PENDING: (e) => e.documentsSubmitted,
    DOCUMENTS_SUBMITTED: (e) => e.documentsVerified,
    HR_VERIFIED: () => true,
    PRE_BOARDING_IN_PROGRESS: () => true,
    ORIENTATION_COMPLETED: () => true,
    TRAINING_ASSIGNED: (e) => e.trainingStarted,
    TRAINING_IN_PROGRESS: (e) => e.trainingDone,
    TRAINING_COMPLETED: () => true,
    FULLY_EQUIPPED: () => true,
    ONBOARDING_COMPLETED: () => false,
  };

/** Done-predicate for leaving `stage` under `evidence`. */
export function isStageDone(
  stage: OnboardingStatus,
  evidence: StageEvidence
): boolean {
  return DONE_PREDICATES[stage](evidence);
}

export type TransitionCheck =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Gates a status transition.
 * @param from - Current row status (must be known).
 * @param to - Requested target status (must be known).
 * @param evidence - Stage evidence counts.
 * @returns `{ ok: true }` or `{ ok: false, reason }` (reason is 400-safe).
 */
export function checkTransition(
  from: OnboardingStatus,
  to: OnboardingStatus,
  evidence: StageEvidence
): TransitionCheck {
  if (from === to) return { ok: true };
  if (!isNextStage(from, to)) {
    return {
      ok: false,
      reason: `Transition ${from} → ${to} is not a single forward step`,
    };
  }
  if (!isStageDone(from, evidence)) {
    return {
      ok: false,
      reason: `Stage ${from} is not complete (done-predicate false)`,
    };
  }
  return { ok: true };
}
