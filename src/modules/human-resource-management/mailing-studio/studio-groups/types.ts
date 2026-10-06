import { z } from "zod";

export const GROUP_SOURCE_KINDS = ["customer", "employee", "manual"] as const;

export const GroupSourceKindSchema = z.enum(GROUP_SOURCE_KINDS);

export type GroupSourceKind = z.infer<typeof GroupSourceKindSchema>;

export const GROUP_SOURCE_KIND_LABELS: Record<GroupSourceKind, string> = {
    customer: "Customer",
    employee: "Employee",
    manual: "Manual entry",
};

export interface MsGroupRow {
    id: number;
    group_key: string;
    group_name: string;
    description: string | null;
    is_active: boolean | number;
    created_at: string | null;
    created_by: string | null;
    updated_at: string | null;
    updated_by: string | null;
}

export interface MsGroupMemberRow {
    id: number;
    group_id: number;
    email: string;
    source_kind: string;
    source_ref: number | null;
    is_active: boolean | number;
    created_at: string | null;
    created_by: string | null;
    updated_at: string | null;
    updated_by: string | null;
}

const groupKeyShapeSchema = z
    .string()
    .trim()
    .min(1, "Group key is required")
    .max(64, "Group key must be at most 64 characters");

const groupNameShapeSchema = z
    .string()
    .trim()
    .min(1, "Group name is required")
    .max(255, "Group name must be at most 255 characters");

const memberEmailShapeSchema = z
    .string()
    .trim()
    .toLowerCase()
    .email("Member email must be valid")
    .max(320, "Member email must be at most 320 characters");

export const msGroupCreateBodySchema = z.object({
    group_key: groupKeyShapeSchema,
    group_name: groupNameShapeSchema,
    description: z.string().nullable().optional(),
    is_active: z.boolean().optional(),
}).strict();

export type MsGroupCreateBody = z.infer<typeof msGroupCreateBodySchema>;

export const msGroupUpdateBodySchema = z.object({
    group_name: groupNameShapeSchema.optional(),
    description: z.string().nullable().optional(),
    is_active: z.boolean().optional(),
}).strict();

export type MsGroupUpdateBody = z.infer<typeof msGroupUpdateBodySchema>;

export const msGroupMemberCreateBodySchema = z.object({
    group_id: z.number().int().positive("Group id is required"),
    email: memberEmailShapeSchema,
    source_kind: GroupSourceKindSchema,
    source_ref: z.number().int().positive().nullable().optional(),
    is_active: z.boolean().optional(),
}).strict().superRefine((member, ctx) => {
    if (member.source_kind === "manual") {
        if (member.source_ref !== undefined && member.source_ref !== null) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Manual members must not carry a source_ref",
                path: ["source_ref"],
            });
        }
        return;
    }
    if (member.source_ref === undefined || member.source_ref === null) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Sourced members must carry the source customer or user id",
            path: ["source_ref"],
        });
    }
});

export type MsGroupMemberCreateBody = z.infer<typeof msGroupMemberCreateBodySchema>;

export const msGroupMemberUpdateBodySchema = z.object({
    is_active: z.boolean().optional(),
}).strict();

export type MsGroupMemberUpdateBody = z.infer<typeof msGroupMemberUpdateBodySchema>;
