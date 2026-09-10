export { PortalModule } from "./PortalModule";
export type {
  PortalChecklistItem,
  PortalChecklistResponse,
  PortalDocKey,
  PortalDocumentLink,
  LinkPortalDocumentInput,
  PortalActor,
} from "./types/portal-checklist.schema";
export {
  PORTAL_DOC_CONFIG,
  buildChecklist,
  isChecklistComplete,
  isKnownDocKey,
  parsePortalFileMarker,
  portalFileMarker,
} from "./portalChecklist";
export {
  LinkPortalDocumentSchema,
  PortalActorSchema,
  PortalChecklistItemSchema,
  PortalChecklistResponseSchema,
  PortalDocKeySchema,
} from "./types/portal-checklist.schema";
export type { PortalDocConfig } from "./portalChecklist";
export { assertHireeScope, readHireeScope } from "./portalAccess";
export type { HireeScope, ScopeDecision } from "./portalAccess";
