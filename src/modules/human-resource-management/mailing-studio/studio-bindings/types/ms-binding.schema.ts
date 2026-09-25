import { z } from "zod";

export const msBindingSchema = z.object({
    event_key_id: z.union([z.string().min(1), z.number().int().positive()], {
        error: "Event key id is required",
    }),
    template_id: z.union([z.string().min(1), z.number().int().positive()], {
        error: "Template id is required",
    }),
    is_enabled: z.boolean(),
});

export type MsBinding = z.infer<typeof msBindingSchema>;
