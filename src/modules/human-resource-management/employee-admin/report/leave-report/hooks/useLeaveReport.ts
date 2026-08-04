"use client";

import { useContext } from "react";
import {
  LeaveReportFetchContext,
  LeaveReportFilterContext,
  LeaveReportPaginationContext,
} from "../contexts";

// ============================================================================
// CUSTOM HOOK
// ============================================================================

export function useLeaveReport() {
  const fetchContext      = useContext(LeaveReportFetchContext);
  const filterContext     = useContext(LeaveReportFilterContext);
  const paginationContext = useContext(LeaveReportPaginationContext);

  if (!fetchContext) {
    throw new Error("useLeaveReport must be used within LeaveReportFetchProvider");
  }
  if (!filterContext) {
    throw new Error("useLeaveReport must be used within LeaveReportFetchProvider");
  }
  if (!paginationContext) {
    throw new Error("useLeaveReport must be used within LeaveReportFetchProvider");
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
    employeeNames,
    isHRAdmin,
  } = filterContext;

  const { pagination, setCurrentPage, setPageSize } = paginationContext;

  return {
    // Data — already the current page from server
    requests: leaveRequests,
    allRequests: leaveRequests,
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

    // Pagination (server-side)
    pagination,
    setCurrentPage,
    setPageSize,
  };
}
