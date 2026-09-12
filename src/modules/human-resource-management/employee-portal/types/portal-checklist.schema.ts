import { z } from "zod";

// portal-checklist.schema.ts — Zod source of truth for the hiree portal
// (todo 25 identity re-key; todo 8 widened doc-key contract). The portal
// identity is NO LONGER an `onboarding_profiles` row: the session resolves an
// APPLICANT before hiring (the applicant-scoped signing key) or an EMPLOYEE
// after the hire (`user.user_id`). The checklist config is driven by the LIVE
// `onboarding_document_slot` catalog (`../server/documentSlotIo`); the
// `PORTAL_DOC_KEYS` list below is the SEED source ONLY (todo-6
// `catalogSeed.ts` via `PORTAL_DOC_CONFIG`), never the runtime allow-list.
// Uploads travel ONLY via the application-form canon (kind/size/mime
// server-validated, folder-routed) and the link route persists only the
// returned `data.id` UUID.

export const PORTAL_DOC_KEYS = [
  "valid_id",
  "birth_certificate",
  "nbi_clearance",
  "medical_certificate",
  "tor_diploma",
  "coe_previous",
  "training_certificates",
  "government_ids",
] as const;

/** Seed-only key union — NOT the runtime allow-list (the DB is). */
export type SeedPortalDocKey = (typeof PORTAL_DOC_KEYS)[number];

/**
 * Widened doc-key contract (todo 8): lower-case snake_case, no leading
 * digit/underscore, max 64 chars. Mirrors `DOC_SLOT_KEY_PATTERN` in
 * `../server/documentSlotIo.ts` (the DB row contract) — keep them identical.
 */
export const PORTAL_DOC_KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

export const PortalDocKeySchema = z.string().regex(PORTAL_DOC_KEY_PATTERN);

/** Runtime doc key — validated by `PortalDocKeySchema`, not a closed enum. */
export type PortalDocKey = z.infer<typeof PortalDocKeySchema>;

export const PortalChecklistItemSchema = z
  .object({
    key: PortalDocKeySchema,
    title: z.string().min(1),
    required: z.boolean(),
    filed: z.boolean(),
    file_id: z.string().min(1).nullable(),
  })
  .strict();

export type PortalChecklistItem = z.infer<typeof PortalChecklistItemSchema>;

export const PortalChecklistResponseSchema = z
  .object({
    success: z.boolean(),
    data: z.array(PortalChecklistItemSchema).optional(),
    message: z.string().optional(),
  })
  .passthrough();

export type PortalChecklistResponse = z.infer<
  typeof PortalChecklistResponseSchema
>;

// ---------------------------------------------------------------------------
// Identity — applicant (pre-hire) / employee (post-hire)
// ---------------------------------------------------------------------------

export const PORTAL_IDENTITY_KINDS = ["applicant", "employee"] as const;

export const PortalIdentityKindSchema = z.enum(PORTAL_IDENTITY_KINDS);

export type PortalIdentityKind = z.infer<typeof PortalIdentityKindSchema>;

/**
 * The key a portal record is filed under: the `applicant.id` before hiring,
 * the `user.user_id` after the hire. One name = one concept — never a
 * profile id.
 */
export const PortalIdentityKeySchema = z
  .object({
    kind: PortalIdentityKindSchema,
    id: z.number().int().positive(),
  })
  .strict();

export type PortalIdentityKey = z.infer<typeof PortalIdentityKeySchema>;

export const PORTAL_PHASES = ["pre_hire", "post_hire"] as const;

export const PortalPhaseSchema = z.enum(PORTAL_PHASES);

export type PortalPhase = z.infer<typeof PortalPhaseSchema>;

/**
 * GET /portal/session response data — also the client session type. `id`
 * mirrors the phase key (`applicant_id` pre-hire, `user_id` post-hire);
 * the other ids are populated when resolvable and null otherwise. There is
 * no `profile_id` anywhere.
 */
export const PortalSessionSchema = z
  .object({
    kind: PortalIdentityKindSchema,
    id: z.number().int().positive(),
    phase: PortalPhaseSchema,
    email: z.string().min(1).nullable(),
    applicant_id: z.number().int().positive().nullable(),
    application_id: z.number().int().positive().nullable(),
    user_id: z.number().int().positive().nullable(),
  })
  .strict();

export type PortalSession = z.infer<typeof PortalSessionSchema>;

/** Server-side alias for the resolved identity (same wire contract). */
export type PortalIdentity = PortalSession;

export const PortalSessionResponseSchema = z
  .object({
    success: z.boolean(),
    data: PortalSessionSchema.optional(),
    message: z.string().optional(),
  })
  .passthrough();

export type PortalSessionResponse = z.infer<typeof PortalSessionResponseSchema>;

// POST /portal/documents body: link an already-uploaded (canon) file UUID
// to one checklist slot of the SESSION's own identity. The server resolves
// the identity key from the cookie — the client never asserts it.
export const LinkPortalDocumentSchema = z
  .object({
    doc_key: PortalDocKeySchema,
    file_id: z.string().min(1).max(128),
  })
  .strict();

export type LinkPortalDocumentInput = z.infer<
  typeof LinkPortalDocumentSchema
>;

export interface PortalDocumentLink {
  kind: PortalIdentityKind;
  id: number;
  doc_key: PortalDocKey;
  file_id: string;
}
