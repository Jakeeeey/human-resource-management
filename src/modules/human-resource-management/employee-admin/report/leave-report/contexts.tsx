"use client";

import React, { createContext, useCallback, useEffect, useRef, useState } from "react";
import { fetchLeaveReportData } from "./providers/fetchProvider";
import type {
  LeaveRequestWithDetails,
  User,
  Department,
  LeaveReportFilters,
  PaginationState,
  LeaveReportFetchContextType,
  LeaveReportFilterContextType,
  LeaveReportPaginationContextType,
} from "./type";

// ============================================================================
// FETCH CONTEXT
// ============================================================================

export const LeaveReportFetchContext = createContext<
  LeaveReportFetchContextType | undefined
>(undefined);

const DEFAULT_PAGE_SIZE = 10;

const initialFilters: LeaveReportFilters = {
  searchQuery: "",
  dateFrom: undefined,
  dateTo: undefined,
  departmentId: null,
  nameFilter: null,
  statusFilter: null,
};

export function LeaveReportFetchProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestWithDetails[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Server-side pagination state
  const [currentPage, setCurrentPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    totalItems: 0,
    totalPages: 1,
  });

  // Filter state
  const [filters, setFilters] = useState<LeaveReportFilters>(initialFilters);

  // Debounce timer for search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Core fetch ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(async (
    page: number,
    size: number,
    activeFilters: LeaveReportFilters
  ) => {
    try {
      setIsLoading(true);
      setIsError(false);
      setError(null);

      const data = await fetchLeaveReportData({ page, pageSize: size, filters: activeFilters });

      setCurrentUser(data.currentUser);
      setDepartments(data.departments);
      setLeaveRequests(data.leaveRequests);
      setPagination(data.pagination);
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error("Unknown error occurred"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(1, DEFAULT_PAGE_SIZE, initialFilters);
  }, [fetchData]);

  const refetch = useCallback(async () => {
    await fetchData(currentPage, pageSize, filters);
  }, [fetchData, currentPage, pageSize, filters]);

  // ── Page/size change ───────────────────────────────────────────────────────
  const setCurrentPage = useCallback((page: number) => {
    setCurrentPageState(page);
    fetchData(page, pageSize, filters);
  }, [fetchData, pageSize, filters]);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setCurrentPageState(1);
    fetchData(1, size, filters);
  }, [fetchData, filters]);

  // ── Filter setters ─────────────────────────────────────────────────────────
  const applyFilters = useCallback((newFilters: LeaveReportFilters) => {
    setFilters(newFilters);
    setCurrentPageState(1);
    fetchData(1, pageSize, newFilters);
  }, [fetchData, pageSize]);

  const setSearchQuery = useCallback((query: string) => {
    const newFilters = { ...filters, searchQuery: query };
    setFilters(newFilters);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setCurrentPageState(1);
      fetchData(1, pageSize, newFilters);
    }, 400);
  }, [filters, fetchData, pageSize]);

  const setDateFrom = useCallback((date: Date | undefined) => {
    applyFilters({ ...filters, dateFrom: date });
  }, [filters, applyFilters]);

  const setDateTo = useCallback((date: Date | undefined) => {
    applyFilters({ ...filters, dateTo: date });
  }, [filters, applyFilters]);

  const setDepartmentId = useCallback((id: number | null) => {
    applyFilters({ ...filters, departmentId: id, nameFilter: null });
  }, [filters, applyFilters]);

  const setNameFilter = useCallback((name: string | null) => {
    applyFilters({ ...filters, nameFilter: name });
  }, [filters, applyFilters]);

  const setStatusFilter = useCallback((status: string | null) => {
    applyFilters({ ...filters, statusFilter: status });
  }, [filters, applyFilters]);

  const resetFilters = useCallback(() => {
    applyFilters(initialFilters);
  }, [applyFilters]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const isHRAdmin = currentUser?.user_department === 2 || currentUser?.isAdmin === true;

  const employeeNames = React.useMemo(() => {
    const names = leaveRequests.map(r => r.employee_name);
    return Array.from(new Set(names)).sort();
  }, [leaveRequests]);

  const fetchValue: LeaveReportFetchContextType = {
    leaveRequests,
    departments,
    currentUser,
    isLoading,
    isError,
    error,
    refetch,
  };

  return (
    <LeaveReportFetchContext.Provider value={fetchValue}>
      <LeaveReportFilterContext.Provider value={{
        filters,
        setSearchQuery,
        setDateFrom,
        setDateTo,
        setDepartmentId,
        setNameFilter,
        setStatusFilter,
        resetFilters,
        filterRequests: (reqs) => reqs,
        employeeNames,
        isHRAdmin,
      }}>
        <LeaveReportPaginationContext.Provider value={{
          pagination,
          setCurrentPage,
          setPageSize,
          paginateRequests: (reqs) => ({ paginatedData: reqs, pagination }),
        }}>
          {children}
        </LeaveReportPaginationContext.Provider>
      </LeaveReportFilterContext.Provider>
    </LeaveReportFetchContext.Provider>
  );
}

// ============================================================================
// FILTER CONTEXT
// ============================================================================

interface LeaveReportFilterContextExtended extends LeaveReportFilterContextType {
  employeeNames: string[];
  isHRAdmin: boolean;
}

export const LeaveReportFilterContext = createContext<
  LeaveReportFilterContextExtended | undefined
>(undefined);

export function LeaveReportFilterProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// ============================================================================
// PAGINATION CONTEXT
// ============================================================================

export const LeaveReportPaginationContext = createContext<
  LeaveReportPaginationContextType | undefined
>(undefined);

export function LeaveReportPaginationProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
