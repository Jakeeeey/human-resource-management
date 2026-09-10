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
import { patchRow, readList } from "./signingSetIo";

// signingRollupIo.ts — row IO for the signing rollup writer (todo 12).
//
// These are the only mutations of `paperwork_item`, `paperworks` and
// `signing_envelope` used by the rollup service; the rollup DECISION (which
// status/count gets written, and when) lives exclusively in
// `signing-rollup-service.ts`. Reads go through the todo-1 record contracts,
// so a drifted column fails loudly instead of feeding a wrong value into the
// rollup. Single-row reads use an id filter (the Directus static token sees
// absent rows as 403 on a direct item GET; a filtered list reads back empty).

/** One paperwork item by id, or null when the row does not exist. */
export async function readPaperworkItemById(
  itemId: number
): Promise<PaperworkItem | null> {
  const rows = await readList(
    `/items/paperwork_item?filter[id][_eq]=${itemId}&limit=1`,
    PaperworkItemSchema
  );
  return rows[0] ?? null;
}

/** One paperworks batch by id, or null. */
export async function readPaperworksById(
  paperworksId: number
): Promise<Paperworks | null> {
  const rows = await readList(
    `/items/paperworks?filter[id][_eq]=${paperworksId}&limit=1`,
    PaperworksSchema
  );
  return rows[0] ?? null;
}

/** One signing envelope by id, or null. */
export async function readSigningEnvelopeById(
  envelopeId: number
): Promise<SigningEnvelope | null> {
  const rows = await readList(
    `/items/signing_envelope?filter[id][_eq]=${envelopeId}&limit=1`,
    SigningEnvelopeSchema
  );
  return rows[0] ?? null;
}

/** One job offer by id, or null — the envelope's completion co-input. */
export async function readJobOfferById(
  jobOfferId: number
): Promise<JobOffer | null> {
  const rows = await readList(
    `/items/job_offer?filter[id][_eq]=${jobOfferId}&limit=1`,
    JobOfferSchema
  );
  return rows[0] ?? null;
}

/**
 * Mark one item signed, persisting the captured evidence (`strokes` +
 * `pdf_file`) and PH timestamps in one PATCH. A signature is immutable once
 * written — the service refuses a second, different signature.
 */
export async function writePaperworkItemSignature(input: {
  itemId: number;
  strokes: string;
  pdfFile: string;
  now: string;
}): Promise<PaperworkItem> {
  return patchRow(
    "paperwork_item",
    input.itemId,
    {
      status: "signed",
      strokes: input.strokes,
      pdf_file: input.pdfFile,
      signed_at: input.now,
      updated_at: input.now,
    },
    PaperworkItemSchema
  );
}

/** Write the recomputed batch rollup (signed count + derived status) in ONE PATCH. */
export async function writePaperworksRollup(input: {
  paperworksId: number;
  status: Paperworks["status"];
  signedCount: number;
  now: string;
}): Promise<Paperworks> {
  return patchRow(
    "paperworks",
    input.paperworksId,
    {
      status: input.status,
      signed_count: input.signedCount,
      updated_at: input.now,
    },
    PaperworksSchema
  );
}

/** Write the recomputed aggregate envelope status (rollup service only). */
export async function writeSigningEnvelopeStatus(input: {
  envelopeId: number;
  status: SigningEnvelope["status"];
  now: string;
}): Promise<SigningEnvelope> {
  return patchRow(
    "signing_envelope",
    input.envelopeId,
    { status: input.status, updated_at: input.now },
    SigningEnvelopeSchema
  );
}
