import { z } from "zod";

export const CLEARANCE_SIGNER_TYPES = ["pool", "subject_department", "named_department", "all"] as const;

export type ClearanceSignerType = (typeof CLEARANCE_SIGNER_TYPES)[number];

export const CLEARANCE_SIGNER_TYPE_LABELS: Record<ClearanceSignerType, string> = {
    pool: "Pool",
    subject_department: "Subject Department",
    named_department: "Named Department",
    all: "All Employees",
};

export const CLEARANCE_REQUEST_STATUSES = ["pending", "in_progress", "completed"] as const;

export type ClearanceRequestStatus = (typeof CLEARANCE_REQUEST_STATUSES)[number];

export const CLEARANCE_REQUEST_STATUS_LABELS: Record<ClearanceRequestStatus, string> = {
    pending: "Pending",
    in_progress: "In Progress",
    completed: "Completed",
};

export const CLEARANCE_ITEM_STATUSES = ["pending", "signed"] as const;

export type ClearanceItemStatus = (typeof CLEARANCE_ITEM_STATUSES)[number];

export const CLEARANCE_ITEM_STATUS_LABELS: Record<ClearanceItemStatus, string> = {
    pending: "Pending",
    signed: "Signed",
};

export const CLEARANCE_EVENT_TYPES = ["assigned", "picked", "signed", "unlocked", "edited", "confirmed"] as const;

export type ClearanceEventType = (typeof CLEARANCE_EVENT_TYPES)[number];

export const CLEARANCE_EVENT_TYPE_LABELS: Record<ClearanceEventType, string> = {
    assigned: "Assigned",
    picked: "Picked",
    signed: "Signed",
    unlocked: "Unlocked",
    edited: "Edited",
    confirmed: "Confirmed",
};

export const ClearanceTemplateSchema = z.object({
    id: z.number(),
    code: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    department_id: z.number().nullable(),
    is_active: z.boolean(),
    sort_order: z.number(),
    created_at: z.string().nullable(),
    created_by: z.number().nullable(),
    updated_at: z.string().nullable(),
    updated_by: z.number().nullable(),
});

export type ClearanceTemplate = z.infer<typeof ClearanceTemplateSchema>;

export const ClearanceTemplateCreateSchema = z.object({
    code: z.string().trim().min(1).max(64),
    title: z.string().trim().min(1).max(255),
    description: z.string().nullable().optional(),
    department_id: z.number().int().positive().nullable().optional(),
    is_active: z.boolean().optional(),
    sort_order: z.number().int().optional(),
}).strict();

export type ClearanceTemplateCreate = z.infer<typeof ClearanceTemplateCreateSchema>;

export const ClearanceTemplateUpdateSchema = z.object({
    title: z.string().trim().min(1).max(255).optional(),
    description: z.string().nullable().optional(),
    department_id: z.number().int().positive().nullable().optional(),
    is_active: z.boolean().optional(),
    sort_order: z.number().int().optional(),
}).strict();

export type ClearanceTemplateUpdate = z.infer<typeof ClearanceTemplateUpdateSchema>;

export const ClearanceCategorySchema = z.object({
    id: z.number(),
    template_id: z.number(),
    label: z.string(),
    instructions: z.string().nullable(),
    signer_type: z.enum(CLEARANCE_SIGNER_TYPES),
    department_id: z.number().nullable(),
    sort_order: z.number(),
    is_active: z.boolean(),
    created_at: z.string().nullable(),
    created_by: z.number().nullable(),
    updated_at: z.string().nullable(),
    updated_by: z.number().nullable(),
});

export type ClearanceCategory = z.infer<typeof ClearanceCategorySchema>;

export const ClearanceCategoryCreateSchema = z.object({
    template_id: z.number().int().positive(),
    label: z.string().trim().min(1).max(255),
    instructions: z.string().nullable().optional(),
    signer_type: z.enum(CLEARANCE_SIGNER_TYPES),
    department_id: z.number().int().positive().nullable().optional(),
    is_active: z.boolean().optional(),
    sort_order: z.number().int().optional(),
}).strict();

export type ClearanceCategoryCreate = z.infer<typeof ClearanceCategoryCreateSchema>;

export const ClearanceCategoryUpdateSchema = z.object({
    label: z.string().trim().min(1).max(255).optional(),
    instructions: z.string().nullable().optional(),
    signer_type: z.enum(CLEARANCE_SIGNER_TYPES).optional(),
    department_id: z.number().int().positive().nullable().optional(),
    is_active: z.boolean().optional(),
    sort_order: z.number().int().optional(),
}).strict();

export type ClearanceCategoryUpdate = z.infer<typeof ClearanceCategoryUpdateSchema>;

export const ClearanceCategorySignatorySchema = z.object({
    id: z.number(),
    category_id: z.number(),
    user_id: z.number(),
    sort_order: z.number(),
    is_active: z.boolean(),
    created_at: z.string().nullable(),
    created_by: z.number().nullable(),
    updated_at: z.string().nullable(),
    updated_by: z.number().nullable(),
});

export type ClearanceCategorySignatory = z.infer<typeof ClearanceCategorySignatorySchema>;

export const ClearanceCategorySignatoryCreateSchema = z.object({
    category_id: z.number().int().positive(),
    user_id: z.number().int().positive(),
    sort_order: z.number().int().optional(),
    is_active: z.boolean().optional(),
}).strict();

export type ClearanceCategorySignatoryCreate = z.infer<typeof ClearanceCategorySignatoryCreateSchema>;

export const ClearanceCategorySignatoryUpdateSchema = z.object({
    sort_order: z.number().int().optional(),
    is_active: z.boolean().optional(),
}).strict();

export type ClearanceCategorySignatoryUpdate = z.infer<typeof ClearanceCategorySignatoryUpdateSchema>;

export const ClearanceReorderSchema = z.object({
    order: z.array(z.object({ id: z.number().int().positive(), sort_order: z.number().int() })).min(1),
}).strict();

export type ClearanceReorder = z.infer<typeof ClearanceReorderSchema>;

export const ClearanceRequestSchema = z.object({
    id: z.number(),
    resignation_id: z.number(),
    user_id: z.number(),
    template_id: z.number(),
    template_code_snapshot: z.string().nullable(),
    template_title_snapshot: z.string().nullable(),
    status: z.enum(CLEARANCE_REQUEST_STATUSES),
    confirmed_by: z.number().nullable(),
    confirmed_at: z.string().nullable(),
    created_at: z.string().nullable(),
    created_by: z.number().nullable(),
    updated_at: z.string().nullable(),
    updated_by: z.number().nullable(),
});

export type ClearanceRequest = z.infer<typeof ClearanceRequestSchema>;

export const ClearanceItemSchema = z.object({
    id: z.number(),
    request_id: z.number(),
    category_id: z.number(),
    label_snapshot: z.string(),
    instructions_snapshot: z.string().nullable(),
    signer_type_snapshot: z.enum(CLEARANCE_SIGNER_TYPES),
    department_id_snapshot: z.number().nullable(),
    department_name_snapshot: z.string().nullable(),
    sort_order: z.number(),
    status: z.enum(CLEARANCE_ITEM_STATUSES),
    expected_signer_user_id: z.number().nullable(),
    signed_by_user_id: z.number().nullable(),
    captured_by_user_id: z.number().nullable(),
    substitution_reason: z.string().nullable(),
    signature_strokes: z.string().nullable(),
    remarks: z.string().nullable(),
    signed_at: z.string().nullable(),
    created_at: z.string().nullable(),
    created_by: z.number().nullable(),
    updated_at: z.string().nullable(),
    updated_by: z.number().nullable(),
});

export type ClearanceItem = z.infer<typeof ClearanceItemSchema>;

export const ClearanceItemSignatorySchema = z.object({
    id: z.number(),
    item_id: z.number(),
    user_id: z.number(),
    sort_order: z.number(),
    created_at: z.string().nullable(),
    created_by: z.number().nullable(),
    updated_at: z.string().nullable(),
    updated_by: z.number().nullable(),
});

export type ClearanceItemSignatory = z.infer<typeof ClearanceItemSignatorySchema>;

export const ClearanceEventSchema = z.object({
    id: z.number(),
    request_id: z.number(),
    item_id: z.number().nullable(),
    event_type: z.enum(CLEARANCE_EVENT_TYPES),
    actor_id: z.number().nullable(),
    reason: z.string().nullable(),
    payload: z.unknown().nullable(),
    created_at: z.string().nullable(),
});

export type ClearanceEvent = z.infer<typeof ClearanceEventSchema>;
