import { z } from "zod";

import { ApplicantStatusSchema } from "@/modules/human-resource-management/onboarding/types/applicant-status";
import type { ApplicantStatus } from "@/modules/human-resource-management/onboarding/types/applicant-status";
import {
  ActivePaperworkTemplateSchema,
  getPhilippineTime,
  insertRows,
  readList,
} from "./signingSetIo";

// signingFilingIo.ts — Directus IO primitives for the deferred filing service
// (todo 17). The flow decisions live in `signing-filing-service.ts`; this file
// owns the `employee_file_records` / list / file-existence row contracts and
// the resolve-or-create of the signed-documents intake list, so a drifted
// column fails loudly instead of silently feeding the filing.

/** Intake category of the auto-filed signed onboarding documents. */
export const SIGNED_DOCS_TYPE_NAME = "Employment & Contractual Documents";

/** Intake list that receives the auto-filed signed documents. */
export const SIGNED_DOCS_LIST_NAME = "Signed Onboarding Paperwork";

const SIGNED_DOCS_TYPE_DESCRIPTION =
  "Documents defining the legal employer-employee relationship (contract, NDA, appointment papers). Signed onboarding paperwork is auto-filed here on hire.";

const SIGNED_DOCS_LIST_DESCRIPTION =
  "Signed onboarding paperwork auto-filed on hire — one record per signed paperwork item.";

const ApplicantStatusRowSchema = z.looseObject({
  id: z.number().int().positive(),
  status: ApplicantStatusSchema,
});

const RecordTypeRowSchema = z.looseObject({
  id: z.number().int().positive(),
  name: z.string(),
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

const DirectusFileRowSchema = z.looseObject({ id: z.string().min(1) });

export type EmployeeFileRecordRow = z.infer<typeof EmployeeFileRecordRowSchema>;

/** One filed-PDF record payload (created_at/updated_at are PH-stamped by the caller). */
export interface FiledPdfRecordInput {
  userId: number;
  listId: number;
  recordName: string;
  description: string;
  fileRef: string;
  now: string;
}

/** The applicant's current status (null when the read returns no row). */
export async function readApplicantStatus(
  applicantId: number
): Promise<ApplicantStatus | null> {
  const rows = await readList(
    `/items/applicant?filter[id][_eq]=${applicantId}&fields=id,status&limit=1`,
    ApplicantStatusRowSchema
  );
  return rows[0]?.status ?? null;
}

/** Records already filed to this employee for the staged PDFs (any state). */
export function listFiledRecords(
  userId: number,
  fileRefs: readonly string[]
): Promise<EmployeeFileRecordRow[]> {
  return readList(
    `/items/employee_file_records?filter[user_id][_eq]=${userId}&filter[file_ref][_in]=${fileRefs.join(",")}&fields=id,user_id,list_id,record_name,file_ref&limit=-1`,
    EmployeeFileRecordRowSchema
  );
}

/** Subset of the staged UUIDs that still resolve to a Directus file. */
export async function listExistingFileRefs(
  fileRefs: readonly string[]
): Promise<string[]> {
  const rows = await readList(
    `/files?filter[id][_in]=${fileRefs.join(",")}&fields=id&limit=-1`,
    DirectusFileRowSchema
  );
  return rows.map((row) => row.id);
}

/** Template id -> title for record naming. */
export async function listTemplateTitles(
  templateIds: readonly number[]
): Promise<Map<number, string>> {
  const rows = await readList(
    `/items/paperwork_templates?filter[id][_in]=${templateIds.join(",")}&fields=id,title&limit=-1`,
    ActivePaperworkTemplateSchema
  );
  return new Map(rows.map((row) => [row.id, row.title]));
}

/** ONE batch insert of the filed-PDF records (no-op on an empty batch). */
export async function insertFiledPdfRecords(
  inputs: readonly FiledPdfRecordInput[]
): Promise<void> {
  if (inputs.length === 0) return;
  await insertRows(
    "employee_file_records",
    inputs.map((input) => ({
      user_id: input.userId,
      list_id: input.listId,
      record_name: input.recordName,
      description: input.description,
      file_ref: input.fileRef,
      is_deleted: 0,
      created_at: input.now,
      updated_at: input.now,
    })),
    EmployeeFileRecordRowSchema
  );
}

/** Resolve-or-create the intake list; single-flight so concurrent hires create it once. */
let listInFlight: Promise<number> | null = null;

async function doEnsureSignedDocsListId(): Promise<number> {
  const now = getPhilippineTime();
  const typeRows = await readList(
    `/items/employee_file_record_type?filter[name][_eq]=${encodeURIComponent(SIGNED_DOCS_TYPE_NAME)}&fields=id,name&limit=1`,
    RecordTypeRowSchema
  );
  let typeId = typeRows[0]?.id ?? null;
  if (typeId === null) {
    const createdTypes = await insertRows(
      "employee_file_record_type",
      [
        {
          name: SIGNED_DOCS_TYPE_NAME,
          description: SIGNED_DOCS_TYPE_DESCRIPTION,
          created_at: now,
          updated_at: now,
        },
      ],
      RecordTypeRowSchema
    );
    typeId = createdTypes[0]?.id ?? null;
    if (typeId === null) {
      throw new Error(
        "SIGNED_PDF_FILING_VERIFY_FAILED: employee_file_record_type create returned no row"
      );
    }
  }

  const listRows = await readList(
    `/items/employee_file_record_list?filter[record_type_id][_eq]=${typeId}&filter[name][_eq]=${encodeURIComponent(SIGNED_DOCS_LIST_NAME)}&fields=id,record_type_id,name&limit=1`,
    RecordListRowSchema
  );
  if (listRows[0]) return listRows[0].id;

  const createdLists = await insertRows(
    "employee_file_record_list",
    [
      {
        record_type_id: typeId,
        name: SIGNED_DOCS_LIST_NAME,
        description: SIGNED_DOCS_LIST_DESCRIPTION,
        created_at: now,
        updated_at: now,
      },
    ],
    RecordListRowSchema
  );
  const listId = createdLists[0]?.id ?? null;
  if (listId === null) {
    throw new Error(
      "SIGNED_PDF_FILING_VERIFY_FAILED: employee_file_record_list create returned no row"
    );
  }
  return listId;
}

export function ensureSignedDocsListId(): Promise<number> {
  if (listInFlight === null) {
    listInFlight = doEnsureSignedDocsListId().finally(() => {
      listInFlight = null;
    });
  }
  return listInFlight;
}
