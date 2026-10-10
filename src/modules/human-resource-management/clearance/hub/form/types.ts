import { z } from "zod";

export const CLEARANCE_FORM_STATUSES = ["pending", "approved"] as const;

export type ClearanceFormStatus = (typeof CLEARANCE_FORM_STATUSES)[number];

export const ClearanceFormSchema = z.object({
    id: z.number(),
    request_id: z.number(),
    status: z.enum(CLEARANCE_FORM_STATUSES),
    ref_no: z.string().nullable(),
    company_code: z.string().nullable(),
    pdf_file: z.string().nullable(),
    gm_name: z.string().nullable(),
    gm_title: z.string().nullable(),
    approved_at: z.string().nullable(),
    approved_by: z.number().nullable(),
    created_at: z.string().nullable(),
    created_by: z.number().nullable(),
    updated_at: z.string().nullable(),
    updated_by: z.number().nullable(),
});

export type ClearanceForm = z.infer<typeof ClearanceFormSchema>;

export const CLEARANCE_FORM_OVERVIEW_STATUSES = ["missing", "pending", "approved"] as const;

export type ClearanceFormOverviewStatus = (typeof CLEARANCE_FORM_OVERVIEW_STATUSES)[number];

export const ClearanceFormOverviewSchema = z.object({
    request_id: z.number(),
    employee_name: z.string(),
    template_code: z.string().nullable(),
    template_title: z.string().nullable(),
    request_status: z.string(),
    status: z.enum(CLEARANCE_FORM_OVERVIEW_STATUSES),
    form_id: z.number().nullable(),
    ref_no: z.string().nullable(),
    company_code: z.string().nullable(),
    created_at: z.string().nullable(),
});

export type ClearanceFormOverview = z.infer<typeof ClearanceFormOverviewSchema>;


export const ClearanceFormRoleBlockSchema = z.object({
    label: z.string(),
    signeeName: z.string(),
    signatureDataUrl: z.string().nullable(),
    remarks: z.string(),
}).strict();

export type ClearanceFormRoleBlock = z.infer<typeof ClearanceFormRoleBlockSchema>;

export const ClearanceFormRenderModelSchema = z.object({
    refNo: z.string(),
    employeeName: z.string(),
    date: z.string(),
    position: z.string(),
    company_name: z.string().optional(),
    company_address: z.string().nullable().optional(),
    logo_data_url: z.string().nullable().optional(),
    gmName: z.string(),
    gmTitle: z.string(),
    roles: z.array(ClearanceFormRoleBlockSchema),
}).strict();

export type ClearanceFormRenderModel = z.infer<typeof ClearanceFormRenderModelSchema>;
