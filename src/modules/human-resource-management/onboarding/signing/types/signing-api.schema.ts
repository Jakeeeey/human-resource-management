import { z } from "zod";

import {
  JobOfferSchema,
  JobOfferStatusSchema,
  PaperworkItemSchema,
  PaperworkItemStatusSchema,
  PaperworksSchema,
  PaperworksStatusSchema,
  SigningEnvelopeSchema,
  SigningEnvelopeStatusSchema,
} from "./contracts";

// signing-api.schema.ts — WRITE/QUERY contracts for the applicant-scoped
// signing API (todo 9). Derived from the todo-1 RECORD contracts in
// `./contracts` so field shapes have ONE source of truth:
//
//   create body = record minus server-managed columns (id + audit), with
//   DB-defaulted columns re-added as defaults so the route writes explicit
//   values and never relies on Directus/MySQL defaults.
//
// Responses are parsed back with the RECORD schemas by the route handlers;
// `.strict()` makes unknown body keys a 400 BEFORE any Directus write.
//
// Route -> collection map (all under /api/hrm/onboarding):
//   signing-envelope -> signing_envelope (by applicant)
//   job-offer        -> job_offer        (by applicant)
//   paperworks       -> paperworks       (by applicant)
//   paperwork-item   -> paperwork_item   (by paperworks)

const RECORD_MANAGED_KEYS = {
  id: true,
  created_at: true,
  created_by: true,
  updated_at: true,
  updated_by: true,
} as const;

export const SigningEnvelopeCreateSchema = SigningEnvelopeSchema.omit(
  RECORD_MANAGED_KEYS
)
  .extend({
    joboffer_id: z.number().int().positive().nullable().default(null),
    paperworks_id: z.number().int().positive().nullable().default(null),
    status: SigningEnvelopeStatusSchema.default("pending"),
  })
  .strict();

export type SigningEnvelopeCreate = z.infer<typeof SigningEnvelopeCreateSchema>;

export const JobOfferCreateSchema = JobOfferSchema.omit(RECORD_MANAGED_KEYS)
  .extend({
    signing_envelope_id: z.number().int().positive().nullable().default(null),
    terms_snapshot: z.json().default(null),
    pdf_file: z.string().nullable().default(null),
    offered_at: z.string().nullable().default(null),
    expires_at: z.string().nullable().default(null),
    status: JobOfferStatusSchema.default("draft"),
    signature_file: z.string().nullable().default(null),
    signed_at: z.string().nullable().default(null),
    strokes: z.string().nullable().default(null),
    signed_pdf_file: z.string().nullable().default(null),
  })
  .strict();

export type JobOfferCreate = z.infer<typeof JobOfferCreateSchema>;

export const JobOfferUpdateSchema = z
  .object({
    signing_envelope_id: z.number().int().positive().nullable().optional(),
    terms_snapshot: z.json().optional(),
    pdf_file: z.string().nullable().optional(),
    status: JobOfferStatusSchema.optional(),
    strokes: z.string().nullable().optional(),
    signed_pdf_file: z.string().nullable().optional(),
  })
  .strict();

export type JobOfferUpdate = z.infer<typeof JobOfferUpdateSchema>;

export const PaperworksCreateSchema = PaperworksSchema.omit(RECORD_MANAGED_KEYS)
  .extend({
    signing_envelope_id: z.number().int().positive().nullable().default(null),
    status: PaperworksStatusSchema.default("pending"),
    required_count: z.number().int().nonnegative().default(0),
    signed_count: z.number().int().nonnegative().default(0),
  })
  .strict();

export type PaperworksCreate = z.infer<typeof PaperworksCreateSchema>;

export const PaperworkItemCreateSchema = PaperworkItemSchema.omit(
  RECORD_MANAGED_KEYS
)
  .extend({
    status: PaperworkItemStatusSchema.default("pending"),
    strokes: z.string().nullable().default(null),
    pdf_file: z.string().nullable().default(null),
    signed_at: z.string().nullable().default(null),
  })
  .strict();

export type PaperworkItemCreate = z.infer<typeof PaperworkItemCreateSchema>;

export const SigningEnvelopeListQuerySchema = z
  .object({
    applicant_id: z.coerce.number().int().positive().optional(),
    status: SigningEnvelopeStatusSchema.optional(),
  })
  .strict();

export const JobOfferListQuerySchema = z
  .object({
    applicant_id: z.coerce.number().int().positive().optional(),
    status: JobOfferStatusSchema.optional(),
  })
  .strict();

export const PaperworksListQuerySchema = z
  .object({
    applicant_id: z.coerce.number().int().positive().optional(),
    status: PaperworksStatusSchema.optional(),
  })
  .strict();

export const PaperworkItemListQuerySchema = z
  .object({
    paperworks_id: z.coerce.number().int().positive().optional(),
    status: PaperworkItemStatusSchema.optional(),
  })
  .strict();
