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
// `PORTAL_DOC_CONFIG` is deliberately NOT re-exported here (todo 11): it is
// the todo-6 SEED source only — `onboarding/tasks/server/catalogSeed.ts`
// imports `./portalChecklist` directly. The runtime checklist is built from
// the live `onboarding_document_slot` catalog (`buildChecklist`), so this
// barrel must not offer a code-constant shortcut back into runtime code.
export {
  buildChecklist,
  isChecklistComplete,
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
export { readPortalToken, resolvePortalIdentity } from "./portalAccess";
export type { PortalIdentityResolution } from "./portalAccess";
