import { z } from "zod";

export const QuitClaimIdentitySchema = z.object({
    date: z.string(),
    name: z.string(),
    position: z.string(),
    separation: z.string(),
    company: z.string(),
}).strict();

export type QuitClaimIdentity = z.infer<typeof QuitClaimIdentitySchema>;

export const QuitClaimAccountabilitySchema = z.object({
    outlet: z.string(),
    name: z.string(),
    date: z.string(),
    remarks: z.string(),
}).strict();

export type QuitClaimAccountability = z.infer<typeof QuitClaimAccountabilitySchema>;

export const QuitClaimDeductionSchema = z.object({
    label: z.string(),
    amount: z.string(),
}).strict();

export type QuitClaimDeduction = z.infer<typeof QuitClaimDeductionSchema>;

export const QuitClaimDueToEmployeeSchema = z.object({
    item: z.string(),
    days: z.string(),
    amount: z.string(),
}).strict();

export type QuitClaimDueToEmployee = z.infer<typeof QuitClaimDueToEmployeeSchema>;

export const QuitClaimTotalsSchema = z.object({
    total: z.string(),
    less_deductions: z.string(),
    net: z.string(),
}).strict();

export type QuitClaimTotals = z.infer<typeof QuitClaimTotalsSchema>;

export const QuitClaimPaymentSchema = z.object({
    amount: z.string(),
    check_no: z.string(),
    date: z.string(),
}).strict();

export type QuitClaimPayment = z.infer<typeof QuitClaimPaymentSchema>;

export const QuitClaimReleasedBySchema = z.object({
    name: z.string(),
    title: z.string(),
    date: z.string(),
}).strict();

export type QuitClaimReleasedBy = z.infer<typeof QuitClaimReleasedBySchema>;

export const QUITCLAIM_SECTION2_SIGNATORY_LABELS = [
    "Amount Verified By",
    "Payroll Officer",
    "Treasury Officer",
    "General Manager",
    "CFO",
    "CEO",
] as const;

export type QuitClaimSection2SignatoryLabel = (typeof QUITCLAIM_SECTION2_SIGNATORY_LABELS)[number];

export const QuitClaimSection2SignatorySchema = z.object({
    label: z.string(),
    name: z.string(),
    date: z.string(),
}).strict();

export type QuitClaimSection2Signatory = z.infer<typeof QuitClaimSection2SignatorySchema>;

export const QuitClaimValuesSchema = z.object({
    identity: QuitClaimIdentitySchema,
    accountabilities: z.array(QuitClaimAccountabilitySchema),
    deductions: z.array(QuitClaimDeductionSchema),
    due_to_employee: z.array(QuitClaimDueToEmployeeSchema),
    totals: QuitClaimTotalsSchema,
    payment: QuitClaimPaymentSchema,
    released_by: QuitClaimReleasedBySchema,
    manager_signature_date: z.string(),
    section2_signatories: z.array(QuitClaimSection2SignatorySchema),
}).strict();

export type QuitClaimValues = z.infer<typeof QuitClaimValuesSchema>;

export const QUITCLAIM_STATUSES = ["draft", "issued"] as const;

export type QuitClaimStatus = (typeof QUITCLAIM_STATUSES)[number];

export const ClearanceQuitclaimSchema = z.object({
    id: z.number(),
    user_id: z.number(),
    resignation_id: z.number().nullable(),
    request_id: z.number().nullable(),
    status: z.enum(QUITCLAIM_STATUSES),
    ref_no: z.string().nullable(),
    clearance_no: z.string().nullable(),
    company_code: z.string().nullable(),
    pdf_file: z.string().nullable(),
    issued_at: z.string().nullable(),
    issued_by: z.number().nullable(),
    created_at: z.string().nullable(),
    created_by: z.number().nullable(),
    updated_at: z.string().nullable(),
    updated_by: z.number().nullable(),
});

export type ClearanceQuitclaim = z.infer<typeof ClearanceQuitclaimSchema>;
