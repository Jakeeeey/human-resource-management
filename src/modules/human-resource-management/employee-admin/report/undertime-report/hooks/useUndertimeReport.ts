"use client";

import { useContext, useMemo } from "react";
import {
  UndertimeReportFetchContext,
  UndertimeReportFilterContext,
  UndertimeReportPaginationContext
} from "../contexts";

// ============================================================================
// CUSTOM HOOK
// ============================================================================

export function useUndertimeReport() {
  const fetchContext = useContext(UndertimeReportFetchContext);
  const filterContext = useContext(UndertimeReportFilterContext);
  const paginationContext = useContext(UndertimeReportPaginationContext);

  if (!fetchContext) {
    throw new Error(
      "useUndertimeReport must be used within UndertimeReportFetchProvider"
    );
  }

  if (!filterContext) {
    throw new Error(
      "useUndertimeReport must be used within UndertimeReportFilterProvider"
    );
  }

  if (!paginationContext) {
    throw new Error(
      "useUndertimeReport must be used within UndertimeReportPaginationProvider"
    );
  }

  const {
    undertimeRequests,
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
    return filterRequests(undertimeRequests);
  }, [undertimeRequests, filterRequests]);

  // Apply pagination to filtered requests
  const { paginatedData, pagination: paginationState } = useMemo(() => {
    return paginateRequests(filteredRequests);
  }, [filteredRequests, paginateRequests]);

  // Check if user is HR admin
  const isHRAdmin = currentUser?.user_department === 2;

  // Get unique employee names for filter dropdown
  // If HR admin and department is selected, show only names from that department
  const employeeNames = useMemo(() => {
    let requestsToFilter = undertimeRequests;

    // If HR admin selected a department, filter names by that department
    if (isHRAdmin && filters.departmentId !== null) {
      requestsToFilter = undertimeRequests.filter(
        (req) => req.department_id === filters.departmentId
      );
    }

    const names = requestsToFilter.map((req) => req.employee_name);
    return Array.from(new Set(names)).sort();
  }, [undertimeRequests, isHRAdmin, filters.departmentId]);

  return {
    // Data
    requests: paginatedData,
    allRequests: undertimeRequests,
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
