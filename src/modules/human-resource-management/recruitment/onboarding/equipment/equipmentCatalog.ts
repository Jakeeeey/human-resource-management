import type { EquipmentIssuer } from "./types/equipment-issue.schema";

// equipmentCatalog.ts — the pdf §9 code catalog, retained ONLY as the SEED
// source (todo 6, `catalogSeed.ts`) and as the shared `EquipmentCatalogItem`
// contract. It is NOT the runtime source: the live catalog is read from the
// `onboarding_equipment_item` collection through `./server/equipmentItemIo.ts`
// (`loadEquipmentCatalog()`), which maps DB rows onto this shape (todo 9).
//
// The legacy fs/JSON path (`equipmentCatalogServer.ts` +
// `equipment-catalog.config.json`) was retired with the migration: HR now
// adds/renames items through the requirements admin surface, and the merge +
// shadow/duplicate validation that used to live here is gone with it.

export interface EquipmentCatalogItem {
  key: string;
  label: string;
  issuer: EquipmentIssuer;
  required: boolean;
  /**
   * Informational provenance of the row — kept WIDE (`string`) because the
   * status route forwards it to the client
   * (`EquipmentItemStatus.source: string`) and the value is now DB-derived:
   * the item IO stamps a constant (`admin-config`), while the seed rows below
   * still carry their legacy `pdf-9` marker. Never branch on this value.
   */
  source: string;
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

/** Finds a catalog item by key (undefined when the key is not catalogued). */
export function findCatalogItem(
  catalog: readonly EquipmentCatalogItem[],
  key: string
): EquipmentCatalogItem | undefined {
  return catalog.find((item) => item.key === key);
}
