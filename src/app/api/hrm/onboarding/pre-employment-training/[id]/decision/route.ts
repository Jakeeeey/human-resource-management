import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  decidePreEmploymentTraining,
  PRE_EMPLOYMENT_TRAINING_DECISION_ERROR_CODES,
} from "@/modules/human-resource-management/onboarding/pre-employment-training/server/preEmploymentTrainingDecision";
import {
  markTrainingRecordDecided,
  PRE_EMPLOYMENT_TRAINING_IO_ERROR_CODES,
} from "@/modules/human-resource-management/onboarding/pre-employment-training/server/preEmploymentTrainingIo";
import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  readOnboardingTaskSession,
  serverError,
  sessionActorId,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/onboarding/tasks/server/onboardingTaskApiServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IdParamSchema = z.coerce.number().int().positive();

const DecisionBodySchema = z
  .object({
    decision: z.enum(["pass", "fail"]),
    remarks: z.string().optional(),
  })
  .strict();

const RecordRefSchema = z.looseObject({
  id: z.number().int().positive(),
  applicant_id: z.number().int().positive().nullable(),
});

async function readRecordApplicantId(id: number): Promise<number | null> {
  const path = `/items/onboarding_pre_employment_training?filter[id][_eq]=${id}&fields=id,applicant_id&limit=1`;
  const body: unknown = await dFetch(path);
  const parsed = z.object({ data: z.array(RecordRefSchema) }).safeParse(body);
  if (!parsed.success) {
    throw new Error(
      `${PRE_EMPLOYMENT_TRAINING_IO_ERROR_CODES.verifyFailed}: training record ${id} lookup failed`
    );
  }
  const row = parsed.data.data[0];
  if (!row) {
    return null;
  }
  return row.applicant_id;
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = readOnboardingTaskSession(req);
    if (!session) return unauthorized();
    const params = await context.params;
    const idValidation = IdParamSchema.safeParse(params.id);
    if (!idValidation.success) {
      return validationFailed({ id: ["Training record id must be a positive integer"] });
    }
    const body: unknown = await req.json().catch(() => null);
    const validation = DecisionBodySchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const applicantId = await readRecordApplicantId(idValidation.data);
    if (applicantId === null) {
      return NextResponse.json(
        { success: false, message: `Training record ${idValidation.data} not found` },
        { status: 404 }
      );
    }

    let outcome: "passed" | "failed";
    let applicantStatus: string;
    try {
      const result = await decidePreEmploymentTraining({
        applicantId,
        decision: validation.data.decision,
        ...(validation.data.remarks !== undefined ? { remarks: validation.data.remarks } : {}),
        ...(sessionActorId(session) !== null
          ? { actorId: sessionActorId(session) as number }
          : {}),
      });
      outcome = result.outcome;
      applicantStatus = result.applicantStatus;
    } catch (serviceError) {
      const message = serviceError instanceof Error ? serviceError.message : String(serviceError);
      if (message.includes(PRE_EMPLOYMENT_TRAINING_DECISION_ERROR_CODES.notEligible)) {
        return NextResponse.json({ success: false, message }, { status: 409 });
      }
      throw serviceError;
    }

    await markTrainingRecordDecided(idValidation.data, {
      status: outcome,
      ...(validation.data.remarks !== undefined ? { remarks: validation.data.remarks } : {}),
    });

    return NextResponse.json({ success: true, data: { outcome, applicantStatus } });
  } catch (error) {
    console.error("[pre-employment-training] decision error:", error);
    return serverError();
  }
}
