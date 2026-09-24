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

const PipActionPlanItemSchema = z.object({
  pip_area_id: z.number().int().positive().nullable().optional(),
  area_for_improvement: z.string().trim().min(1).max(255),
  action_plan: z.string().max(4000).nullable().optional(),
  review_date: DateStringSchema.nullable().optional(),
  result: z.enum(["met", "partially_met", "not_met"]).nullable().optional(),
});

const PipBase = z.object({
  user_id: z.number().int().positive(),
  evaluation_id: z.number().int().positive(),
  pip_start_date: DateStringSchema.nullable().optional(),
  pip_end_date: DateStringSchema.nullable().optional(),
  immediate_superior_id: z.number().int().positive().nullable().optional(),
  detailed_concerns: z.string().max(4000).nullable().optional(),
  areas: z.array(z.string().trim().min(1).max(150)).default([]),
  action_plan: z.array(PipActionPlanItemSchema).default([]),
});

export const CreatePipSchema = PipBase.strict();

export type CreatePipInput = z.infer<typeof CreatePipSchema>;

export const UpdatePipSchema = PipBase.partial()
  .extend({
    areas: z.array(z.string().trim().min(1).max(150)).optional(),
    action_plan: z.array(PipActionPlanItemSchema).optional(),
    status: z.enum(["open", "passed", "failed"]).optional(),
  })
  .strict();

export type UpdatePipInput = z.infer<typeof UpdatePipSchema>;

export const AcknowledgePipSchema = z.object({}).strict();

export type AcknowledgePipInput = z.infer<typeof AcknowledgePipSchema>;
