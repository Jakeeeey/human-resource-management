import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

import type { EquipmentCatalogItem } from "../equipmentCatalog";
import {
  EquipmentIssuerSchema,
  type EquipmentIssuer,
} from "../types/equipment-issue.schema";

// equipmentItemIo.ts — Directus primitives for the equipment handover catalog
// (`onboarding_equipment_item`, todo 5 of onboarding-requirements-config).
// This is the ONLY place item rows are read or written, and since todo 9 it is
// ALSO the runtime source of the catalog (`loadEquipmentCatalog()` below) for
// the status/issues/acks routes. `PDF_SECTION_9_CATALOG` in
// ../equipmentCatalog.ts stays a SEED source only (todo 6); the legacy fs/JSON
// loader (equipmentCatalogServer.ts + equipment-catalog.config.json) is gone.
//
// Every response is parsed back with the row schema below, so a Directus error
// body or a contract drift fails LOUDLY with a coded error instead of silently
// passing raw rows (the todo-6 false-empty lesson: a swallowed error must
// never read as an empty list).
//
// Live columns (probed 2026-09-12): id, item_key, label, issuer, is_required,
// sort_order, is_active, created_at, created_by, updated_at, updated_by.

export const EQUIPMENT_ITEM_ERROR_CODES = {
  readFailed: "EQUIPMENT_ITEM_READ_FAILED",
  writeFailed: "EQUIPMENT_ITEM_WRITE_FAILED",
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
// onboarding_equipment_item — row contract
// ---------------------------------------------------------------------------

/** pdf §9 key contract: lower-case letters, digits, underscore. */
export const EQUIPMENT_ITEM_KEY_PATTERN = /^[a-z0-9_]{1,64}$/;

// The `tinyint(1)` columns are serialized by the live Directus API as `0 | 1`
// — normalize at the boundary so the rest of the app only ever sees a real
// boolean.
const EquipmentItemFlagSchema = z
  .union([z.boolean(), z.number().int().min(0).max(1)])
  .transform((value) => value === true || value === 1);

// `is_active` is TOLERANT — and only for `is_active`: a legacy null/absent
// flag normalizes to `true` (todo 1 semantics); `is_required` stays strict so
// a null required flag can never silently become `false`.
const EquipmentItemActiveFlagSchema = z
  .union([z.boolean(), z.number().int().min(0).max(1)])
  .nullish()
  .transform((value) => value !== false && value !== 0);

export const OnboardingEquipmentItemSchema = z.object({
  id: z.number().int().positive(),
  item_key: z.string().regex(EQUIPMENT_ITEM_KEY_PATTERN),
  label: z.string().min(1),
  issuer: EquipmentIssuerSchema,
  is_required: EquipmentItemFlagSchema,
  sort_order: z.number().int(),
  is_active: EquipmentItemActiveFlagSchema,
  created_at: z.string().nullable(),
  created_by: z.number().int().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.number().int().nullable(),
});

export type OnboardingEquipmentItem = z.infer<
  typeof OnboardingEquipmentItemSchema
>;

export interface EquipmentItemWriteRow {
  item_key: string;
  label: string;
  issuer: EquipmentIssuer;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  created_by: number | null;
  updated_at: string;
  updated_by: number | null;
}

export interface EquipmentItemListOptions {
  /** When true, only `is_active=1` rows (the runtime catalog set). */
  activeOnly?: boolean;
}

/** All items, `sort_order` order; `activeOnly` filters `is_active=1`. */
export async function listEquipmentItemRows(
  options: EquipmentItemListOptions = {}
): Promise<OnboardingEquipmentItem[]> {
  const query = ["sort=sort_order,id", "limit=-1"];
  if (options.activeOnly === true) {
    query.push("filter[is_active][_eq]=1");
  }
  const body: unknown = await dFetch(
    `/items/onboarding_equipment_item?${query.join("&")}`
  );
  return parseRowList(
    OnboardingEquipmentItemSchema,
    body,
    EQUIPMENT_ITEM_ERROR_CODES.readFailed,
    "onboarding_equipment_item"
  );
}

/** Active items only (`is_active=1`). */
export function listActiveEquipmentItemRows(): Promise<
  OnboardingEquipmentItem[]
> {
  return listEquipmentItemRows({ activeOnly: true });
}

export async function createEquipmentItemRows(
  rows: readonly EquipmentItemWriteRow[]
): Promise<OnboardingEquipmentItem[]> {
  const body: unknown = await dFetch("/items/onboarding_equipment_item", {
    method: "POST",
    body: JSON.stringify(rows),
  });
  return parseRowList(
    OnboardingEquipmentItemSchema,
    body,
    EQUIPMENT_ITEM_ERROR_CODES.writeFailed,
    "onboarding_equipment_item create"
  );
}

export async function patchEquipmentItemRow(
  id: number,
  patch: Record<string, unknown>
): Promise<OnboardingEquipmentItem> {
  const body: unknown = await dFetch(`/items/onboarding_equipment_item/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return parseSingle(
    OnboardingEquipmentItemSchema,
    body,
    EQUIPMENT_ITEM_ERROR_CODES.writeFailed,
    `onboarding_equipment_item/${id} update`
  );
}

/**
 * Soft-delete: `is_active=0`, never a DELETE — issue/ack doc_refs may
 * reference the item key and must stay readable.
 */
export async function softDeleteEquipmentItemRow(
  id: number,
  actorId: number | null
): Promise<OnboardingEquipmentItem> {
  return patchEquipmentItemRow(id, {
    is_active: 0,
    updated_at: phTimeNow(),
    updated_by: actorId,
  });
}

export interface EquipmentItemOrderEntry {
  id: number;
  sort_order: number;
}

/** Applies the batch in one sequence, stamping `updated_at`/`updated_by` once. */
export async function reorderEquipmentItems(
  entries: readonly EquipmentItemOrderEntry[],
  actorId: number | null
): Promise<OnboardingEquipmentItem[]> {
  const now = phTimeNow();
  const updated: OnboardingEquipmentItem[] = [];
  for (const entry of entries) {
    updated.push(
      await patchEquipmentItemRow(entry.id, {
        sort_order: entry.sort_order,
        updated_at: now,
        updated_by: actorId,
      })
    );
  }
  return updated;
}

// ---------------------------------------------------------------------------
// Catalog service — the shape the equipment feature consumes (todo 9)
// ---------------------------------------------------------------------------

/**
 * The active items mapped to the catalog shape the equipment feature consumes
 * (`key`/`label`/`issuer`/`required`), `sort_order` order (the IO read already
 * sorts). An empty pre-seed catalog yields `[]` — the equipment tab degrades
 * to empty, never an error.
 *
 * `source` is DERIVED as a constant: after the migration the DB is the
 * runtime source, so both seeded pdf §9 defaults and HR-added items are
 * DB-configured (the legacy `pdf-9` / JSON `admin-config` split is gone).
 */
export async function loadEquipmentCatalog(): Promise<EquipmentCatalogItem[]> {
  const rows = await listActiveEquipmentItemRows();
  return rows.map((row) => ({
    key: row.item_key,
    label: row.label,
    issuer: row.issuer,
    required: row.is_required,
    source: "admin-config",
  }));
}
