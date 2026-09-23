import { z } from "zod";

export const EvaluationCriterionSchema = z.object({
  id: z.number().int().positive(),
  department_id: z.number().int(),
  kpi_category: z.string(),
  kpi_description: z.string(),
  target: z.string().nullable(),
  measurement_method: z.string().nullable(),
  weight_percentage: z.number(),
  sort_order: z.number().int(),
  is_active: z.boolean(),
  created_at: z.string().nullable(),
  created_by: z.number().int().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.number().int().nullable(),
});

export type EvaluationCriterion = z.infer<typeof EvaluationCriterionSchema>;

export const PipCriterionSchema = z.object({
  id: z.number().int().positive(),
  area_name: z.string(),
  sort_order: z.number().int(),
  is_active: z.boolean(),
  created_at: z.string().nullable(),
  created_by: z.number().int().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.number().int().nullable(),
});

export type PipCriterion = z.infer<typeof PipCriterionSchema>;

export const EvaluationTrackingSchema = z.object({
  id: z.number().int().positive(),
  user_id: z.number().int(),
  date_hired_snapshot: z.string().nullable(),
  recommendation_issued_at: z.string().nullable(),
  recommendation_issued_by: z.number().int().nullable(),
  recommendation_letter_file: z.string().nullable(),
  regularized_at: z.string().nullable(),
  regularized_by: z.number().int().nullable(),
  terminated_at: z.string().nullable(),
  terminated_by: z.number().int().nullable(),
  separation_type: z.string().nullable(),
  termination_reason: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string().nullable(),
  created_by: z.number().int().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.number().int().nullable(),
});

export type EvaluationTracking = z.infer<typeof EvaluationTrackingSchema>;

export const EmployeeEvaluationSchema = z.object({
  id: z.number().int().positive(),
  user_id: z.number().int(),
  eval_type: z.enum(["first", "second"]),
  evaluation_date: z.string(),
  total_score: z.number(),
  rating_band: z.string().nullable(),
  result: z.enum(["passed", "failed"]),
  evaluator_comments: z.string().nullable(),
  evaluated_by: z.number().int().nullable(),
  voided_at: z.string().nullable(),
  voided_by: z.number().int().nullable(),
  void_reason: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string().nullable(),
  created_by: z.number().int().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.number().int().nullable(),
});

export type EmployeeEvaluation = z.infer<typeof EmployeeEvaluationSchema>;

export const EmployeeEvaluationItemSchema = z.object({
  id: z.number().int().positive(),
  evaluation_id: z.number().int(),
  criterion_id: z.number().int().nullable(),
  kpi_category_snapshot: z.string(),
  kpi_description_snapshot: z.string(),
  target_snapshot: z.string().nullable(),
  measurement_method_snapshot: z.string().nullable(),
  weight_percentage_snapshot: z.number(),
  rating: z.number(),
  sort_order: z.number().int(),
  created_at: z.string().nullable(),
  created_by: z.number().int().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.number().int().nullable(),
});

export type EmployeeEvaluationItem = z.infer<typeof EmployeeEvaluationItemSchema>;

export const EmployeePipSchema = z.object({
  id: z.number().int().positive(),
  user_id: z.number().int(),
  evaluation_id: z.number().int(),
  pip_start_date: z.string().nullable(),
  pip_end_date: z.string().nullable(),
  immediate_superior_id: z.number().int().nullable(),
  detailed_concerns: z.string().nullable(),
  status: z.enum(["open", "passed", "failed"]),
  closed_at: z.string().nullable(),
  closed_by: z.number().int().nullable(),
  employee_viewed_at: z.string().nullable(),
  employee_ack_user_id: z.number().int().nullable(),
  employee_acknowledged_at: z.string().nullable(),
  manager_ack_user_id: z.number().int().nullable(),
  manager_acknowledged_at: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string().nullable(),
  created_by: z.number().int().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.number().int().nullable(),
});

export type EmployeePip = z.infer<typeof EmployeePipSchema>;

export const EmployeePipAreaSchema = z.object({
  id: z.number().int().positive(),
  pip_id: z.number().int(),
  pip_criteria_id: z.number().int().nullable(),
  area_name_snapshot: z.string(),
  selected: z.boolean(),
  sort_order: z.number().int(),
  created_at: z.string().nullable(),
  created_by: z.number().int().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.number().int().nullable(),
});

export type EmployeePipArea = z.infer<typeof EmployeePipAreaSchema>;

export const EmployeePipActionPlanSchema = z.object({
  id: z.number().int().positive(),
  pip_id: z.number().int(),
  pip_area_id: z.number().int().nullable(),
  area_for_improvement: z.string(),
  action_plan: z.string().nullable(),
  review_date: z.string().nullable(),
  result: z.enum(["met", "partially_met", "not_met"]).nullable(),
  sort_order: z.number().int(),
  created_at: z.string().nullable(),
  created_by: z.number().int().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.number().int().nullable(),
});

export type EmployeePipActionPlan = z.infer<typeof EmployeePipActionPlanSchema>;

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export const EmployeeProfileSchema = z.object({
  user_id: z.number().int(),
  full_name: z.string(),
  department_id: z.number().int().nullable(),
  department_name: z.string().nullable(),
  position: z.string().nullable(),
  date_hired: z.string().nullable(),
});

export type EmployeeProfile = z.infer<typeof EmployeeProfileSchema>;

export const WorkspaceBundleSchema = z.object({
  employee: EmployeeProfileSchema,
  tracking: EvaluationTrackingSchema.nullable(),
  evaluations: z.array(EmployeeEvaluationSchema),
  evaluationItems: z.array(EmployeeEvaluationItemSchema),
  pips: z.array(EmployeePipSchema),
  pipAreas: z.array(EmployeePipAreaSchema),
  pipActionPlans: z.array(EmployeePipActionPlanSchema),
});

export type WorkspaceBundle = z.infer<typeof WorkspaceBundleSchema>;

export const RosterRowSchema = z.object({
  user_id: z.number().int(),
  full_name: z.string(),
  department_id: z.number().int().nullable(),
  department_name: z.string().nullable(),
  position: z.string().nullable(),
  date_hired: z.string().nullable(),
  third_month_due: z.string().nullable(),
  fifth_month_due: z.string().nullable(),
  sixth_month_due: z.string().nullable(),
  probation_status: z.string(),
  stage: z.string(),
  next_action: z.record(z.string(), z.unknown()).nullable(),
  is_overdue: z.boolean(),
});

export type RosterRow = z.infer<typeof RosterRowSchema>;
