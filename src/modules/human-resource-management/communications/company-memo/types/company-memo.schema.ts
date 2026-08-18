import { z } from "zod";

export const COMPANY_MEMO_STATUSES = [
    "DRAFT",
    "PUBLISHED",
    "ARCHIVED",
] as const;

export type CompanyMemoStatus = (typeof COMPANY_MEMO_STATUSES)[number];

export const COMPANY_MEMO_STATUS_LABELS: Record<CompanyMemoStatus, string> = {
    DRAFT: "Draft",
    PUBLISHED: "Published",
    ARCHIVED: "Archived",
};

export const COMPANY_MEMO_PRIORITIES = [
    "LOW",
    "NORMAL",
    "HIGH",
] as const;

export type CompanyMemoPriority = (typeof COMPANY_MEMO_PRIORITIES)[number];

export const COMPANY_MEMO_PRIORITY_LABELS: Record<CompanyMemoPriority, string> = {
    LOW: "Low",
    NORMAL: "Normal",
    HIGH: "High",
};

export const CompanyMemoSchema = z.object({
    id: z.number().optional(),
    title: z.string().min(1, "Title is required").max(255, "Limit to 255 characters"),
    content: z.string().min(1, "Content is required"),
    attachment: z.string().nullable().optional(),
    status: z.enum(COMPANY_MEMO_STATUSES).default("DRAFT"),
    priority: z.enum(COMPANY_MEMO_PRIORITIES).default("NORMAL"),
    published_at: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
    created_by: z.number().nullable().optional(),
    updated_at: z.string().nullable().optional(),
    updated_by: z.number().nullable().optional(),
});

export type CompanyMemo = z.infer<typeof CompanyMemoSchema>;

export const CompanyMemoFormSchema = z.object({
    title: z.string().min(1, "Title is required").max(255, "Limit to 255 characters"),
    content: z.string().min(1, "Content is required"),
    attachment: z.string().nullable().optional(),
    status: z.enum(COMPANY_MEMO_STATUSES).default("DRAFT"),
    priority: z.enum(COMPANY_MEMO_PRIORITIES).default("NORMAL"),
});

export type CompanyMemoForm = z.infer<typeof CompanyMemoFormSchema>;

export interface EnrichedCompanyMemo extends CompanyMemo {
    created_by_name?: string;
    updated_by_name?: string;
}
