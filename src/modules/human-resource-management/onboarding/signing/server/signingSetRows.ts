import { z } from "zod";

import {
  JobOfferSchema,
  PaperworkItemSchema,
  PaperworksSchema,
  SigningEnvelopeSchema,
  type JobOffer,
  type PaperworkItem,
  type Paperworks,
  type SigningEnvelope,
} from "@/modules/human-resource-management/onboarding/signing/types/contracts";
import {
  ActivePaperworkTemplateSchema,
  insertRow,
  insertRows,
  patchRow,
  readList,
  type ActivePaperworkTemplate,
} from "./signingSetIo";

// signingSetRows.ts — typed row access for the four applicant-scoped signing
// collections (todo 10). Every function names one query/mutation and parses
// through the todo-1 RECORD contracts via `signingSetIo`, so the signing-set
// hook never composes raw Directus rows. `resolveRequiredSigningTemplates`
// owns the required-template rule: ACTIVE `paperwork_templates`, narrowed by
// the `paperwork_template_companies` junction when the applicant's company is
// known.

/**
 * Active paperwork templates — the registry candidates for the required set.
 * @returns Every `is_active=1` template (id + title).
 */
export async function listActivePaperworkTemplates(): Promise<
  ActivePaperworkTemplate[]
> {
  return readList(
    "/items/paperwork_templates?filter[is_active][_eq]=1&fields=id,title&limit=-1",
    ActivePaperworkTemplateSchema
  );
}

/**
 * Template ids carrying a junction row for one company
 * (`paperwork_template_companies`); duplicates collapse via a Set.
 * @param companyId - Company row id.
 * @returns Distinct template ids scoped to that company.
 */
export async function listCompanyScopedTemplateIds(
  companyId: number
): Promise<number[]> {
  const rows = await readList(
    `/items/paperwork_template_companies?filter[company_id][_eq]=${companyId}&fields=template_id&limit=-1`,
    z.object({ template_id: z.number().int().positive() })
  );
  return [...new Set(rows.map((row) => row.template_id))];
}

/**
 * Resolve the required template set for a signing set.
 * @param companyId - The applicant's company when known; when provided, only
 * templates scoped to it through `paperwork_template_companies` stay required.
 * Absent company -> the whole active registry is required (locked plan rule:
 * the live applicant/application schema has no company column).
 * @returns The required template rows (possibly empty).
 */
export async function resolveRequiredSigningTemplates(
  companyId?: number | null
): Promise<ActivePaperworkTemplate[]> {
  const templates = await listActivePaperworkTemplates();
  if (companyId === undefined || companyId === null) return templates;
  const scopedIds = new Set(await listCompanyScopedTemplateIds(companyId));
  return templates.filter((template) => scopedIds.has(template.id));
}

/** One applicant's signing envelope (UNIQUE applicant_id) or null. */
export async function findSigningEnvelopeByApplicant(
  applicantId: number
): Promise<SigningEnvelope | null> {
  const rows = await readList(
    `/items/signing_envelope?filter[applicant_id][_eq]=${applicantId}&limit=1`,
    SigningEnvelopeSchema
  );
  return rows[0] ?? null;
}

/** One applicant's job offer (UNIQUE applicant_id) or null. */
export async function findJobOfferByApplicant(
  applicantId: number
): Promise<JobOffer | null> {
  const rows = await readList(
    `/items/job_offer?filter[applicant_id][_eq]=${applicantId}&limit=1`,
    JobOfferSchema
  );
  return rows[0] ?? null;
}

/** One applicant's paperwork batch rollup (UNIQUE applicant_id) or null. */
export async function findPaperworksByApplicant(
  applicantId: number
): Promise<Paperworks | null> {
  const rows = await readList(
    `/items/paperworks?filter[applicant_id][_eq]=${applicantId}&limit=1`,
    PaperworksSchema
  );
  return rows[0] ?? null;
}

/** Every item of one paperwork batch. */
export async function listPaperworkItems(
  paperworksId: number
): Promise<PaperworkItem[]> {
  return readList(
    `/items/paperwork_item?filter[paperworks_id][_eq]=${paperworksId}&limit=-1`,
    PaperworkItemSchema
  );
}

/** Insert the `paperworks` batch (pending, zero signed). */
export async function insertPaperworks(input: {
  applicantId: number;
  requiredCount: number;
  now: string;
}): Promise<Paperworks> {
  return insertRow(
    "paperworks",
    {
      applicant_id: input.applicantId,
      status: "pending",
      required_count: input.requiredCount,
      signed_count: 0,
      created_at: input.now,
      updated_at: input.now,
    },
    PaperworksSchema
  );
}

/** Insert the `job_offer` as `sent` (the offer leaves HR), PH-stamped. */
export async function insertJobOffer(input: {
  applicantId: number;
  now: string;
}): Promise<JobOffer> {
  return insertRow(
    "job_offer",
    {
      applicant_id: input.applicantId,
      status: "sent",
      offered_at: input.now,
      created_at: input.now,
      updated_at: input.now,
    },
    JobOfferSchema
  );
}

/** Insert the `signing_envelope` aggregate (pending) linking offer + batch. */
export async function insertSigningEnvelope(input: {
  applicantId: number;
  jobOfferId: number;
  paperworksId: number;
  now: string;
}): Promise<SigningEnvelope> {
  return insertRow(
    "signing_envelope",
    {
      applicant_id: input.applicantId,
      joboffer_id: input.jobOfferId,
      paperworks_id: input.paperworksId,
      status: "pending",
      created_at: input.now,
      updated_at: input.now,
    },
    SigningEnvelopeSchema
  );
}

/**
 * Insert the pending `paperwork_item` rows for the required template set in
 * ONE Directus batch POST — the set materializes together (no partial-item
 * window mid-loop) and a re-run sees either zero or the full batch.
 * @returns The created item rows in request order.
 */
export async function insertPaperworkItemsBatch(input: {
  paperworksId: number;
  templateIds: readonly number[];
  now: string;
}): Promise<PaperworkItem[]> {
  return insertRows(
    "paperwork_item",
    input.templateIds.map((templateId) => ({
      paperworks_id: input.paperworksId,
      template_id: templateId,
      status: "pending",
      created_at: input.now,
      updated_at: input.now,
    })),
    PaperworkItemSchema
  );
}

/** Link the aggregate back onto the batch (repair/consistency write). */
export async function patchPaperworksEnvelopeLink(input: {
  paperworksId: number;
  envelopeId: number;
  now: string;
}): Promise<Paperworks> {
  return patchRow(
    "paperworks",
    input.paperworksId,
    { signing_envelope_id: input.envelopeId, updated_at: input.now },
    PaperworksSchema
  );
}

/** Link the aggregate back onto the offer (repair/consistency write). */
export async function patchJobOfferEnvelopeLink(input: {
  jobOfferId: number;
  envelopeId: number;
  now: string;
}): Promise<JobOffer> {
  return patchRow(
    "job_offer",
    input.jobOfferId,
    { signing_envelope_id: input.envelopeId, updated_at: input.now },
    JobOfferSchema
  );
}

/** Repair the aggregate's own offer/batch pointers. */
export async function patchSigningEnvelopeLinks(input: {
  envelopeId: number;
  jobOfferId: number;
  paperworksId: number;
  now: string;
}): Promise<SigningEnvelope> {
  return patchRow(
    "signing_envelope",
    input.envelopeId,
    {
      joboffer_id: input.jobOfferId,
      paperworks_id: input.paperworksId,
      updated_at: input.now,
    },
    SigningEnvelopeSchema
  );
}

/** Repair the required-template count while nothing has been signed yet. */
export async function patchPaperworksRequiredCount(input: {
  paperworksId: number;
  requiredCount: number;
  now: string;
}): Promise<Paperworks> {
  return patchRow(
    "paperworks",
    input.paperworksId,
    { required_count: input.requiredCount, updated_at: input.now },
    PaperworksSchema
  );
}
