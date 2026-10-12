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
  PaperworkTemplateCompany,
  ReplacePaperworkTemplateCompaniesInput,
} from "./types/paperwork-template-company.schema";
export {
  PaperworkTemplateCompanySchema,
  ReplacePaperworkTemplateCompaniesSchema,
} from "./types/paperwork-template-company.schema";
export {
  listAllTemplateCompanies,
  listTemplateCompanies,
  replaceTemplateCompanies,
  toTemplateCompanyMap,
} from "./providers/paperworkTemplateCompanies";
export type { PaperworkCompany } from "./providers/paperworkCompanyProvider";
export { listPaperworkCompanies } from "./providers/paperworkCompanyProvider";
export type {
  PaperworkPageSize,
  PaperworkValidityVerdict,
} from "./paperworkValidity";
export {
  hasAnyInkMark,
  getInkedZoneIds,
  isPaperworkValid,
} from "./paperworkValidity";
