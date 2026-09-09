import { promises as fs } from "node:fs";
import path from "node:path";

import {
  loadEquipmentCatalog,
  type EquipmentCatalogItem,
} from "../equipmentCatalog";

// equipmentCatalogServer.ts — SERVER-ONLY catalog loader (imports
// node:fs — never import from client components). Merges the pdf §9 code
// seed with the admin JSON config at request time, so custom items land
// without a code change or restart.

export async function loadServerEquipmentCatalog(): Promise<
  EquipmentCatalogItem[]
> {
  const configPath = path.join(
    process.cwd(),
    "src",
    "modules",
    "human-resource-management",
    "onboarding",
    "equipment",
    "equipment-catalog.config.json"
  );
  const raw = await fs.readFile(configPath, "utf8");
  const parsed: unknown = JSON.parse(raw);
  const customItems =
    typeof parsed === "object" && parsed !== null
      ? (parsed as { customItems?: unknown }).customItems ?? []
      : [];
  return loadEquipmentCatalog(customItems);
}
