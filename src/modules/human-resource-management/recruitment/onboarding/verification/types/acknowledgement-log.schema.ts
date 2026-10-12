import { z } from "zod";

// acknowledgement-log.schema.ts — Zod source of truth for `acknowledgement_logs`.
//
// Mirrors the Todo 1a contract (8 fields): id (PK) + doc_ref + signer +
// acknowledged_at (PH) + four nullable app-written audit columns
// (zero DB defaults). Composite UNIQUE (doc_ref, signer, acknowledged_at) is
// an owner-DB guarantee — the POST route collapses double-acks to one row via
// exact-triple pre-check + duplicate-error swallow (Todo 2 precedent).
//
// This is the audit-trail store ONLY. The signed file lives on its
// `paperwork_item.pdf_file` — the two stores are never merged.
// Log shape ported from memo-acknowledgement `AcknowledgementLog` (port, never
// import — module boundary); the WRITE path is greenfield (memo-ack is
// GET-only in-repo).

export const AcknowledgementLogSchema = z.object({
  id: z.number().int().positive(),
  doc_ref: z.string(),
  signer: z.string(),
  acknowledged_at: z.string(),
  created_at: z.string().nullable(),
  created_by: z.number().int().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.number().int().nullable(),
});

export type AcknowledgementLog = z.infer<typeof AcknowledgementLogSchema>;

// POST body: the audit-trail write. `acknowledged_at` is optional — absent
// means "stamp PH now server-side". Supplying it makes a retry carry the
// identical triple so the UNIQUE collapses it to one row (never two).
export const CreateAcknowledgementLogSchema = z
  .object({
    doc_ref: z.string().min(1).max(255),
    signer: z.string().min(1).max(120),
    acknowledged_at: z.string().min(1).max(32).optional(),
  })
  .strict();

export type CreateAcknowledgementLogInput = z.infer<
  typeof CreateAcknowledgementLogSchema
>;

export interface AcknowledgementLogResponse {
  success: boolean;
  data?: AcknowledgementLog | AcknowledgementLog[] | null;
  message?: string;
}
