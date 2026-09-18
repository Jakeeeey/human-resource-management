import { z } from "zod";

import {
  APPLICANT_STATUS,
  ApplicantStatusSchema,
  type ApplicantStatus,
} from "@/modules/human-resource-management/onboarding/types/applicant-status";
import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

// applicant-status-service.ts — the SINGLE writer of `applicant.status`
// (todo 2 of onboarding-hub-replan). Every module that advances or closes an
// applicant MUST call `setApplicantStatus`; no other module may PATCH
// `applicant.status` directly, and nobody may write the dropped
// `application.status` column. There is NO history/event table — the current
// `applicant.status` value is the whole truth, and ALLOWED_TRANSITIONS below
// is the only place transitions are defined.
//
// This service is ALSO the single writer of `applicant.manpower_request_id`:
// the stamp is written atomically with the `final_approved` transition from the
// applicant's approved manpower recommendation. Provenance — set-once, never
// cleared (a null/undefined stamp is never written).

export { APPLICANT_STATUS, ApplicantStatusSchema };
export type { ApplicantStatus };

/**
 * Canonical ALLOWED-TRANSITION table for `applicant.status` (stored
 * snake_case values). Each key lists the ONLY states the applicant may move
 * to from that state; an empty array marks a terminal state.
 *
 * Pipeline: `submitted` -> `quiz_completed` -> `initial_interview` ->
 * `verdict_pending` -> `recommended` -> `final_interview` -> `final_approved`
 * -> `for_signing` -> `incomplete` -> `hired`, plus `for_signing` -> `hired`
 * directly (offer + all items complete in one step). Applicant declines the
 * offer -> `withdrawn`; HR rejects/withdraws -> `rejected`; offer expires ->
 * `rejected` (batched). From ANY non-terminal state -> `rejected` or
 * `withdrawn`; `incomplete` -> `hired` | `withdrawn` (plus `rejected` via the
 * non-terminal rule). NO backward transitions and no skipped stages.
 */
export const ALLOWED_TRANSITIONS: Record<ApplicantStatus, readonly ApplicantStatus[]> = {
  draft: ["submitted", "rejected", "withdrawn"],
  submitted: ["quiz_completed", "rejected", "withdrawn"],
  quiz_completed: ["initial_interview", "rejected", "withdrawn"],
  initial_interview: ["verdict_pending", "rejected", "withdrawn"],
  verdict_pending: ["recommended", "rejected", "withdrawn"],
  recommended: ["final_interview", "rejected", "withdrawn"],
  final_interview: ["final_approved", "rejected", "withdrawn"],
  final_approved: ["for_signing", "rejected", "withdrawn"],
  for_signing: ["incomplete", "hired", "rejected", "withdrawn"],
  incomplete: ["hired", "rejected", "withdrawn"],
  hired: [],
  rejected: [],
  withdrawn: [],
};

/** Error codes thrown by this service — callers branch on the prefix. */
export const APPLICANT_STATUS_ERROR_CODES = {
  invalidInput: "APPLICANT_STATUS_INVALID_INPUT",
  readFailed: "APPLICANT_STATUS_READ_FAILED",
  unknownCurrent: "APPLICANT_STATUS_UNKNOWN_CURRENT",
  transitionNotAllowed: "APPLICANT_STATUS_TRANSITION_NOT_ALLOWED",
  writeFailed: "APPLICANT_STATUS_WRITE_FAILED",
} as const;

/** `setApplicantStatus` input: applicant row id + target status + optional one-time stamp. */
export const SetApplicantStatusParamsSchema = z.object({
  applicantId: z.number().int().positive(),
  status: ApplicantStatusSchema,
  manpowerRequestId: z.number().int().positive().optional(),
});

export type SetApplicantStatusParams = z.infer<typeof SetApplicantStatusParamsSchema>;

/** Directus row shape returned by the status read/write round-trip. */
export const ApplicantStatusRowSchema = z.looseObject({
  id: z.number().int().positive(),
  status: ApplicantStatusSchema,
  manpower_request_id: z.number().int().positive().nullable().optional(),
});

export type ApplicantStatusRow = z.infer<typeof ApplicantStatusRowSchema>;

const DIRECTUS_COLLECTION = "applicant";

const DirectusErrorBodySchema = z.object({
  errors: z.array(z.object({ message: z.string() })).min(1),
});

function directusErrorMessage(body: unknown): string | null {
  const parsed = DirectusErrorBodySchema.safeParse(body);
  if (!parsed.success) return null;
  return parsed.data.errors.map((error) => error.message).join("; ");
}

function unwrapData(body: unknown): unknown {
  if (typeof body === "object" && body !== null && "data" in body) {
    return body.data;
  }
  return undefined;
}

async function readApplicantRow(applicantId: number): Promise<ApplicantStatusRow> {
  const body: unknown = await dFetch(
    `/items/${DIRECTUS_COLLECTION}/${applicantId}?fields=id,status,manpower_request_id`
  );
  const errorMessage = directusErrorMessage(body);
  if (errorMessage) {
    throw new Error(
      `${APPLICANT_STATUS_ERROR_CODES.readFailed}: applicant ${applicantId} could not be read (${errorMessage})`
    );
  }
  const parsed = ApplicantStatusRowSchema.safeParse(unwrapData(body));
  if (!parsed.success) {
    throw new Error(
      `${APPLICANT_STATUS_ERROR_CODES.unknownCurrent}: applicant ${applicantId} has no readable status (${parsed.error.issues
        .map((issue) => issue.message)
        .join("; ")})`
    );
  }
  return parsed.data;
}

async function patchApplicantStatus(
  applicantId: number,
  status: ApplicantStatus,
  manpowerRequestId?: number
): Promise<ApplicantStatusRow> {
  const body: unknown = await dFetch(`/items/${DIRECTUS_COLLECTION}/${applicantId}`, {
    method: "PATCH",
    body: JSON.stringify(
      manpowerRequestId === undefined
        ? { status }
        : { status, manpower_request_id: manpowerRequestId }
    ),
  });
  const errorMessage = directusErrorMessage(body);
  if (errorMessage) {
    throw new Error(
      `${APPLICANT_STATUS_ERROR_CODES.writeFailed}: applicant ${applicantId} -> ${status} was rejected by Directus (${errorMessage})`
    );
  }
  const parsed = ApplicantStatusRowSchema.safeParse(unwrapData(body));
  if (!parsed.success || parsed.data.status !== status) {
    throw new Error(
      `${APPLICANT_STATUS_ERROR_CODES.writeFailed}: applicant ${applicantId} write-back mismatch for ${status}`
    );
  }
  return parsed.data;
}

/**
 * Runtime guard for the transition table — true when `from` may legally move
 * to `to`. Same-status calls are handled by `setApplicantStatus` as an
 * idempotent no-op, so this returns false for `from === to`.
 * @param from - Current `applicant.status`.
 * @param to - Target `applicant.status`.
 * @returns Whether the transition is allowed.
 */
export function canTransition(from: ApplicantStatus, to: ApplicantStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/**
 * THE single writer of `applicant.status` (and of the `final_approved`
 * `manpower_request_id` stamp). Validates the payload locally (malformed
 * ids/values are rejected BEFORE any network call), reads the applicant's
 * current status, enforces `ALLOWED_TRANSITIONS`, then PATCHes Directus
 * `PATCH /items/applicant/{id}` and returns the read-back row. The optional
 * `manpowerRequestId` is written ONLY when provided — it is set-once
 * provenance and is never cleared. Re-calling with the CURRENT status is an
 * idempotent no-op (safe for retries/resume — no PATCH is issued), unless a
 * differing `manpowerRequestId` is supplied, in which case only the stamp is
 * PATCHed.
 * @param params - `{ applicantId, status, manpowerRequestId? }` (applicant row
 * id + target status + optional one-time `manpower_request_id` stamp).
 * @returns The Directus read-back row (`{ id, status, manpower_request_id, ... }`).
 * @throws Error with a code from `APPLICANT_STATUS_ERROR_CODES` on invalid
 * input, unreadable/unparseable current status, disallowed transition, or
 * Directus write failure.
 */
export async function setApplicantStatus(
  params: SetApplicantStatusParams
): Promise<ApplicantStatusRow> {
  const validation = SetApplicantStatusParamsSchema.safeParse(params);
  if (!validation.success) {
    const issues = validation.error.issues
      .map((issue) => `${issue.path.join(".") || "params"}: ${issue.message}`)
      .join("; ");
    throw new Error(`${APPLICANT_STATUS_ERROR_CODES.invalidInput}: ${issues}`);
  }

  const { applicantId, status, manpowerRequestId } = validation.data;
  const current = await readApplicantRow(applicantId);

  if (current.status === status) {
    if (manpowerRequestId === undefined || manpowerRequestId === current.manpower_request_id) {
      return current;
    }
    return patchApplicantStatus(applicantId, status, manpowerRequestId);
  }

  if (!canTransition(current.status, status)) {
    throw new Error(
      `${APPLICANT_STATUS_ERROR_CODES.transitionNotAllowed}: ${current.status} -> ${status} is not an allowed applicant.status transition`
    );
  }

  return patchApplicantStatus(applicantId, status, manpowerRequestId);
}

/**
 * Read-only accessor for the current `applicant.status`. Callers use it to
 * decide which ordered transition steps are still applicable (e.g. skip a
 * stage step the applicant already passed) WITHOUT duplicating the transition
 * table or issuing a blind PATCH. Every WRITE still goes exclusively through
 * `setApplicantStatus` (todo 8 consumers).
 * @param applicantId - Applicant row id.
 * @returns The current canonical status value.
 * @throws Error with `APPLICANT_STATUS_ERROR_CODES` on invalid input or an
 * unreadable/unparseable applicant row.
 */
export async function getApplicantStatus(applicantId: number): Promise<ApplicantStatus> {
  const validation = z.number().int().positive().safeParse(applicantId);
  if (!validation.success) {
    throw new Error(
      `${APPLICANT_STATUS_ERROR_CODES.invalidInput}: applicantId: ${validation.error.issues
        .map((issue) => issue.message)
        .join("; ")}`
    );
  }
  const row = await readApplicantRow(validation.data);
  return row.status;
}
