import { z } from "zod";

// equipment-issue.schema.ts — Zod source of truth for the issue/ack API
// shapes. Ack rows are written into the `acknowledgement_logs` store
// (contract: UNIQUE doc_ref+signer+acknowledged_at; no method column). Issue
// rows reuse the SAME audit-trail store with namespaced doc_refs (no new
// collection, no migration, no asset-table writes — EmployeeAssetsTab owns
// assets; this log references handover only).
//
// KEY: everything is keyed to the EMPLOYEE (`user.user_id`) — doc_refs are
// `equipment:issue:<userId>:<itemKey>` / `equipment:ack:<userId>:<itemKey>`
// and the hiree signer is `hiree:<userId>` (the employee themself). There is
// no onboarding-profile key anywhere in this module.

/** Issuer vocabulary is EXACTLY pdf §9: IT / Admin / Department. */
export const EquipmentIssuerSchema = z.enum(["IT", "Admin", "Department"]);

export type EquipmentIssuer = z.infer<typeof EquipmentIssuerSchema>;

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
