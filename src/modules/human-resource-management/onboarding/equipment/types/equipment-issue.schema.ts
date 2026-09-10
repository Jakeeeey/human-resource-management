import { z } from "zod";

// equipment-issue.schema.ts — Zod source of truth for the issue/ack API
// shapes. Ack rows are written into the `acknowledgement_logs` store
// (contract: 9 fields, UNIQUE doc_ref+signer+acknowledged_at, method enum
// ink|stamp|typed). Issue rows reuse the SAME audit-trail store with
// namespaced doc_refs (no new collection, no migration, no asset-table
// writes — EmployeeAssetsTab owns assets; this log references handover only).
//
// KEY: everything is keyed to the EMPLOYEE (`user.user_id`) — doc_refs are
// `equipment:issue:<userId>:<itemKey>` / `equipment:ack:<userId>:<itemKey>`
// and the hiree signer is `hiree:<userId>` (the employee themself). There is
// no onboarding-profile key anywhere in this module.

/** Issuer vocabulary is EXACTLY pdf §9: IT / Admin / Department. */
export const EquipmentIssuerSchema = z.enum(["IT", "Admin", "Department"]);

export type EquipmentIssuer = z.infer<typeof EquipmentIssuerSchema>;

/** Ack method enum mirrors the `acknowledgement_logs.method` contract. */
export const EquipmentAckMethodSchema = z.enum(["ink", "stamp", "typed"]);

export type EquipmentAckMethod = z.infer<typeof EquipmentAckMethodSchema>;

/**
 * Hiree signer shape: `hiree:<user_id>` (the employee digital-acknowledge) or
 * `hr-override:<user_id>` (HR override — both logged). Free-form signers are
 * rejected so the trail stays attributable.
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
    user_id: z.number().int().positive(),
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
// The hiree signer must BE the employee: `hiree:<user_id>` of the same
// employee the row is keyed to (`hr-override:<user_id>` stays free-form).
export const AcknowledgeEquipmentItemSchema = z
  .object({
    user_id: z.number().int().positive(),
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
  .strict()
  .refine(
    (data) =>
      !data.signer.startsWith("hiree:") ||
      data.signer === `hiree:${data.user_id}`,
    {
      message: "The hiree signer must be the employee key (hiree:<user_id>)",
      path: ["signer"],
    }
  );

export type AcknowledgeEquipmentItemInput = z.infer<
  typeof AcknowledgeEquipmentItemSchema
>;

export const EquipmentQuerySchema = z
  .object({
    user_id: z.coerce.number().int().positive(),
  })
  .strict();

export type EquipmentQuery = z.infer<typeof EquipmentQuerySchema>;

export interface EquipmentRouteResponse {
  success: boolean;
  data?: unknown;
  message?: string;
}
