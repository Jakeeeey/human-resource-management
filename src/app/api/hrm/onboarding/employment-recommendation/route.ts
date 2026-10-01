import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assembleEmploymentRecommendationInput } from "@/modules/human-resource-management/recruitment/onboarding/pre-employment-training/server/employmentRecommendationInput";
import {
  EMPLOYMENT_RECOMMENDATION_FILING_ERROR_CODES,
  fileEmploymentRecommendationLetter,
  markEmploymentRecommendationIssued,
  readEmploymentRecommendationIssuance,
} from "@/modules/human-resource-management/recruitment/onboarding/pre-employment-training/server/employmentRecommendationFiling";
import {
  readOnboardingTaskSession,
  serverError,
  sessionActorId,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/recruitment/onboarding/tasks/server/onboardingTaskApiServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GetQuerySchema = z
  .object({
    user_id: z.coerce.number().int().positive(),
    applicant_id: z.coerce.number().int().positive().optional(),
    effectivity_date: z.string().trim().min(1).optional(),
  })
  .strict();

const PostBodySchema = z
  .object({
    user_id: z.coerce.number().int().positive(),
    applicant_id: z.coerce.number().int().positive().optional(),
    file_name: z.string().trim().min(1).max(255),
    pdf_base64: z.string().min(1),
    replace_existing: z.boolean().optional(),
  })
  .strict();

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_BASE64_CHARS = 15 * 1024 * 1024;
const PDF_MAGIC = "%PDF-";

function failed(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

function issuanceRef(query: { user_id: number; applicant_id?: number }) {
  return query.applicant_id === undefined
    ? { userId: query.user_id }
    : { userId: query.user_id, applicantId: query.applicant_id };
}

export async function GET(req: NextRequest) {
  try {
    if (!readOnboardingTaskSession(req)) return unauthorized();
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = GetQuerySchema.safeParse(params);
    if (!query.success) {
      return validationFailed(query.error.flatten().fieldErrors);
    }
    const assembled = await assembleEmploymentRecommendationInput({
      userId: query.data.user_id,
      ...(query.data.applicant_id !== undefined ? { applicantId: query.data.applicant_id } : {}),
      ...(query.data.effectivity_date !== undefined ? { effectivityDate: query.data.effectivity_date } : {}),
    });
    let issuance = null;
    try {
      issuance = await readEmploymentRecommendationIssuance(
        issuanceRef(query.data)
      );
    } catch (issuanceError) {
      console.error("[employment-recommendation] issuance read error:", issuanceError);
    }
    return NextResponse.json({ success: true, data: assembled, issuance });
  } catch (error) {
    console.error("[employment-recommendation] assemble error:", error);
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = readOnboardingTaskSession(req);
    if (!session) return unauthorized();
    const actorId = sessionActorId(session);
    const body: unknown = await req.json().catch(() => null);
    const validation = PostBodySchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }
    const { user_id, applicant_id, file_name, pdf_base64, replace_existing } = validation.data;
    if (pdf_base64.length > MAX_BASE64_CHARS) {
      return failed("The letter file is too large. Maximum size is 10 MB.", 413);
    }
    let decoded: Buffer;
    try {
      decoded = Buffer.from(pdf_base64, "base64");
    } catch {
      return failed("The letter file could not be read. Generate the letter again.", 400);
    }
    if (decoded.byteLength === 0) {
      return failed("The letter file is empty. Generate the letter again.", 400);
    }
    if (decoded.byteLength > MAX_PDF_BYTES) {
      return failed("The letter file is too large. Maximum size is 10 MB.", 413);
    }
    if (decoded.subarray(0, PDF_MAGIC.length).toString("binary") !== PDF_MAGIC) {
      return failed("The letter file is not a PDF document. Generate the letter again.", 415);
    }
    const bytes = new Uint8Array(decoded);
    try {
      const settled = await readEmploymentRecommendationIssuance(
        applicant_id === undefined
          ? { userId: user_id }
          : { userId: user_id, applicantId: applicant_id }
      );
      if (!replace_existing && settled.issued && settled.fileRef !== null && settled.recordId !== null) {
        const healed = await markEmploymentRecommendationIssued(
          applicant_id === undefined
            ? { userId: user_id }
            : { userId: user_id, applicantId: applicant_id }
        );
        return NextResponse.json({
          success: true,
          data: {
            issued: true,
            alreadyFiled: true,
            fileRef: settled.fileRef,
            recordId: settled.recordId,
            marked: healed.marked,
          },
        });
      }
      const filed = await fileEmploymentRecommendationLetter({
        userId: user_id,
        bytes,
        fileName: file_name,
        ...(applicant_id !== undefined ? { applicantId: applicant_id } : {}),
        ...(actorId !== null ? { actorId } : {}),
        ...(replace_existing ? { replaceExisting: true } : {}),
      });
      const mark = await markEmploymentRecommendationIssued(
        applicant_id === undefined
          ? { userId: user_id }
          : { userId: user_id, applicantId: applicant_id }
      );
      return NextResponse.json({
        success: true,
        data: {
          issued: true,
          alreadyFiled: filed.alreadyFiled,
          fileRef: filed.fileRef,
          recordId: filed.recordId,
          marked: mark.marked,
        },
      });
    } catch (filingError) {
      const message =
        filingError instanceof Error ? filingError.message : String(filingError);
      console.error("[employment-recommendation] save error:", filingError);
      if (message.includes(EMPLOYMENT_RECOMMENDATION_FILING_ERROR_CODES.uploadFailed)) {
        return failed("The letter could not be uploaded, so it was not saved. Please try again.", 502);
      }
      if (message.includes(EMPLOYMENT_RECOMMENDATION_FILING_ERROR_CODES.verifyFailed)) {
        return failed("The letter could not be filed to the employee records, so it was not saved. Please try again.", 502);
      }
      return failed("The letter could not be saved. Please try again.", 502);
    }
  } catch (error) {
    console.error("[employment-recommendation] save error:", error);
    return serverError();
  }
}
