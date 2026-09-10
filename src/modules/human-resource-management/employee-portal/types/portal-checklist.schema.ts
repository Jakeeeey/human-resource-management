import { z } from "zod";

// portal-checklist.schema.ts — Zod source of truth for the hiree portal
// (Todo 9). The per-hire document checklist (required/optional) is seeded
// from the hub config defaults (`../portalChecklist`) — stage 4 semantics
// from onboarding.pdf — never hardcoded in components. Uploads travel ONLY
// via the application-form upload canon (kind/size/mime server-validated,
// folder-routed); the link route persists only the returned `data.id` UUID.

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

export type PortalDocKey = (typeof PORTAL_DOC_KEYS)[number];

export const PortalDocKeySchema = z.enum(PORTAL_DOC_KEYS);

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

// POST /portal/documents body: link an already-uploaded (canon) file UUID
// to one checklist slot. The `File|null` lived in the form only — the
// server persists just `file_id` (never raw bytes, never a path).
export const LinkPortalDocumentSchema = z
  .object({
    profile_id: z.number().int().positive(),
    doc_key: PortalDocKeySchema,
    file_id: z.string().min(1).max(128),
  })
  .strict();

export type LinkPortalDocumentInput = z.infer<
  typeof LinkPortalDocumentSchema
>;

export interface PortalDocumentLink {
  profile_id: number;
  doc_key: PortalDocKey;
  file_id: string;
}

export const PortalActorSchema = z
  .object({
    role: z.enum(["hiree", "hr"]),
    profile_id: z.number().int().positive().nullable(),
  })
  .strict();

export type PortalActor = z.infer<typeof PortalActorSchema>;
