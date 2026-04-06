// Type definitions for leave report

export interface LeaveRequest {
  leave_id: number;
  user_id: number;
  department_id: number | null;
  leave_type: string;
  leave_start: string;
  leave_end: string;
  total_days: string;
  reason: string;
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

export interface LeaveRequestWithDetails extends LeaveRequest {
  user?: User;
  department?: Department;
  employee_name: string;
}

export interface LeaveReportFilters {
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

export interface LeaveReportFetchContextType {
  leaveRequests: LeaveRequestWithDetails[];
  departments: Department[];
  currentUser: User | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export interface LeaveReportFilterContextType {
  filters: LeaveReportFilters;
  setSearchQuery: (query: string) => void;
  setDateFrom: (date: Date | undefined) => void;
  setDateTo: (date: Date | undefined) => void;
  setDepartmentId: (id: number | null) => void;
  setNameFilter: (name: string | null) => void;
  setStatusFilter: (status: string | null) => void;
  resetFilters: () => void;
  filterRequests: (requests: LeaveRequestWithDetails[]) => LeaveRequestWithDetails[];
}

export interface LeaveReportPaginationContextType {
  pagination: PaginationState;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  paginateRequests: (requests: LeaveRequestWithDetails[]) => {
    paginatedData: LeaveRequestWithDetails[];
    pagination: PaginationState;
  };
}
