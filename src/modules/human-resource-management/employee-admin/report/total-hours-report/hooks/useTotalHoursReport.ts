"use client";

import { useContext } from "react";
import {
  TotalHoursReportFetchContext,
  TotalHoursReportFilterContext,
  TotalHoursReportPaginationContext,
} from "../contexts";

export function useTotalHoursReport() {
  const fetchContext = useContext(TotalHoursReportFetchContext);
  const filterContext = useContext(TotalHoursReportFilterContext);
  const paginationContext = useContext(TotalHoursReportPaginationContext);

  if (!fetchContext) {
    throw new Error(
      "useTotalHoursReport must be used within a TotalHoursReportProvider"
    );
  }
  if (!filterContext) {
    throw new Error(
      "useTotalHoursReport must be used within a TotalHoursReportProvider"
    );
  }
  if (!paginationContext) {
    throw new Error(
      "useTotalHoursReport must be used within a TotalHoursReportProvider"
    );
  }

  const {
    records,
    summary,
    departments,
    currentUser,
    employeeNames,
    isHRAdmin,
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
    setDateRangePreset,
    setDepartmentId,
    setNameFilter,
    setApprovalStatus,
    resetFilters,
  } = filterContext;

  const { pagination, setCurrentPage, setPageSize } = paginationContext;

  return {
    records,
    matrix: fetchContext.matrix,
    summary,
    departments,
    currentUser,
    employeeNames,
    isHRAdmin,
    isLoading,
    isError,
    error,
    refetch,

    filters,
    setSearchQuery,
    setDateFrom,
    setDateTo,
    setDateRangePreset,
    setDepartmentId,
    setNameFilter,
    setApprovalStatus,
    resetFilters,

    pagination,
    setCurrentPage,
    setPageSize,
  };
}
