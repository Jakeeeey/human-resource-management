import { z } from "zod";

export const memoFormSchema = z.object({
    subject: z.string().min(1, "Subject is required"),
    body: z.string().optional().nullable(),
    from: z.number().int().positive("From Company is required"),
    company_ids: z.array(z.number()).min(1, "At least one target company must be selected"),
    start_date: z.string().min(1, "Start Date is required"),
    end_date: z.string().min(1, "End Date is required"),
}).refine((data) => {
    const start = new Date(data.start_date);
    const end = new Date(data.end_date);
    return end >= start;
}, {
    message: "End date must be on or after the start date",
    path: ["end_date"]
});

export type MemoFormValues = z.infer<typeof memoFormSchema>;

// Legacy schema support for outer route API compilation
export const MemoCreationFormSchema = z.object({
    subject: z.string().min(1, "Subject is required"),
    attachment: z.any().optional()
});
