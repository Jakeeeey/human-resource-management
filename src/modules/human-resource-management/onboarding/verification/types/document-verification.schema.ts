import { z } from "zod";

import { MAX_RETURN_REASON_LENGTH } from "./verification-queue.schema";

export const DOC_VERIFICATION_STATES = [
  "pending",
  "approved",
  "returned",
] as const;

export type DocumentVerificationState = (typeof DOC_VERIFICATION_STATES)[number];

export const DocumentVerificationSchema = z.object({
  id: z.number().int().positive(),
  user_id: z.number().int().positive(),
  doc_key: z.string().min(1).max(64),
  state: z.enum(DOC_VERIFICATION_STATES).catch("pending"),
  reason: z.string().nullable(),
  decided_by: z.number().int().nullable(),
  decided_at: z.string().nullable(),
});

export type DocumentVerification = z.infer<typeof DocumentVerificationSchema>;

export const DOCUMENT_DECISIONS = ["approve", "return"] as const;

export type DocumentDecision = (typeof DOCUMENT_DECISIONS)[number];

export const DocumentDecisionSchema = z
  .object({
    user_id: z.number().int().positive(),
    doc_key: z.string().min(1).max(64),
    decision: z.enum(DOCUMENT_DECISIONS),
    reason: z.string().min(1).max(MAX_RETURN_REASON_LENGTH).optional(),
  })
  .strict()
  .refine((d) => d.decision !== "return" || (d.reason ?? "").trim().length > 0, {
    message: "A return reason is required when returning for resubmit",
    path: ["reason"],
  });

export type DocumentDecisionInput = z.infer<typeof DocumentDecisionSchema>;

export function rollupDocumentState(
  states: readonly DocumentVerificationState[]
): DocumentVerificationState {
  if (states.some((state) => state === "returned")) return "returned";
  if (states.length > 0 && states.every((state) => state === "approved")) {
    return "approved";
  }
  return "pending";
}
