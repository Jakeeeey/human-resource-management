/**
 * Types for Employee Masterlist Module
 * Aligned with Spring Boot /users API response schema
 */

export interface Department {
  department_id: number;
  department_name: string;
  parent_division: number;
  department_description?: string;
  department_head?: string;
  department_head_id?: number;
  tax_id?: number;
  date_added?: string;
}

/** Matches the Spring Boot GET /users response object */
export interface User {
  id: number;
  email: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  suffixName?: string;
  nickname?: string;
  contact?: string;
  province?: string;
  city?: string;
  brgy?: string;
  department?: number | null;
  sssNumber?: string;
  philHealthNumber?: string;
  tinNumber?: string;
  pagibigNumber?: string;
  position?: string;
  dateOfHire?: string;
  tags?: string | null;
  birthday?: string | null;
  gender?: string | null;
  civilStatus?: string | null;
  nationality?: string | null;
  placeOfBirth?: string | null;
  bloodType?: string | null;
  religion?: string | null;
  spouseName?: string | null;
  image?: string | null;
  signature?: string | null;
  rfId?: string | null;
  isAdmin?: boolean | null;
  admin?: boolean | null;
  role?: string | null;
  roleId?: number | null;
  biometricId?: string | null;
  externalId?: string | null;
  isDeleted?: boolean | unknown | null;
  is_deleted?: boolean | unknown | null;
  updateAt?: string | null;
  emergencyContactName?: string | null;
  emergencyContactNumber?: string | null;
}

export type Employee = User;

export interface EmployeeMasterlistFilters {
  search?: string;
  department_id?: number;
  status?: "active" | "inactive";
}

// --- 201 Files / Employee File Records ---

export interface EmployeeFileRecord {
  id: number;
  user_id: number;
  list_id: number;
  record_name: string;
  description?: string;
  file_ref: string; // Directus file UUID
  is_deleted: boolean;
  created_at: string;
  created_by?: number;
  updated_at: string;
  updated_by?: number;
}


export interface EmployeeFileRecordType {
  id: number;
  name: string;
  description?: string;
}

export interface EmployeeFileRecordList {
  id: number;
  record_type_id: number;
  name: string;
  description?: string;
}

/** Flattened record for UI display, matching the JOIN query provided */
export interface EmployeeFileRecordDisplay {
  id: number;
  record_name: string;
  file_ref: string;
  type: string;
  list_name: string;
  description?: string;
  created_at: string;
}

// --- Assets and Equipments Types ---

export interface Item {
  id: number;
  item_name: string;
  item_type?: number;
  item_classification?: number;
}

export interface AssetAndEquipment {
  id: number;
  item_image?: string;
  item_id?: number;
  quantity?: number;
  rfid_code?: string;
  barcode?: string;
  serial?: string;
  department?: number;
  employee?: number; // assigned employee ID
  cost_per_item?: number;
  total?: number;
  condition?: string;
  life_span?: number;
  is_active_warning?: boolean;
  is_active?: boolean | number;
  encoder?: number;
  date_acquired?: string;
  date_created?: string;
}

export interface AssetAssignment {
  assignment_id?: number;
  asset_id: number;
  user_id: number;
  assigned_by?: number;
  assigned_date?: string;
  expected_return_date?: string | null;
  actual_return_date?: string | null;
  assignment_status?: string;
  condition_on_assignment?: string;
  condition_on_return?: string;
  notes?: string;
}

export interface Company {
  company_id: number;
  company_name: string;
  company_type?: string;
  company_code: string;
  company_address?: string;
  company_brgy?: string;
  company_city?: string;
  company_province?: string;
  company_zipCode?: string;
  company_registrationNumber?: string;
  company_tin?: string;
  company_dateAdmitted?: string;
  company_contact?: string;
  company_email?: string;
  company_outlook?: string;
  company_gmail?: string;
  company_department?: string;
  company_logo?: string;
  company_facebook?: string;
  company_website?: string;
  company_tags?: string;
}
