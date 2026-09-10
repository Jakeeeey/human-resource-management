// portalChecklist.ts — hub-owned document config + pure checklist builder
// (Todo 9). Required/optional flags live HERE (the hub config shape Todo 5
// owns) — the portal only renders what this file declares. Filed state is
// derived from the Directus file-description markers
// (`onboarding-portal:<profile_id>:<doc_key>`) stamped by the link route,
// so checklist GET is a pure function of (config, marker rows).
//
// Stage 4 seed (onboarding.pdf): government IDs, birth record, clearances,
// medical fitness, and scholastic records are required; prior-employment
// and supplementary credentials are optional. Admin-editable later —
// never hardcoded in components.

import type {
  PortalChecklistItem,
  PortalDocKey,
} from "./types/portal-checklist.schema";

export interface PortalDocConfig {
  key: PortalDocKey;
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

export function isKnownDocKey(key: string): key is PortalDocKey {
  return PORTAL_DOC_CONFIG.some((entry) => entry.key === key);
}

/** Description marker stamped on every portal-linked Directus file. */
export function portalFileMarker(profileId: number, docKey: PortalDocKey): string {
  return `onboarding-portal:${profileId}:${docKey}`;
}

/** Parses a marker back to its (profile_id, doc_key) pair, or null. */
export function parsePortalFileMarker(
  description: unknown
): { profile_id: number; doc_key: PortalDocKey } | null {
  if (typeof description !== "string") return null;
  const match = /^onboarding-portal:(\d+):([a-z_]+)$/.exec(description.trim());
  if (!match) return null;
  const profileId = Number(match[1]);
  const docKey = match[2] ?? "";
  if (!Number.isInteger(profileId) || profileId <= 0) return null;
  if (!isKnownDocKey(docKey)) return null;
  return { profile_id: profileId, doc_key: docKey };
}

export interface PortalFiledRow {
  id: string;
  description: unknown;
}

/**
 * Builds the per-hire checklist: every config entry exactly once, filed
 * iff a marker row exists for (profile_id, doc_key). Pure — unit-tested
 * in the Todo 9 harness (required-missing → unchecked; optional-only +
 * one marker → checked).
 */
export function buildChecklist(
  profileId: number,
  filedRows: PortalFiledRow[]
): PortalChecklistItem[] {
  const filedByKey = new Map<PortalDocKey, string>();
  for (const row of filedRows) {
    const parsed = parsePortalFileMarker(row.description);
    if (!parsed || parsed.profile_id !== profileId) continue;
    if (!filedByKey.has(parsed.doc_key)) filedByKey.set(parsed.doc_key, row.id);
  }
  return PORTAL_DOC_CONFIG.map((entry) => ({
    key: entry.key,
    title: entry.title,
    required: entry.required,
    filed: filedByKey.has(entry.key),
    file_id: filedByKey.get(entry.key) ?? null,
  }));
}

/** True when every required slot is filed (checklist-complete predicate). */
export function isChecklistComplete(items: PortalChecklistItem[]): boolean {
  return items
    .filter((item) => item.required)
    .every((item) => item.filed && item.file_id !== null);
}
