// Type definitions for overtime report

export interface OvertimeRequest {
  overtime_id: number;
  user_id: number;
  department_id: number | null;
  log_id: number | null;
  request_date: string;
  sched_timeout: string;
  ot_from: string;
  ot_to: string;
  duration_minutes: number;
  purpose: string;
  remarks: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approver_id: number | null;
  approved_at: string | null;
  filed_at: string;
}

export interface User {
  user_id: number;
  user_fname: string;
  user_lname: string;
  user_mname: string | null;
  user_department: number;
  user_email: string;
  user_position: string;
  isAdmin: boolean;
  role: string;
}

export interface Department {
  department_id: number;
  department_name: string;
  department_description: string;
  department_head: string | null;
  department_head_id: number | null;
}

export interface OvertimeRequestWithDetails extends OvertimeRequest {
  user?: User;
  department?: Department;
  employee_name: string;
}

export interface OvertimeReportFilters {
  searchQuery: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  departmentId: number | null;
  nameFilter: string | null;
  statusFilter: string | null;
}

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

// ============================================================================
// CONTEXT TYPES
// ============================================================================

export interface OvertimeReportFetchContextType {
  overtimeRequests: OvertimeRequestWithDetails[];
  departments: Department[];
  currentUser: User | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export interface OvertimeReportFilterContextType {
  filters: OvertimeReportFilters;
  setSearchQuery: (query: string) => void;
  setDateFrom: (date: Date | undefined) => void;
  setDateTo: (date: Date | undefined) => void;
  setDepartmentId: (id: number | null) => void;
  setNameFilter: (name: string | null) => void;
  setStatusFilter: (status: string | null) => void;
  resetFilters: () => void;
  filterRequests: (requests: OvertimeRequestWithDetails[]) => OvertimeRequestWithDetails[];
}

export interface OvertimeReportPaginationContextType {
  pagination: PaginationState;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  paginateRequests: (requests: OvertimeRequestWithDetails[]) => {
    paginatedData: OvertimeRequestWithDetails[];
    pagination: PaginationState;
  };
}
