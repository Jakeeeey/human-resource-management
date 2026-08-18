import { z } from "zod";

export const handbookAttachmentSchema = z.object({
    id: z.number().optional(),
    company_handbook_id: z.number().optional(),
    file_url: z.string().min(1, "File UUID is required"),
    file_name: z.string().min(1, "File name is required"),
});

export const handbookSchema = z.object({
    id: z.number().optional(),
    title: z.string().min(1, "Title is required"),
    description: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
    created_by: z.number().nullable().optional(),
    created_by_name: z.string().optional(),
    updated_at: z.string().nullable().optional(),
    updated_by: z.number().nullable().optional(),
    updated_by_name: z.string().optional(),
    attachments: z.array(handbookAttachmentSchema).optional(),
});

export type HandbookAttachment = z.infer<typeof handbookAttachmentSchema>;
export type Handbook = z.infer<typeof handbookSchema>;
