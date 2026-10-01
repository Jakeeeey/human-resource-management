import { z } from "zod";

import {
  APPLICANT_STATUS,
  ApplicantStatusSchema,
  type ApplicantStatus,
} from "@/modules/human-resource-management/recruitment/onboarding/types/applicant-status";
import { dFetch } from "@/modules/human-resource-management/recruitment/manpower-recommendation/utils/directus";
import { nowUTC } from "@/modules/human-resource-management/recruitment/manpower-recommendation/utils/audit";

export { APPLICANT_STATUS, ApplicantStatusSchema };
export type { ApplicantStatus };

export const ALLOWED_TRANSITIONS: Record<ApplicantStatus, readonly ApplicantStatus[]> = {
  draft: ["submitted", "rejected", "withdrawn"],
  submitted: ["quiz_completed", "rejected", "withdrawn"],
  quiz_completed: ["initial_interview", "rejected", "withdrawn"],
  initial_interview: ["verdict_pending", "rejected", "withdrawn"],
  verdict_pending: ["recommended", "rejected", "withdrawn"],
  recommended: ["final_interview", "rejected", "withdrawn"],
  final_interview: ["final_approved", "rejected", "withdrawn"],
  final_approved: ["for_signing", "rejected", "withdrawn"],
  for_signing: ["incomplete", "signing_complete", "rejected", "withdrawn"],
  incomplete: ["signing_complete", "rejected", "withdrawn"],
  signing_complete: ["for_training", "hired", "rejected", "withdrawn"],
  for_training: ["hired", "rejected", "withdrawn"],
  hired: [],
  rejected: [],
  withdrawn: [],
};

export const APPLICANT_STATUS_ERROR_CODES = {
  invalidInput: "APPLICANT_STATUS_INVALID_INPUT",
  readFailed: "APPLICANT_STATUS_READ_FAILED",
  unknownCurrent: "APPLICANT_STATUS_UNKNOWN_CURRENT",
  transitionNotAllowed: "APPLICANT_STATUS_TRANSITION_NOT_ALLOWED",
  writeFailed: "APPLICANT_STATUS_WRITE_FAILED",
} as const;

export const SetApplicantStatusParamsSchema = z.object({
  applicantId: z.number().int().positive(),
  status: ApplicantStatusSchema,
  manpowerRequestId: z.number().int().positive().optional(),
  actorId: z.number().int().positive().optional(),
});

export type SetApplicantStatusParams = z.infer<typeof SetApplicantStatusParamsSchema>;

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
  manpowerRequestId?: number,
  actorId?: number
): Promise<ApplicantStatusRow> {
  const payload = {
    ...(manpowerRequestId === undefined
      ? { status }
      : { status, manpower_request_id: manpowerRequestId }),
    ...(actorId != null ? { updated_by: actorId } : {}),
    updated_at: nowUTC(),
  };
  const body: unknown = await dFetch(`/items/${DIRECTUS_COLLECTION}/${applicantId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
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

export function canTransition(from: ApplicantStatus, to: ApplicantStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

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

  const { applicantId, status, manpowerRequestId, actorId } = validation.data;
  const current = await readApplicantRow(applicantId);

  if (current.status === status) {
    if (manpowerRequestId === undefined || manpowerRequestId === current.manpower_request_id) {
      return current;
    }
    return patchApplicantStatus(applicantId, status, manpowerRequestId, actorId);
  }

  if (!canTransition(current.status, status)) {
    throw new Error(
      `${APPLICANT_STATUS_ERROR_CODES.transitionNotAllowed}: ${current.status} -> ${status} is not an allowed applicant.status transition`
    );
  }

  return patchApplicantStatus(applicantId, status, manpowerRequestId, actorId);
}

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
