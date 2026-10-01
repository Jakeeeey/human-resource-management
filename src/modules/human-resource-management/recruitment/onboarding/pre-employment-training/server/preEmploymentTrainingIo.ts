import { z } from "zod";

import { nowPH } from "@/modules/human-resource-management/recruitment/onboarding/utils/audit";
import { dFetch } from "@/modules/human-resource-management/recruitment/onboarding/utils/directus";

export const PRE_EMPLOYMENT_TRAINING_IO_ERROR_CODES = {
  invalidInput: "PRE_EMPLOYMENT_TRAINING_IO_INVALID_INPUT",
  notFound: "PRE_EMPLOYMENT_TRAINING_RECORD_NOT_FOUND",
  verifyFailed: "PRE_EMPLOYMENT_TRAINING_IO_FAILED",
} as const;

export const TrainingRecordSchema = z.looseObject({
  id: z.number().int().positive(),
  applicant_id: z.number().int().positive().nullable(),
  user_id: z.number().int().positive().nullable(),
  status: z.string().nullable(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  pdf_file: z.string().nullable(),
  signed_pdf_file: z.string().nullable(),
  signed_at: z.string().nullable(),
  remarks: z.string().nullable(),
  terms_snapshot: z.unknown(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

export type TrainingRecord = z.infer<typeof TrainingRecordSchema>;

const RefSchema = z
  .object({
    applicantId: z.number().int().positive().optional(),
    userId: z.number().int().positive().optional(),
  })
  .strict()
  .refine((value) => value.applicantId !== undefined || value.userId !== undefined, {
    message: "applicantId or userId is required",
  });

const CreateOrUpdateInputSchema = z
  .object({
    applicantId: z.number().int().positive(),
    userId: z.number().int().positive(),
    pdfFile: z.string().trim().min(1),
    startDate: z.string().trim().min(1),
    endDate: z.string().trim().min(1),
    termsSnapshot: z.unknown(),
    status: z.string().trim().min(1),
  })
  .strict();

const MarkSignedInputSchema = z
  .object({
    signedPdfFile: z.string().trim().min(1),
  })
  .strict();

const MarkDecidedInputSchema = z
  .object({
    status: z.enum(["passed", "failed"]),
    remarks: z.string().optional(),
  })
  .strict();

const COLLECTION = "onboarding_pre_employment_training";
const FIELDS =
  "id,applicant_id,user_id,status,start_date,end_date,pdf_file,signed_pdf_file,signed_at,remarks,terms_snapshot,created_at,updated_at";

function directusErrorText(body: unknown): string | null {
  const errors = (body as { errors?: unknown } | null | undefined)?.errors;
  if (!Array.isArray(errors) || errors.length === 0) return null;
  return errors
    .map((entry) =>
      typeof (entry as { message?: unknown })?.message === "string"
        ? (entry as { message: string }).message
        : JSON.stringify(entry)
    )
    .join("; ");
}

function parseRows(body: unknown, path: string): TrainingRecord[] {
  const errorText = directusErrorText(body);
  if (errorText) {
    throw new Error(
      `${PRE_EMPLOYMENT_TRAINING_IO_ERROR_CODES.verifyFailed}: GET ${path} was rejected (${errorText})`
    );
  }
  const rows = (body as { data?: unknown } | null | undefined)?.data;
  if (!Array.isArray(rows)) {
    throw new Error(
      `${PRE_EMPLOYMENT_TRAINING_IO_ERROR_CODES.verifyFailed}: GET ${path} returned no data array`
    );
  }
  return rows.map((row, index) => {
    const parsed = TrainingRecordSchema.safeParse(row);
    if (!parsed.success) {
      throw new Error(
        `${PRE_EMPLOYMENT_TRAINING_IO_ERROR_CODES.verifyFailed}: ${path} #${index} row failed the record contract (${parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "row"}: ${issue.message}`)
          .join("; ")})`
      );
    }
    return parsed.data;
  });
}

function parseSingle(body: unknown, collection: string): TrainingRecord {
  const errorText = directusErrorText(body);
  if (errorText) {
    throw new Error(
      `${PRE_EMPLOYMENT_TRAINING_IO_ERROR_CODES.verifyFailed}: writing ${collection} was rejected (${errorText})`
    );
  }
  const parsed = TrainingRecordSchema.safeParse(
    (body as { data?: unknown } | null | undefined)?.data ?? null
  );
  if (!parsed.success) {
    throw new Error(
      `${PRE_EMPLOYMENT_TRAINING_IO_ERROR_CODES.verifyFailed}: ${collection} write returned no row`
    );
  }
  return parsed.data;
}

async function readById(id: number): Promise<TrainingRecord> {
  const path = `/items/${COLLECTION}?filter[id][_eq]=${id}&fields=${FIELDS}&limit=1`;
  const rows = parseRows(await dFetch(path), path);
  const row = rows[0];
  if (!row) {
    throw new Error(
      `${PRE_EMPLOYMENT_TRAINING_IO_ERROR_CODES.notFound}: training record ${id} not found`
    );
  }
  return row;
}

export async function getTrainingRecordByApplicantOrUser(ref: {
  applicantId?: number;
  userId?: number;
}): Promise<TrainingRecord | null> {
  const validation = RefSchema.safeParse(ref);
  if (!validation.success) {
    throw new Error(
      `${PRE_EMPLOYMENT_TRAINING_IO_ERROR_CODES.invalidInput}: ${validation.error.issues
        .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
        .join("; ")}`
    );
  }
  const { applicantId, userId } = validation.data;
  const filters: string[] = [];
  if (applicantId !== undefined) filters.push(`filter[applicant_id][_eq]=${applicantId}`);
  if (userId !== undefined) filters.push(`filter[user_id][_eq]=${userId}`);
  const path = `/items/${COLLECTION}?${filters.join("&")}&fields=${FIELDS}&limit=1`;
  const rows = parseRows(await dFetch(path), path);
  return rows[0] ?? null;
}

export async function createOrUpdateTrainingRecord(input: {
  applicantId: number;
  userId: number;
  pdfFile: string;
  startDate: string;
  endDate: string;
  termsSnapshot: unknown;
  status: string;
}): Promise<TrainingRecord> {
  const validation = CreateOrUpdateInputSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(
      `${PRE_EMPLOYMENT_TRAINING_IO_ERROR_CODES.invalidInput}: ${validation.error.issues
        .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
        .join("; ")}`
    );
  }
  const now = nowPH();
  const existing = await getTrainingRecordByApplicantOrUser({
    applicantId: validation.data.applicantId,
    userId: validation.data.userId,
  });
  let persisted: TrainingRecord;
  if (existing) {
    const body: unknown = await dFetch(
      `/items/${COLLECTION}/${existing.id}?fields=${FIELDS}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          applicant_id: validation.data.applicantId,
          user_id: validation.data.userId,
          pdf_file: validation.data.pdfFile,
          start_date: validation.data.startDate,
          end_date: validation.data.endDate,
          terms_snapshot: validation.data.termsSnapshot,
          status: validation.data.status,
          updated_at: now,
        }),
      }
    );
    persisted = parseSingle(body, COLLECTION);
  } else {
    const body: unknown = await dFetch(`/items/${COLLECTION}`, {
      method: "POST",
      body: JSON.stringify({
        applicant_id: validation.data.applicantId,
        user_id: validation.data.userId,
        pdf_file: validation.data.pdfFile,
        start_date: validation.data.startDate,
        end_date: validation.data.endDate,
        terms_snapshot: validation.data.termsSnapshot,
        status: validation.data.status,
        created_at: now,
        updated_at: now,
      }),
    });
    persisted = parseSingle(body, COLLECTION);
  }
  const verified = await readById(persisted.id);
  if (verified.pdf_file !== validation.data.pdfFile) {
    throw new Error(
      `${PRE_EMPLOYMENT_TRAINING_IO_ERROR_CODES.verifyFailed}: training record ${persisted.id} did not persist pdf_file`
    );
  }
  return verified;
}

export async function markTrainingRecordSigned(
  id: number,
  input: { signedPdfFile: string }
): Promise<TrainingRecord> {
  const idValidation = z.number().int().positive().safeParse(id);
  if (!idValidation.success) {
    throw new Error(
      `${PRE_EMPLOYMENT_TRAINING_IO_ERROR_CODES.invalidInput}: id must be a positive integer`
    );
  }
  const validation = MarkSignedInputSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(
      `${PRE_EMPLOYMENT_TRAINING_IO_ERROR_CODES.invalidInput}: ${validation.error.issues
        .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
        .join("; ")}`
    );
  }
  const now = nowPH();
  const body: unknown = await dFetch(
    `/items/${COLLECTION}/${idValidation.data}?fields=${FIELDS}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        signed_pdf_file: validation.data.signedPdfFile,
        signed_at: now,
        status: "signed",
        updated_at: now,
      }),
    }
  );
  parseSingle(body, COLLECTION);
  const verified = await readById(idValidation.data);
  if (verified.signed_pdf_file !== validation.data.signedPdfFile) {
    throw new Error(
      `${PRE_EMPLOYMENT_TRAINING_IO_ERROR_CODES.verifyFailed}: training record ${idValidation.data} did not persist signed_pdf_file`
    );
  }
  return verified;
}

export async function markTrainingRecordDecided(
  id: number,
  input: { status: "passed" | "failed"; remarks?: string }
): Promise<TrainingRecord> {
  const idValidation = z.number().int().positive().safeParse(id);
  if (!idValidation.success) {
    throw new Error(
      `${PRE_EMPLOYMENT_TRAINING_IO_ERROR_CODES.invalidInput}: id must be a positive integer`
    );
  }
  const validation = MarkDecidedInputSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(
      `${PRE_EMPLOYMENT_TRAINING_IO_ERROR_CODES.invalidInput}: ${validation.error.issues
        .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
        .join("; ")}`
    );
  }
  const payload: Record<string, unknown> = {
    status: validation.data.status,
    updated_at: nowPH(),
  };
  if (validation.data.remarks !== undefined) {
    payload["remarks"] = validation.data.remarks;
  }
  const body: unknown = await dFetch(
    `/items/${COLLECTION}/${idValidation.data}?fields=${FIELDS}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
  parseSingle(body, COLLECTION);
  const verified = await readById(idValidation.data);
  if (verified.status !== validation.data.status) {
    throw new Error(
      `${PRE_EMPLOYMENT_TRAINING_IO_ERROR_CODES.verifyFailed}: training record ${idValidation.data} did not persist status ${validation.data.status}`
    );
  }
  return verified;
}
