import { z } from "zod";

import { nowPH } from "@/modules/human-resource-management/shared/utils/audit";
import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import { ensureSignedDocsListId } from "@/modules/human-resource-management/onboarding/signing/server/signingFilingIo";
import { getTrainingRecordByApplicantOrUser } from "./preEmploymentTrainingIo";

export const EMPLOYMENT_RECOMMENDATION_FILING_ERROR_CODES = {
  invalidInput: "EMPLOYMENT_RECOMMENDATION_FILING_INVALID_INPUT",
  uploadFailed: "EMPLOYMENT_RECOMMENDATION_UPLOAD_FAILED",
  verifyFailed: "EMPLOYMENT_RECOMMENDATION_FILING_FAILED",
} as const;

export const RECOMMENDATION_ISSUED_STATUS = "recommendation_issued";

const RECOMMENDATION_RECORD_NAME = "Recommendation for Employment";
const EMPLOYEE_FILE_FOLDER_NAME = "201_emp_files";
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const FileEmploymentRecommendationInputSchema = z
  .object({
    userId: z.number().int().positive(),
    bytes: z.instanceof(Uint8Array),
    fileName: z.string().trim().min(1),
    applicantId: z.number().int().positive().optional(),
    actorId: z.number().int().positive().optional(),
  })
  .strict();

export type FileEmploymentRecommendationInput = z.infer<
  typeof FileEmploymentRecommendationInputSchema
>;

export interface FileEmploymentRecommendationResult {
  recordId: number;
  fileRef: string;
  listId: number;
  alreadyFiled: boolean;
}

export interface MarkRecommendationIssuedResult {
  marked: boolean;
  previousStatus: string | null;
}

export interface RecommendationIssuance {
  issued: boolean;
  fileRef: string | null;
  recordId: number | null;
  recordStatus: string | null;
}

const EmployeeFileRecordRowSchema = z.looseObject({
  id: z.number().int().positive(),
  user_id: z.number().int(),
  list_id: z.number().int(),
  record_name: z.string(),
  file_ref: z.string(),
});

const MarkRefSchema = z
  .object({
    userId: z.number().int().positive(),
    applicantId: z.number().int().positive().optional(),
  })
  .strict();

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

async function readRows<T>(
  path: string,
  schema: z.ZodType<T>
): Promise<T[]> {
  const body: unknown = await dFetch(path);
  const errorText = directusErrorText(body);
  if (errorText) {
    throw new Error(
      `${EMPLOYMENT_RECOMMENDATION_FILING_ERROR_CODES.verifyFailed}: GET ${path} was rejected (${errorText})`
    );
  }
  const rows = (body as { data?: unknown } | null | undefined)?.data;
  if (!Array.isArray(rows)) {
    throw new Error(
      `${EMPLOYMENT_RECOMMENDATION_FILING_ERROR_CODES.verifyFailed}: GET ${path} returned no data array`
    );
  }
  return rows.map((row, index) => {
    const parsed = schema.safeParse(row);
    if (!parsed.success) {
      throw new Error(
        `${EMPLOYMENT_RECOMMENDATION_FILING_ERROR_CODES.verifyFailed}: ${path} #${index} row failed the record contract (${parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "row"}: ${issue.message}`)
          .join("; ")})`
      );
    }
    return parsed.data;
  });
}

async function createRow<T>(
  collection: string,
  payload: Record<string, unknown>,
  schema: z.ZodType<T>
): Promise<T> {
  const body: unknown = await dFetch(`/items/${collection}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const errorText = directusErrorText(body);
  if (errorText) {
    throw new Error(
      `${EMPLOYMENT_RECOMMENDATION_FILING_ERROR_CODES.verifyFailed}: inserting into ${collection} was rejected (${errorText})`
    );
  }
  const parsed = schema.safeParse(
    (body as { data?: unknown } | null | undefined)?.data ?? null
  );
  if (!parsed.success) {
    throw new Error(
      `${EMPLOYMENT_RECOMMENDATION_FILING_ERROR_CODES.verifyFailed}: ${collection} create returned no row`
    );
  }
  return parsed.data;
}

async function uploadRecommendationPdf(
  bytes: Uint8Array,
  fileName: string
): Promise<string> {
  if (bytes.byteLength === 0) {
    throw new Error(
      `${EMPLOYMENT_RECOMMENDATION_FILING_ERROR_CODES.uploadFailed}: empty PDF bytes for ${fileName}`
    );
  }
  if (bytes.byteLength > MAX_FILE_BYTES) {
    throw new Error(
      `${EMPLOYMENT_RECOMMENDATION_FILING_ERROR_CODES.uploadFailed}: File too large (Max 10MB)`
    );
  }
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base || base.trim() === "") {
    throw new Error(
      `${EMPLOYMENT_RECOMMENDATION_FILING_ERROR_CODES.verifyFailed}: Directus base URL is not configured`
    );
  }
  const token = process.env.DIRECTUS_STATIC_TOKEN;
  const headers: Record<string, string> =
    token && token.trim() !== "" ? { Authorization: `Bearer ${token}` } : {};
  let folderId: string | null = null;
  const folderBody: unknown = await fetch(
    `${base}/folders?filter[name][_eq]=${encodeURIComponent(EMPLOYEE_FILE_FOLDER_NAME)}`,
    { headers }
  )
    .then((res) => (res.ok ? res.json().catch(() => null) : null))
    .catch(() => null);
  const folderRows = (folderBody as { data?: unknown } | null | undefined)
    ?.data;
  if (Array.isArray(folderRows) && folderRows.length > 0) {
    const first = folderRows[0] as { id?: unknown };
    if (typeof first.id === "string" && first.id.length > 0) {
      folderId = first.id;
    }
  }
  const form = new FormData();
  if (folderId) {
    form.append("folder", folderId);
  }
  form.append(
    "file",
    new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }),
    fileName
  );
  const uploadBody: unknown = await fetch(`${base}/files`, {
    method: "POST",
    headers,
    body: form,
  })
    .then((res) =>
      res.json().catch(() => null) as Promise<unknown>
    )
    .catch(() => null);
  const uploadError = directusErrorText(uploadBody);
  if (uploadError) {
    throw new Error(
      `${EMPLOYMENT_RECOMMENDATION_FILING_ERROR_CODES.uploadFailed}: filing upload rejected (${uploadError})`
    );
  }
  const fileId = (uploadBody as { data?: { id?: unknown } } | null)?.data?.id;
  if (typeof fileId !== "string" || fileId.length === 0) {
    throw new Error(
      `${EMPLOYMENT_RECOMMENDATION_FILING_ERROR_CODES.uploadFailed}: upload returned no Directus file id`
    );
  }
  return fileId;
}

function filedByNamePath(userId: number): string {
  return `/items/employee_file_records?filter[user_id][_eq]=${userId}&filter[record_name][_eq]=${encodeURIComponent(RECOMMENDATION_RECORD_NAME)}&fields=id,user_id,list_id,record_name,file_ref&limit=-1`;
}

function filedByRefPath(userId: number, fileRef: string): string {
  return `/items/employee_file_records?filter[user_id][_eq]=${userId}&filter[file_ref][_eq]=${encodeURIComponent(fileRef)}&fields=id,user_id,list_id,record_name,file_ref&limit=1`;
}

function describeHire(input: {
  userId: number;
  fileName: string;
  applicantId?: number;
  actorId?: number;
}): string {
  const filedBy = input.actorId !== undefined ? ` Filed by user #${input.actorId}.` : "";
  if (input.applicantId !== undefined) {
    return `Recommendation for employment — applicant #${input.applicantId}, user_id ${input.userId} (${input.fileName}).${filedBy}`;
  }
  return `Recommendation for employment — user_id ${input.userId} (${input.fileName}).${filedBy}`;
}

export async function fileEmploymentRecommendationLetter(
  rawInput: unknown
): Promise<FileEmploymentRecommendationResult> {
  const validation = FileEmploymentRecommendationInputSchema.safeParse(rawInput);
  if (!validation.success) {
    throw new Error(
      `${EMPLOYMENT_RECOMMENDATION_FILING_ERROR_CODES.invalidInput}: ${validation.error.issues
        .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
        .join("; ")}`
    );
  }
  const { userId, bytes, fileName, applicantId, actorId } = validation.data;
  if (bytes.byteLength === 0) {
    throw new Error(
      `${EMPLOYMENT_RECOMMENDATION_FILING_ERROR_CODES.invalidInput}: bytes must not be empty`
    );
  }
  const existing = await readRows(
    filedByNamePath(userId),
    EmployeeFileRecordRowSchema
  );
  const latest = existing.reduce<
    z.infer<typeof EmployeeFileRecordRowSchema> | null
  >((best, row) => (best === null || row.id > best.id ? row : best), null);
  if (latest) {
    return {
      recordId: latest.id,
      fileRef: latest.file_ref,
      listId: latest.list_id,
      alreadyFiled: true,
    };
  }
  const fileRef = await uploadRecommendationPdf(bytes, fileName);
  const filed = await readRows(
    filedByRefPath(userId, fileRef),
    EmployeeFileRecordRowSchema
  );
  if (filed[0]) {
    return {
      recordId: filed[0].id,
      fileRef,
      listId: filed[0].list_id,
      alreadyFiled: true,
    };
  }
  const listId = await ensureSignedDocsListId();
  const now = nowPH();
  await createRow(
    "employee_file_records",
    {
      user_id: userId,
      list_id: listId,
      record_name: RECOMMENDATION_RECORD_NAME,
      description: describeHire({ userId, fileName, applicantId, actorId }),
      file_ref: fileRef,
      is_deleted: 0,
      created_at: now,
      updated_at: now,
    },
    EmployeeFileRecordRowSchema
  );
  const after = await readRows(
    filedByRefPath(userId, fileRef),
    EmployeeFileRecordRowSchema
  );
  if (!after[0]) {
    throw new Error(
      `${EMPLOYMENT_RECOMMENDATION_FILING_ERROR_CODES.verifyFailed}: employee_file_records missing after filing: ${fileRef}`
    );
  }
  return {
    recordId: after[0].id,
    fileRef,
    listId,
    alreadyFiled: false,
  };
}

export async function markEmploymentRecommendationIssued(ref: {
  userId: number;
  applicantId?: number;
}): Promise<MarkRecommendationIssuedResult> {
  const validation = MarkRefSchema.safeParse(ref);
  if (!validation.success) {
    throw new Error(
      `${EMPLOYMENT_RECOMMENDATION_FILING_ERROR_CODES.invalidInput}: ${validation.error.issues
        .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
        .join("; ")}`
    );
  }
  const { userId, applicantId } = validation.data;
  const existing = await getTrainingRecordByApplicantOrUser(
    applicantId === undefined ? { userId } : { applicantId, userId }
  );
  const previousStatus = existing?.status ?? null;
  if (!existing) {
    return { marked: false, previousStatus };
  }
  if (existing.status === "passed" || existing.status === "failed") {
    return { marked: false, previousStatus };
  }
  if (existing.status === RECOMMENDATION_ISSUED_STATUS) {
    return { marked: false, previousStatus };
  }
  const body: unknown = await dFetch(
    `/items/onboarding_pre_employment_training/${existing.id}?fields=id,status`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: RECOMMENDATION_ISSUED_STATUS,
        updated_at: nowPH(),
      }),
    }
  );
  const errorText = directusErrorText(body);
  if (errorText) {
    throw new Error(
      `${EMPLOYMENT_RECOMMENDATION_FILING_ERROR_CODES.verifyFailed}: marking the recommendation issued was rejected (${errorText})`
    );
  }
  const verified = await getTrainingRecordByApplicantOrUser(
    applicantId === undefined ? { userId } : { applicantId, userId }
  );
  if (verified?.status !== RECOMMENDATION_ISSUED_STATUS) {
    throw new Error(
      `${EMPLOYMENT_RECOMMENDATION_FILING_ERROR_CODES.verifyFailed}: training record ${existing.id} did not persist status ${RECOMMENDATION_ISSUED_STATUS}`
    );
  }
  return { marked: true, previousStatus };
}

export async function readEmploymentRecommendationIssuance(ref: {
  userId: number;
  applicantId?: number;
}): Promise<RecommendationIssuance> {
  const validation = MarkRefSchema.safeParse(ref);
  if (!validation.success) {
    throw new Error(
      `${EMPLOYMENT_RECOMMENDATION_FILING_ERROR_CODES.invalidInput}: ${validation.error.issues
        .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
        .join("; ")}`
    );
  }
  const { userId, applicantId } = validation.data;
  const existing = await readRows(
    filedByNamePath(userId),
    EmployeeFileRecordRowSchema
  );
  const latest = existing.reduce<
    z.infer<typeof EmployeeFileRecordRowSchema> | null
  >((best, row) => (best === null || row.id > best.id ? row : best), null);
  let recordStatus: string | null = null;
  try {
    const record = await getTrainingRecordByApplicantOrUser(
      applicantId === undefined ? { userId } : { applicantId, userId }
    );
    recordStatus = record?.status ?? null;
  } catch {
    recordStatus = null;
  }
  const issued =
    recordStatus === RECOMMENDATION_ISSUED_STATUS || latest !== null;
  return {
    issued,
    fileRef: latest?.file_ref ?? null,
    recordId: latest?.id ?? null,
    recordStatus,
  };
}
