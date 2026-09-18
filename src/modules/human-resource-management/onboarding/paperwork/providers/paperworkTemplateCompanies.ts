"use client";

import type {
  PaperworkTemplateCompany,
  PaperworkTemplateCompanyResponse,
} from "../types/paperwork-template-company.schema";

// paperworkTemplateCompanies.ts — client fetch layer for the junction routes:
// `paperwork-templates/companies` (collection GET) and
// `paperwork-templates/[id]/companies` (per-template GET + PUT-replace).
// Thin fetch helpers mirroring the template provider shape.

const BASE = "/api/hrm/onboarding/paperwork-templates";

async function readEnvelope(
  res: Response
): Promise<PaperworkTemplateCompanyResponse> {
  return (await res.json().catch(() => null)) as PaperworkTemplateCompanyResponse;
}

function toRows(body: PaperworkTemplateCompanyResponse): PaperworkTemplateCompany[] {
  return Array.isArray(body?.data) ? body.data : [];
}

/**
 * Lists every junction row (registry table + signing-desk filter build their
 * template→companies maps from this in one call — no per-template fan-out).
 * Never throws — failure yields [] and callers render the unscoped mark.
 * @returns All junction rows, possibly empty.
 */
export async function listAllTemplateCompanies(): Promise<
  PaperworkTemplateCompany[]
> {
  try {
    const res = await fetch(`${BASE}/companies?limit=-1`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return toRows(await readEnvelope(res));
  } catch {
    return [];
  }
}

/**
 * Lists one template's junction rows (dialog initial selection).
 * Never throws — failure yields [].
 * @param templateId - Template id.
 * @returns That template's junction rows.
 */
export async function listTemplateCompanies(
  templateId: number
): Promise<PaperworkTemplateCompany[]> {
  try {
    const res = await fetch(`${BASE}/${templateId}/companies`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return toRows(await readEnvelope(res));
  } catch {
    return [];
  }
}

/**
 * Replaces one template's company set (delete-then-insert in one route call,
 * never partial). Duplicate ids collapse server-side; empty sets are rejected
 * with a reason.
 * @param templateId - Template id.
 * @param companyIds - Full replacement set (≥1).
 * @returns The persisted junction rows.
 */
export async function replaceTemplateCompanies(
  templateId: number,
  companyIds: number[]
): Promise<PaperworkTemplateCompany[]> {
  const res = await fetch(`${BASE}/${templateId}/companies`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company_ids: companyIds }),
  });
  const body = await readEnvelope(res);
  if (!res.ok || !body.success) {
    throw new Error(body?.message || "Company set save failed");
  }
  return toRows(body);
}

/**
 * Builds template→company-ids from junction rows (deduped, order-stable).
 * @param rows - Junction rows.
 * @returns Map of template id to company id list.
 */
export function toTemplateCompanyMap(
  rows: PaperworkTemplateCompany[]
): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const row of rows) {
    const list = map.get(row.template_id) ?? [];
    if (!list.includes(row.company_id)) list.push(row.company_id);
    map.set(row.template_id, list);
  }
  return map;
}
