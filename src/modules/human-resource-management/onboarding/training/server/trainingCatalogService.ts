import { z } from "zod";

import {
  createTrainingItemRow,
  createTrainingTemplateRow,
  listAllTrainingItemRows,
  listTrainingItemRows,
  listTrainingTemplateDepartmentRows,
  listTrainingTemplateRows,
  patchTrainingItemRow,
  patchTrainingTemplateRow,
  replaceTrainingTemplateDepartmentRows,
  TRAINING_CATALOG_ERROR_CODES,
  type TrainingItemWriteRow,
  type TrainingTemplateWriteRow,
} from "./trainingCatalogIo";
import {
  CreateTrainingItemSchema,
  CreateTrainingTemplateSchema,
  UpdateTrainingItemSchema,
  UpdateTrainingTemplateSchema,
  type TrainingItem,
  type TrainingTemplate,
  type TrainingTemplateDepartment,
  type TrainingTemplateView,
} from "../types/training-catalog.schema";
import {
  createTemplateRows,
  listTemplateRows,
  patchTemplateRow,
  phTimeNow,
  type TemplateWriteRow,
} from "../../tasks/server/onboardingTaskIo";
import type { OnboardingOwnerRole } from "../../types/onboarding-task.schema";

// trainingCatalogService.ts — the training-template DOMAIN layer over
// `./trainingCatalogIo`: catalog listing, department applicability resolution,
// CRUD with read-back verification, and the derivation of one
// `onboarding_task_template` row per training item.
//
// Department auto-selection (the ONE precedence rule): a hire's department id
// picks the active template whose EFFECTIVE department set contains it (the
// junction rows, falling back to the legacy `department_id` when empty); when
// there is none (or the hire has no department) the active GLOBAL template
// (empty effective set) applies. `resolveApplicableTrainingItems` is the single
// resolver; the materialize filter and the derived-template sync both go
// through it.
//
// `syncTrainingDerivedTemplates` mirrors `orientationTopicTemplateSync`:
// create-missing derived rows, then PATCH `is_active` on existing derived rows
// so deactivation propagates. It is idempotent — a re-run after the catalog
// settles is a true no-op. Reads and writes fail LOUDLY (coded IO errors) —
// never a silent skip.

/** The `onboarding_task_template.code` prefix for a derived training item. */
export const TRAINING_ITEM_CODE_PREFIX = "training_item_";

/**
 * The ONLY training-item ↔ derived-template mapping formula. Example:
 * item id 7 → `training_item_7`. Consumers must never compose the code by hand.
 */
export function trainingItemCode(itemId: number): string {
  return `${TRAINING_ITEM_CODE_PREFIX}${itemId}`;
}

/** The always-present fallback template for a hire with no applicable items. */
export const TRAINING_FALLBACK_TEMPLATE_CODE = "training_recorded";

/** Retired code-owned training rows — dropped from materialization. */
export const LEGACY_TRAINING_TEMPLATE_CODES = [
  "training_assigned",
  "training_completed",
] as const;

/** Derived-row `sort_order` base: training items sort after documents/orientation. */
const TRAINING_SORT_BASE = 300;

type CreateTemplateFields = z.infer<typeof CreateTrainingTemplateSchema>;
type UpdateTemplateFields = z.infer<typeof UpdateTrainingTemplateSchema>;
type CreateItemFields = z.infer<typeof CreateTrainingItemSchema>;
type UpdateItemFields = z.infer<typeof UpdateTrainingItemSchema>;

function fail(code: string, detail: string): never {
  throw new Error(`${code}: ${detail}`);
}

async function readTemplateById(id: number): Promise<TrainingTemplate | null> {
  const rows = await listTrainingTemplateRows({ includeInactive: true });
  return rows.find((row) => row.id === id) ?? null;
}

async function readItemById(id: number): Promise<TrainingItem | null> {
  const rows = await listAllTrainingItemRows({ includeInactive: true });
  return rows.find((row) => row.id === id) ?? null;
}

function groupDepartmentIds(
  rows: readonly TrainingTemplateDepartment[]
): Map<number, number[]> {
  const byTemplate = new Map<number, number[]>();
  for (const row of rows) {
    const bucket = byTemplate.get(row.template_id);
    if (bucket) bucket.push(row.department_id);
    else byTemplate.set(row.template_id, [row.department_id]);
  }
  return byTemplate;
}

function effectiveDepartmentIds(
  template: TrainingTemplate,
  junctionByTemplate: Map<number, number[]>
): number[] {
  const junctionIds = junctionByTemplate.get(template.id);
  if (junctionIds && junctionIds.length > 0) return junctionIds;
  return template.department_id === null ? [] : [template.department_id];
}

async function readTemplateView(
  id: number
): Promise<TrainingTemplateView | null> {
  const [rows, junctions] = await Promise.all([
    listTrainingTemplateRows({ includeInactive: true }),
    listTrainingTemplateDepartmentRows(id),
  ]);
  const raw = rows.find((row) => row.id === id);
  if (!raw) return null;
  const junctionIds = junctions.map((row) => row.department_id);
  return {
    ...raw,
    department_ids:
      junctionIds.length > 0 || raw.department_id === null
        ? junctionIds
        : [raw.department_id],
  };
}

/** One step past the current maximum `sort_order` within one template. */
function nextItemSort(
  rows: readonly TrainingItem[],
  templateId: number
): number {
  let max = 0;
  for (const row of rows) {
    if (row.template_id === templateId && row.sort_order > max) {
      max = row.sort_order;
    }
  }
  return max + 10;
}

/**
 * The whole catalog: every template (active only by default) with its items
 * nested, items in `sort_order` order.
 */
export async function listTrainingTemplates(
  opts: { includeInactive?: boolean } = {}
): Promise<Array<TrainingTemplateView & { items: TrainingItem[] }>> {
  const includeInactive = opts.includeInactive === true;
  const [templates, items, junctions] = await Promise.all([
    listTrainingTemplateRows({ includeInactive }),
    listAllTrainingItemRows({ includeInactive }),
    listTrainingTemplateDepartmentRows(),
  ]);
  const junctionByTemplate = groupDepartmentIds(junctions);
  const byTemplate = new Map<number, TrainingItem[]>();
  for (const item of items) {
    const bucket = byTemplate.get(item.template_id);
    if (bucket) bucket.push(item);
    else byTemplate.set(item.template_id, [item]);
  }
  return templates.map((template) => ({
    ...template,
    department_ids: effectiveDepartmentIds(template, junctionByTemplate),
    items: [...(byTemplate.get(template.id) ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order || a.id - b.id
    ),
  }));
}

/**
 * The items of ONE template, `sort_order` order. Default: active items only;
 * `includeInactive` includes deactivated items.
 * @throws Coded `templateNotFound` when the owning template does not exist.
 */
export async function listTrainingItems(
  templateId: number,
  opts: { includeInactive?: boolean } = {}
): Promise<TrainingItem[]> {
  const template = await readTemplateById(templateId);
  if (!template) {
    fail(
      TRAINING_CATALOG_ERROR_CODES.templateNotFound,
      `training template ${templateId} does not exist`
    );
  }
  return listTrainingItemRows(templateId, {
    includeInactive: opts.includeInactive === true,
  });
}

/**
 * The training that applies to a hire in `departmentId`: the active template
 * whose EFFECTIVE department set contains that id when the hire has a
 * department and such a template exists, otherwise the active GLOBAL template
 * (empty effective set).
 * @returns The chosen template (or null) and its ACTIVE items by `sort_order`.
 */
export async function resolveApplicableTrainingItems(
  departmentId: number | null
): Promise<{ template: TrainingTemplate | null; items: TrainingItem[] }> {
  const [templates, junctions] = await Promise.all([
    listTrainingTemplateRows(),
    listTrainingTemplateDepartmentRows(),
  ]);
  const junctionByTemplate = groupDepartmentIds(junctions);
  const departmentTemplate =
    departmentId === null
      ? undefined
      : templates.find((template) =>
          effectiveDepartmentIds(template, junctionByTemplate).includes(
            departmentId
          )
        );
  const template =
    departmentTemplate ??
    templates.find(
      (candidate) =>
        effectiveDepartmentIds(candidate, junctionByTemplate).length === 0
    ) ??
    null;
  if (!template) return { template: null, items: [] };
  const items = await listTrainingItemRows(template.id);
  return { template, items };
}

/**
 * Narrows a template catalog for one hire's materialization run:
 *   - any non-`training` phase is KEPT unchanged;
 *   - retired legacy training codes are DROPPED;
 *   - the fallback code is KEPT only when the hire has NO applicable items;
 *   - a `training_item_*` code is KEPT only when that item is applicable to the
 *     hire's department; every other training code is KEPT unchanged.
 * The hire's department (null = global) is the ONLY input to applicability.
 */
export async function filterMaterializableTrainingTemplates<
  T extends { phase: string; code: string },
>(templates: readonly T[], departmentId: number | null): Promise<T[]> {
  if (!templates.some((template) => template.phase === "training")) {
    return [...templates];
  }

  const { items } = await resolveApplicableTrainingItems(departmentId);
  const applicableCodes = new Set(
    items.map((item) => trainingItemCode(item.id))
  );
  const hasApplicableItems = applicableCodes.size > 0;

  return templates.filter((template) => {
    if (template.phase !== "training") return true;
    const code = template.code;
    if ((LEGACY_TRAINING_TEMPLATE_CODES as readonly string[]).includes(code)) {
      return false;
    }
    if (code === TRAINING_FALLBACK_TEMPLATE_CODE) return !hasApplicableItems;
    if (code.startsWith(TRAINING_ITEM_CODE_PREFIX)) {
      return applicableCodes.has(code);
    }
    return true;
  });
}

/**
 * Creates one template (`.strict()` create body). `department_ids` absent/empty
 * means GLOBAL; the junction is replaced with the deduped set in the same call
 * and the legacy `department_id` carries the first id. `is_active` absent means
 * active. `code` is immutable after create and must be unique.
 * @throws Coded `codeDuplicate` / `writeNotVisible` / IO failures.
 */
export async function createTrainingTemplate(
  input: CreateTemplateFields & {
    is_active?: boolean;
    actorId?: number | null;
  }
): Promise<TrainingTemplateView> {
  const { actorId: rawActorId, is_active: rawIsActive, ...fields } = input;
  const actorId = rawActorId ?? null;
  const parsed = CreateTrainingTemplateSchema.safeParse(fields);
  if (!parsed.success) {
    fail(
      TRAINING_CATALOG_ERROR_CODES.writeFailed,
      `invalid training template payload (${JSON.stringify(
        parsed.error.flatten()
      )})`
    );
  }

  const current = await listTrainingTemplateRows({ includeInactive: true });
  if (current.some((row) => row.code === parsed.data.code)) {
    fail(
      TRAINING_CATALOG_ERROR_CODES.codeDuplicate,
      `training template code ${parsed.data.code} already exists`
    );
  }

  const departmentIds = [...new Set(parsed.data.department_ids ?? [])];
  const now = phTimeNow();
  const row: TrainingTemplateWriteRow = {
    code: parsed.data.code,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    department_id: departmentIds[0] ?? null,
    is_active: rawIsActive ?? true,
    created_at: now,
    created_by: actorId,
    updated_at: now,
    updated_by: actorId,
  };
  const created = await createTrainingTemplateRow(row);
  await replaceTrainingTemplateDepartmentRows(created.id, departmentIds);
  const verified = await readTemplateView(created.id);
  if (!verified) {
    fail(
      TRAINING_CATALOG_ERROR_CODES.writeNotVisible,
      `training template ${created.id} is not visible after create`
    );
  }
  return verified;
}

/**
 * Patches one template (`.strict()` update body). The row must exist. When
 * `department_ids` is present the junction is replaced with the deduped set and
 * the legacy `department_id` carries its first id (null when empty); otherwise
 * the department scope is left untouched.
 * @throws Coded `templateNotFound` / `writeNotVisible` / IO failures.
 */
export async function updateTrainingTemplate(input: {
  id: number;
  patch: UpdateTemplateFields;
  actorId?: number | null;
}): Promise<TrainingTemplateView> {
  const actorId = input.actorId ?? null;
  const parsed = UpdateTrainingTemplateSchema.safeParse(input.patch);
  if (!parsed.success) {
    fail(
      TRAINING_CATALOG_ERROR_CODES.writeFailed,
      `invalid training template patch (${JSON.stringify(
        parsed.error.flatten()
      )})`
    );
  }

  const existing = await readTemplateById(input.id);
  if (!existing) {
    fail(
      TRAINING_CATALOG_ERROR_CODES.templateNotFound,
      `training template ${input.id} does not exist`
    );
  }

  const { department_ids: departmentIds, ...rest } = parsed.data;
  const patch: Record<string, unknown> = {
    ...rest,
    updated_at: phTimeNow(),
    updated_by: actorId,
  };
  if (departmentIds !== undefined) {
    patch.department_id = [...new Set(departmentIds)][0] ?? null;
  }

  const updated = await patchTrainingTemplateRow(input.id, patch);
  if (departmentIds !== undefined) {
    await replaceTrainingTemplateDepartmentRows(input.id, departmentIds);
  }
  const verified = await readTemplateView(updated.id);
  if (!verified) {
    fail(
      TRAINING_CATALOG_ERROR_CODES.writeNotVisible,
      `training template ${updated.id} is not visible after update`
    );
  }
  return verified;
}

/**
 * Soft-deletes one template (`is_active=false`). Read-back verified through
 * `updateTrainingTemplate`, which owns the `phTimeNow()` audit stamps.
 * @throws Coded `templateNotFound` / `writeNotVisible` / IO failures.
 */
export function deactivateTrainingTemplate(input: {
  id: number;
  actorId?: number | null;
}): Promise<TrainingTemplateView> {
  return updateTrainingTemplate({
    id: input.id,
    patch: { is_active: false },
    actorId: input.actorId ?? null,
  });
}

/**
 * Creates one item under `templateId` (`.strict()` create body; `template_id`
 * is carried out-of-band — the create schema never accepts it). The owning
 * template must exist and `code` must be unique. `is_active` absent means
 * active.
 * @throws Coded `templateNotFound` / `codeDuplicate` / `writeNotVisible`.
 */
export async function createTrainingItem(
  input: CreateItemFields & {
    templateId: number;
    is_active?: boolean;
    actorId?: number | null;
  }
): Promise<TrainingItem> {
  const {
    actorId: rawActorId,
    templateId,
    is_active: rawIsActive,
    ...fields
  } = input;
  const actorId = rawActorId ?? null;
  const parsed = CreateTrainingItemSchema.safeParse(fields);
  if (!parsed.success) {
    fail(
      TRAINING_CATALOG_ERROR_CODES.writeFailed,
      `invalid training item payload (${JSON.stringify(
        parsed.error.flatten()
      )})`
    );
  }

  const current = await listAllTrainingItemRows({ includeInactive: true });
  const template = await readTemplateById(templateId);
  if (!template) {
    fail(
      TRAINING_CATALOG_ERROR_CODES.templateNotFound,
      `training template ${templateId} does not exist`
    );
  }
  if (current.some((row) => row.code === parsed.data.code)) {
    fail(
      TRAINING_CATALOG_ERROR_CODES.codeDuplicate,
      `training item code ${parsed.data.code} already exists`
    );
  }

  const now = phTimeNow();
  const row: TrainingItemWriteRow = {
    template_id: templateId,
    code: parsed.data.code,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    is_required: parsed.data.is_required ?? true,
    sort_order: parsed.data.sort_order ?? nextItemSort(current, templateId),
    is_active: rawIsActive ?? true,
    created_at: now,
    created_by: actorId,
    updated_at: now,
    updated_by: actorId,
  };
  const created = await createTrainingItemRow(row);
  const verified = await readItemById(created.id);
  if (!verified) {
    fail(
      TRAINING_CATALOG_ERROR_CODES.writeNotVisible,
      `training item ${created.id} is not visible after create`
    );
  }
  return verified;
}

/**
 * Patches one item (`.strict()` update body). The row must exist.
 * @throws Coded `itemNotFound` / `writeNotVisible` / IO failures.
 */
export async function updateTrainingItem(input: {
  id: number;
  patch: UpdateItemFields;
  actorId?: number | null;
}): Promise<TrainingItem> {
  const actorId = input.actorId ?? null;
  const parsed = UpdateTrainingItemSchema.safeParse(input.patch);
  if (!parsed.success) {
    fail(
      TRAINING_CATALOG_ERROR_CODES.writeFailed,
      `invalid training item patch (${JSON.stringify(parsed.error.flatten())})`
    );
  }

  const existing = await readItemById(input.id);
  if (!existing) {
    fail(
      TRAINING_CATALOG_ERROR_CODES.itemNotFound,
      `training item ${input.id} does not exist`
    );
  }

  const updated = await patchTrainingItemRow(input.id, {
    ...parsed.data,
    updated_at: phTimeNow(),
    updated_by: actorId,
  });
  const verified = await readItemById(updated.id);
  if (!verified) {
    fail(
      TRAINING_CATALOG_ERROR_CODES.writeNotVisible,
      `training item ${updated.id} is not visible after update`
    );
  }
  return verified;
}

/**
 * Soft-deletes one item (`is_active=false`). Read-back verified through
 * `updateTrainingItem`, which owns the `phTimeNow()` audit stamps.
 * @throws Coded `itemNotFound` / `writeNotVisible` / IO failures.
 */
export function deactivateTrainingItem(input: {
  id: number;
  actorId?: number | null;
}): Promise<TrainingItem> {
  return updateTrainingItem({
    id: input.id,
    patch: { is_active: false },
    actorId: input.actorId ?? null,
  });
}

/**
 * Derives one `onboarding_task_template` row per training item
 * (`code` = `trainingItemCode(item.id)`, phase `training`, owner `hr`,
 * `is_required`/`sort_order` from the item, `is_active` = item active AND
 * owning template active). Create-missing only, then PATCH `is_active` on
 * existing derived rows so deactivation propagates. Idempotent.
 * @param actorId - Audit actor for created/updated columns (null when absent).
 * @returns The derived codes created by this run + the count of flag updates.
 */
export async function syncTrainingDerivedTemplates(
  actorId: number | null = null
): Promise<{ created: string[]; updated: number }> {
  const [items, templates] = await Promise.all([
    listAllTrainingItemRows({ includeInactive: true }),
    listTemplateRows(),
  ]);
  const templateActive = new Map<number, boolean>();
  const existingByCode = new Map<string, { id: number; is_active: boolean }>();
  for (const template of templates) {
    templateActive.set(template.id, template.is_active);
    existingByCode.set(template.code, {
      id: template.id,
      is_active: template.is_active,
    });
  }

  const now = phTimeNow();
  const desired = items
    .filter((item) => templateActive.has(item.template_id))
    .map((item) => ({
      code: trainingItemCode(item.id),
      title: item.title,
      ownerRole: "hr" as OnboardingOwnerRole,
      isRequired: item.is_required,
      sortOrder: TRAINING_SORT_BASE + item.sort_order,
      isActive: item.is_active && templateActive.get(item.template_id) === true,
    }));

  const missing = desired.filter((row) => !existingByCode.has(row.code));
  const createdCodes: string[] = [];
  if (missing.length > 0) {
    const rows: TemplateWriteRow[] = missing.map((row) => ({
      code: row.code,
      title: row.title,
      phase: "training",
      owner_role: row.ownerRole,
      is_required: row.isRequired,
      sort_order: row.sortOrder,
      is_active: row.isActive,
      created_at: now,
      created_by: actorId,
      updated_at: now,
      updated_by: actorId,
    }));
    const created = await createTemplateRows(rows);
    createdCodes.push(...created.map((row) => row.code));
  }

  let updated = 0;
  for (const row of desired) {
    const existing = existingByCode.get(row.code);
    if (!existing || existing.is_active === row.isActive) continue;
    await patchTemplateRow(existing.id, {
      is_active: row.isActive,
      updated_at: now,
      updated_by: actorId,
    });
    updated += 1;
  }

  return { created: createdCodes, updated };
}
