import { z } from 'zod';

export const ManpowerRequestSchema = z.object({
  id: z.number().optional(),
  request_no: z.string().optional(),
  requesting_department_id: z.number().optional(),
  position: z.string().min(1, 'Position is required'),
  division_id: z.number().nullable().optional(),
  no_manpower_needed: z.number().min(1, 'At least 1 is required'),
  purpose: z.enum(['New Position', 'Additional', 'Replacement']),
  replacement_name: z.string().nullable().optional(),
  employment_type: z.enum(['Regular', 'Seasonal', 'Reliever', 'Others']),
  employment_others: z.string().nullable().optional(),
  reason_justification: z.string().min(1, 'Reason/Justification is required'),
  qualification: z.enum(['Male', 'Female', 'Any'], { message: 'Gender preference is required' }),
  qualification_description: z.string().min(1, 'Other qualifications is required'),
  applicant_name: z.string().nullable().optional(),
  rate: z.number().nullable().optional(),
  requested_by: z.any().nullable().optional(),
  created_by: z.any().nullable().optional(),
  recommending_approval: z.number().nullable().optional(),
  noted_by: z.number().nullable().optional(),
  approved_by: z.number().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  updated_by: z.any().nullable().optional(),
  status: z.enum(['Draft', 'Approved', 'Rejected']).optional().default('Draft'),
});

export type ManpowerRequest = z.infer<typeof ManpowerRequestSchema>;
