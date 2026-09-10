import { z } from "zod";

import type { EquipmentIssuer } from "./types/equipment-issue.schema";
import { EquipmentIssuerSchema } from "./types/equipment-issue.schema";

// equipmentCatalog.ts — item catalog for Todo 13.
//
// Pdf §9 lists EXACTLY seven handover items; they are seeded here with their
// §9 issuer roles (IT / Admin / Department). Anything beyond these seven
// MUST come from the admin config file (`equipment-catalog.config.json`) —
// never from new code constants. `loadEquipmentCatalog` merges the two and
// rejects custom keys that shadow a pdf key.

export interface EquipmentCatalogItem {
  key: string;
  label: string;
  issuer: EquipmentIssuer;
  required: boolean;
  source: "pdf-9" | "admin-config";
}

/** The seven pdf §9 handover items — the ONLY code-constant items allowed. */
export const PDF_SECTION_9_CATALOG: readonly EquipmentCatalogItem[] = [
  { key: "computer", label: "Computer / laptop", issuer: "IT", required: true, source: "pdf-9" },
  { key: "company_id", label: "Company ID", issuer: "Admin", required: true, source: "pdf-9" },
  { key: "email", label: "Email account", issuer: "IT", required: true, source: "pdf-9" },
  { key: "system_access", label: "System access", issuer: "IT", required: true, source: "pdf-9" },
  { key: "equipment_tools", label: "Equipment / tools", issuer: "Admin", required: true, source: "pdf-9" },
  { key: "required_apps", label: "Required applications", issuer: "IT", required: true, source: "pdf-9" },
  { key: "workspace", label: "Workspace", issuer: "Department", required: true, source: "pdf-9" },
];

export const CustomEquipmentItemSchema = z
  .object({
    key: z
      .string()
      .min(1, "Custom item key is required")
      .max(64, "Custom item key must be at most 64 characters")
      .regex(
        /^[a-z0-9_]{1,64}$/,
        "Custom item key must be lowercase letters, digits, or underscore"
      ),
    label: z.string().min(1, "Custom item label is required").max(120),
    issuer: EquipmentIssuerSchema,
    required: z.boolean(),
  })
  .strict();

export type CustomEquipmentItemInput = z.infer<typeof CustomEquipmentItemSchema>;

/**
 * Merges pdf §9 defaults with admin-config extras.
 * @param customItems - Raw `customItems` array from the admin JSON config.
 * @returns Full catalog (pdf items first, then admin extras).
 * @throws Error when a custom item is invalid or shadows a pdf §9 key.
 */
export function loadEquipmentCatalog(
  customItems: unknown
): EquipmentCatalogItem[] {
  const list = customItems === undefined ? [] : customItems;
  const parsed = z.array(CustomEquipmentItemSchema).safeParse(list);
  if (!parsed.success) {
    throw new Error("Invalid equipment admin config: customItems mismatch");
  }
  const pdfKeys = new Set(PDF_SECTION_9_CATALOG.map((item) => item.key));
  const seen = new Set<string>();
  const extras: EquipmentCatalogItem[] = parsed.data.map((item) => {
    if (pdfKeys.has(item.key)) {
      throw new Error(
        `Admin config item "${item.key}" shadows a pdf §9 item — rename it`
      );
    }
    if (seen.has(item.key)) {
      throw new Error(
        `Admin config item "${item.key}" is declared more than once`
      );
    }
    seen.add(item.key);
    return { ...item, source: "admin-config" as const };
  });
  return [...PDF_SECTION_9_CATALOG, ...extras];
}

/** Finds a catalog item by key (undefined when the key is not catalogued). */
export function findCatalogItem(
  catalog: readonly EquipmentCatalogItem[],
  key: string
): EquipmentCatalogItem | undefined {
  return catalog.find((item) => item.key === key);
}
