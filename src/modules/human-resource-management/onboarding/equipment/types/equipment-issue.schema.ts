import { z } from "zod";

// equipment-issue.schema.ts — Zod source of truth for the Todo 13 issue/ack
// API shapes. Ack rows are written into Todo 10's `acknowledgement_logs`
// store (contract: Todo 1a — 9 fields, UNIQUE doc_ref+signer+acknowledged_at,
// method enum ink|stamp|typed). Issue rows reuse the SAME audit-trail store
// with namespaced doc_refs (no new collection, no migration, no asset-table
// writes — EmployeeAssetsTab owns assets; this log references handover only).

/** Issuer vocabulary is EXACTLY pdf §9: IT / Admin / Department. */
export const EquipmentIssuerSchema = z.enum(["IT", "Admin", "Department"]);

export type EquipmentIssuer = z.infer<typeof EquipmentIssuerSchema>;

/** Ack method enum mirrors the `acknowledgement_logs.method` contract. */
export const EquipmentAckMethodSchema = z.enum(["ink", "stamp", "typed"]);

export type EquipmentAckMethod = z.infer<typeof EquipmentAckMethodSchema>;

/**
 * Hiree signer shape: `hiree:<employee_id>` (hiree digital-acknowledge) or
 * `hr-override:<user_id>` (HR override, Todo 7 precedent — both logged).
 * Free-form signers are rejected so the trail stays attributable.
 */
export const EquipmentAckSignerSchema = z
  .string()
  .min(1, "Signer is required")
  .max(64, "Signer must be at most 64 characters")
  .regex(
    /^(hiree:\d+|hr-override:\d+)$/,
    "Signer must be hiree:<employee_id> or hr-override:<user_id>"
  );

export type EquipmentAckSigner = z.infer<typeof EquipmentAckSignerSchema>;

// POST /equipment-issues — HR records handover of one catalog item.
// `item_key` membership is checked server-side against the loaded catalog
// (pdf §9 + admin config), so invented items are rejected with 400.
export const IssueEquipmentItemSchema = z
  .object({
    profile_id: z.number().int().positive(),
    item_key: z
      .string()
      .min(1, "Item key is required")
      .max(64, "Item key must be at most 64 characters")
      .regex(
        /^[a-z0-9_]{1,64}$/,
        "Item key must be lowercase letters, digits, or underscore"
      ),
  })
  .strict();

export type IssueEquipmentItemInput = z.infer<typeof IssueEquipmentItemSchema>;

// POST /equipment-acks — hiree digital-acknowledge of one ISSUED item.
// Ack-without-issue is rejected server-side with 422 (never counted).
export const AcknowledgeEquipmentItemSchema = z
  .object({
    profile_id: z.number().int().positive(),
    item_key: z
      .string()
      .min(1, "Item key is required")
      .max(64, "Item key must be at most 64 characters")
      .regex(
        /^[a-z0-9_]{1,64}$/,
        "Item key must be lowercase letters, digits, or underscore"
      ),
    signer: EquipmentAckSignerSchema,
    method: EquipmentAckMethodSchema,
  })
  .strict();

export type AcknowledgeEquipmentItemInput = z.infer<
  typeof AcknowledgeEquipmentItemSchema
>;

export const EquipmentQuerySchema = z
  .object({
    profile_id: z.coerce.number().int().positive(),
  })
  .strict();

export type EquipmentQuery = z.infer<typeof EquipmentQuerySchema>;

export interface EquipmentRouteResponse {
  success: boolean;
  data?: unknown;
  message?: string;
}
