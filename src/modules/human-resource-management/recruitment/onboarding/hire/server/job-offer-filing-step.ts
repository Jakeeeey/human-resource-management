import { z } from "zod";

import { nowUTC } from "@/modules/human-resource-management/recruitment/onboarding/utils/audit";
import {
  ensureSignedDocsListId,
  insertFiledPdfRecords,
  listExistingFileRefs,
  listFiledRecords,
  readEmployeeUserId,
} from "../../../signing/server/signingFilingIo";
import { readList } from "../../../signing/server/signingSetIo";
import type {
  HireCompletionStep,
  HireCompletionStepResult,
} from "../types/hire.schema";

export const JOB_OFFER_FILING_ERROR_CODES = {
  invalidInput: "JOB_OFFER_FILING_INVALID_INPUT",
  applicantNotHired: "JOB_OFFER_FILING_APPLICANT_NOT_HIRED",
  fileMissing: "JOB_OFFER_FILING_FILE_MISSING",
  verifyFailed: "JOB_OFFER_FILING_VERIFY_FAILED",
} as const;

const RECORD_NAME = "Signed Job Offer";

const JobOfferRowSchema = z.looseObject({
  id: z.number().int().positive(),
  applicant_id: z.number().int().positive(),
  status: z.string().nullish(),
  signed_pdf_file: z.string().nullish(),
});

export const FileJobOfferInputSchema = z
  .object({
    applicantId: z.number().int().positive(),
    userId: z.number().int().positive(),
  })
  .strict();

export type FileJobOfferInput = z.infer<typeof FileJobOfferInputSchema>;

export interface FileJobOfferResult {
  applicantId: number;
  userId: number;
  offerId: number | null;
  listId: number | null;
  filed: number;
  existing: number;
  total: number;
}

function zeroResult(
  applicantId: number,
  userId: number,
  offerId: number | null
): FileJobOfferResult {
  return {
    applicantId,
    userId,
    offerId,
    listId: null,
    filed: 0,
    existing: 0,
    total: 0,
  };
}

async function assertEmployeeExists(userId: number): Promise<void> {
  const employeeId = await readEmployeeUserId(userId);
  if (employeeId === null) {
    throw new Error(
      `${JOB_OFFER_FILING_ERROR_CODES.applicantNotHired}: employee user_id ${userId} does not exist — filing is deferred until the employee exists`
    );
  }
}

async function doFileJobOfferForHire(
  applicantId: number,
  userId: number
): Promise<FileJobOfferResult> {
  await assertEmployeeExists(userId);

  const offers = await readList(
    `/items/job_offer?filter[applicant_id][_eq]=${applicantId}&fields=id,applicant_id,status,signed_pdf_file&limit=1`,
    JobOfferRowSchema
  );
  const offer = offers[0] ?? null;
  if (!offer) return zeroResult(applicantId, userId, null);

  const fileRef = offer.signed_pdf_file?.trim() || null;
  if (!fileRef) return zeroResult(applicantId, userId, offer.id);

  const existingFileIds = new Set(await listExistingFileRefs([fileRef]));
  if (!existingFileIds.has(fileRef)) {
    throw new Error(
      `${JOB_OFFER_FILING_ERROR_CODES.fileMissing}: staged Directus file not found: ${fileRef}`
    );
  }

  const alreadyFiled = await listFiledRecords(userId, [fileRef]);
  if (alreadyFiled.length > 0) {
    return {
      applicantId,
      userId,
      offerId: offer.id,
      listId: alreadyFiled[0]?.list_id ?? null,
      filed: 0,
      existing: alreadyFiled.length,
      total: alreadyFiled.length,
    };
  }

  const listId = await ensureSignedDocsListId();
  const now = nowUTC();
  await insertFiledPdfRecords([
    {
      userId,
      listId,
      recordName: RECORD_NAME,
      description: `Signed job offer — applicant #${applicantId}, job offer #${offer.id}.`,
      fileRef,
      now,
    },
  ]);

  const after = await listFiledRecords(userId, [fileRef]);
  if (after.length === 0) {
    throw new Error(
      `${JOB_OFFER_FILING_ERROR_CODES.verifyFailed}: employee_file_records missing after filing: ${fileRef}`
    );
  }

  return {
    applicantId,
    userId,
    offerId: offer.id,
    listId,
    filed: 1,
    existing: 0,
    total: after.length,
  };
}

const fileInFlight = new Map<number, Promise<FileJobOfferResult>>();

export function fileJobOfferForHire(
  rawInput: unknown
): Promise<FileJobOfferResult> {
  const validation = FileJobOfferInputSchema.safeParse(rawInput);
  if (!validation.success) {
    return Promise.reject(
      new Error(
        `${JOB_OFFER_FILING_ERROR_CODES.invalidInput}: ${validation.error.issues
          .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
          .join("; ")}`
      )
    );
  }
  const { applicantId, userId } = validation.data;

  const current = fileInFlight.get(userId);
  if (current) return current;

  const task = doFileJobOfferForHire(applicantId, userId).finally(() => {
    fileInFlight.delete(userId);
  });
  fileInFlight.set(userId, task);
  return task;
}

const STEP_NAME = "job-offer-filing";

export const jobOfferFilingStep: HireCompletionStep = async (
  context
): Promise<HireCompletionStepResult> => {
  try {
    const result = await fileJobOfferForHire({
      applicantId: context.applicantId,
      userId: context.userId,
    });
    return {
      step: STEP_NAME,
      ok: true,
      detail: `user_id=${context.userId} applicant=${context.applicantId} offer=${result.offerId ?? "-"} list_id=${result.listId ?? "-"} filed=${result.filed} existing=${result.existing} total=${result.total}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { step: STEP_NAME, ok: false, detail: message };
  }
};
