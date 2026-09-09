// completionChecklist.ts — pdf §10 completion checklist (Todo 14).
//
// Pure logic — safe for route + client + harness use. This module READS the
// predicates owned by Todos 5/10-13 and never redefines them:
// - Todo 5 owns the status machine (`statusRank` — ranks are the proof that
//   docs were submitted and HR verified; unknown status answers false).
// - Todo 10 owns verification evidence (the approve decision IS the proof;
//   a `RETURNED` current_stage marker means verification is NOT done — the
//   row reads as DOCUMENTS_SUBMITTED until resubmitted + approved).
// - Todo 13 owns equipment truth (`buildEquipmentItemStates` +
//   `isFullyEquipped` — THE single definition, imported, never copied).
// - Todo 11 owns orientation truth (the route feeds `orientationDone` from
//   `isOrientationDone`; this runner only positions it in §10 order).
// - Todo 12 owns training truth (assignment rows; completed-only counts).
// - Todo 10 owns the ack store (namespaced `onboarding:profile:<id>` rows;
//   equipment `equipment:*` rows share the table but never match the prefix).
//
// Fixed §10 order (never reordered): docs → HR verify → profile → access →
// equipment → orientations → training → ack.

import type { DispatchCtx } from "../../recruitment/mailing/utils/dispatchMail";
import {
  buildEquipmentItemStates,
  isFullyEquipped,
} from "../equipment/equipmentPredicate";
import { statusRank } from "../hub/statusMachine";
import type { OnboardingStatus } from "../hub/types/onboarding-profile.schema";

/** The four owner-sanctioned onboarding event keys (Todo 1c §2 — must match
 *  `FROZEN_EVENT_KEYS` in dispatchMail.ts exactly; the frozen-enum diff
 *  assert in the Todo 14 evidence guards drift). */
export const ONBOARDING_EVENT_KEYS = [
  "onboarding.profile_created",
  "onboarding.docs_verified",
  "onboarding.training_completed",
  "onboarding.completed",
] as const;

export type OnboardingEventKey = (typeof ONBOARDING_EVENT_KEYS)[number];

/** §10 checklist keys in fixed order. */
export const COMPLETION_CHECKLIST_ORDER = [
  "docs",
  "hr_verify",
  "profile",
  "access",
  "equipment",
  "orientations",
  "training",
  "ack",
] as const;

export type CompletionItemKey = (typeof COMPLETION_CHECKLIST_ORDER)[number];

/** Pdf §9 catalog keys that carry the "access" meaning (email account +
 *  system access, both IT-issued). A strict subset of the FULLY_EQUIPPED
 *  set, so equipment-done always implies access-done. */
export const ACCESS_ITEM_KEYS = ["email", "system_access"] as const;

export interface CompletionProfileLike {
  id: number;
  employee_id: number;
  application_id: number | null;
  status: OnboardingStatus | string;
  current_stage: string | null;
  offer_accepted: boolean;
}

export interface CompletionInputs {
  profile: CompletionProfileLike;
  /** Raw `doc_ref` values from `acknowledgement_logs` for this hire
   *  (equipment `issue:` + `ack:` rows — the predicate sorts them). */
  equipmentDocRefs: readonly unknown[];
  /** Catalog membership flags (route loads via `loadServerEquipmentCatalog`
   *  and passes `{ key, required }` — seed stays in Todo 13's hands). */
  equipmentCatalog: readonly { key: string; required: boolean }[];
  /** Todo 11 verdict for this hire (`isOrientationDone(profileId)`). */
  orientationDone: boolean;
  /** Raw `status` strings of this hire's `training_assignments` rows. */
  trainingStatuses: readonly string[];
  /** Count of `acknowledgement_logs` rows in the exact
   *  `onboarding:profile:<id>[:suffix]` namespace (Todo 10 store). */
  ackCount: number;
}

export interface ChecklistItem {
  key: CompletionItemKey;
  label: string;
  done: boolean;
  detail: string;
}

/**
 * Runs the §10 checklist in fixed order. Every item answers from evidence
 * owned elsewhere; nothing here writes, fetches, or re-derives a predicate.
 */
export function runCompletionChecklist(input: CompletionInputs): ChecklistItem[] {
  const { profile } = input;
  const rank = statusRank(profile.status as OnboardingStatus);
  const submittedRank = statusRank("DOCUMENTS_SUBMITTED");
  const verifiedRank = statusRank("HR_VERIFIED");
  const known = rank >= 0;

  const docsDone = known && rank >= submittedRank;

  const returned =
    typeof profile.current_stage === "string" &&
    profile.current_stage.startsWith("RETURNED");
  const hrVerifyDone = known && rank >= verifiedRank && !returned;

  const profileDone = profile.offer_accepted === true;

  const states = buildEquipmentItemStates(
    profile.id,
    input.equipmentCatalog,
    input.equipmentDocRefs
  );
  const accessStates = states.filter((s) =>
    (ACCESS_ITEM_KEYS as readonly string[]).includes(s.itemKey)
  );
  const accessDone =
    accessStates.length === ACCESS_ITEM_KEYS.length &&
    accessStates.every((s) => s.issued && s.acked);
  const equipmentDone = isFullyEquipped(states);

  const orientationsDone = input.orientationDone === true;

  const total = input.trainingStatuses.length;
  const completedCount = input.trainingStatuses.filter((s) => s === "completed").length;
  const trainingDone = total > 0 && completedCount === total;

  const ackDone = input.ackCount > 0;

  return [
    {
      key: "docs",
      label: "Required documents submitted",
      done: docsDone,
      detail: docsDone
        ? `Profile is ${profile.status}`
        : `Profile is ${profile.status} — documents not yet submitted`,
    },
    {
      key: "hr_verify",
      label: "HR verification approved",
      done: hrVerifyDone,
      detail: returned
        ? "Returned for resubmit — resubmit and HR approval still pending"
        : hrVerifyDone
          ? `Profile is ${profile.status}`
          : `Profile is ${profile.status} — HR approval still pending`,
    },
    {
      key: "profile",
      label: "Offer-acceptance record on profile",
      done: profileDone,
      detail: profileDone
        ? "Offer accepted"
        : "Offer-acceptance record missing (offer_accepted is false)",
    },
    {
      key: "access",
      label: "System access provisioned (email + system access)",
      done: accessDone,
      detail: accessDone
        ? "Email account and system access issued and acknowledged"
        : "Email account / system access handover incomplete",
    },
    {
      key: "equipment",
      label: "Equipment fully issued and acknowledged",
      done: equipmentDone,
      detail: equipmentDone
        ? "All required §9 items issued and acknowledged"
        : "Required equipment items still open",
    },
    {
      key: "orientations",
      label: "Company + department orientations complete",
      done: orientationsDone,
      detail: orientationsDone
        ? "All required orientation topics checked off"
        : "Orientation topics still unchecked",
    },
    {
      key: "training",
      label: "Assigned training completed",
      done: trainingDone,
      detail:
        total === 0
          ? "No training assigned to this hire"
          : trainingDone
            ? `${completedCount}/${total} assignments completed`
            : `${total - completedCount} of ${total} assignments still open`,
    },
    {
      key: "ack",
      label: "Hiree acknowledgement recorded",
      done: ackDone,
      detail: ackDone
        ? `${input.ackCount} acknowledgement row(s) on file`
        : "No acknowledgement rows for this hire",
    },
  ];
}

/** Items still blocking completion, in §10 order (the refuse-with-list payload). */
export function missingChecklistItems(items: readonly ChecklistItem[]): ChecklistItem[] {
  return items.filter((item) => !item.done);
}

/** True iff every §10 item passes. */
export function isCompletionReady(items: readonly ChecklistItem[]): boolean {
  return items.length === COMPLETION_CHECKLIST_ORDER.length &&
    items.every((item) => item.done);
}

/**
 * Dedup key for onboarding notifications: `<profile_id>:<transition>`
 * (e.g. `42:onboarding.completed`). Passed as the explicit
 * `idempotency_key` so a re-fire collapses to `duplicate` — exactly one
 * notification per transition, mirroring dispatchMail's duplicate-key path.
 */
export function buildCompletionDedupKey(
  profileId: number,
  transition: OnboardingEventKey
): string {
  return `${profileId}:${transition}`;
}

/**
 * Builds the dispatch context for an onboarding transition. The
 * `application_id` bridge resolves HR-explicit first; when the hire has no
 * bridge the synthetic `onboarding:<profileId>` id is used — it can never
 * equal a numeric `application` row id, so recipient lookup deterministically
 * misses and dispatch records `skipped` (never a wrong-person send), still
 * under the same dedup key.
 */
export function buildOnboardingDispatchCtx(
  profile: Pick<CompletionProfileLike, "id" | "employee_id" | "application_id">,
  eventKey: OnboardingEventKey,
  status: string
): DispatchCtx {
  const bridge =
    typeof profile.application_id === "number" && profile.application_id > 0
      ? profile.application_id
      : `onboarding:${profile.id}`;
  return {
    event_key: eventKey,
    application_id: bridge,
    vars: {
      profile_id: String(profile.id),
      employee_id: String(profile.employee_id),
      status,
    },
    idempotency_key: buildCompletionDedupKey(profile.id, eventKey),
  };
}
