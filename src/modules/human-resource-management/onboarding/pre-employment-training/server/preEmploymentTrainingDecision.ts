import { z } from "zod";

import { logHireActivity } from "../../hire/server/hire-log";
import {
  APPLICANT_STATUS_ERROR_CODES,
  getApplicantStatus,
  setApplicantStatus,
  type ApplicantStatus,
} from "@/modules/human-resource-management/shared/services/applicant-status-service";

export const PRE_EMPLOYMENT_TRAINING_DECISION_ERROR_CODES = {
  invalidInput: "PRE_EMPLOYMENT_TRAINING_DECISION_INVALID_INPUT",
  notEligible: "PRE_EMPLOYMENT_TRAINING_DECISION_NOT_ELIGIBLE",
  statusWriteFailed: "PRE_EMPLOYMENT_TRAINING_DECISION_STATUS_WRITE_FAILED",
} as const;

export const DecidePreEmploymentTrainingInputSchema = z
  .object({
    applicantId: z.number().int().positive(),
    decision: z.enum(["pass", "fail"]),
    remarks: z.string().trim().min(1).optional(),
    actorId: z.number().int().positive().optional(),
  })
  .strict();

export type DecidePreEmploymentTrainingInput = z.infer<
  typeof DecidePreEmploymentTrainingInputSchema
>;

export interface PreEmploymentTrainingDecisionResult {
  outcome: "passed" | "failed";
  applicantStatus: ApplicantStatus;
}

function inputError(details: string): Error {
  return new Error(
    `${PRE_EMPLOYMENT_TRAINING_DECISION_ERROR_CODES.invalidInput}: ${details}`
  );
}

function notEligibleError(applicantId: number, current: string): Error {
  return new Error(
    `${PRE_EMPLOYMENT_TRAINING_DECISION_ERROR_CODES.notEligible}: applicant ${applicantId} has status ${current}, a decision requires for_training`
  );
}

function writeFailedError(applicantId: number, detail: string): Error {
  return new Error(
    `${PRE_EMPLOYMENT_TRAINING_DECISION_ERROR_CODES.statusWriteFailed}: applicant ${applicantId} decision write failed (${detail})`
  );
}

function describeDecision(input: {
  applicantId: number;
  outcome: "passed" | "failed";
  from: ApplicantStatus;
  to: ApplicantStatus;
  remarks?: string;
  actorId?: number;
}): string {
  const base =
    input.outcome === "passed"
      ? `pre-employment-training decision: applicant=${input.applicantId} ${input.from} -> ${input.to} (passed)`
      : `pre-employment-training decision: applicant=${input.applicantId} ${input.from} -> ${input.to} (failed, non-acceptance, job offer untouched)`;
  const actor = input.actorId !== undefined ? ` actor=${input.actorId}` : "";
  const remarks =
    input.remarks !== undefined ? ` remarks=${input.remarks}` : "";
  return `${base}${actor}${remarks}`;
}

export async function decidePreEmploymentTraining(
  rawInput: unknown
): Promise<PreEmploymentTrainingDecisionResult> {
  const validation = DecidePreEmploymentTrainingInputSchema.safeParse(rawInput);
  if (!validation.success) {
    throw inputError(
      validation.error.issues
        .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
        .join("; ")
    );
  }
  const { applicantId, decision, remarks, actorId } = validation.data;

  let current: ApplicantStatus;
  try {
    current = await getApplicantStatus(applicantId);
  } catch (error) {
    throw writeFailedError(
      applicantId,
      error instanceof Error ? error.message : String(error)
    );
  }
  const target: ApplicantStatus = decision === "pass" ? "hired" : "rejected";
  const outcome: "passed" | "failed" =
    decision === "pass" ? "passed" : "failed";

  const alreadyApplied = current === target;
  if (alreadyApplied) {
    return { outcome, applicantStatus: target };
  }

  if (current !== "for_training") {
    throw notEligibleError(applicantId, current);
  }

  try {
    await setApplicantStatus({
      applicantId,
      status: target,
      ...(actorId !== undefined ? { actorId } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.startsWith(APPLICANT_STATUS_ERROR_CODES.transitionNotAllowed)
    ) {
      throw notEligibleError(applicantId, current);
    }
    throw writeFailedError(applicantId, message);
  }

  await logHireActivity({
    userId: null,
    userName: `Applicant #${applicantId}`,
    userEmail: `applicant-${applicantId}@hire-gate.local`,
    ok: decision === "pass",
    reason: describeDecision({
      applicantId,
      outcome,
      from: current,
      to: target,
      ...(remarks !== undefined ? { remarks } : {}),
      ...(actorId !== undefined ? { actorId } : {}),
    }),
  });

  return { outcome, applicantStatus: target };
}
