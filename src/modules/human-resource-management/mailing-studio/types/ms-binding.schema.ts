import { z } from "zod";

import { msEventKeyShapeSchema } from "./ms-catalog.schema";

// Frozen send_condition enum — byte-parity with old mailSendConditionSchema
// (Appendix Bindings row): fire always, or match the interview verdict on_pass/on_fail.
export const msSendConditionSchema = z.enum(["always", "on_pass", "on_fail"]);

export type MsSendCondition = z.infer<typeof msSendConditionSchema>;

// ms_bindings row — parity with the frozen mail_hook_bindings contract.
// event_key is CATALOG-DRIVEN (D4): shape-checked here
// (^[a-z0-9_.]+$), existence-checked against event_catalog by the route —
// any registered key binds, including the onboarding.* keys the old 3-key
// enum could never carry. Disable/delete row = unhook.
//
// recipient_path (§6.2, D1: JSONPath-subset read of the payload, default
// `$.payload.to`) and priority (§6.2: lower fires first, default 100) are
// OPTIONAL here with NO zod defaults, so payloads that omit them validate to
// data without the keys — the live routes' byte-shape is unchanged until the
// Phase-1 DDL lands and the routes accept the columns. The studio UI applies
// the display defaults. There is deliberately NO variable_map (§7.7).
export const msBindingSchema = z.object({
    event_key: msEventKeyShapeSchema,
    template_id: z.union([z.string().min(1), z.number().int().positive()], {
        error: "Template id is required",
    }),
    is_enabled: z.boolean(),
    send_condition: msSendConditionSchema,
    recipient_path: z.string().min(1, "Recipient path is required").optional(),
    priority: z.number().int().min(0, "Priority must be a non-negative integer").optional(),
});

export type MsBinding = z.infer<typeof msBindingSchema>;
