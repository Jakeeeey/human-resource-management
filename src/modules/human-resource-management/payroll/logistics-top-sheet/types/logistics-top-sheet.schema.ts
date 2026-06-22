import { z } from "zod";

export const LogisticsTopSheetItemSchema = z.object({
    id: z.string(),
    userId: z.number(),
    employeeId: z.string(),
    employeeName: z.string(),
    type: z.string(),
    grossPay: z.number(),
    additions: z.number(),
    deductions: z.number(),
    netPay: z.number(),
    additionsList: z.array(z.object({
        description: z.string(),
        amount: z.number()
    })).optional()
});

export type LogisticsTopSheetItem = z.infer<typeof LogisticsTopSheetItemSchema>;

export const LogisticsTopSheetResponseSchema = z.object({
    data: z.array(LogisticsTopSheetItemSchema)
});

export type LogisticsTopSheetResponse = z.infer<typeof LogisticsTopSheetResponseSchema>;
