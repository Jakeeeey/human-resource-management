import { z } from "zod";

// paperwork-template.schema.ts — Zod source of truth for `paperwork_templates`.
//
// PDF-ONLY (owner order 2026-09-09 — the HTML/Quill path is removed):
// every template is an admin-uploaded PDF (`pdf_file` UUID) with click-drag
// zones. The `body_html` column was dropped in Directus and is gone from
// writes and reads; `source` writes only "pdf".
// Zone rule is EXACTLY the Todo 6 contract: `template_id → zones[] {id, page,
// rect{x,y,w,h} fractions, required}` — rect lives in template FRACTIONS
// (0..1, resolution-independent) so Todo 7 can map ink points from any bitmap
// size without redefining the schema.

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

// Template kind: PDF-only. The enum keeps the legacy "html" member so reads
// of pre-cut rows still parse; WRITES accept only "pdf" (superRefine below).
export const PaperworkTemplateSourceSchema = z.enum(["html", "pdf"]);

export type PaperworkTemplateSource = z.infer<
  typeof PaperworkTemplateSourceSchema
>;

export const PaperworkTemplateSchema = z.object({
  id: z.number().int().positive(),
  company_key: z.string(),
  title: z.string(),
  zones: z.array(PaperworkZoneSchema),
  is_active: z.boolean(),
  source: PaperworkTemplateSourceSchema,
  pdf_file: z.string().uuid().nullable(),
  created_at: z.string().nullable(),
  created_by: z.number().int().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.number().int().nullable(),
});

export type PaperworkTemplate = z.infer<typeof PaperworkTemplateSchema>;

// POST body: PDF-only. `pdf_file` UUID required. (The dropped `body_html`
// column is neither accepted nor written.)
const CreatePaperworkTemplateBase = z
  .object({
    company_key: z.string().min(1, "Company key is required"),
    title: z.string().min(1, "Title is required"),
    zones: PaperworkZonesSchema.optional(),
    is_active: z.boolean().optional(),
    source: PaperworkTemplateSourceSchema.optional(),
    pdf_file: z
      .string()
      .uuid("PDF file must be a valid uploaded-file UUID")
      .nullable()
      .optional(),
  })
  .strict();

export const CreatePaperworkTemplateSchema = CreatePaperworkTemplateBase.superRefine(
  (data, ctx) => {
    if (data.source !== undefined && data.source !== "pdf") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["source"],
        message: "Only PDF templates are supported",
      });
    }
    if (!data.pdf_file) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pdf_file"],
        message: "PDF file is required for PDF templates",
      });
    }
  }
);

export type CreatePaperworkTemplateInput = z.infer<
  typeof CreatePaperworkTemplateSchema
>;

// PATCH body: partial update; at least one key.
export const UpdatePaperworkTemplateSchema = z
  .object({
    company_key: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    zones: PaperworkZonesSchema.optional(),
    is_active: z.boolean().optional(),
    source: PaperworkTemplateSourceSchema.optional(),
    pdf_file: z
      .string()
      .uuid("PDF file must be a valid uploaded-file UUID")
      .nullable()
      .optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided",
  })
  .refine((d) => d.source === undefined || d.source === "pdf", {
    message: "Only PDF templates are supported",
  });

export type UpdatePaperworkTemplateInput = z.infer<
  typeof UpdatePaperworkTemplateSchema
>;

export interface PaperworkTemplateResponse {
  success: boolean;
  data?: PaperworkTemplate | PaperworkTemplate[] | null;
  message?: string;
}
