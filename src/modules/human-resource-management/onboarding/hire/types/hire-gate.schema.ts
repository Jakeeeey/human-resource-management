import { z } from "zod";

import { ApplicantStatusSchema } from "@/modules/human-resource-management/onboarding/types/applicant-status";

export const HireGateChoiceSchema = z.enum(["employment", "training"]);

export type HireGateChoice = z.infer<typeof HireGateChoiceSchema>;

export const HireGatePostBodySchema = z
  .object({
    applicant_id: z.number().int().positive(),
    choice: HireGateChoiceSchema,
    training_template_id: z.number().int().positive().optional(),
  })
  .strict();

export type HireGatePostBody = z.infer<typeof HireGatePostBodySchema>;

export const HireGateGetQuerySchema = z
  .object({
    applicant_id: z.coerce.number().int().positive().optional(),
    user_id: z.coerce.number().int().positive().optional(),
    scope: z.enum(["pending"]).optional(),
  })
  .strict()
  .refine(
    (query) =>
      query.applicant_id !== undefined ||
      query.user_id !== undefined ||
      query.scope !== undefined,
    { message: "Provide applicant_id, user_id, or scope=pending" }
  );

export type HireGateGetQuery = z.infer<typeof HireGateGetQuerySchema>;

export const HireGateTemplateOptionSchema = z.object({
  id: z.number().int().positive(),
  code: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  department_ids: z.array(z.number().int().positive()),
  global: z.boolean(),
  itemCount: z.number().int().min(0),
  requiredItemCount: z.number().int().min(0),
});

export type HireGateTemplateOption = z.infer<
  typeof HireGateTemplateOptionSchema
>;

export const HireGateStateSchema = z.object({
  applicantId: z.number().int().positive(),
  applicantName: z.string(),
  applicantStatus: ApplicantStatusSchema,
  userId: z.number().int().positive().nullable(),
  departmentId: z.number().int().positive().nullable(),
  needsTrainingChoice: z.boolean(),
  trainingTaskCount: z.number().int().min(0),
  templates: z.array(HireGateTemplateOptionSchema),
});

export type HireGateState = z.infer<typeof HireGateStateSchema>;

export const HireGatePendingItemSchema = z.object({
  applicantId: z.number().int().positive(),
  name: z.string(),
  status: ApplicantStatusSchema,
  position: z.string().nullable(),
  userId: z.number().int().positive().nullable(),
});

export type HireGatePendingItem = z.infer<typeof HireGatePendingItemSchema>;

export const HireGateProvisionBodySchema = z
  .object({
    applicant_id: z.number().int().positive(),
  })
  .strict();

export type HireGateProvisionBody = z.infer<typeof HireGateProvisionBodySchema>;

export const HireGateResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z
    .object({
      gate: HireGateStateSchema.optional(),
      pending: z.array(HireGatePendingItemSchema).optional(),
    })
    .optional(),
});

export type HireGateResponse = z.infer<typeof HireGateResponseSchema>;
