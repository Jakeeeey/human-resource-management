import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  createOrUpdateTrainingRecord,
  getTrainingRecordByApplicantOrUser,
} from "@/modules/human-resource-management/recruitment/onboarding/pre-employment-training/server/preEmploymentTrainingIo";
import {
  readOnboardingTaskSession,
  serverError,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/recruitment/onboarding/tasks/server/onboardingTaskApiServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GetQuerySchema = z
  .object({
    applicant_id: z.coerce.number().int().positive().optional(),
    user_id: z.coerce.number().int().positive().optional(),
  })
  .strict()
  .refine((value) => value.applicant_id !== undefined || value.user_id !== undefined, {
    message: "applicant_id or user_id is required",
  });

const PostBodySchema = z
  .object({
    applicant_id: z.number().int().positive(),
    user_id: z.number().int().positive(),
    pdf_file: z.string().trim().min(1),
    start_date: z.string().trim().min(1),
    end_date: z.string().trim().min(1),
    terms_snapshot: z.unknown(),
    status: z.literal("issued"),
  })
  .strict();

export async function GET(req: NextRequest) {
  try {
    if (!readOnboardingTaskSession(req)) return unauthorized();
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = GetQuerySchema.safeParse(params);
    if (!query.success) {
      return validationFailed(query.error.flatten().fieldErrors);
    }
    const record = await getTrainingRecordByApplicantOrUser({
      ...(query.data.applicant_id !== undefined
        ? { applicantId: query.data.applicant_id }
        : {}),
      ...(query.data.user_id !== undefined ? { userId: query.data.user_id } : {}),
    });
    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    console.error("[pre-employment-training] read error:", error);
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!readOnboardingTaskSession(req)) return unauthorized();
    const body: unknown = await req.json().catch(() => null);
    const validation = PostBodySchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }
    const record = await createOrUpdateTrainingRecord({
      applicantId: validation.data.applicant_id,
      userId: validation.data.user_id,
      pdfFile: validation.data.pdf_file,
      startDate: validation.data.start_date,
      endDate: validation.data.end_date,
      termsSnapshot: validation.data.terms_snapshot,
      status: validation.data.status,
    });
    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    console.error("[pre-employment-training] issue error:", error);
    return serverError();
  }
}
