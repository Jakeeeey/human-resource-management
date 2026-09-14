import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

import {
  TrainingItemSchema,
  TrainingTemplateSchema,
  type TrainingItem,
  type TrainingTemplate,
} from "../types/training-catalog.schema";

// trainingCatalogIo.ts — Directus primitives for the "Onboarding Training
// Templates" catalog (`onboarding_training_template` / `onboarding_training_item`).
// This is the ONLY place those rows are read or written.
//
// Every response is parsed back with the training-catalog record schemas, so a
// Directus error body or a contract drift fails LOUDLY with a coded error
// instead of silently passing raw rows (the false-empty lesson: a swallowed
// error must never read as an empty list). `readUserDepartmentId` is the ONE
// deliberate exception — a failed user read logs and answers null (a missing
// department is not an error; the hire simply falls back to the GLOBAL
// template), and never throws.
//
// Live columns: onboarding_training_template {id, code, title, description,
// department_id (nullable int), is_active, created_at, created_by, updated_at,
// updated_by}; onboarding_training_item {id, template_id, code, title,
// description, is_required, sort_order, is_active, audit cols}.

export const TRAINING_CATALOG_ERROR_CODES = {
  templateNotFound: "TRAINING_CATALOG_TEMPLATE_NOT_FOUND",
  itemNotFound: "TRAINING_CATALOG_ITEM_NOT_FOUND",
  codeDuplicate: "TRAINING_CATALOG_CODE_DUPLICATE",
  writeNotVisible: "TRAINING_CATALOG_WRITE_NOT_VISIBLE",
  readFailed: "TRAINING_CATALOG_READ_FAILED",
  writeFailed: "TRAINING_CATALOG_WRITE_FAILED",
} as const;

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

/** Directus answers a duplicate natural key (`RECORD_NOT_UNIQUE` / "duplicate entry"). */
function isDuplicateError(body: unknown): boolean {
  const errors = (
    body as { errors?: Array<{ extensions?: { code?: string } }> } | null
  )?.errors;
  if (
    Array.isArray(errors) &&
    errors.some((entry) => entry?.extensions?.code === "RECORD_NOT_UNIQUE")
  ) {
    return true;
  }
  return JSON.stringify(body ?? "")
    .toLowerCase()
    .includes("duplicate entry");
}

// ---------------------------------------------------------------------------
// onboarding_training_template — catalog IO
// ---------------------------------------------------------------------------

export interface TrainingTemplateWriteRow {
  code: string;
  title: string;
  description: string | null;
  /** null = GLOBAL template (applies to every department). */
  department_id: number | null;
  is_active: boolean;
  created_at: string;
  created_by: number | null;
  updated_at: string;
  updated_by: number | null;
}

export interface TrainingCatalogListOptions {
  /** When true, include deactivated rows (default: active only). */
  includeInactive?: boolean;
}

/** Templates, id order; the default keeps `is_active=1` rows only. */
export async function listTrainingTemplateRows(
  opts: TrainingCatalogListOptions = {}
): Promise<TrainingTemplate[]> {
  const query = ["sort=id", "limit=-1"];
  if (opts.includeInactive !== true) {
    query.push("filter[is_active][_eq]=1");
  }
  const body: unknown = await dFetch(
    `/items/onboarding_training_template?${query.join("&")}`
  );
  return parseRowList(
    TrainingTemplateSchema,
    body,
    TRAINING_CATALOG_ERROR_CODES.readFailed,
    "onboarding_training_template"
  );
}

export async function createTrainingTemplateRow(
  row: TrainingTemplateWriteRow
): Promise<TrainingTemplate> {
  const body: unknown = await dFetch("/items/onboarding_training_template", {
    method: "POST",
    body: JSON.stringify(row),
  });
  const parsed = z
    .object({ data: TrainingTemplateSchema })
    .safeParse(body);
  if (parsed.success) return parsed.data.data;
  if (isDuplicateError(body)) {
    fail(
      TRAINING_CATALOG_ERROR_CODES.codeDuplicate,
      `onboarding_training_template create rejected (${JSON.stringify(body).slice(0, 300)})`
    );
  }
  fail(
    TRAINING_CATALOG_ERROR_CODES.writeFailed,
    `onboarding_training_template create failed (${JSON.stringify(body).slice(0, 300)})`
  );
}

export async function patchTrainingTemplateRow(
  id: number,
  patch: Record<string, unknown>
): Promise<TrainingTemplate> {
  const body: unknown = await dFetch(`/items/onboarding_training_template/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return parseSingle(
    TrainingTemplateSchema,
    body,
    TRAINING_CATALOG_ERROR_CODES.writeFailed,
    `onboarding_training_template/${id} update`
  );
}

// ---------------------------------------------------------------------------
// onboarding_training_item — catalog IO
// ---------------------------------------------------------------------------

export interface TrainingItemWriteRow {
  template_id: number;
  code: string;
  title: string;
  description: string | null;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  created_by: number | null;
  updated_at: string;
  updated_by: number | null;
}

/** Items of ONE template, `sort_order` order; default keeps `is_active=1` rows. */
export async function listTrainingItemRows(
  templateId: number,
  opts: TrainingCatalogListOptions = {}
): Promise<TrainingItem[]> {
  const query = [
    `filter[template_id][_eq]=${templateId}`,
    "sort=sort_order,id",
    "limit=-1",
  ];
  if (opts.includeInactive !== true) {
    query.push("filter[is_active][_eq]=1");
  }
  const body: unknown = await dFetch(
    `/items/onboarding_training_item?${query.join("&")}`
  );
  return parseRowList(
    TrainingItemSchema,
    body,
    TRAINING_CATALOG_ERROR_CODES.readFailed,
    "onboarding_training_item"
  );
}

/** Every item across all templates, `sort_order` order within each template. */
export async function listAllTrainingItemRows(
  opts: TrainingCatalogListOptions = {}
): Promise<TrainingItem[]> {
  const query = ["sort=template_id,sort_order,id", "limit=-1"];
  if (opts.includeInactive !== true) {
    query.push("filter[is_active][_eq]=1");
  }
  const body: unknown = await dFetch(
    `/items/onboarding_training_item?${query.join("&")}`
  );
  return parseRowList(
    TrainingItemSchema,
    body,
    TRAINING_CATALOG_ERROR_CODES.readFailed,
    "onboarding_training_item"
  );
}

export async function createTrainingItemRow(
  row: TrainingItemWriteRow
): Promise<TrainingItem> {
  const body: unknown = await dFetch("/items/onboarding_training_item", {
    method: "POST",
    body: JSON.stringify(row),
  });
  const parsed = z.object({ data: TrainingItemSchema }).safeParse(body);
  if (parsed.success) return parsed.data.data;
  if (isDuplicateError(body)) {
    fail(
      TRAINING_CATALOG_ERROR_CODES.codeDuplicate,
      `onboarding_training_item create rejected (${JSON.stringify(body).slice(0, 300)})`
    );
  }
  fail(
    TRAINING_CATALOG_ERROR_CODES.writeFailed,
    `onboarding_training_item create failed (${JSON.stringify(body).slice(0, 300)})`
  );
}

export async function patchTrainingItemRow(
  id: number,
  patch: Record<string, unknown>
): Promise<TrainingItem> {
  const body: unknown = await dFetch(`/items/onboarding_training_item/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return parseSingle(
    TrainingItemSchema,
    body,
    TRAINING_CATALOG_ERROR_CODES.writeFailed,
    `onboarding_training_item/${id} update`
  );
}

// ---------------------------------------------------------------------------
// user — the hire's department drives which training template applies
// ---------------------------------------------------------------------------

// `user_department` is a nullable department reference. Directus may serialize
// an M2O as the scalar id or as an expanded `{ department_id }` object, so both
// are accepted; the ONE rule is that a department resolves to a positive int or
// null.
const UserDepartmentSchema = z.object({
  user_department: z
    .union([
      z.number().int(),
      z.string().regex(/^\d+$/),
      z.object({ department_id: z.number().int() }),
    ])
    .nullable(),
});

/**
 * @param userId - `user.user_id` (the employee key the task engine uses).
 * @returns The department id, or null when the hire has none / the read failed.
 * Never throws — a missing department is not an error, it just means the hire
 * falls back to the GLOBAL training template.
 */
export async function readUserDepartmentId(
  userId: number
): Promise<number | null> {
  try {
    const body: unknown = await dFetch(
      `/items/user/${userId}?fields=user_department`
    );
    const parsed = z.object({ data: UserDepartmentSchema }).safeParse(body);
    if (!parsed.success) {
      console.error(
        `[trainingCatalogIo] user ${userId} department read failed (${JSON.stringify(
          body
        ).slice(0, 300)})`
      );
      return null;
    }
    const raw = parsed.data.data.user_department;
    if (raw === null) return null;
    if (typeof raw === "number") return raw > 0 ? raw : null;
    if (typeof raw === "string") {
      const value = Number(raw);
      return Number.isInteger(value) && value > 0 ? value : null;
    }
    return raw.department_id > 0 ? raw.department_id : null;
  } catch (error) {
    console.error(
      `[trainingCatalogIo] user ${userId} department read threw:`,
      error
    );
    return null;
  }
}
