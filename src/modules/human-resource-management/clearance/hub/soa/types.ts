import { z } from "zod";

export const SOA_STATUSES = ["pending", "approved"] as const;

export type SoaStatus = (typeof SOA_STATUSES)[number];

export const SoaSignatorySchema = z.object({
    label: z.string(),
    name: z.string(),
    title: z.string(),
}).strict();

export type SoaSignatory = z.infer<typeof SoaSignatorySchema>;

export const SoaSignatoriesSchema = z.array(SoaSignatorySchema);

export type SoaSignatories = z.infer<typeof SoaSignatoriesSchema>;

export const ClearanceSoaSchema = z.object({
    id: z.number(),
    request_id: z.number(),
    status: z.enum(SOA_STATUSES),
    ref_no: z.string().nullable(),
    clearance_no: z.string().nullable(),
    company_code: z.string().nullable(),
    pdf_file: z.string().nullable(),
    approved_at: z.string().nullable(),
    approved_by: z.number().nullable(),
    created_at: z.string().nullable(),
    created_by: z.number().nullable(),
    updated_at: z.string().nullable(),
    updated_by: z.number().nullable(),
});

export type ClearanceSoa = z.infer<typeof ClearanceSoaSchema>;

export const SoaTemplateRowRefSchema = z.object({
    id: z.number(),
    label: z.string(),
    sort_order: z.number(),
});

export type SoaTemplateRowRef = z.infer<typeof SoaTemplateRowRefSchema>;

export const ClearanceSoaLineSchema = z.object({
    id: z.number(),
    soa_id: z.number(),
    item_id: z.number().nullable(),
    soa_template_row_id: z.number().nullable(),
    description: z.string().nullable(),
    amount: z.number().nullable(),
    remarks: z.string().nullable(),
    sort_order: z.number(),
    created_at: z.string().nullable(),
    created_by: z.number().nullable(),
    updated_at: z.string().nullable(),
    updated_by: z.number().nullable(),
});

export type ClearanceSoaLine = z.infer<typeof ClearanceSoaLineSchema>;

export const SOA_OVERVIEW_STATUSES = ["missing", "pending", "approved"] as const;

export type SoaOverviewStatus = (typeof SOA_OVERVIEW_STATUSES)[number];

export const ClearanceSoaOverviewSchema = z.object({
    request_id: z.number(),
    employee_name: z.string(),
    template_code: z.string().nullable(),
    template_title: z.string().nullable(),
    request_status: z.string(),
    status: z.enum(SOA_OVERVIEW_STATUSES),
    soa_id: z.number().nullable(),
    ref_no: z.string().nullable(),
    clearance_no: z.string().nullable(),
    company_code: z.string().nullable(),
    created_at: z.string().nullable(),
});

export type ClearanceSoaOverview = z.infer<typeof ClearanceSoaOverviewSchema>;

export const SoaLineInputSchema = z.object({
    item_id: z.number().int().positive().nullable().optional(),
    soa_template_row_id: z.number().int().positive().nullable().optional(),
    description: z.string().trim().max(255),
    amount: z.number().finite().nonnegative().nullable(),
    remarks: z.string().trim().max(255),
    sort_order: z.number().int().min(0).optional(),
}).strict().refine(
    (line) => line.item_id != null || line.soa_template_row_id != null,
    { message: "Either item_id or soa_template_row_id is required" }
);

export type SoaLineInput = z.infer<typeof SoaLineInputSchema>;

export const SoaCompanySnapshotSchema = z.object({
    company_name: z.string(),
    company_address: z.string(),
    logo_data_url: z.string().nullable(),
}).strict();

export type SoaCompanySnapshot = z.infer<typeof SoaCompanySnapshotSchema>;
