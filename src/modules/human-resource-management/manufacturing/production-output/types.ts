import { z } from "zod";

export const outputUpdateSchema = z.object({
    actual_produce: z.number().int().min(0, "Actual output cannot be negative").default(0),
});

export type OutputUpdateValues = z.infer<typeof outputUpdateSchema>;
