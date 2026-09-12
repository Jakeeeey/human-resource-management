// portalChecklist.ts — hub-owned document config + checklist builder
// (todo 25 identity re-key; todo 8 DB runtime source). Required/optional
// flags now come from the LIVE `onboarding_document_slot` catalog (active
// rows, todo-6 seeded) via `listActiveDocSlotConfig()`; the `PORTAL_DOC_CONFIG`
// constant below is the SEED source ONLY (todo-6 `catalogSeed.ts`), never the
// runtime source. Filed state is derived from the Directus file-description
// markers (`onboarding-portal:<applicant|employee>:<id>:<doc_key>`) stamped
// by the link route, so checklist GET is a function of (identity key, live
// slots, markers). There is NO `profile_id` marker anymore.
//
// Stage 4 seed (onboarding.pdf): government IDs, birth record, clearances,
// medical fitness, and scholastic records are required; prior-employment
// and supplementary credentials are optional. Admin-editable via the
// requirements surface — never hardcoded in components.

import {
  PortalDocKeySchema,
  type PortalChecklistItem,
  type PortalDocKey,
  type PortalIdentityKey,
  type SeedPortalDocKey,
} from "./types/portal-checklist.schema";
import { listActiveDocSlotConfig } from "./server/documentSlotIo";

export interface PortalDocConfig {
  key: SeedPortalDocKey;
  title: string;
  required: boolean;
}

export const PORTAL_DOC_CONFIG: readonly PortalDocConfig[] = [
  { key: "valid_id", title: "Valid government-issued ID", required: true },
  { key: "birth_certificate", title: "Birth certificate (PSA)", required: true },
  { key: "nbi_clearance", title: "NBI clearance", required: true },
  {
    key: "medical_certificate",
    title: "Medical / fitness certificate",
    required: true,
  },
  {
    key: "tor_diploma",
    title: "Transcript of records / diploma",
    required: true,
  },
  {
    key: "coe_previous",
    title: "Certificate of employment (previous)",
    required: false,
  },
  {
    key: "training_certificates",
    title: "Training / seminar certificates",
    required: false,
  },
  {
    key: "government_ids",
    title: "SSS / PhilHealth / Pag-IBIG / TIN IDs",
    required: false,
  },
] as const;

/** Marker prefix filed under one portal identity key. */
export function portalMarkerPrefix(key: PortalIdentityKey): string {
  return `onboarding-portal:${key.kind}:${key.id}:`;
}

/** Description marker stamped on every portal-linked Directus file. */
export function portalFileMarker(
  key: PortalIdentityKey,
  docKey: PortalDocKey
): string {
  return `${portalMarkerPrefix(key)}${docKey}`;
}

// The `<doc_key>` capture is widened to `[a-z0-9_]+` (todo 8) and then
// drift-validated by `PortalDocKeySchema` below — never enum-gated here.
const PORTAL_MARKER_PATTERN =
  /^onboarding-portal:(applicant|employee):(\d+):([a-z0-9_]+)$/;

/**
 * Parses a marker back to its (identity key, doc_key) pair, or null.
 * SYNCHRONOUS by contract — marker parsing feeds pure builders and must
 * never become async. The widened capture is validated against
 * `PortalDocKeySchema` (no leading digit/underscore, max 64 chars);
 * membership in the live slot catalog is checked by `buildChecklist`.
 */
export function parsePortalFileMarker(
  description: unknown
): { key: PortalIdentityKey; doc_key: PortalDocKey } | null {
  if (typeof description !== "string") return null;
  const match = PORTAL_MARKER_PATTERN.exec(description.trim());
  if (!match) return null;
  const kind = match[1] === "employee" ? "employee" : "applicant";
  const identityId = Number(match[2]);
  const docKey = match[3] ?? "";
  if (!Number.isInteger(identityId) || identityId <= 0) return null;
  if (!PortalDocKeySchema.safeParse(docKey).success) return null;
  return { key: { kind, id: identityId }, doc_key: docKey };
}

export interface PortalFiledRow {
  id: string;
  description: unknown;
}

/**
 * Builds the checklist for one identity key from the LIVE active document
 * slots (todo 8 — the DB is the runtime source; `PORTAL_DOC_CONFIG` is seed
 * only). Every active slot appears exactly once, filed iff a marker row
 * exists for (kind, id, doc_key). A marker whose key has no live slot is
 * ignored — never an error; an empty pre-seed catalog degrades to `[]`.
 * @throws Coded error when the slot read itself fails (a failure must never
 * read as an empty checklist).
 */
export async function buildChecklist(
  key: PortalIdentityKey,
  filedRows: PortalFiledRow[]
): Promise<PortalChecklistItem[]> {
  const slots = await listActiveDocSlotConfig();
  const liveKeys = new Set(slots.map((slot) => slot.key));
  const filedByKey = new Map<PortalDocKey, string>();
  for (const row of filedRows) {
    const parsed = parsePortalFileMarker(row.description);
    if (!parsed || parsed.key.kind !== key.kind || parsed.key.id !== key.id) {
      continue;
    }
    if (!liveKeys.has(parsed.doc_key)) continue;
    if (!filedByKey.has(parsed.doc_key)) {
      filedByKey.set(parsed.doc_key, row.id);
    }
  }
  return slots.map((slot) => ({
    key: slot.key,
    title: slot.title,
    required: slot.required,
    filed: filedByKey.has(slot.key),
    file_id: filedByKey.get(slot.key) ?? null,
  }));
}

/** True when every required slot is filed (checklist-complete predicate). */
export function isChecklistComplete(items: PortalChecklistItem[]): boolean {
  return items
    .filter((item) => item.required)
    .every((item) => item.filed && item.file_id !== null);
}
