import { z } from "zod";

const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const KpiCriterionBase = z.object({
  kpi_category: z.string().trim().min(1).max(150),
  kpi_description: z.string().trim().min(1).max(2000),
  target: z.string().max(255).nullable().optional(),
  measurement_method: z.string().max(255).nullable().optional(),
  weight_percentage: z.number().min(0).max(100),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export const CreateKpiCriterionSchema = KpiCriterionBase.strict();

export type CreateKpiCriterionInput = z.infer<typeof CreateKpiCriterionSchema>;

export const UpdateKpiCriterionSchema = KpiCriterionBase.partial().strict();

export type UpdateKpiCriterionInput = z.infer<typeof UpdateKpiCriterionSchema>;

const PipAreaBase = z.object({
  area_name: z.string().trim().min(1).max(150),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export const CreatePipAreaSchema = PipAreaBase.strict();

export type CreatePipAreaInput = z.infer<typeof CreatePipAreaSchema>;

export const UpdatePipAreaSchema = PipAreaBase.partial().strict();

export type UpdatePipAreaInput = z.infer<typeof UpdatePipAreaSchema>;

export const ReorderSchema = z
  .object({
    order: z
      .array(
        z.object({
          id: z.number().int().positive(),
          sort_order: z.number().int().min(0),
        }),
      )
      .min(1),
  })
  .strict();

export type ReorderInput = z.infer<typeof ReorderSchema>;

const EvaluationRatingSchema = z.object({
  criterion_id: z.number().int().positive(),
  rating: z.number().min(1).max(5),
});

export const CreateEvaluationSchema = z
  .object({
    user_id: z.number().int().positive(),
    eval_type: z.enum(["first", "second"]),
    evaluation_date: DateStringSchema,
    result: z.enum(["passed", "failed"]),
    evaluator_comments: z.string().max(4000).nullable().optional(),
    ratings: z.array(EvaluationRatingSchema).min(1),
  })
  .strict();

export type CreateEvaluationInput = z.infer<typeof CreateEvaluationSchema>;

export const UpdateEvaluationSchema = z
  .object({
    user_id: z.number().int().positive().optional(),
    eval_type: z.enum(["first", "second"]).optional(),
    evaluation_date: DateStringSchema.optional(),
    result: z.enum(["passed", "failed"]).optional(),
    evaluator_comments: z.string().max(4000).nullable().optional(),
    ratings: z.array(EvaluationRatingSchema).min(1),
  })
  .strict();

export type UpdateEvaluationInput = z.infer<typeof UpdateEvaluationSchema>;

const PipDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const CreatePipActionPlanItemSchema = z
  .object({
    pip_area_id: z.number().int().positive().nullable().optional(),
    area: z.string().trim().min(1).max(255),
    action: z.string().trim().min(1).max(4000),
  })
  .strict();

export type CreatePipActionPlanItem = z.infer<
  typeof CreatePipActionPlanItemSchema
>;

function pipDatesCoherent(value: {
  pip_start_date?: string | null;
  pip_end_date?: string | null;
}): boolean {
  const start = value.pip_start_date ?? null;
  const end = value.pip_end_date ?? null;
  if (start === null || end === null) return true;
  return end >= start;
}

export const CreatePipSchema = z
  .object({
    evaluation_id: z.number().int().positive(),
    pip_start_date: PipDateString.nullable().optional(),
    pip_end_date: PipDateString.nullable().optional(),
    immediate_superior_id: z.number().int().positive().nullable().optional(),
    detailed_concerns: z.string().max(4000).nullable().optional(),
    action_plan: z.array(CreatePipActionPlanItemSchema).min(1),
  })
  .strict()
  .refine(pipDatesCoherent, {
    message: "PIP_DATE_INCOHERENT",
    path: ["pip_end_date"],
  });

export type CreatePipInput = z.infer<typeof CreatePipSchema>;

const UpdatePipActionPlanItemSchema = z
  .object({
    id: z.number().int().positive().optional(),
    pip_area_id: z.number().int().positive().nullable().optional(),
    area: z.string().trim().min(1).max(255).optional(),
    action: z.string().max(4000).nullable().optional(),
    review_date: PipDateString.nullable().optional(),
    result: z.enum(["met", "partially_met", "not_met"]).nullable().optional(),
  })
  .strict();

export type UpdatePipActionPlanItem = z.infer<
  typeof UpdatePipActionPlanItemSchema
>;

export const UpdatePipSchema = z
  .object({
    pip_start_date: PipDateString.nullable().optional(),
    pip_end_date: PipDateString.nullable().optional(),
    immediate_superior_id: z.number().int().positive().nullable().optional(),
    detailed_concerns: z.string().max(4000).nullable().optional(),
    action_plan: z.array(UpdatePipActionPlanItemSchema).min(1).optional(),
    status: z.enum(["open", "passed", "failed"]).optional(),
  })
  .strict()
  .refine(pipDatesCoherent, {
    message: "PIP_DATE_INCOHERENT",
    path: ["pip_end_date"],
  });

export type UpdatePipInput = z.infer<typeof UpdatePipSchema>;

export const AcknowledgePipSchema = z.object({}).strict();

export type AcknowledgePipInput = z.infer<typeof AcknowledgePipSchema>;
