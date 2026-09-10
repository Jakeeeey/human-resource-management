// portalChecklist.ts — hub-owned document config + pure checklist builder
// (todo 25 identity re-key). Required/optional flags live HERE — the portal
// only renders what this file declares. Filed state is derived from the
// Directus file-description markers
// (`onboarding-portal:<applicant|employee>:<id>:<doc_key>`) stamped by the
// link route, so checklist GET is a pure function of (identity key, markers).
// There is NO `profile_id` marker anymore.
//
// Stage 4 seed (onboarding.pdf): government IDs, birth record, clearances,
// medical fitness, and scholastic records are required; prior-employment
// and supplementary credentials are optional. Admin-editable later —
// never hardcoded in components.

import type {
  PortalChecklistItem,
  PortalDocKey,
  PortalIdentityKey,
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

/** Parses a marker back to its (identity key, doc_key) pair, or null. */
export function parsePortalFileMarker(
  description: unknown
): { key: PortalIdentityKey; doc_key: PortalDocKey } | null {
  if (typeof description !== "string") return null;
  const match =
    /^onboarding-portal:(applicant|employee):(\d+):([a-z_]+)$/.exec(
      description.trim()
    );
  if (!match) return null;
  const kind = match[1] === "employee" ? "employee" : "applicant";
  const identityId = Number(match[2]);
  const docKey = match[3] ?? "";
  if (!Number.isInteger(identityId) || identityId <= 0) return null;
  if (!isKnownDocKey(docKey)) return null;
  return { key: { kind, id: identityId }, doc_key: docKey };
}

export interface PortalFiledRow {
  id: string;
  description: unknown;
}

/**
 * Builds the checklist for one identity key: every config entry exactly
 * once, filed iff a marker row exists for (kind, id, doc_key).
 */
export function buildChecklist(
  key: PortalIdentityKey,
  filedRows: PortalFiledRow[]
): PortalChecklistItem[] {
  const filedByKey = new Map<PortalDocKey, string>();
  for (const row of filedRows) {
    const parsed = parsePortalFileMarker(row.description);
    if (!parsed || parsed.key.kind !== key.kind || parsed.key.id !== key.id) {
      continue;
    }
    if (!filedByKey.has(parsed.doc_key)) {
      filedByKey.set(parsed.doc_key, row.id);
    }
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
