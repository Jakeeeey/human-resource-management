import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { fileSignedTrainingLetter } from "@/modules/human-resource-management/onboarding/pre-employment-training/server/preEmploymentTrainingFiling";
import { markTrainingRecordSigned } from "@/modules/human-resource-management/onboarding/pre-employment-training/server/preEmploymentTrainingIo";
import {
  readOnboardingTaskSession,
  serverError,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/onboarding/tasks/server/onboardingTaskApiServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IdParamSchema = z.coerce.number().int().positive();

const SignBodySchema = z
  .object({
    signed_pdf_file: z.string().trim().min(1),
    file_name: z.string().trim().min(1).optional(),
  })
  .strict();

async function downloadSignedBytes(fileId: string): Promise<Uint8Array> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base || base.trim() === "") {
    throw new Error("Directus base URL is not configured");
  }
  const token = process.env.DIRECTUS_STATIC_TOKEN;
  const res = await fetch(`${base}/assets/${encodeURIComponent(fileId)}`, {
    headers: token && token.trim() !== "" ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(`Signed file download failed with status ${res.status}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    if (!readOnboardingTaskSession(req)) return unauthorized();
    const params = await context.params;
    const idValidation = IdParamSchema.safeParse(params.id);
    if (!idValidation.success) {
      return validationFailed({ id: ["Training record id must be a positive integer"] });
    }
    const body: unknown = await req.json().catch(() => null);
    const validation = SignBodySchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const record = await markTrainingRecordSigned(idValidation.data, {
      signedPdfFile: validation.data.signed_pdf_file,
    });

    if (record.user_id === null) {
      return NextResponse.json({
        success: true,
        data: record,
        filed: false,
        message: "Signed PDF saved; filing skipped because the training record has no user_id",
      });
    }

    try {
      const bytes = await downloadSignedBytes(validation.data.signed_pdf_file);
      await fileSignedTrainingLetter({
        userId: record.user_id,
        bytes,
        fileName: validation.data.file_name ?? `signed-pre-employment-training-${record.id}.pdf`,
        ...(record.applicant_id !== null ? { applicantId: record.applicant_id } : {}),
      });
      return NextResponse.json({ success: true, data: record, filed: true });
    } catch (filingError) {
      const detail = filingError instanceof Error ? filingError.message : String(filingError);
      console.error("[pre-employment-training] filing error (signature preserved):", filingError);
      return NextResponse.json({
        success: true,
        data: record,
        filed: false,
        message: `Signed PDF saved; 201 filing will be retried later (${detail})`,
      });
    }
  } catch (error) {
    console.error("[pre-employment-training] sign error:", error);
    return serverError();
  }
}
