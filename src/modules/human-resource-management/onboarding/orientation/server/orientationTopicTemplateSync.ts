import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

// orientationTopicTemplateSync.ts — the topic → derived
// `onboarding_task_template` `is_active` sync (todo 2's pin; used by todo 3's
// `patchTopic` / `softDeleteTopicRow`).
//
// This module owns the derivation, so the ONE topic↔template mapping formula
// (`orientationTopicCode`) lives here; `./orientationTopicIo` re-exports it
// (and this helper), so `../orientationStore` keeps a single import surface.
// ONLY the derived row's `is_active` is touched — never
// title/is_required/sort_order — and a code with no derived row yet is a
// NO-OP (todo 2's create-missing seed applies the topic's flag on create).

export const ORIENTATION_TOPIC_SYNC_ERROR_CODES = {
  syncFailed: "ORIENTATION_TOPIC_TEMPLATE_SYNC_FAILED",
} as const;

/**
 * The `onboarding_task_template.code` for one topic — the ONLY topic↔template
 * mapping formula (`taskTemplateSeed.buildOrientationTemplates` imports it via
 * `../orientationStore`, so the two can never drift). Example:
 * `company-background` → `orientation_company_background`.
 */
export function orientationTopicCode(topicCode: string): string {
  return `orientation_${topicCode.replace(/-/g, "_")}`;
}

/** PH wall-time, MySQL-compatible `YYYY-MM-DD HH:mm:ss` (conventions §6). */
function phTimeNow(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

function fail(code: string, detail: string): never {
  throw new Error(`${code}: ${detail}`);
}

const TemplateIdRowSchema = z.object({ id: z.number().int().positive() });

/** The topic fields the derived-template sync needs. */
export interface TopicActiveSync {
  /** `orientation_topic.code` (the app-level topic id). */
  code: string;
  is_active: boolean;
}

/**
 * Updates ONLY the derived `onboarding_task_template` row's `is_active`
 * (mapped via the ONE formula, `orientationTopicCode`). Reads loudly: a
 * Directus error body fails with `ORIENTATION_TOPIC_TEMPLATE_SYNC_FAILED`
 * instead of silently skipping the sync.
 */
export async function syncDerivedTemplateActive(
  topic: TopicActiveSync,
  actorId: number | null = null
): Promise<void> {
  const templateCode = orientationTopicCode(topic.code);
  const lookup: unknown = await dFetch(
    `/items/onboarding_task_template?filter[code][_eq]=${encodeURIComponent(
      templateCode
    )}&fields=id&limit=1`
  );
  const found = z
    .object({ data: z.array(TemplateIdRowSchema) })
    .safeParse(lookup);
  if (!found.success) {
    fail(
      ORIENTATION_TOPIC_SYNC_ERROR_CODES.syncFailed,
      `onboarding_task_template lookup failed (${JSON.stringify(lookup).slice(
        0,
        300
      )})`
    );
  }
  const template = found.data.data[0];
  if (!template) return;

  const patched: unknown = await dFetch(
    `/items/onboarding_task_template/${template.id}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        is_active: topic.is_active,
        updated_at: phTimeNow(),
        updated_by: actorId,
      }),
    }
  );
  const parsed = z.object({ data: TemplateIdRowSchema }).safeParse(patched);
  if (!parsed.success) {
    fail(
      ORIENTATION_TOPIC_SYNC_ERROR_CODES.syncFailed,
      `onboarding_task_template/${template.id} is_active sync failed (${JSON.stringify(
        patched
      ).slice(0, 300)})`
    );
  }
}
