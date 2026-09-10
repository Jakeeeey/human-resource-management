import { z } from "zod";

// contracts.ts — Zod source of truth for the applicant-scoped signing
// aggregate (todo 1 of onboarding-hub-replan), mirroring the LIVE Directus
// tables EXACTLY (field names, nullability, enums probed via
// `GET /fields/<collection>` on 2026-09-10):
//
//   signing_envelope — one per applicant (UNIQUE applicant_id); rolls the
//                      offer + paperwork set up to pending|complete
//   job_offer        — the offer record; draft -> sent -> signed|declined.
//                      'expired' is NOT a stored value (expiry batches into
//                      'declined' — see replan DDL E)
//   paperworks       — per-applicant batch rollup (pending|partial|complete)
//                      with required_count / signed_count
//   paperwork_item   — one row per required template (pending|signed);
//                      UNIQUE(paperworks_id, template_id)
//
// Audit columns are app-written PH-time and nullable (zero DB defaults).
// Input/write bodies live in `./signing-api.schema.ts`; this file owns the
// RECORD contracts. The retired profile-scoped envelope model must NOT be
// re-introduced — do NOT import or re-export its names here.

export const SIGNING_ENVELOPE_STATUS = ["pending", "complete"] as const;

export type SigningEnvelopeStatus = (typeof SIGNING_ENVELOPE_STATUS)[number];

export const SigningEnvelopeStatusSchema = z.enum(SIGNING_ENVELOPE_STATUS);

// Completion = job_offer.status 'signed' AND every paperwork_item 'signed';
// the rollup writer lives in ONE recompute service (todo 12) — never set
// this status from more than one place.
export const SigningEnvelopeSchema = z.object({
  id: z.number().int().positive(),
  applicant_id: z.number().int().positive(),
  joboffer_id: z.number().int().positive().nullable(),
  paperworks_id: z.number().int().positive().nullable(),
  status: SigningEnvelopeStatusSchema,
  created_at: z.string().nullable(),
  created_by: z.number().int().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.number().int().nullable(),
});

export type SigningEnvelope = z.infer<typeof SigningEnvelopeSchema>;

export const JOB_OFFER_STATUS = [
  "draft",
  "sent",
  "signed",
  "declined",
] as const;

export type JobOfferStatus = (typeof JOB_OFFER_STATUS)[number];

export const JobOfferStatusSchema = z.enum(JOB_OFFER_STATUS);

export const JobOfferSchema = z.object({
  id: z.number().int().positive(),
  applicant_id: z.number().int().positive(),
  signing_envelope_id: z.number().int().positive().nullable(),
  terms_snapshot: z.json(), // json | nullable — parsed JSON value (incl. null)
  offered_at: z.string().nullable(),
  expires_at: z.string().nullable(),
  status: JobOfferStatusSchema,
  signature_file: z.string().nullable(),
  signed_at: z.string().nullable(),
  created_at: z.string().nullable(),
  created_by: z.number().int().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.number().int().nullable(),
});

export type JobOffer = z.infer<typeof JobOfferSchema>;

export const PAPERWORKS_STATUS = [
  "pending",
  "partial",
  "complete",
] as const;

export type PaperworksStatus = (typeof PAPERWORKS_STATUS)[number];

export const PaperworksStatusSchema = z.enum(PAPERWORKS_STATUS);

// required_count / signed_count drive the derived `status`; all required
// templates means complete ⇔ signed_count === required_count.
export const PaperworksSchema = z.object({
  id: z.number().int().positive(),
  applicant_id: z.number().int().positive(),
  signing_envelope_id: z.number().int().positive().nullable(),
  status: PaperworksStatusSchema,
  required_count: z.number().int().nonnegative(),
  signed_count: z.number().int().nonnegative(),
  created_at: z.string().nullable(),
  created_by: z.number().int().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.number().int().nullable(),
});

export type Paperworks = z.infer<typeof PaperworksSchema>;

export const PAPERWORK_ITEM_STATUS = ["pending", "signed"] as const;

export type PaperworkItemStatus = (typeof PAPERWORK_ITEM_STATUS)[number];

export const PaperworkItemStatusSchema = z.enum(PAPERWORK_ITEM_STATUS);

export const PaperworkItemSchema = z.object({
  id: z.number().int().positive(),
  paperworks_id: z.number().int().positive(),
  template_id: z.number().int().positive(),
  status: PaperworkItemStatusSchema,
  strokes: z.string().nullable(),
  pdf_file: z.string().nullable(),
  signed_at: z.string().nullable(),
  created_at: z.string().nullable(),
  created_by: z.number().int().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.number().int().nullable(),
});

export type PaperworkItem = z.infer<typeof PaperworkItemSchema>;
