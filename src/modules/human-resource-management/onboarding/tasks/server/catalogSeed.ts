import { PORTAL_DOC_CONFIG } from "@/modules/human-resource-management/employee-portal/portalChecklist";
import {
  createDocSlotRows,
  listDocSlotRows,
  type DocSlotWriteRow,
} from "@/modules/human-resource-management/employee-portal/server/documentSlotIo";

import { PDF_SECTION_9_CATALOG } from "../../equipment/equipmentCatalog";
import {
  createEquipmentItemRows,
  listEquipmentItemRows,
  type EquipmentItemWriteRow,
} from "../../equipment/server/equipmentItemIo";
import { DEFAULT_ORIENTATION_TOPICS } from "../../orientation/orientationSeed";
import {
  createTopicRows,
  listTopicRows,
  type TopicWriteRow,
} from "../../orientation/server/orientationTopicIo";
import { phTimeNow } from "./onboardingTaskIo";

// catalogSeed.ts — RUNTIME create-missing seeding for the three new catalogs
// (todo 6 of onboarding-requirements-config): `orientation_topic`,
// `onboarding_document_slot`, `onboarding_equipment_item`.
//
// The legacy code constants stay the SEED source only:
//   - `DEFAULT_ORIENTATION_TOPICS` -> `orientation_topic.code`;
//   - `PORTAL_DOC_CONFIG`          -> `onboarding_document_slot.doc_key`;
//   - `PDF_SECTION_9_CATALOG`      -> `onboarding_equipment_item.item_key`.
//
// Contract:
//   - CREATE-MISSING ONLY — a key that is present (whatever title / required /
//     sort edits HR made, active or deactivated) is NEVER touched: no PATCH,
//     no DELETE. The DB is authoritative after the first seed;
//   - reads ALL rows INCLUDING inactive ones, so a soft-deleted default is
//     not resurrected;
//   - one batch POST per catalog and only when keys are absent; a second run
//     is a true no-op (zero writes → idempotent);
//   - APP-TRIGGERED ONLY — called from `ensureOnboardingTaskTemplates` (the
//     normal hire / materialize read path), never from a script.

/** Seed creates start active — a seeded default is immediately usable. */
const SEED_IS_ACTIVE = true;

export interface CatalogSeedInput {
  /** Session actor for `created_by` / `updated_by` (null when unavailable). */
  actorId?: number | null;
}

export interface CatalogSeedSummary {
  /** `orientation_topic.code`s created by this run ([] when none missing). */
  orientation: string[];
  /** `onboarding_document_slot.doc_key`s created by this run. */
  documents: string[];
  /** `onboarding_equipment_item.item_key`s created by this run. */
  equipment: string[];
  /** Total rows created by this run — 0 on every re-run after the first. */
  created: number;
}

async function seedOrientationTopics(
  actorId: number | null
): Promise<string[]> {
  const existing = await listTopicRows();
  const present = new Set(existing.map((row) => row.code));
  const missing = DEFAULT_ORIENTATION_TOPICS.filter(
    (topic) => !present.has(topic.id)
  );
  if (missing.length === 0) return [];

  const now = phTimeNow();
  const rows: TopicWriteRow[] = missing.map((topic) => ({
    code: topic.id,
    title: topic.title,
    track: topic.track,
    is_required: topic.required,
    sort_order: topic.sort,
    is_active: SEED_IS_ACTIVE,
    created_at: now,
    created_by: actorId,
    updated_at: now,
    updated_by: actorId,
  }));
  const created = await createTopicRows(rows);
  return created.map((row) => row.code);
}

async function seedDocumentSlots(actorId: number | null): Promise<string[]> {
  const existing = await listDocSlotRows();
  const present = new Set(existing.map((row) => row.doc_key));
  const missing = PORTAL_DOC_CONFIG.map((slot, index) => ({
    slot,
    sort_order: index + 1,
  })).filter(({ slot }) => !present.has(slot.key));
  if (missing.length === 0) return [];

  const now = phTimeNow();
  const rows: DocSlotWriteRow[] = missing.map(({ slot, sort_order }) => ({
    doc_key: slot.key,
    title: slot.title,
    is_required: slot.required,
    sort_order,
    is_active: SEED_IS_ACTIVE,
    created_at: now,
    created_by: actorId,
    updated_at: now,
    updated_by: actorId,
  }));
  const created = await createDocSlotRows(rows);
  return created.map((row) => row.doc_key);
}

async function seedEquipmentItems(actorId: number | null): Promise<string[]> {
  const existing = await listEquipmentItemRows();
  const present = new Set(existing.map((row) => row.item_key));
  const missing = PDF_SECTION_9_CATALOG.map((item, index) => ({
    item,
    sort_order: index + 1,
  })).filter(({ item }) => !present.has(item.key));
  if (missing.length === 0) return [];

  const now = phTimeNow();
  const rows: EquipmentItemWriteRow[] = missing.map(
    ({ item, sort_order }) => ({
      item_key: item.key,
      label: item.label,
      issuer: item.issuer,
      is_required: item.required,
      sort_order,
      is_active: SEED_IS_ACTIVE,
      created_at: now,
      created_by: actorId,
      updated_at: now,
      updated_by: actorId,
    })
  );
  const created = await createEquipmentItemRows(rows);
  return created.map((row) => row.item_key);
}

/** Coalesces concurrent first reads onto ONE seeding run per process. */
let seedInFlight: Promise<CatalogSeedSummary> | null = null;

async function runSeed(actorId: number | null): Promise<CatalogSeedSummary> {
  const [orientation, documents, equipment] = await Promise.all([
    seedOrientationTopics(actorId),
    seedDocumentSlots(actorId),
    seedEquipmentItems(actorId),
  ]);
  return {
    orientation,
    documents,
    equipment,
    created: orientation.length + documents.length + equipment.length,
  };
}

/**
 * Inserts every seed key that is absent from its catalog and leaves existing
 * rows untouched. Safe to call on every hire: a fully seeded catalog produces
 * zero writes. Concurrent calls collapse onto one run.
 * @param input - Optional actor id for `created_by` / `updated_by`.
 * @returns The keys created by this run (all empty on a re-run).
 */
export function seedMissingCatalogRows(
  input: CatalogSeedInput = {}
): Promise<CatalogSeedSummary> {
  if (seedInFlight) return seedInFlight;

  const actorId = input.actorId ?? null;
  const run = runSeed(actorId).finally(() => {
    seedInFlight = null;
  });
  seedInFlight = run;
  return run;
}
