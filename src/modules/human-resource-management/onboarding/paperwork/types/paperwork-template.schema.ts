import { z } from "zod";

// paperwork-template.schema.ts — Zod source of truth for `paperwork_templates`.
//
// Mirrors the Todo 1a contract (10 fields): id (PK) + company_key (per-company
// scope, app-level key — NOT a UNIQUE column) + title + body_html (Quill-built
// HTML body, same 100k cap as mail templates) + zones (json, optional) +
// is_active + four nullable app-written audit columns (zero DB defaults).
// Zone rule is EXACTLY the Todo 6 contract: `template_id → zones[] {id, page,
// rect{x,y,w,h} fractions, required}` — rect lives in template FRACTIONS
// (0..1, resolution-independent) so Todo 7 can map ink points from any bitmap
// size without redefining the schema.

// Body storage cap (same row as mail templates: sanitized body_html ≤100_000).
export const PAPERWORK_BODY_HTML_MAX = 100_000;

// Fraction rect: every edge in template fractions (0..1). w/h may be 0 only
// transiently — persisted zones always carry a dragged area (editor enforces
// a minimum drag before commit).
export const PaperworkZoneRectSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1),
  })
  .strict();

export type PaperworkZoneRect = z.infer<typeof PaperworkZoneRectSchema>;

// One admin-marked zone on a template page (page is 1-based, matching the
// SigningInk page numbering from `signing/signingStrokes.ts`).
export const PaperworkZoneSchema = z
  .object({
    id: z.string().min(1).max(64),
    page: z.number().int().positive(),
    rect: PaperworkZoneRectSchema,
    required: z.boolean(),
  })
  .strict();

export type PaperworkZone = z.infer<typeof PaperworkZoneSchema>;

export const PaperworkZonesSchema = z.array(PaperworkZoneSchema).max(200);

export const PaperworkTemplateSchema = z.object({
  id: z.number().int().positive(),
  company_key: z.string(),
  title: z.string(),
  body_html: z.string(),
  zones: z.array(PaperworkZoneSchema),
  is_active: z.boolean(),
  created_at: z.string().nullable(),
  created_by: z.number().int().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.number().int().nullable(),
});

export type PaperworkTemplate = z.infer<typeof PaperworkTemplateSchema>;

// POST body: zones default to [] (freeform-ink-only template — valid iff ≥1
// ink mark anywhere per the validity predicate); is_active defaults true.
export const CreatePaperworkTemplateSchema = z
  .object({
    company_key: z.string().min(1, "Company key is required"),
    title: z.string().min(1, "Title is required"),
    body_html: z
      .string()
      .min(1, "Body is required")
      .max(
        PAPERWORK_BODY_HTML_MAX,
        `Body must be at most ${PAPERWORK_BODY_HTML_MAX} characters`
      ),
    zones: PaperworkZonesSchema.optional(),
    is_active: z.boolean().optional(),
  })
  .strict();

export type CreatePaperworkTemplateInput = z.infer<
  typeof CreatePaperworkTemplateSchema
>;

// PATCH body: partial update; at least one key. Zones replace wholesale
// (template_id → zones[] is one document — no per-zone routes).
export const UpdatePaperworkTemplateSchema = z
  .object({
    company_key: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    body_html: z
      .string()
      .min(1)
      .max(
        PAPERWORK_BODY_HTML_MAX,
        `Body must be at most ${PAPERWORK_BODY_HTML_MAX} characters`
      )
      .optional(),
    zones: PaperworkZonesSchema.optional(),
    is_active: z.boolean().optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdatePaperworkTemplateInput = z.infer<
  typeof UpdatePaperworkTemplateSchema
>;

export interface PaperworkTemplateResponse {
  success: boolean;
  data?: PaperworkTemplate | PaperworkTemplate[] | null;
  message?: string;
}
