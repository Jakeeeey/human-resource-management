// orientationStore.ts — server-side orientation state (seed + check-offs).
//
// Backing: runtime store seeded from `orientationSeed.ts`. Topic lists are
// admin-editable through `upsertTopic` (the topics routes) — the seed is
// the default, never a hardcoded constant in consuming code. Per-hire
// check-offs live here keyed `<profile_id>:<topic_id>`.
//
// Role gate (THE rule for Todo 11): company topics check off ONLY by `hr`;
// department topics ONLY by `department`. A wrong-role attempt returns
// `{ ok: false, forbidden: true }` (routes map to 403) and moves NOTHING —
// the predicate stays exactly where it was.
//
// Pure logic + module-scoped Maps — no imports, safe for routes + harness.
// Production note: if the owner later creates an `orientation_checks`
// Directus collection, swap this store's internals; the function shapes
// (and the 403/predicate contract) stay identical.

import { DEFAULT_ORIENTATION_TOPICS } from "./orientationSeed";
import type {
  OrientationCheck,
  OrientationRole,
  OrientationTopic,
  OrientationTrack,
} from "./types/orientation.schema";

function getPhilippineTime(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

/** Responsible party per track (pdf §7: HR / Department). */
export const TRACK_OWNER: Record<OrientationTrack, OrientationRole> = {
  company: "hr",
  department: "department",
};

const topics = new Map<string, OrientationTopic>();
let seeded = false;

function ensureSeeded(): void {
  if (seeded) return;
  for (const topic of DEFAULT_ORIENTATION_TOPICS) {
    topics.set(topic.id, { ...topic });
  }
  seeded = true;
}

const checks = new Map<string, OrientationCheck>();

function checkKey(profileId: number, topicId: string): string {
  return `${profileId}:${topicId}`;
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
  topics.set(created.id, created);
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

export type CheckOffResult =
  | { ok: true; check: OrientationCheck }
  | { ok: false; forbidden: true; reason: string }
  | { ok: false; forbidden: false; reason: string };

/**
 * Check off one topic for one hire. Wrong responsible party → forbidden
 * (403 at the route, predicate unmoved). Unknown topic → not-found
 * (404 at the route). Idempotent: re-checking returns the existing row.
 */
export function checkOffTopic(input: {
  profileId: number;
  topicId: string;
  role: OrientationRole;
}): CheckOffResult {
  ensureSeeded();
  const topic = topics.get(input.topicId) ?? null;
  if (!topic) {
    return { ok: false, forbidden: false, reason: "Unknown orientation topic" };
  }
  const owner = TRACK_OWNER[topic.track];
  if (input.role !== owner) {
    return {
      ok: false,
      forbidden: true,
      reason: `Topic track '${topic.track}' must be checked off by ${owner}`,
    };
  }
  const key = checkKey(input.profileId, input.topicId);
  const existing = checks.get(key) ?? null;
  if (existing) return { ok: true, check: existing };
  const check: OrientationCheck = {
    profile_id: input.profileId,
    topic_id: input.topicId,
    checked_by: input.role,
    checked_at: getPhilippineTime(),
  };
  checks.set(key, check);
  return { ok: true, check };
}

/** Checks recorded for one hire. */
export function listChecksFor(profileId: number): OrientationCheck[] {
  return [...checks.values()].filter((c) => c.profile_id === profileId);
}

/**
 * Orientation predicate (Todo 5 machine + Todo 14 orchestrator shape):
 * true iff EVERY required topic has a check for this hire. Both tracks
 * complete is exactly this — required spans both tracks.
 */
export function isOrientationDone(profileId: number): boolean {
  ensureSeeded();
  const required = [...topics.values()].filter((t) => t.required);
  if (required.length === 0) return false;
  return required.every((t) => checks.has(checkKey(profileId, t.id)));
}

/** Harness/test reset (never called from product paths). */
export function resetOrientationStore(): void {
  topics.clear();
  checks.clear();
  seeded = false;
}
