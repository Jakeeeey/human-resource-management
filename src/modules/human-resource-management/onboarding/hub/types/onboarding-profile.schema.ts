import { z } from "zod";

// onboarding-profile.schema.ts — Zod source of truth for `onboarding_profiles`.
//
// Mirrors the Todo 1a contract (11 fields): id (PK) + employee_id (UNIQUE
// upsert key) + application_id bridge (nullable, never spoofed) + status
// machine + current_stage pointer + offer_accepted record + start_date +
// four nullable app-written audit columns (zero DB defaults).
// Status vocabulary is EXACTLY onboarding.pdf stages 2/3/10 (+ the flow
// restatement): underscored here to match the shape Todo 2 writes
// (`FOR_ONBOARDING`). No invented stages.

export const ONBOARDING_STATUSES = [
  "FOR_ONBOARDING",
  "DOCUMENTS_PENDING",
  "DOCUMENTS_SUBMITTED",
  "HR_VERIFIED",
  "PRE_BOARDING_IN_PROGRESS",
  "ORIENTATION_COMPLETED",
  "TRAINING_ASSIGNED",
  "TRAINING_IN_PROGRESS",
  "TRAINING_COMPLETED",
  "FULLY_EQUIPPED",
  "ONBOARDING_COMPLETED",
] as const;

export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export const OnboardingStatusSchema = z.enum(ONBOARDING_STATUSES);

export const OnboardingProfileSchema = z.object({
  id: z.number().int().positive(),
  employee_id: z.number().int().positive(),
  application_id: z.number().int().positive().nullable(),
  status: OnboardingStatusSchema,
  current_stage: z.string().nullable(),
  offer_accepted: z.boolean(),
  start_date: z.string().nullable(),
  created_at: z.string().nullable(),
  created_by: z.number().int().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.number().int().nullable(),
});

export type OnboardingProfile = z.infer<typeof OnboardingProfileSchema>;

// POST body: hook shape is `{ employee_id }` only (offer_accepted defaults
// false, status always FOR_ONBOARDING server-side); HR creation may carry
// the offer-acceptance record (offer_accepted + start_date + bridge).
export const CreateOnboardingProfileSchema = z
  .object({
    employee_id: z.number().int().positive(),
    application_id: z.number().int().positive().nullable().optional(),
    offer_accepted: z.boolean().optional(),
    start_date: z.string().min(1).nullable().optional(),
    current_stage: z.string().min(1).nullable().optional(),
  })
  .strict();

export type CreateOnboardingProfileInput = z.infer<
  typeof CreateOnboardingProfileSchema
>;

// PATCH body: partial update; at least one key. `status` targets are
// gated by the status machine (unknown stage → 400, skip-ahead → 400,
// predicate-false → 400) — see `../statusMachine.ts`.
export const UpdateOnboardingProfileSchema = z
  .object({
    application_id: z.number().int().positive().nullable().optional(),
    offer_accepted: z.boolean().optional(),
    start_date: z.string().min(1).nullable().optional(),
    current_stage: z.string().min(1).nullable().optional(),
    status: OnboardingStatusSchema.optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateOnboardingProfileInput = z.infer<
  typeof UpdateOnboardingProfileSchema
>;

export interface OnboardingProfileResponse {
  success: boolean;
  data?: OnboardingProfile | OnboardingProfile[] | null;
  message?: string;
}
