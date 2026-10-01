import { z } from "zod";

export const PORTAL_TRAINING_STATUSES = [
  "pending",
  "in_progress",
  "done",
  "blocked",
  "na",
] as const;

export type PortalTrainingStatus = (typeof PORTAL_TRAINING_STATUSES)[number];

export const PortalTrainingStatusSchema = z
  .enum(PORTAL_TRAINING_STATUSES)
  .catch("pending");

export const PORTAL_TRAINING_STATUS_LABELS: Record<
  PortalTrainingStatus,
  string
> = {
  pending: "Pending",
  in_progress: "In progress",
  done: "Done",
  blocked: "Blocked",
  na: "N/A",
};

export const PortalTrainingItemSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  status: PortalTrainingStatusSchema,
  dueDate: z.string().nullable(),
});

export type PortalTrainingItem = z.infer<typeof PortalTrainingItemSchema>;

export const PortalTrainingResponseSchema = z
  .object({
    success: z.boolean(),
    data: z.array(PortalTrainingItemSchema).optional(),
    message: z.string().optional(),
  })
  .passthrough();

export type PortalTrainingResponse = z.infer<
  typeof PortalTrainingResponseSchema
>;
