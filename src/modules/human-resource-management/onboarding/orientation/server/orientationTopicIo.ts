import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

import {
  OrientationTrackSchema,
  type OrientationTrack,
} from "../types/orientation.schema";
import { syncDerivedTemplateActive } from "./orientationTopicTemplateSync";

// `orientationTopicCode` (the ONLY topic↔template formula) and
// `syncDerivedTemplateActive` are re-exported so the store keeps one surface.
export {
  orientationTopicCode,
  syncDerivedTemplateActive,
} from "./orientationTopicTemplateSync";

// orientationTopicIo.ts — Directus primitives for the orientation topic
// catalog (`orientation_topic`, todo 3 of onboarding-requirements-config).
// This is the ONLY place topic rows are read or written; `../orientationSeed.ts`
// (`DEFAULT_ORIENTATION_TOPICS`) stays the SEED source (todo 6) — never the
// runtime source of the catalog.
//
// Every response is parsed back with the row schema below, so a Directus error
// body or a contract drift fails LOUDLY with a coded error instead of silently
// passing raw rows (the todo-6 false-empty lesson: a swallowed error must
// never read as an empty list).
//
// Live columns (Wave 0, 2026-09-12): id, code, title, track, is_required,
// sort_order, is_active, created_at, created_by, updated_at, updated_by.

export const ORIENTATION_TOPIC_ERROR_CODES = {
  readFailed: "ORIENTATION_TOPIC_READ_FAILED",
  writeFailed: "ORIENTATION_TOPIC_WRITE_FAILED",
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
// orientation_topic — row contract
// ---------------------------------------------------------------------------

// The `tinyint(1)` columns are serialized by the live Directus API as `0 | 1`
// (probed live on onboarding_task_template 2026-09-10) — normalize at the
// boundary so the rest of the app only ever sees a real boolean.
const TopicFlagSchema = z
  .union([z.boolean(), z.number().int().min(0).max(1)])
  .transform((value) => value === true || value === 1);

// `is_active` is TOLERANT — and only for `is_active`: a legacy null/absent
// flag normalizes to `true` (todo 1 semantics); `is_required` stays strict so
// a null required flag can never silently become `false`.
const TopicActiveFlagSchema = z
  .union([z.boolean(), z.number().int().min(0).max(1)])
  .nullish()
  .transform((value) => value !== false && value !== 0);

export const OrientationTopicRowSchema = z.object({
  id: z.number().int().positive(),
  code: z.string().min(1),
  title: z.string().min(1),
  track: OrientationTrackSchema,
  is_required: TopicFlagSchema,
  sort_order: z.number().int(),
  is_active: TopicActiveFlagSchema,
  created_at: z.string().nullable(),
  created_by: z.number().int().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.number().int().nullable(),
});

export type OrientationTopicRow = z.infer<typeof OrientationTopicRowSchema>;

export interface TopicWriteRow {
  code: string;
  title: string;
  track: OrientationTrack;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  created_by: number | null;
  updated_at: string;
  updated_by: number | null;
}

export interface TopicListOptions {
  /** When true, only `is_active=1` rows (the runtime catalog set). */
  activeOnly?: boolean;
}

/** All topics, `sort_order` order; `activeOnly` filters `is_active=1`. */
export async function listTopicRows(
  options: TopicListOptions = {}
): Promise<OrientationTopicRow[]> {
  const query = ["sort=sort_order,id", "limit=-1"];
  if (options.activeOnly === true) {
    query.push("filter[is_active][_eq]=1");
  }
  const body: unknown = await dFetch(
    `/items/orientation_topic?${query.join("&")}`
  );
  return parseRowList(
    OrientationTopicRowSchema,
    body,
    ORIENTATION_TOPIC_ERROR_CODES.readFailed,
    "orientation_topic"
  );
}

/** Active topics only (`is_active=1`). */
export function listActiveTopicRows(): Promise<OrientationTopicRow[]> {
  return listTopicRows({ activeOnly: true });
}

/**
 * One topic by its `code`, regardless of `is_active` — inactive topics stay
 * resolvable for employees who already have their orientation task.
 * @returns The row, or null when the code is unknown.
 */
export async function readTopicRowByCode(
  code: string
): Promise<OrientationTopicRow | null> {
  const body: unknown = await dFetch(
    `/items/orientation_topic?filter[code][_eq]=${encodeURIComponent(
      code
    )}&sort=sort_order,id&limit=1`
  );
  const rows = parseRowList(
    OrientationTopicRowSchema,
    body,
    ORIENTATION_TOPIC_ERROR_CODES.readFailed,
    "orientation_topic"
  );
  return rows[0] ?? null;
}

export async function createTopicRow(
  row: TopicWriteRow
): Promise<OrientationTopicRow> {
  const body: unknown = await dFetch("/items/orientation_topic", {
    method: "POST",
    body: JSON.stringify(row),
  });
  return parseSingle(
    OrientationTopicRowSchema,
    body,
    ORIENTATION_TOPIC_ERROR_CODES.writeFailed,
    "orientation_topic create"
  );
}

/** ONE batch POST for the create-missing seeder (todo 6). */
export async function createTopicRows(
  rows: readonly TopicWriteRow[]
): Promise<OrientationTopicRow[]> {
  const body: unknown = await dFetch("/items/orientation_topic", {
    method: "POST",
    body: JSON.stringify(rows),
  });
  return parseRowList(
    OrientationTopicRowSchema,
    body,
    ORIENTATION_TOPIC_ERROR_CODES.writeFailed,
    "orientation_topic create"
  );
}

export async function patchTopicRow(
  id: number,
  patch: Record<string, unknown>
): Promise<OrientationTopicRow> {
  const body: unknown = await dFetch(`/items/orientation_topic/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return parseSingle(
    OrientationTopicRowSchema,
    body,
    ORIENTATION_TOPIC_ERROR_CODES.writeFailed,
    `orientation_topic/${id} update`
  );
}

/**
 * Soft-delete: `is_active=0`, never a DELETE — per-employee task rows may
 * reference the topic's derived template and must stay readable. The derived
 * template's `is_active` is synced so a deactivated topic stops being required.
 */
export async function softDeleteTopicRow(
  id: number,
  actorId: number | null
): Promise<OrientationTopicRow> {
  const row = await patchTopicRow(id, {
    is_active: 0,
    updated_at: phTimeNow(),
    updated_by: actorId,
  });
  await syncDerivedTemplateActive(
    { code: row.code, is_active: false },
    actorId
  );
  return row;
}

export interface TopicOrderEntry {
  id: number;
  sort_order: number;
}

/** Applies the batch in one sequence, stamping `updated_at`/`updated_by` once. */
export async function reorderTopics(
  entries: readonly TopicOrderEntry[],
  actorId: number | null
): Promise<OrientationTopicRow[]> {
  const now = phTimeNow();
  const updated: OrientationTopicRow[] = [];
  for (const entry of entries) {
    updated.push(
      await patchTopicRow(entry.id, {
        sort_order: entry.sort_order,
        updated_at: now,
        updated_by: actorId,
      })
    );
  }
  return updated;
}
