import { z } from "zod";

// orientation.schema.ts — Zod source of truth for orientation tracks.
//
// Two tracks per onboarding.pdf §7 (FIRST-DAY ONBOARDING): `company`
// (HR-owned) + `department` (department-owned). Topic TITLES live ONLY in
// `../orientationSeed.ts` (seed data, admin-editable via the topics routes)
// — never inline literals anywhere else in code.

export const ORIENTATION_TRACKS = ["company", "department"] as const;

export type OrientationTrack = (typeof ORIENTATION_TRACKS)[number];

export const OrientationTrackSchema = z.enum(ORIENTATION_TRACKS);

export const OrientationRoleSchema = z.enum(["hr", "department"]);

export type OrientationRole = z.infer<typeof OrientationRoleSchema>;

export const OrientationTopicSchema = z.object({
  id: z.string().min(1),
  track: OrientationTrackSchema,
  title: z.string().min(1),
  required: z.boolean(),
  sort: z.number().int().nonnegative(),
});

export type OrientationTopic = z.infer<typeof OrientationTopicSchema>;

export const OrientationCheckSchema = z.object({
  profile_id: z.number().int().positive(),
  topic_id: z.string().min(1),
  checked_by: OrientationRoleSchema,
  checked_at: z.string().min(1),
});

export type OrientationCheck = z.infer<typeof OrientationCheckSchema>;

// Actor performing a check-off. Company track requires `hr`;
// department track requires `department` — any other pairing is 403.
export const OrientationActorSchema = z
  .object({
    role: OrientationRoleSchema,
  })
  .strict();

export type OrientationActor = z.infer<typeof OrientationActorSchema>;

export const CheckOffOrientationSchema = z
  .object({
    profile_id: z.number().int().positive(),
    topic_id: z.string().min(1),
    actor: OrientationActorSchema,
  })
  .strict();

export type CheckOffOrientationInput = z.infer<
  typeof CheckOffOrientationSchema
>;

// Admin topic mutations (seed is editable — never hardcoded elsewhere).
export const CreateOrientationTopicSchema = z
  .object({
    id: z.string().min(1).optional(),
    track: OrientationTrackSchema,
    title: z.string().min(1),
    required: z.boolean().optional(),
  })
  .strict();

export type CreateOrientationTopicInput = z.infer<
  typeof CreateOrientationTopicSchema
>;

export const UpdateOrientationTopicSchema = z
  .object({
    title: z.string().min(1).optional(),
    required: z.boolean().optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateOrientationTopicInput = z.infer<
  typeof UpdateOrientationTopicSchema
>;

export interface OrientationStateResponse {
  success: boolean;
  data?: {
    topics: OrientationTopic[];
    checks: OrientationCheck[];
    done: boolean;
  } | null;
  message?: string;
}

export interface OrientationTopicResponse {
  success: boolean;
  data?: OrientationTopic | OrientationTopic[] | null;
  message?: string;
}
