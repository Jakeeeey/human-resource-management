// Type definitions for Total Hours Report

export interface TotalHoursRecord {
  id: string; // Unique composite key e.g. `${employee_id}_${log_date}`
  log_id: number | null;
  approval_id: number | null;
  employee_id: number;
  employee_name: string;
  employee_position?: string;
  employee_code?: string | null;
  department_id: number;
  department_name: string;
  log_date: string; // YYYY-MM-DD
  day_of_week: string;

  // Approved Metrics (from attendance_approval / approved calculation)
  work_minutes: number;
  late_minutes: number;
  undertime_minutes: number;
  overtime_minutes: number;
  approval_status: 'approved' | 'rejected' | 'pending';
  remarks: string | null;
  approved_by?: number | null;
  approved_by_name?: string | null;
  approved_at?: string | null;

  // Actual Clock Times (from attendance_log)
  time_in: string | null;
  time_out: string | null;
  lunch_start?: string | null;
  lunch_end?: string | null;
  break_start?: string | null;
  break_end?: string | null;
  attendance_status?: string | null; // e.g. "On Time", "Late", "Absent"

  // Scheduled Hours
  sched_time_in?: string | null;
  sched_time_out?: string | null;
  grace_period?: number;
}

export interface User {
  user_id: number;
  user_fname: string;
  user_lname: string;
  user_mname: string | null;
  user_department: number | null;
  user_email: string;
  user_position?: string;
  biometric_id?: string | null;
  isAdmin?: boolean | number;
  role?: string;
}

export interface Department {
  department_id: number;
  department_name: string;
  department_description?: string | null;
  department_head?: string | null;
  department_head_id?: number | null;
}

export interface TotalHoursSummary {
  totalWorkMinutes: number;
  totalLateMinutes: number;
  totalUndertimeMinutes: number;
  totalOvertimeMinutes: number;
  totalDays: number;
  uniqueEmployees: number;
}

export interface TotalHoursReportFilters {
  searchQuery: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  departmentId: number | null;
  nameFilter: string | null;
  approvalStatus: string;
}

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

// ============================================================================
// DEPARTMENT SUMMARY MATRIX TYPES
// ============================================================================

export interface MatrixDayData {
  date: string; // YYYY-MM-DD
  isAbsent: boolean;
  status: string; // "Approved" | "Present" | "Absent"
  work_minutes: number;
  late_minutes: number;
  overtime_minutes: number;
  undertime_minutes: number;
  work_formatted: string; // "8h 0m"
  late_formatted: string; // "0h 7m"
  overtime_formatted: string; // "0h 30m"
  undertime_formatted: string; // "0h 0m"
  time_in: string | null;
  time_out: string | null;
  time_in_formatted: string;
  time_out_formatted: string;
  sched_time_in?: string | null;
  sched_time_out?: string | null;
  remarks?: string | null;
}

export interface MatrixEmployeeTotals {
  total_work_minutes: number;
  total_late_minutes: number;
  total_overtime_minutes: number;
  total_undertime_minutes: number;
  total_days_attended: number;
  total_days_absent: number;
}

export interface MatrixEmployeeRow {
  user_id: number;
  employee_name: string;
  employee_position: string;
  department_id: number;
  department_name: string;
  days: Record<string, MatrixDayData>;
  totals: MatrixEmployeeTotals;
}

export interface DepartmentMatrixData {
  dates: Array<{
    date: string; // YYYY-MM-DD
    displayHeader: string; // "Sep 29 (Tue)"
    dayOfWeek: string;
  }>;
  employees: MatrixEmployeeRow[];
  departmentTotals: Record<
    string,
    {
      work_minutes: number;
      late_minutes: number;
      overtime_minutes: number;
      undertime_minutes: number;
      present_count: number;
      absent_count: number;
    }
  >;
}

export interface TotalHoursReportApiResponse {
  data: TotalHoursRecord[];
  matrix: DepartmentMatrixData;
  summary: TotalHoursSummary;
  departments: Department[];
  currentUser: User | null;
  employeeNames: string[];
  isHRAdmin: boolean;
  pagination: PaginationState;
}

// ============================================================================
// CONTEXT TYPES
// ============================================================================

export interface TotalHoursReportFetchContextType {
  records: TotalHoursRecord[];
  matrix: DepartmentMatrixData | null;
  summary: TotalHoursSummary;
  departments: Department[];
  currentUser: User | null;
  employeeNames: string[];
  isHRAdmin: boolean;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export interface TotalHoursReportFilterContextType {
  filters: TotalHoursReportFilters;
  setSearchQuery: (query: string) => void;
  setDateFrom: (date: Date | undefined) => void;
  setDateTo: (date: Date | undefined) => void;
  setDateRangePreset: (
    preset:
      | "today"
      | "yesterday"
      | "this_week"
      | "last_week"
      | "this_month"
      | "last_month"
      | "cutoff_26_10"
      | "cutoff_11_25"
  ) => void;
  setDepartmentId: (id: number | null) => void;
  setNameFilter: (name: string | null) => void;
  setApprovalStatus: (status: string) => void;
  resetFilters: () => void;
  employeeNames: string[];
  isHRAdmin: boolean;
}

export interface TotalHoursReportPaginationContextType {
  pagination: PaginationState;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
}
