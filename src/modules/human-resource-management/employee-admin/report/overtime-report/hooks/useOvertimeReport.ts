"use client";

import { useContext } from "react";
import {
  OvertimeReportFetchContext,
  OvertimeReportFilterContext,
  OvertimeReportPaginationContext,
} from "../contexts";

// ============================================================================
// CUSTOM HOOK
// ============================================================================

export function useOvertimeReport() {
  const fetchContext      = useContext(OvertimeReportFetchContext);
  const filterContext     = useContext(OvertimeReportFilterContext);
  const paginationContext = useContext(OvertimeReportPaginationContext);

  if (!fetchContext) {
    throw new Error("useOvertimeReport must be used within OvertimeReportFetchProvider");
  }
  if (!filterContext) {
    throw new Error("useOvertimeReport must be used within OvertimeReportFetchProvider");
  }
  if (!paginationContext) {
    throw new Error("useOvertimeReport must be used within OvertimeReportFetchProvider");
  }

  const {
    overtimeRequests,
    departments,
    users,
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
    requests: overtimeRequests,
    allRequests: overtimeRequests,
    departments,
    users,
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
