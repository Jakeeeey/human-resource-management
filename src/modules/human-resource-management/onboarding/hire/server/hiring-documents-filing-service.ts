import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  parsePortalFileMarker,
  portalMarkerPrefix,
} from "@/modules/human-resource-management/employee-portal";
import { listActiveDocSlotConfig } from "@/modules/human-resource-management/employee-portal/server/documentSlotIo";

import { readHireApplicationByApplicant } from "./hire-application";
import { nowPH } from "@/lib/audit";

// hiring-documents-filing-service.ts — auto-files hiring documents into the
// employee's 201 file (`employee_file_records`) under Pre-Employment &
// Personal Records. Covers the application row (photo, signature,
// attachments) and the portal slot files (birth certificate, TOR/diploma,
// NBI, medical, valid ID, …) — the two surfaces whose files previously lived
// only in the Directus file library and never reached the 201 file.
// Mirrors the signing-filing precedent: find-or-create type+list, dedupe by
// (user_id, file_ref), batch insert, verify-after-write. Every UUID filed was
// just read back from a live row. Best-effort at the call sites — failures
// throw here and the step/route converts them to audited non-fatal outcomes.

const PRE_EMPLOYMENT_TYPE_NAME = "Pre-Employment & Personal Records";
const HIRING_DOCS_LIST_NAME = "Hiring Documents";
const HIRING_DOCS_LIST_DESCRIPTION =
  "Application and portal documents auto-filed on hire — one record per submitted file.";

/** `employee_file_records.record_name` is VARCHAR(150). */
const RECORD_NAME_MAX_LENGTH = 150;

function recordNameFor(value: string | null | undefined, fallback: string): string {
  const clean = (value ?? "").trim() || fallback;
  return clean.slice(0, RECORD_NAME_MAX_LENGTH);
}

const IdRowSchema = z.object({ id: z.number().int().positive() });

async function readRows(url: string): Promise<unknown[]> {
  const body: unknown = await dFetch(url);
  const parsed = z.object({ data: z.array(z.unknown()) }).safeParse(body);
  return parsed.success ? parsed.data.data : [];
}

let listInFlight: Promise<number> | null = null;

async function doEnsureHiringDocsListId(): Promise<number> {
  const now = nowPH();
  const typeRows = await readRows(
    `/items/employee_file_record_type?filter[name][_eq]=${encodeURIComponent(PRE_EMPLOYMENT_TYPE_NAME)}&fields=id&limit=1`
  );
  const firstType = typeRows.length > 0 ? IdRowSchema.safeParse(typeRows[0]) : null;
  let resolvedTypeId = firstType && firstType.success ? firstType.data.id : null;
  if (resolvedTypeId === null) {
    const created = (await dFetch("/items/employee_file_record_type", {
      method: "POST",
      body: JSON.stringify({
        name: PRE_EMPLOYMENT_TYPE_NAME,
        description: "Employee 201 pre-employment and personal records.",
        created_at: now,
        updated_at: now,
      }),
    })) as { data?: unknown };
    const parsed = IdRowSchema.safeParse(
      (created as { data?: unknown })?.data ?? null
    );
    if (!parsed.success) {
      throw new Error(
        "HIRING_DOCS_FILING_FAILED: employee_file_record_type create returned no row"
      );
    }
    resolvedTypeId = parsed.data.id;
  }

  const listRows = await readRows(
    `/items/employee_file_record_list?filter[record_type_id][_eq]=${resolvedTypeId}&filter[name][_eq]=${encodeURIComponent(HIRING_DOCS_LIST_NAME)}&fields=id&limit=1`
  );
  const existing = listRows.length > 0 ? IdRowSchema.safeParse(listRows[0]) : null;
  if (existing && existing.success) return existing.data.id;

  const created = (await dFetch("/items/employee_file_record_list", {
    method: "POST",
    body: JSON.stringify({
      record_type_id: resolvedTypeId,
      name: HIRING_DOCS_LIST_NAME,
      description: HIRING_DOCS_LIST_DESCRIPTION,
      created_at: now,
      updated_at: now,
    }),
  })) as { data?: unknown };
  const parsed = IdRowSchema.safeParse(
    (created as { data?: unknown })?.data ?? null
  );
  if (!parsed.success) {
    throw new Error(
      "HIRING_DOCS_FILING_FAILED: employee_file_record_list create returned no row"
    );
  }
  return parsed.data.id;
}

export function ensureHiringDocsListId(): Promise<number> {
  if (listInFlight === null) {
    listInFlight = doEnsureHiringDocsListId().finally(() => {
      listInFlight = null;
    });
  }
  return listInFlight;
}

interface StagedRecord {
  fileRef: string;
  recordName: string;
  description: string;
}

async function listFiledFileRefs(userId: number): Promise<Set<string>> {
  const rows = await readRows(
    `/items/employee_file_records?filter[user_id][_eq]=${userId}&fields=file_ref&limit=-1`
  );
  const refs = new Set<string>();
  for (const row of rows) {
    const parsed = z.object({ file_ref: z.string() }).safeParse(row);
    if (parsed.success && parsed.data.file_ref) refs.add(parsed.data.file_ref);
  }
  return refs;
}

async function insertFileRecords(
  userId: number,
  listId: number,
  staged: StagedRecord[]
): Promise<void> {
  if (staged.length === 0) return;
  const now = nowPH();
  await dFetch("/items/employee_file_records", {
    method: "POST",
    body: JSON.stringify(
      staged.map((entry) => ({
        user_id: userId,
        list_id: listId,
        record_name: entry.recordName,
        description: entry.description,
        file_ref: entry.fileRef,
        is_deleted: 0,
        created_at: now,
        updated_at: now,
      }))
    ),
  });
}

export interface HiringFiledCounts {
  filed: number;
  existing: number;
  listId: number | null;
}

async function fileStagedEntries(
  userId: number,
  staged: StagedRecord[]
): Promise<HiringFiledCounts> {
  const filedRefs = await listFiledFileRefs(userId);
  const pending = staged.filter((entry) => !filedRefs.has(entry.fileRef));
  if (pending.length === 0) {
    return { filed: 0, existing: filedRefs.size, listId: null };
  }
  const listId = await ensureHiringDocsListId();
  await insertFileRecords(userId, listId, pending);

  const after = await listFiledFileRefs(userId);
  const unfiled = pending
    .map((entry) => entry.fileRef)
    .filter((ref) => !after.has(ref));
  if (unfiled.length > 0) {
    throw new Error(
      `HIRING_DOCS_FILING_FAILED: employee_file_records missing after filing: ${unfiled.join(",")}`
    );
  }
  return { filed: pending.length, existing: filedRefs.size, listId };
}

const PortalFileRowSchema = z.object({
  id: z.string().min(1),
  description: z.unknown(),
  uploaded_on: z.string().nullish(),
});

async function collectPortalStaged(userId: number): Promise<StagedRecord[]> {
  const marker = portalMarkerPrefix({ kind: "employee", id: userId });
  const rows = await readRows(
    `/files?filter[description][_contains]=${encodeURIComponent(marker)}&fields=id,description,uploaded_on&limit=100`
  );
  const slots = await listActiveDocSlotConfig();
  const titleByKey = new Map(slots.map((slot) => [slot.key, slot.title]));
  const newestByKey = new Map<string, { fileRef: string; uploadedAt: string }>();
  for (const raw of rows) {
    const parsed = PortalFileRowSchema.safeParse(raw);
    if (!parsed.success) continue;
    const markerParsed = parsePortalFileMarker(parsed.data.description);
    if (!markerParsed || markerParsed.key.kind !== "employee") continue;
    if (markerParsed.key.id !== userId) continue;
    const current = newestByKey.get(markerParsed.doc_key);
    const uploadedAt = parsed.data.uploaded_on ?? "";
    if (!current || uploadedAt > current.uploadedAt) {
      newestByKey.set(markerParsed.doc_key, {
        fileRef: parsed.data.id,
        uploadedAt,
      });
    }
  }
  return [...newestByKey.entries()].map(([docKey, entry]) => {
    const title = titleByKey.get(docKey) ?? docKey;
    return {
      fileRef: entry.fileRef,
      recordName: recordNameFor(title, docKey),
      description: `Portal submission — ${title} (${docKey}).`,
    };
  });
}

const AttachmentRowSchema = z.object({
  file: z.string().min(1),
  label: z.string().nullable(),
  type: z.string().nullable(),
});

async function collectApplicationStaged(
  applicantId: number
): Promise<StagedRecord[]> {
  const application = await readHireApplicationByApplicant(applicantId);
  if (!application) return [];
  const staged: StagedRecord[] = [];
  const tag = `applicant #${applicantId}, application #${application.id}`;
  const photo = application.photo_file?.trim() || "";
  if (photo) {
    staged.push({
      fileRef: photo,
      recordName: "ID Photo",
      description: `Application photo — ${tag}.`,
    });
  }
  const signature = application.signature_file?.trim() || "";
  if (signature) {
    staged.push({
      fileRef: signature,
      recordName: "Signature",
      description: `Application signature — ${tag}.`,
    });
  }
  const attachmentRows = await readRows(
    `/items/application_attachment?filter[application_id][_eq]=${application.id}&fields=file,label,type&limit=-1`
  );
  for (const raw of attachmentRows) {
    const parsed = AttachmentRowSchema.safeParse(raw);
    if (!parsed.success || !parsed.data.file) continue;
    const label = (parsed.data.label ?? "").trim() || parsed.data.type?.trim() || "Attachment";
    staged.push({
      fileRef: parsed.data.file,
      recordName: recordNameFor(label, "Attachment"),
      description: `Application attachment (${parsed.data.type?.trim() || "file"}) — ${tag}.`,
    });
  }
  return staged;
}

export async function filePortalDocumentsForUser(
  userId: number
): Promise<HiringFiledCounts> {
  return fileStagedEntries(userId, await collectPortalStaged(userId));
}

export async function fileHiringDocumentsForHire(input: {
  applicantId: number;
  userId: number;
}): Promise<HiringFiledCounts> {
  const staged = await collectApplicationStaged(input.applicantId);
  const portalStaged = await collectPortalStaged(input.userId);
  const seen = new Set<string>();
  const combined = [...staged, ...portalStaged].filter((entry) =>
    seen.has(entry.fileRef) ? false : (seen.add(entry.fileRef), true)
  );
  return fileStagedEntries(input.userId, combined);
}
