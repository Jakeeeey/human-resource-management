import { z } from "zod";

// portal-equipment.schema.ts — Zod contract for the hiree portal equipment
// tab: issued handover items and the acknowledge intent. The identity is
// resolved SERVER-SIDE from the session cookie, so the ack body carries only
// the item key — the server forces the `hiree:<user_id>` signer and never
// reads a client-asserted user or signer.

export const PORTAL_EQUIPMENT_ITEM_KEY_PATTERN = /^[a-z0-9_]{1,64}$/;

export const PortalEquipmentItemKeySchema = z
  .string()
  .regex(PORTAL_EQUIPMENT_ITEM_KEY_PATTERN);

export type PortalEquipmentItemKey = z.infer<
  typeof PortalEquipmentItemKeySchema
>;

export const PortalEquipmentItemSchema = z.object({
  key: PortalEquipmentItemKeySchema,
  label: z.string().min(1),
  issuer: z.string().min(1),
  required: z.boolean(),
  issued: z.boolean(),
  acked: z.boolean(),
  issuedAt: z.string().nullable(),
  ackedAt: z.string().nullable(),
});

export type PortalEquipmentItem = z.infer<typeof PortalEquipmentItemSchema>;

export const PortalEquipmentResponseSchema = z
  .object({
    success: z.boolean(),
    data: z.array(PortalEquipmentItemSchema).optional(),
    message: z.string().optional(),
  })
  .passthrough();

export type PortalEquipmentResponse = z.infer<
  typeof PortalEquipmentResponseSchema
>;

export const AcknowledgePortalEquipmentSchema = z
  .object({
    item_key: PortalEquipmentItemKeySchema,
  })
  .strict();

export type AcknowledgePortalEquipmentInput = z.infer<
  typeof AcknowledgePortalEquipmentSchema
>;
