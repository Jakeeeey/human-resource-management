export type {
  EquipmentIssuer,
  EquipmentAckMethod,
  EquipmentAckSigner,
  IssueEquipmentItemInput,
  AcknowledgeEquipmentItemInput,
  EquipmentQuery,
  EquipmentRouteResponse,
} from "./types/equipment-issue.schema";
export {
  EquipmentIssuerSchema,
  EquipmentAckMethodSchema,
  EquipmentAckSignerSchema,
  IssueEquipmentItemSchema,
  AcknowledgeEquipmentItemSchema,
  EquipmentQuerySchema,
} from "./types/equipment-issue.schema";
export type { EquipmentCatalogItem } from "./equipmentCatalog";
// `PDF_SECTION_9_CATALOG` is deliberately NOT re-exported here (todo 11): it is
// the todo-6 SEED source only — `catalogSeed.ts` imports `./equipmentCatalog`
// directly. The runtime catalog comes from the DB via `loadEquipmentCatalog`.
export { findCatalogItem } from "./equipmentCatalog";
export type {
  EquipmentEventKind,
  ParsedEquipmentDocRef,
  EquipmentCatalogEntry,
  EquipmentItemState,
} from "./equipmentPredicate";
export {
  equipmentDocRef,
  parseEquipmentDocRef,
  hireeSigner,
  issuerSigner,
  buildEquipmentItemStates,
  isFullyEquipped,
  toEquipmentEvidence,
} from "./equipmentPredicate";
export type {
  EquipmentItemStatus,
  EquipmentStatus,
} from "./providers/equipmentProvider";
export {
  EquipmentFetchProvider,
  useEquipmentFetch,
} from "./providers/equipmentProvider";
export { EquipmentTab } from "./components/EquipmentTab";
