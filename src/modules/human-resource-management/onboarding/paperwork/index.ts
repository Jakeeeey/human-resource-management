export { PaperworkRegistryModule } from "./PaperworkRegistryModule";
export type {
  PaperworkTemplate,
  PaperworkZone,
  PaperworkZoneRect,
  CreatePaperworkTemplateInput,
  UpdatePaperworkTemplateInput,
} from "./types/paperwork-template.schema";
export {
  PAPERWORK_BODY_HTML_MAX,
  PaperworkTemplateSchema,
  PaperworkZoneSchema,
  PaperworkZoneRectSchema,
  PaperworkZonesSchema,
  CreatePaperworkTemplateSchema,
  UpdatePaperworkTemplateSchema,
} from "./types/paperwork-template.schema";
export type {
  PaperworkPageSize,
  PaperworkValidityVerdict,
} from "./paperworkValidity";
export {
  hasAnyInkMark,
  getInkedZoneIds,
  isPaperworkValid,
} from "./paperworkValidity";
