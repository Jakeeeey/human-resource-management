import { z } from "zod";

import { nowPH } from "@/modules/human-resource-management/shared/utils/audit";
import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

export const PRE_EMPLOYMENT_TRAINING_FILING_ERROR_CODES = {
  invalidInput: "PRE_EMPLOYMENT_TRAINING_FILING_INVALID_INPUT",
  uploadFailed: "PRE_EMPLOYMENT_TRAINING_UPLOAD_FAILED",
  verifyFailed: "PRE_EMPLOYMENT_TRAINING_FILING_FAILED",
} as const;

const PRE_EMPLOYMENT_TYPE_NAME = "Pre-Employment & Personal Records";
const PRE_EMPLOYMENT_TYPE_DESCRIPTION =
  "Employee 201 pre-employment and personal records.";
const HIRING_DOCS_LIST_NAME = "Hiring Documents";
const HIRING_DOCS_LIST_DESCRIPTION =
  "Application and portal documents auto-filed on hire — one record per submitted file.";

const RECORD_NAME = "Signed Pre-Employment Training Letter";
const EMPLOYEE_FILE_FOLDER_NAME = "201_emp_files";
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const FileSignedTrainingLetterInputSchema = z
  .object({
    userId: z.number().int().positive(),
    bytes: z.instanceof(Uint8Array),
    fileName: z.string().trim().min(1),
    applicantId: z.number().int().positive().optional(),
  })
  .strict();

export type FileSignedTrainingLetterInput = z.infer<
  typeof FileSignedTrainingLetterInputSchema
>;

export interface FileSignedTrainingLetterResult {
  recordId: number;
  fileRef: string;
  listId: number;
  alreadyFiled: boolean;
}

const IdRowSchema = z.looseObject({
  id: z.number().int().positive(),
});

const RecordListRowSchema = z.looseObject({
  id: z.number().int().positive(),
  record_type_id: z.number().int().positive(),
  name: z.string(),
});

const EmployeeFileRecordRowSchema = z.looseObject({
  id: z.number().int().positive(),
  user_id: z.number().int(),
  list_id: z.number().int(),
  record_name: z.string(),
  file_ref: z.string(),
});

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
      `${PRE_EMPLOYMENT_TRAINING_FILING_ERROR_CODES.verifyFailed}: GET ${path} was rejected (${errorText})`
    );
  }
  const rows = (body as { data?: unknown } | null | undefined)?.data;
  if (!Array.isArray(rows)) {
    throw new Error(
      `${PRE_EMPLOYMENT_TRAINING_FILING_ERROR_CODES.verifyFailed}: GET ${path} returned no data array`
    );
  }
  return rows.map((row, index) => {
    const parsed = schema.safeParse(row);
    if (!parsed.success) {
      throw new Error(
        `${PRE_EMPLOYMENT_TRAINING_FILING_ERROR_CODES.verifyFailed}: ${path} #${index} row failed the record contract (${parsed.error.issues
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
      `${PRE_EMPLOYMENT_TRAINING_FILING_ERROR_CODES.verifyFailed}: inserting into ${collection} was rejected (${errorText})`
    );
  }
  const parsed = schema.safeParse(
    (body as { data?: unknown } | null | undefined)?.data ?? null
  );
  if (!parsed.success) {
    throw new Error(
      `${PRE_EMPLOYMENT_TRAINING_FILING_ERROR_CODES.verifyFailed}: ${collection} create returned no row`
    );
  }
  return parsed.data;
}

async function uploadSignedPdf(
  bytes: Uint8Array,
  fileName: string
): Promise<string> {
  if (bytes.byteLength === 0) {
    throw new Error(
      `${PRE_EMPLOYMENT_TRAINING_FILING_ERROR_CODES.uploadFailed}: empty PDF bytes for ${fileName}`
    );
  }
  if (bytes.byteLength > MAX_FILE_BYTES) {
    throw new Error(
      `${PRE_EMPLOYMENT_TRAINING_FILING_ERROR_CODES.uploadFailed}: File too large (Max 10MB)`
    );
  }
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base || base.trim() === "") {
    throw new Error(
      `${PRE_EMPLOYMENT_TRAINING_FILING_ERROR_CODES.verifyFailed}: Directus base URL is not configured`
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
      `${PRE_EMPLOYMENT_TRAINING_FILING_ERROR_CODES.uploadFailed}: filing upload rejected (${uploadError})`
    );
  }
  const fileId = (uploadBody as { data?: { id?: unknown } } | null)?.data?.id;
  if (typeof fileId !== "string" || fileId.length === 0) {
    throw new Error(
      `${PRE_EMPLOYMENT_TRAINING_FILING_ERROR_CODES.uploadFailed}: upload returned no Directus file id`
    );
  }
  return fileId;
}

function filedRecordPath(userId: number, fileRef: string): string {
  return `/items/employee_file_records?filter[user_id][_eq]=${userId}&filter[file_ref][_eq]=${encodeURIComponent(fileRef)}&fields=id,user_id,list_id,record_name,file_ref&limit=1`;
}

function describeHire(input: {
  userId: number;
  fileName: string;
  applicantId?: number;
}): string {
  if (input.applicantId !== undefined) {
    return `Signed pre-employment training letter — applicant #${input.applicantId}, user_id ${input.userId} (${input.fileName}).`;
  }
  return `Signed pre-employment training letter — user_id ${input.userId} (${input.fileName}).`;
}

let listInFlight: Promise<number> | null = null;

async function doEnsureTrainingFilingListId(): Promise<number> {
  const now = nowPH();
  const typeRows = await readRows(
    `/items/employee_file_record_type?filter[name][_eq]=${encodeURIComponent(PRE_EMPLOYMENT_TYPE_NAME)}&fields=id&limit=1`,
    IdRowSchema
  );
  let typeId = typeRows[0]?.id ?? null;
  if (typeId === null) {
    const created = await createRow(
      "employee_file_record_type",
      {
        name: PRE_EMPLOYMENT_TYPE_NAME,
        description: PRE_EMPLOYMENT_TYPE_DESCRIPTION,
        created_at: now,
        updated_at: now,
      },
      IdRowSchema
    );
    typeId = created.id;
  }
  const listRows = await readRows(
    `/items/employee_file_record_list?filter[record_type_id][_eq]=${typeId}&filter[name][_eq]=${encodeURIComponent(HIRING_DOCS_LIST_NAME)}&fields=id,record_type_id,name&limit=1`,
    RecordListRowSchema
  );
  if (listRows[0]) return listRows[0].id;
  const createdList = await createRow(
    "employee_file_record_list",
    {
      record_type_id: typeId,
      name: HIRING_DOCS_LIST_NAME,
      description: HIRING_DOCS_LIST_DESCRIPTION,
      created_at: now,
      updated_at: now,
    },
    RecordListRowSchema
  );
  return createdList.id;
}

function ensureTrainingFilingListId(): Promise<number> {
  if (listInFlight === null) {
    listInFlight = doEnsureTrainingFilingListId().finally(() => {
      listInFlight = null;
    });
  }
  return listInFlight;
}

export async function fileSignedTrainingLetter(
  rawInput: unknown
): Promise<FileSignedTrainingLetterResult> {
  const validation = FileSignedTrainingLetterInputSchema.safeParse(rawInput);
  if (!validation.success) {
    throw new Error(
      `${PRE_EMPLOYMENT_TRAINING_FILING_ERROR_CODES.invalidInput}: ${validation.error.issues
        .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
        .join("; ")}`
    );
  }
  const { userId, bytes, fileName, applicantId } = validation.data;
  if (bytes.byteLength === 0) {
    throw new Error(
      `${PRE_EMPLOYMENT_TRAINING_FILING_ERROR_CODES.invalidInput}: bytes must not be empty`
    );
  }
  const fileRef = await uploadSignedPdf(bytes, fileName);
  const filed = await readRows(
    filedRecordPath(userId, fileRef),
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
  const listId = await ensureTrainingFilingListId();
  const now = nowPH();
  await createRow(
    "employee_file_records",
    {
      user_id: userId,
      list_id: listId,
      record_name: RECORD_NAME,
      description: describeHire({ userId, fileName, applicantId }),
      file_ref: fileRef,
      is_deleted: 0,
      created_at: now,
      updated_at: now,
    },
    EmployeeFileRecordRowSchema
  );
  const after = await readRows(
    filedRecordPath(userId, fileRef),
    EmployeeFileRecordRowSchema
  );
  if (!after[0]) {
    throw new Error(
      `${PRE_EMPLOYMENT_TRAINING_FILING_ERROR_CODES.verifyFailed}: employee_file_records missing after filing: ${fileRef}`
    );
  }
  return {
    recordId: after[0].id,
    fileRef,
    listId,
    alreadyFiled: false,
  };
}
