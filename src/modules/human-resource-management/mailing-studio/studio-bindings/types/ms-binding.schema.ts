import { z } from "zod";
import { CONDITION_OPERATORS } from "../events/utils/routing-conditions";
export const conditionSchema = z.object({
    field: z.string().min(1),
    op: z.enum(CONDITION_OPERATORS),
    value: z.unknown().optional(),
}).strict().superRefine((condition, ctx) => {
    if (condition.op === "is_set" || condition.op === "is_empty") {
        if (condition.value !== undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${condition.op} must not carry a value`,
                path: ["value"],
            });
        }
        return;
    }
    if (condition.op === "in" || condition.op === "not_in") {
        if (!Array.isArray(condition.value) || condition.value.length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${condition.op} must carry a non-empty array value`,
                path: ["value"],
            });
        }
        return;
    }
    if (
        condition.value === undefined ||
        Array.isArray(condition.value) ||
        (typeof condition.value === "object" && condition.value !== null)
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${condition.op} must carry a scalar value`,
            path: ["value"],
        });
    }
});
export const msBindingSchema = z.object({
    event_key_id: z.union([z.string().min(1), z.number().int().positive()], {
        error: "Event key id is required",
    }),
    template_id: z.union([z.string().min(1), z.number().int().positive()], {
        error: "Template id is required",
    }),
    is_enabled: z.boolean(),
    conditions: z.array(conditionSchema).max(50).nullable().optional(),
    priority: z.number().int().nullable().optional(),
});
export type MsBinding = z.infer<typeof msBindingSchema>;
