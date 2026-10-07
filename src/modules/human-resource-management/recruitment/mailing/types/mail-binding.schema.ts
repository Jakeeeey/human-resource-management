import { z } from "zod";

import { mailEventKeySchema } from "./mail-template.schema";

// Frozen send_condition enum (Appendix Bindings row): fire when `always`, or
// when the interview verdict Passed/Failed matches on_pass/on_fail.
export const mailSendConditionSchema = z.enum(["always", "on_pass", "on_fail"]);

export type MailSendCondition = z.infer<typeof mailSendConditionSchema>;

// mail_hook_bindings row (mailing-templates.md §3 + Appendix Bindings row).
// event_key is restricted to the 3 frozen keys — unknown keys are rejected.
// Disable/delete row = unhook (always allowed).
export const mailBindingSchema = z.object({
    event_key: mailEventKeySchema,
    template_id: z.union([z.string().min(1), z.number().int().positive()], {
        error: "Template id is required",
    }),
    is_enabled: z.boolean(),
    send_condition: mailSendConditionSchema,
});

export type MailBinding = z.infer<typeof mailBindingSchema>;
