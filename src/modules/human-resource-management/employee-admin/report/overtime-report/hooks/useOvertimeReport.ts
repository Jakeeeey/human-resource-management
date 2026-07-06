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

  // Check if user is HR admin or System admin
  const isHRAdmin = currentUser?.user_department === 2 || currentUser?.isAdmin === true;

  // Get unique employee names for filter dropdown from the complete users list
  const employeeNames = useMemo(() => {
    let usersToFilter = users;
    
    // If HR admin selected a department, filter names by that department
    if (isHRAdmin && filters.departmentId !== null) {
      usersToFilter = users.filter(
        (user) => user.user_department === filters.departmentId
      );
    }
    
    const names = usersToFilter.map(
      (user) => `${user.user_fname} ${user.user_mname ? user.user_mname + " " : ""}${user.user_lname}`
    );
    return Array.from(new Set(names)).sort();
  }, [users, isHRAdmin, filters.departmentId]);

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
