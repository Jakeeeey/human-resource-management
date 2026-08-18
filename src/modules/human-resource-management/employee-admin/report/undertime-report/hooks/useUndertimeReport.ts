"use client";

import { useContext } from "react";
import {
  UndertimeReportFetchContext,
  UndertimeReportFilterContext,
  UndertimeReportPaginationContext,
} from "../contexts";

// ============================================================================
// CUSTOM HOOK
// ============================================================================

export function useUndertimeReport() {
  const fetchContext      = useContext(UndertimeReportFetchContext);
  const filterContext     = useContext(UndertimeReportFilterContext);
  const paginationContext = useContext(UndertimeReportPaginationContext);

  if (!fetchContext) {
    throw new Error("useUndertimeReport must be used within UndertimeReportFetchProvider");
  }
  if (!filterContext) {
    throw new Error("useUndertimeReport must be used within UndertimeReportFetchProvider");
  }
  if (!paginationContext) {
    throw new Error("useUndertimeReport must be used within UndertimeReportFetchProvider");
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
    employeeNames,
    isHRAdmin,
  } = filterContext;

  const { pagination, setCurrentPage, setPageSize } = paginationContext;

  return {
    // Data — already the current page from server
    requests: undertimeRequests,
    allRequests: undertimeRequests,
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
