"use client";

import { useContext, useMemo } from "react";
import {
  LeaveReportFetchContext,
  LeaveReportFilterContext,
  LeaveReportPaginationContext
} from "../contexts";

// ============================================================================
// CUSTOM HOOK
// ============================================================================

export function useLeaveReport() {
  const fetchContext = useContext(LeaveReportFetchContext);
  const filterContext = useContext(LeaveReportFilterContext);
  const paginationContext = useContext(LeaveReportPaginationContext);

  if (!fetchContext) {
    throw new Error(
      "useLeaveReport must be used within LeaveReportFetchProvider"
    );
  }

  if (!filterContext) {
    throw new Error(
      "useLeaveReport must be used within LeaveReportFilterProvider"
    );
  }

  if (!paginationContext) {
    throw new Error(
      "useLeaveReport must be used within LeaveReportPaginationProvider"
    );
  }

  const {
    leaveRequests,
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
    return filterRequests(leaveRequests);
  }, [leaveRequests, filterRequests]);

  // Apply pagination to filtered requests
  const { paginatedData, pagination: paginationState } = useMemo(() => {
    return paginateRequests(filteredRequests);
  }, [filteredRequests, paginateRequests]);

  // Check if user is HR admin
  const isHRAdmin = currentUser?.user_department === 2;

  // Get unique employee names for filter dropdown
  // If HR admin and department is selected, show only names from that department
  const employeeNames = useMemo(() => {
    let requestsToFilter = leaveRequests;

    // If HR admin selected a department, filter names by that department
    if (isHRAdmin && filters.departmentId !== null) {
      requestsToFilter = leaveRequests.filter(
        (req) => req.department_id === filters.departmentId
      );
    }

    const names = requestsToFilter.map((req) => req.employee_name);
    return Array.from(new Set(names)).sort();
  }, [leaveRequests, isHRAdmin, filters.departmentId]);

  return {
    // Data
    requests: paginatedData,
    allRequests: leaveRequests,
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
