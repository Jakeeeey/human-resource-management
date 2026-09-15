// orientationStore.ts — server-side orientation TOPIC store (Directus-backed).
//
// Topic rows live in the `orientation_topic` Directus collection (todo 3 of
// onboarding-requirements-config); this file is the DOMAIN layer over
// `./server/orientationTopicIo.ts` — ordering, slug composition, admin
// upsert/patch semantics and the pinned topic→derived-template `is_active`
// sync. There is NO module-level Map: the DB survives restarts.
//
// The per-employee CHECK-OFFS are NOT held here: they are the employee's
// orientation-phase `onboarding_task` rows, managed by
// `orientation-task-service.ts` (keyed to `user_id`). This file stays pure
// topic data — no `profile_id`, no check state.
//
// `orientationTopicCode` (the ONLY topic↔template mapping formula) is
// re-exported from the IO module, so every existing importer keeps the same
// path (`taskTemplateSeed.buildOrientationTemplates`).

import {
  createTopicRow,
  listActiveTopicRows,
  listTopicRows,
  patchTopicRow,
  phTimeNow,
  readTopicRowByCode,
  syncDerivedTemplateActive,
  type OrientationTopicRow,
  type TopicWriteRow,
} from "./server/orientationTopicIo";
import type {
  OrientationRole,
  OrientationTopic,
  OrientationTrack,
} from "./types/orientation.schema";

export { orientationTopicCode } from "./server/orientationTopicIo";

/** Responsible party per track (pdf §7: HR / Department). */
export const TRACK_OWNER: Record<OrientationTrack, OrientationRole> = {
  company: "hr",
  department: "department",
};

/** Row → domain mapping: `code` is the app-level topic id. */
function toTopic(row: OrientationTopicRow): OrientationTopic {
  return {
    id: row.code,
    track: row.track,
    title: row.title,
    required: row.is_required,
    sort: row.sort_order,
  };
}

/** Company track first, then DB `sort_order` — the legacy display order. */
function sortTopics(rows: readonly OrientationTopicRow[]): OrientationTopic[] {
  return [...rows]
    .sort((a, b) => {
      if (a.track !== b.track) return a.track === "company" ? -1 : 1;
      return a.sort_order - b.sort_order;
    })
    .map(toTopic);
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `topic-${Date.now()}`
  );
}

async function nextSortFor(track: OrientationTrack): Promise<number> {
  const rows = await listTopicRows();
  let max = 0;
  for (const row of rows) {
    if (row.track === track && row.sort_order > max) max = row.sort_order;
  }
  return max + 1;
}

/** Active topics (company track first, then sort) — the runtime catalog. */
export async function listTopics(): Promise<OrientationTopic[]> {
  return sortTopics(await listActiveTopicRows());
}

/**
 * Every topic INCLUDING inactive rows — the admin listing and the resolution
 * source for employees who already hold a task for a deactivated topic.
 */
export async function listAllTopics(): Promise<OrientationTopic[]> {
  return sortTopics(await listTopicRows());
}

/**
 * One topic by code, or null when unknown. Inactive topics STILL resolve so an
 * employee who already has a task keeps a visible, check-off-able item (the
 * active-union / requiredness policy lives in `orientation-task-service.ts`).
 */
export async function findTopic(
  topicId: string
): Promise<OrientationTopic | null> {
  const row = await readTopicRowByCode(topicId);
  return row ? toTopic(row) : null;
}

export interface UpsertTopicInput {
  /** Explicit topic code; composed from the title when absent. */
  id?: string;
  track: OrientationTrack;
  title: string;
  required?: boolean;
  /** Session actor for `created_by` / `updated_by` (null when unavailable). */
  actorId?: number | null;
}

/**
 * Admin upsert: edit title/required for an existing code, or create a topic
 * (id composed from the title when absent, sort appended per track, active on
 * create).
 */
export async function upsertTopic(
  input: UpsertTopicInput
): Promise<OrientationTopic> {
  const code = input.id ?? slugify(input.title);
  const existing = await readTopicRowByCode(code);
  const now = phTimeNow();
  const actorId = input.actorId ?? null;

  if (existing) {
    const patch: Record<string, unknown> = {};
    if (existing.title !== input.title) patch.title = input.title;
    const required = input.required ?? existing.is_required;
    if (required !== existing.is_required) patch.is_required = required;
    if (Object.keys(patch).length === 0) return toTopic(existing);
    patch.updated_at = now;
    patch.updated_by = actorId;
    return toTopic(await patchTopicRow(existing.id, patch));
  }

  const write: TopicWriteRow = {
    code,
    title: input.title,
    track: input.track,
    is_required: input.required ?? true,
    sort_order: await nextSortFor(input.track),
    is_active: true,
    created_at: now,
    created_by: actorId,
    updated_at: now,
    updated_by: actorId,
  };
  return toTopic(await createTopicRow(write));
}

export interface PatchTopicInput {
  title?: string;
  required?: boolean;
  /** Admin deactivate/reactivate — syncs the derived template's `is_active`. */
  is_active?: boolean;
  actorId?: number | null;
}

/**
 * Admin patch of title/required/is_active for one topic code (null when the
 * code is unknown). The derived `onboarding_task_template.is_active` is synced
 * WHEN AND ONLY WHEN the patch actually changes `is_active` (todo 2's pin):
 * title / track / sort edits never touch the derived template.
 */
export async function patchTopic(
  id: string,
  patch: PatchTopicInput
): Promise<OrientationTopic | null> {
  const existing = await readTopicRowByCode(id);
  if (!existing) return null;

  const rowPatch: Record<string, unknown> = {};
  if (patch.title !== undefined && patch.title !== existing.title) {
    rowPatch.title = patch.title;
  }
  if (patch.required !== undefined && patch.required !== existing.is_required) {
    rowPatch.is_required = patch.required;
  }
  const activeChanged =
    patch.is_active !== undefined && patch.is_active !== existing.is_active;
  if (activeChanged) rowPatch.is_active = patch.is_active;

  if (Object.keys(rowPatch).length === 0) return toTopic(existing);

  const actorId = patch.actorId ?? null;
  rowPatch.updated_at = phTimeNow();
  rowPatch.updated_by = actorId;
  const updated = await patchTopicRow(existing.id, rowPatch);

  if (activeChanged) {
    await syncDerivedTemplateActive(
      { code: updated.code, is_active: updated.is_active },
      actorId
    );
  }
  return toTopic(updated);
}
