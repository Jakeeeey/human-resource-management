import { z } from 'zod';

export const InterviewSchema = z.object({
  id: z.number().optional(),
  stage: z.enum(['Initial', 'Final']),
  application_id: z.number(),
  manpower_request_id: z.number().nullable().optional(),
  recommendation_id: z.number().nullable().optional(),
  template_id: z.number().nullable().optional(),
  score_sheet_id: z.number().nullable().optional(),
  verdict: z.enum(['Pending', 'Passed', 'Failed']).default('Pending'),
  interviewed_by: z.number().nullable().optional(),
  interviewed_at: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  created_at: z.string().optional(),
  created_by: z.number().nullable().optional(),
  updated_at: z.string().optional(),
  updated_by: z.number().nullable().optional(),
});

export type Interview = z.infer<typeof InterviewSchema>;

export type InterviewCreateInput = Omit<
  Interview,
  'id' | 'created_at' | 'created_by' | 'updated_at' | 'updated_by'
>;
