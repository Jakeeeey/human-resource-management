import { z } from "zod";

// signing-envelope.schema.ts — Zod source of truth for `signing_envelopes`
// (Todo 7). Mirrors the Todo 1a contract (12 fields): id (PK) +
// envelope_key (UNIQUE `<profile_id>:<template_id>:<attempt>`) + profile_id
// (→ onboarding_profiles.id) + template_id (→ paperwork_templates.id) +
// status (draft → finished) + strokes (server-persisted stroke JSON,
// resumable draft) + pdf_file (filed PDF UUID, Todo 8) + finished_at (PH
// lock time) + four nullable app-written audit columns (zero DB defaults).
//
// Draft vs Finish are DISTINCT writes: PATCH persists strokes and keeps
// status=draft (resumable); POST /[id]/finish validity-checks via the single
// `isPaperworkValid` predicate (imported, never redefined) and locks the
// envelope (status=finished, routes to Todo 8). Partial ink is NEVER
// persisted silently — every server write is an explicit draft or finish.

export const SIGNING_ENVELOPE_STATUSES = ["draft", "finished"] as const;

export type SigningEnvelopeStatus = (typeof SIGNING_ENVELOPE_STATUSES)[number];

export const SigningEnvelopeStatusSchema = z.enum(SIGNING_ENVELOPE_STATUSES);

// One signature stamp placed on a page: top-left anchor in page FRACTIONS
// (0..1, resolution-independent — same space as PaperworkZone rects) plus
// the captured pad strokes in pad-bitmap px. The merge helper
// (`../signingStamps`) translates strokes into page-bitmap space so the
// validity predicate honors stamped ink exactly like drawn ink.
export const SigningStampSchema = z
  .object({
    id: z.string().min(1).max(64),
    page: z.number().int().positive(),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    strokes: z
      .array(
        z
          .object({
            points: z.array(
              z.object({ x: z.number(), y: z.number() }).strict()
            ),
            width: z.number().positive(),
            color: z.string(),
          })
          .strict()
      )
      .max(500),
  })
  .strict();

export type SigningStamp = z.infer<typeof SigningStampSchema>;

// Envelope content document persisted in the `strokes` text column:
// freehand ink (SigningInk shape — validated structurally) + placed stamps.
// `finishedBy` is written ONLY by the finish route so both finish paths
// (hiree session owning the envelope + HR override) are logged in the row.
export const SigningEnvelopeContentSchema = z
  .object({
    ink: z.object({ pages: z.array(z.unknown()) }).passthrough(),
    stamps: z.array(SigningStampSchema).max(50).optional(),
    finishedBy: z
      .object({
        role: z.enum(["hiree", "hr"]),
        profile_id: z.number().int().positive().nullable(),
      })
      .strict()
      .optional(),
  })
  .passthrough();

export type SigningEnvelopeContent = z.infer<
  typeof SigningEnvelopeContentSchema
>;

export const SigningEnvelopeSchema = z.object({
  id: z.number().int().positive(),
  envelope_key: z.string(),
  profile_id: z.number().int().positive(),
  template_id: z.number().int().positive(),
  status: SigningEnvelopeStatusSchema,
  strokes: z.string().nullable(),
  pdf_file: z.string().nullable(),
  finished_at: z.string().nullable(),
  created_at: z.string().nullable(),
  created_by: z.number().int().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.number().int().nullable(),
});

export type SigningEnvelope = z.infer<typeof SigningEnvelopeSchema>;

// POST body: the server composes `envelope_key` as
// `<profile_id>:<template_id>:<attempt>` (idempotency key — double-POST
// collapses via pre-check + duplicate swallow, Todo 2 precedent).
export const CreateSigningEnvelopeSchema = z
  .object({
    profile_id: z.number().int().positive(),
    template_id: z.number().int().positive(),
    attempt: z.number().int().positive().optional(),
  })
  .strict();

export type CreateSigningEnvelopeInput = z.infer<
  typeof CreateSigningEnvelopeSchema
>;

// PATCH body (Save-draft ONLY): persists strokes, keeps status=draft.
// Finish is a separate POST /[id]/finish write — never a PATCH flag.
export const SaveSigningDraftSchema = z
  .object({
    strokes: z.string().min(1).max(500_000),
  })
  .strict();

export type SaveSigningDraftInput = z.infer<typeof SaveSigningDraftSchema>;

// POST /[id]/finish body: explicit ink + stamps + the renderer-owned bitmap
// sizes per 1-based page (fraction mapping needs them) + the acting caller.
// Server merges stamps into ink, then gates SOLELY on `isPaperworkValid`.
export const FinishSigningEnvelopeSchema = z
  .object({
    ink: z.object({ pages: z.array(z.unknown()) }).passthrough(),
    stamps: z.array(SigningStampSchema).max(50).optional(),
    pageSizes: z.record(
      z.coerce.number().int().positive(),
      z.object({ width: z.number().positive(), height: z.number().positive() }).strict()
    ),
    actor: z
      .object({
        role: z.enum(["hiree", "hr"]),
        profile_id: z.number().int().positive().nullable(),
      })
      .strict(),
  })
  .strict();

export type FinishSigningEnvelopeInput = z.infer<
  typeof FinishSigningEnvelopeSchema
>;

export interface SigningEnvelopeResponse {
  success: boolean;
  data?: SigningEnvelope | SigningEnvelope[] | null;
  message?: string;
}
