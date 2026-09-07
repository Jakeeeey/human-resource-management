import { z } from 'zod';

export const ManpowerRecommendationSchema = z.object({
  id: z.number().optional(),
  manpower_request_id: z.number(),
  applicant_id: z.number(),
  status: z.enum(['Recommended', 'Approved', 'Hired', 'Rejected', 'Withdrawn']).default('Recommended'),
  recommendation_notes: z.string().nullable().optional(),
  recommended_by: z.number().nullable().optional(),
  recommended_at: z.string().nullable().optional(),
  decision_by: z.number().nullable().optional(),
  decision_at: z.string().nullable().optional(),
  decision_notes: z.string().nullable().optional(),
  created_at: z.string().optional(),
  created_by: z.number().nullable().optional(),
  updated_at: z.string().optional(),
  updated_by: z.number().nullable().optional(),
});

export type ManpowerRecommendation = z.infer<typeof ManpowerRecommendationSchema>;

export type ManpowerRecommendationCreateInput = Omit<
  ManpowerRecommendation,
  'id' | 'created_at' | 'created_by' | 'updated_at' | 'updated_by'
>;
