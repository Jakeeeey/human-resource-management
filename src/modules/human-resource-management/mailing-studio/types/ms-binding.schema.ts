import { z } from "zod";

// Frozen send_condition enum — byte-parity with old mailSendConditionSchema
// (Appendix Bindings row): fire always, or match the interview verdict on_pass/on_fail.
export const msSendConditionSchema = z.enum(["always", "on_pass", "on_fail"]);

export type MsSendCondition = z.infer<typeof msSendConditionSchema>;

// ms_hook_bindings row — parity with the frozen mail_hook_bindings contract.
// event_key is restricted to the 3 frozen keys (inline, standalone — pinned to
// msEventKeySchema by the T2 assert suite); disable/delete row = unhook.
export const msBindingSchema = z.object({
    event_key: z.enum([
        "initial_interview.graded",
        "final_interview.graded",
        "final_interview.invited",
    ]),
    template_id: z.union([z.string().min(1), z.number().int().positive()], {
        error: "Template id is required",
    }),
    is_enabled: z.boolean(),
    send_condition: msSendConditionSchema,
});

export type MsBinding = z.infer<typeof msBindingSchema>;
