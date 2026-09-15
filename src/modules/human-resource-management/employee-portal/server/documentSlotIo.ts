import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

// documentSlotIo.ts — Directus primitives for the hiree document checklist
// catalog (`onboarding_document_slot`, todo 4 of onboarding-requirements-config).
// This is the ONLY place the slot rows are read or written; `PORTAL_DOC_CONFIG`
// in ../portalChecklist.ts stays the SEED source (todo 6) — never the runtime
// source of the checklist config.
//
// Every response is parsed back with the row schema below, so a Directus error
// body or a contract drift fails LOUDLY with a coded error instead of silently
// passing raw rows (the todo-6 false-empty lesson: a swallowed error must
// never read as an empty list).
//
// Live columns (probed 2026-09-12): id, doc_key, title, is_required,
// sort_order, is_active, created_at, created_by, updated_at, updated_by.

export const DOC_SLOT_ERROR_CODES = {
  readFailed: "PORTAL_DOC_SLOT_READ_FAILED",
  writeFailed: "PORTAL_DOC_SLOT_WRITE_FAILED",
} as const;

/** PH wall-time, MySQL-compatible `YYYY-MM-DD HH:mm:ss` (conventions §6). */
export function phTimeNow(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

function fail(code: string, detail: string): never {
  throw new Error(`${code}: ${detail}`);
}

function parseRowList<T>(
  schema: z.ZodType<T>,
  body: unknown,
  code: string,
  label: string
): T[] {
  const envelope = z.object({ data: z.array(z.unknown()) }).safeParse(body);
  if (!envelope.success) {
    fail(
      code,
      `${label} read failed (${JSON.stringify(body).slice(0, 300)})`
    );
  }
  const rows: T[] = [];
  for (const raw of envelope.data.data) {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      fail(
        code,
        `${label} row contract mismatch (${JSON.stringify(parsed.error.flatten())})`
      );
    }
    rows.push(parsed.data);
  }
  return rows;
}

function parseSingle<T>(
  schema: z.ZodType<T>,
  body: unknown,
  code: string,
  label: string
): T {
  const parsed = z.object({ data: schema }).safeParse(body);
  if (!parsed.success) {
    fail(
      code,
      `${label} write/read failed (${JSON.stringify(body).slice(0, 300)})`
    );
  }
  return parsed.data.data;
}

// ---------------------------------------------------------------------------
// onboarding_document_slot — row contract
// ---------------------------------------------------------------------------

/**
 * The widened doc-key contract (todo 8): lower-case snake_case, no leading
 * digit/underscore. The DB column is the runtime source of checklist keys.
 */
export const DOC_SLOT_KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

// The `tinyint(1)` columns are serialized by the live Directus API as `0 | 1`
// (probed live on onboarding_task_template 2026-09-10) — normalize at the
// boundary so the rest of the app only ever sees a real boolean.
const DocSlotFlagSchema = z
  .union([z.boolean(), z.number().int().min(0).max(1)])
  .transform((value) => value === true || value === 1);

// `is_active` is TOLERANT — and only for `is_active`: a legacy null/absent
// flag normalizes to `true` (todo 1 semantics); `is_required` stays strict so
// a null required flag can never silently become `false`.
const DocSlotActiveFlagSchema = z
  .union([z.boolean(), z.number().int().min(0).max(1)])
  .nullish()
  .transform((value) => value !== false && value !== 0);

export const OnboardingDocumentSlotSchema = z.object({
  id: z.number().int().positive(),
  doc_key: z.string().regex(DOC_SLOT_KEY_PATTERN),
  title: z.string().min(1),
  is_required: DocSlotFlagSchema,
  sort_order: z.number().int(),
  is_active: DocSlotActiveFlagSchema,
  created_at: z.string().nullable(),
  created_by: z.number().int().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.number().int().nullable(),
});

export type OnboardingDocumentSlot = z.infer<
  typeof OnboardingDocumentSlotSchema
>;

export interface DocSlotWriteRow {
  doc_key: string;
  title: string;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  created_by: number | null;
  updated_at: string;
  updated_by: number | null;
}

export interface DocSlotListOptions {
  /** When true, only `is_active=1` rows (the checklist runtime set). */
  activeOnly?: boolean;
}

/** All slots, `sort_order` order; `activeOnly` filters `is_active=1`. */
export async function listDocSlotRows(
  options: DocSlotListOptions = {}
): Promise<OnboardingDocumentSlot[]> {
  const query = ["sort=sort_order,id", "limit=-1"];
  if (options.activeOnly === true) {
    query.push("filter[is_active][_eq]=1");
  }
  const body: unknown = await dFetch(
    `/items/onboarding_document_slot?${query.join("&")}`
  );
  return parseRowList(
    OnboardingDocumentSlotSchema,
    body,
    DOC_SLOT_ERROR_CODES.readFailed,
    "onboarding_document_slot"
  );
}

/** Active slots only (`is_active=1`). */
export function listActiveDocSlotRows(): Promise<OnboardingDocumentSlot[]> {
  return listDocSlotRows({ activeOnly: true });
}

export async function createDocSlotRows(
  rows: readonly DocSlotWriteRow[]
): Promise<OnboardingDocumentSlot[]> {
  const body: unknown = await dFetch("/items/onboarding_document_slot", {
    method: "POST",
    body: JSON.stringify(rows),
  });
  return parseRowList(
    OnboardingDocumentSlotSchema,
    body,
    DOC_SLOT_ERROR_CODES.writeFailed,
    "onboarding_document_slot create"
  );
}

export async function patchDocSlotRow(
  id: number,
  patch: Record<string, unknown>
): Promise<OnboardingDocumentSlot> {
  const body: unknown = await dFetch(`/items/onboarding_document_slot/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return parseSingle(
    OnboardingDocumentSlotSchema,
    body,
    DOC_SLOT_ERROR_CODES.writeFailed,
    `onboarding_document_slot/${id} update`
  );
}

/** Soft-delete: `is_active=0`, never a DELETE (existing rows stay readable). */
export async function softDeleteDocSlotRow(
  id: number,
  actorId: number | null
): Promise<OnboardingDocumentSlot> {
  return patchDocSlotRow(id, {
    is_active: 0,
    updated_at: phTimeNow(),
    updated_by: actorId,
  });
}

export interface DocSlotOrderEntry {
  id: number;
  sort_order: number;
}

/** Applies the batch in one sequence, stamping `updated_at`/`updated_by` once. */
export async function reorderDocSlots(
  entries: readonly DocSlotOrderEntry[],
  actorId: number | null
): Promise<OnboardingDocumentSlot[]> {
  const now = phTimeNow();
  const updated: OnboardingDocumentSlot[] = [];
  for (const entry of entries) {
    updated.push(
      await patchDocSlotRow(entry.id, {
        sort_order: entry.sort_order,
        updated_at: now,
        updated_by: actorId,
      })
    );
  }
  return updated;
}

// ---------------------------------------------------------------------------
// Checklist config service — the shape `buildChecklist` consumes (todo 8)
// ---------------------------------------------------------------------------

/** `{ key, title, required }` — the runtime checklist config shape. */
export interface DocSlotConfig {
  key: string;
  title: string;
  required: boolean;
}

/**
 * The active slots mapped to the checklist config shape, `sort_order` order
 * (the IO read already sorts). An empty pre-seed catalog yields `[]` — the
 * checklist degrades to empty, never an error.
 */
export async function listActiveDocSlotConfig(): Promise<DocSlotConfig[]> {
  const slots = await listActiveDocSlotRows();
  return slots.map((slot) => ({
    key: slot.doc_key,
    title: slot.title,
    required: slot.is_required,
  }));
}
