"use client";

import { useContext, useMemo } from "react";
import { 
  OvertimeReportFetchContext,
  OvertimeReportFilterContext,
  OvertimeReportPaginationContext 
} from "../contexts";

// ============================================================================
// CUSTOM HOOK
// ============================================================================

export function useOvertimeReport() {
  const fetchContext = useContext(OvertimeReportFetchContext);
  const filterContext = useContext(OvertimeReportFilterContext);
  const paginationContext = useContext(OvertimeReportPaginationContext);

  if (!fetchContext) {
    throw new Error(
      "useOvertimeReport must be used within OvertimeReportFetchProvider"
    );
  }

  if (!filterContext) {
    throw new Error(
      "useOvertimeReport must be used within OvertimeReportFilterProvider"
    );
  }

  if (!paginationContext) {
    throw new Error(
      "useOvertimeReport must be used within OvertimeReportPaginationProvider"
    );
  }

  const {
    overtimeRequests,
    departments,
    currentUser,
    isLoading,
    isError,
    error,
    refetch,
  } = fetchContext;

  const {
    filters,
    setSearchQuery,
    setDateFrom,
    setDateTo,
    setDepartmentId,
    setNameFilter,
    setStatusFilter,
    resetFilters,
    filterRequests,
  } = filterContext;

  const {
    setCurrentPage,
    setPageSize,
    paginateRequests,
  } = paginationContext;

  // Apply filters to requests
  const filteredRequests = useMemo(() => {
    return filterRequests(overtimeRequests);
  }, [overtimeRequests, filterRequests]);

  // Apply pagination to filtered requests
  const { paginatedData, pagination: paginationState } = useMemo(() => {
    return paginateRequests(filteredRequests);
  }, [filteredRequests, paginateRequests]);

  // Check if user is HR admin
  const isHRAdmin = currentUser?.user_department === 2;

  // Get unique employee names for filter dropdown
  // If HR admin and department is selected, show only names from that department
  const employeeNames = useMemo(() => {
    let requestsToFilter = overtimeRequests;
    
    // If HR admin selected a department, filter names by that department
    if (isHRAdmin && filters.departmentId !== null) {
      requestsToFilter = overtimeRequests.filter(
        (req) => req.department_id === filters.departmentId
      );
    }
    
    const names = requestsToFilter.map((req) => req.employee_name);
    return Array.from(new Set(names)).sort();
  }, [overtimeRequests, isHRAdmin, filters.departmentId]);

  return {
    // Data
    requests: paginatedData,
    allRequests: overtimeRequests,
    filteredRequests,
    departments,
    currentUser,
    isHRAdmin,

    // Loading states
    isLoading,
    isError,
    error,

    // Actions
    refetch,

    // Filters
    filters,
    setSearchQuery,
    setDateFrom,
    setDateTo,
    setDepartmentId,
    setNameFilter,
    setStatusFilter,
    resetFilters,
    employeeNames,

    // Pagination
    pagination: paginationState,
    setCurrentPage,
    setPageSize,
  };
}
