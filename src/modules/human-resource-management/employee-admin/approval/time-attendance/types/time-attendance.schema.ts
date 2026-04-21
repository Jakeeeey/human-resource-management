import { z } from "zod";

export const TAActionPayloadSchema = z.object({
  requestId: z.number(),
  type: z.enum(['leave', 'overtime', 'undertime']),
  action: z.enum(['approve', 'reject', 'return', 'override', 'approve_override', 'reject_override']),
  remarks: z.string().min(1, 'Remarks are required'),
  isOverride: z.boolean().optional(),
  attachment_uuid: z.string().optional(),
});

export type TAActionPayload = z.infer<typeof TAActionPayloadSchema>;
