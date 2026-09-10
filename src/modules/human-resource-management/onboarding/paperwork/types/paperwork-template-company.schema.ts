import { z } from "zod";

// paperwork-template-company.schema.ts — Zod source of truth for the
// `paperwork_template_companies` junction (Todo 20). Junction rows are the
// source of truth for template↔company scoping; `company_key` on the template
// row is legacy read-fallback only and is never written in the normal path.
// Pair grain: UNIQUE (template_id, company_id); duplicate pairs collapse to a
// single row, never doubled. No native Directus M2M alias fields — manual
// junction per house pattern (`company_memo_per_companies`).

export const PaperworkTemplateCompanySchema = z.object({
  id: z.number().int().positive(),
  template_id: z.number().int().positive(),
  company_id: z.number().int().positive(),
  created_at: z.string().nullable(),
  created_by: z.number().int().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.number().int().nullable(),
});

export type PaperworkTemplateCompany = z.infer<
  typeof PaperworkTemplateCompanySchema
>;

// PUT body for the per-template replace route: the FULL company set for one
// template. Empty sets are rejected (a template must scope to ≥1 company);
// callers collapse duplicates but the route re-collapses defensively.
export const ReplacePaperworkTemplateCompaniesSchema = z
  .object({
    company_ids: z
      .array(z.number().int().positive(), {
        message: "company_ids must be an array of company ids",
      })
      .min(1, "Pick at least one company")
      .max(200, "Too many companies for one template"),
  })
  .strict();

export type ReplacePaperworkTemplateCompaniesInput = z.infer<
  typeof ReplacePaperworkTemplateCompaniesSchema
>;

export interface PaperworkTemplateCompanyResponse {
  success: boolean;
  data?: PaperworkTemplateCompany | PaperworkTemplateCompany[] | null;
  message?: string;
}
