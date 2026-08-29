import { z } from "zod";

export const TravelRequestBudgetSchema = z.object({
  id: z.number().optional(),
  travel_request_id: z.number().optional(),
  chart_of_account_id: z.number(),
  amount: z.number().min(0),
});

export const TravelRequestSchema = z.object({
  id: z.union([z.number(), z.string()]),
  user_id: z.number().optional(),
  requester_name: z.string().optional(),
  destination: z.string(),
  travel_from: z.string(),
  travel_to: z.string(),
  purpose: z.string(),
  remarks: z.string().optional().nullable(),
  approval_remarks: z.string().optional().nullable(),
  requires_budget: z.boolean().default(false),
  status: z.enum(["pending", "approved", "rejected", "cancelled"]),
  total_budget: z.number().optional(),
  budget_items: z.array(TravelRequestBudgetSchema).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const TravelRequestApprovalPayloadSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  approval_remarks: z.string().optional(),
});

export type TravelRequest = z.infer<typeof TravelRequestSchema>;
export type TravelRequestBudget = z.infer<typeof TravelRequestBudgetSchema>;
export type TravelRequestApprovalPayload = z.infer<typeof TravelRequestApprovalPayloadSchema>;
