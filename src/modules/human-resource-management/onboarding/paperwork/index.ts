export { PaperworkRegistryModule } from "./PaperworkRegistryModule";
export type {
  PaperworkTemplate,
  PaperworkTemplateSource,
  PaperworkZone,
  PaperworkZoneRect,
  CreatePaperworkTemplateInput,
  UpdatePaperworkTemplateInput,
} from "./types/paperwork-template.schema";
export {
  PaperworkTemplateSchema,
  PaperworkTemplateSourceSchema,
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
