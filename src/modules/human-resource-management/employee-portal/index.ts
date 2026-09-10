export { PortalModule } from "./PortalModule";
export type {
  PortalChecklistItem,
  PortalChecklistResponse,
  PortalDocKey,
  PortalDocumentLink,
  LinkPortalDocumentInput,
  PortalIdentity,
  PortalIdentityKey,
  PortalIdentityKind,
  PortalPhase,
  PortalSession,
  PortalSessionResponse,
} from "./types/portal-checklist.schema";
export {
  PORTAL_DOC_CONFIG,
  buildChecklist,
  isChecklistComplete,
  isKnownDocKey,
  parsePortalFileMarker,
  portalFileMarker,
  portalMarkerPrefix,
} from "./portalChecklist";
export {
  LinkPortalDocumentSchema,
  PortalChecklistItemSchema,
  PortalChecklistResponseSchema,
  PortalDocKeySchema,
  PortalIdentityKeySchema,
  PortalIdentityKindSchema,
  PortalPhaseSchema,
  PortalSessionResponseSchema,
  PortalSessionSchema,
} from "./types/portal-checklist.schema";
export type { PortalDocConfig } from "./portalChecklist";
export { readPortalToken, resolvePortalIdentity } from "./portalAccess";
export type { PortalIdentityResolution } from "./portalAccess";
