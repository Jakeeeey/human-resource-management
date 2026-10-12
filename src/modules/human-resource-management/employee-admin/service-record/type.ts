export interface EmployeeProfile {
  user_id: number;
  user_fname: string;
  user_mname?: string | null;
  user_lname: string;
  user_maiden_name?: string | null;
  user_bday?: string | null;
  user_birth_place?: string | null;
  user_bp_number?: string | null;
  user_position?: string | null;
  user_department?: number | null;
  department_name?: string | null;
  user_dateOfHire?: string | null;
  separation_date?: string | null;
  separation_cause?: string | null;
  is_active?: boolean;
}

export interface ServiceRecordEntry {
  service_record_id: number;
  user_id: number;
  service_from: string; // YYYY-MM-DD
  service_to?: string | null; // YYYY-MM-DD or null if Present
  designation: string;
  appointment_status: string; // Reg.Perm., Casual, Contractual, Job Order, etc.
  salary: number;
  salary_basis: string; // Per Annum, Monthly, Daily
  station_assignment: string;
  branch: string; // National, NM, Local, Provincial
  leave_wo_pay?: string | null; // None or specific dates/days
  cause: string; // Orig. Appt., NOSA, NOSI, Promotion, etc.
  remarks?: string | null;
  sequence_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface ServiceRecordSetting {
  id: number;
  agency_name: string;
  sub_header?: string | null;
  office_address?: string | null;
  certification_text?: string | null;
  legal_basis_text?: string | null;
  default_prepared_by_name?: string | null;
  default_prepared_by_title?: string | null;
  default_certified_by_name?: string | null;
  default_certified_by_title?: string | null;
}

export interface ServiceRecordDataResponse {
  employee: EmployeeProfile;
  records: ServiceRecordEntry[];
  setting: ServiceRecordSetting;
  is_still_in_service: boolean;
}

export interface EmployeeOption {
  user_id: number;
  user_fname: string;
  user_mname?: string | null;
  user_lname: string;
  user_position?: string | null;
  department_name?: string | null;
  user_dateOfHire?: string | null;
  is_active?: boolean;
}
