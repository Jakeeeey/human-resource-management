import { z } from "zod";

import { msEventKeyShapeSchema } from "../catalog/ms-catalog.schema";

export const msBindingSchema = z.object({
    event_key: msEventKeyShapeSchema,
    template_id: z.union([z.string().min(1), z.number().int().positive()], {
        error: "Template id is required",
    }),
    is_enabled: z.boolean(),
});

export type MsBinding = z.infer<typeof msBindingSchema>;
