import { z } from "zod";

// acknowledgement-log.schema.ts — Zod source of truth for `acknowledgement_logs`.
//
// Mirrors the Todo 1a contract (9 fields): id (PK) + doc_ref + signer +
// acknowledged_at (PH) + method + four nullable app-written audit columns
// (zero DB defaults). Composite UNIQUE (doc_ref, signer, acknowledged_at) is
// an owner-DB guarantee — the POST route collapses double-acks to one row via
// exact-triple pre-check + duplicate-error swallow (Todo 2 precedent).
//
// This is the audit-trail store ONLY. The signed file lives in the vault
// (`signing_envelopes.pdf_file`, Todo 8) — the two stores are never merged.
// Log shape ported from memo-acknowledgement `AcknowledgementLog` (port, never
// import — module boundary); the WRITE path is greenfield (memo-ack is
// GET-only in-repo).

export const ACK_METHODS = ["ink", "stamp", "typed"] as const;

export type AckMethod = (typeof ACK_METHODS)[number];

export const AckMethodSchema = z.enum(ACK_METHODS);

export const AcknowledgementLogSchema = z.object({
  id: z.number().int().positive(),
  doc_ref: z.string(),
  signer: z.string(),
  acknowledged_at: z.string(),
  method: AckMethodSchema,
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
    method: AckMethodSchema,
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

// Document-reference convention: `onboarding:profile:<profile_id>[:suffix]`.
// The vault file UUID is NEVER embedded here — vault and ack stay separate.
export function buildDocRef(profileId: number, suffix?: string): string {
  const base = `onboarding:profile:${profileId}`;
  const clean = (suffix ?? "").trim().replace(/[:\s]+/g, "-");
  return clean.length > 0 ? `${base}:${clean}` : base;
}

// Extracts the profile id from a convention-shaped doc_ref, else null.
export function parseDocRefProfileId(docRef: string): number | null {
  const match = /^onboarding:profile:(\d+)(?::.*)?$/.exec(docRef.trim());
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}
