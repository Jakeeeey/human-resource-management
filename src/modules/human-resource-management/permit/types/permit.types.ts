export type PermitHealthLevel = "healthy" | "warning" | "critical" | "unregistered";

export interface PermitTypeItem {
  id: number | string;
  name?: string;
  permit_type_name?: string;
  code?: string;
  description?: string;
  is_active?: number | boolean;
}

export interface CompanyPermitRecord {
  id: number | string;
  company_id?: number | string | null;
  permit_type_id: number | string;
  permit_type_name?: string;
  permit_number: string;
  issue_date?: string | null;
  issued_date?: string | null;
  expiry_date?: string | null;
  expiration_date?: string | null;
  file_url?: string | null;
  issuing_agency?: string | null;
  status: "Active" | "Archived" | string;
  notes?: string | null;
  remarks?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  days_remaining?: number;
  health_level?: PermitHealthLevel;
}

export interface PermitFormData {
  id?: number | string;
  company_id?: number | string;
  permit_type_id: number | string;
  permit_number: string;
  issue_date: string;
  expiry_date: string;
  file_url: string;
  issuing_agency?: string;
  status?: string;
  notes?: string;
  renew_from_id?: number | string;
}

export interface PermitCatalogSlot {
  permitType: PermitTypeItem;
  currentPermit: CompanyPermitRecord | null;
  history: CompanyPermitRecord[];
}

export interface CompanyPermitSummary {
  totalRequirements: number;
  compliantCount: number;
  expiringCount: number;
  expiredCount: number;
  missingCount: number;
  complianceRate: number;
}

export interface CompanyPermitData {
  summary: CompanyPermitSummary;
  slots: PermitCatalogSlot[];
  allPermits: CompanyPermitRecord[];
  permitTypes: PermitTypeItem[];
}
