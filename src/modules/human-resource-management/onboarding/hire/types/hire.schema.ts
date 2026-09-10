import { z } from "zod";

import { ApplicantStatusSchema } from "@/modules/human-resource-management/onboarding/types/applicant-status";

// hire.schema.ts — typed boundary for the post-hire orchestrator (todo 16).
//
// The orchestrator runs when todo 15 fires `applicant.status = "hired"` and
// turns that transition into the Spring employee (`user`) plus every
// registered post-hire step (todos 17/19), all keyed to the returned
// `user_id` — there is NO applicant↔user / job_offer↔user correlation column.

/** `applicant` fields the orchestrator reads (subset + current status). */
export const HireApplicantRowSchema = z.looseObject({
  id: z.number().int().positive(),
  full_name: z.string().nullish(),
  position_applied_for: z.string().nullish(),
  status: ApplicantStatusSchema,
});

export type HireApplicantRow = z.infer<typeof HireApplicantRowSchema>;

/**
 * `application` fields the orchestrator reads. The application is the ONLY
 * source of the hiree's personal data (applicant is decoupled) and the ONLY
 * place the email for the idempotent user lookup comes from.
 */
export const HireApplicationRowSchema = z.looseObject({
  id: z.number().int().positive(),
  applicant_id: z.number().int().positive(),
  first_name: z.string().nullish(),
  middle_name: z.string().nullish(),
  last_name: z.string().nullish(),
  nickname: z.string().nullish(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  address: z.string().nullish(),
  position_applied_for: z.string().nullish(),
  birthdate: z.string().nullish(),
  sex: z.string().nullish(),
  civil_status: z.string().nullish(),
  religion: z.string().nullish(),
  sss_no: z.string().nullish(),
  tin: z.string().nullish(),
  philhealth_no: z.string().nullish(),
  pagibig_no: z.string().nullish(),
});

export type HireApplicationRow = z.infer<typeof HireApplicationRowSchema>;

export const HireOrchestrationInputSchema = z
  .object({
    applicantId: z.number().int().positive(),
    /**
     * Optional Spring JWT override. Production callers (the signing routes)
     * omit it and the orchestrator reads the request's `vos_access_token`
     * cookie; direct server-side invocations may pass a token explicitly.
     */
    authToken: z.string().min(1).optional(),
  })
  .strict();

export type HireOrchestrationInput = z.infer<
  typeof HireOrchestrationInputSchema
>;

/** Error codes thrown anywhere in the hire-orchestrator module family. */
export const HIRE_ORCHESTRATOR_ERROR_CODES = {
  invalidInput: "HIRE_INVALID_INPUT",
  readFailed: "HIRE_READ_FAILED",
  applicantNotFound: "HIRE_APPLICANT_NOT_FOUND",
  applicantNotHired: "HIRE_APPLICANT_NOT_HIRED",
  applicationNotFound: "HIRE_APPLICATION_NOT_FOUND",
  emailMissing: "HIRE_EMAIL_MISSING",
  positionMissing: "HIRE_POSITION_MISSING",
  userCreateFailed: "HIRE_USER_CREATE_FAILED",
  userVerifyFailed: "HIRE_USER_VERIFY_FAILED",
  stepFailed: "HIRE_STEP_FAILED",
} as const;

/**
 * Context handed to every registered post-hire step. Steps receive the
 * resolved employee id — that IS the correlation between the applicant
 * workflow and the employee workflow, which is why no DB column is needed
 * (the orchestrator resolves/creates the user first and passes it down).
 */
export interface HireCompletionContext {
  applicantId: number;
  applicationId: number;
  userId: number;
  /** True when THIS orchestration run created the Spring user; false = reused. */
  userCreated: boolean;
  email: string;
}

/** Outcome a post-hire step reports. `ok:false` fails the whole run. */
export interface HireCompletionStepResult {
  step: string;
  ok: boolean;
  detail?: string;
}

/**
 * SEAM CONTRACT (todos 17/19): a post-hire step is an idempotent async
 * function. Todos 17 (signed-PDF filing) and 19 (onboarding_task
 * materialization) each register exactly one step through
 * `registerHireCompletionStep` in `onboarding/hire/server/hire-steps.ts`.
 * Steps run in registration order AFTER the user exists; every step MUST be
 * safe to re-run with the same context (the orchestrator re-runs on retry).
 */
export type HireCompletionStep = (
  context: HireCompletionContext
) => Promise<HireCompletionStepResult>;

export interface HireOrchestrationResult {
  applicantId: number;
  applicationId: number;
  userId: number;
  userCreated: boolean;
  email: string;
  steps: HireCompletionStepResult[];
}
