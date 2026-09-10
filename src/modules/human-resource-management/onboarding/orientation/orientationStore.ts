// orientationStore.ts — server-side orientation TOPIC store (seed + overlays).
//
// Topic lists are admin-editable through `upsertTopic` (the topics routes) —
// the seed is the default, never a hardcoded constant in consuming code. Since
// todo 20 the per-employee CHECK-OFFS are NOT held here: they are the
// employee's orientation-phase `onboarding_task` rows, managed by
// `orientation-task-service.ts` (keyed to `user_id`). This file stays pure
// topic data — no `profile_id`, no check state.
//
// Pure logic + module-scoped Maps — no imports beyond the seed, safe for
// routes + harness.

import { DEFAULT_ORIENTATION_TOPICS } from "./orientationSeed";
import type {
  OrientationRole,
  OrientationTopic,
  OrientationTrack,
} from "./types/orientation.schema";

/** Responsible party per track (pdf §7: HR / Department). */
export const TRACK_OWNER: Record<OrientationTrack, OrientationRole> = {
  company: "hr",
  department: "department",
};

/**
 * The `onboarding_task_template.code` for one topic — the ONLY topic↔template
 * mapping formula (`taskTemplateSeed.buildOrientationTemplates` imports this,
 * so the two can never drift). Example: `company-background` →
 * `orientation_company_background`.
 */
export function orientationTopicCode(topicId: string): string {
  return `orientation_${topicId.replace(/-/g, "_")}`;
}

const topics = new Map<string, OrientationTopic>();
let seeded = false;

function ensureSeeded(): void {
  if (seeded) return;
  for (const topic of DEFAULT_ORIENTATION_TOPICS) {
    topics.set(topic.id, { ...topic });
  }
  seeded = true;
}

function nextSortFor(track: OrientationTrack): number {
  let max = 0;
  for (const topic of topics.values()) {
    if (topic.track === track && topic.sort > max) max = topic.sort;
  }
  return max + 1;
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `topic-${Date.now()}`
  );
}

/** All topics (seed + admin overlays), company track first, then sort. */
export function listTopics(): OrientationTopic[] {
  ensureSeeded();
  return [...topics.values()].sort((a, b) => {
    if (a.track !== b.track) return a.track === "company" ? -1 : 1;
    return a.sort - b.sort;
  });
}

/** One topic by id, or null when unknown (check-off ownership gate). */
export function findTopic(topicId: string): OrientationTopic | null {
  ensureSeeded();
  return topics.get(topicId) ?? null;
}

/** Admin upsert: add a topic (id composed when absent) or edit title/required. */
export function upsertTopic(input: {
  id?: string;
  track: OrientationTrack;
  title: string;
  required?: boolean;
}): OrientationTopic {
  ensureSeeded();
  if (input.id !== undefined) {
    const existing = topics.get(input.id) ?? null;
    if (existing) {
      const updated: OrientationTopic = {
        ...existing,
        title: input.title,
        required: input.required ?? existing.required,
      };
      topics.set(existing.id, updated);
      return updated;
    }
    const created: OrientationTopic = {
      id: input.id,
      track: input.track,
      title: input.title,
      required: input.required ?? true,
      sort: nextSortFor(input.track),
    };
    topics.set(created.id, created);
    return created;
  }
  const id = slugify(input.title);
  if (topics.has(id)) {
    const existing = topics.get(id) as OrientationTopic;
    const updated: OrientationTopic = {
      ...existing,
      title: input.title,
      required: input.required ?? existing.required,
    };
    topics.set(id, updated);
    return updated;
  }
  const created: OrientationTopic = {
    id,
    track: input.track,
    title: input.title,
    required: input.required ?? true,
    sort: nextSortFor(input.track),
  };
  topics.set(id, created);
  return created;
}

/** Admin patch of title/required for one topic id (null when unknown). */
export function patchTopic(
  id: string,
  patch: { title?: string; required?: boolean }
): OrientationTopic | null {
  ensureSeeded();
  const existing = topics.get(id) ?? null;
  if (!existing) return null;
  const updated: OrientationTopic = {
    ...existing,
    title: patch.title ?? existing.title,
    required: patch.required ?? existing.required,
  };
  topics.set(id, updated);
  return updated;
}
