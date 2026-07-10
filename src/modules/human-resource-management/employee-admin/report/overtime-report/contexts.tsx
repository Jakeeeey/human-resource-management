"use client";

import React, { createContext, useCallback, useEffect, useRef, useState } from "react";
import { fetchOvertimeReportData } from "./providers/fetchProvider";
import type {
  OvertimeRequestWithDetails,
  User,
  Department,
  OvertimeReportFilters,
  PaginationState,
  OvertimeReportFetchContextType,
  OvertimeReportFilterContextType,
  OvertimeReportPaginationContextType,
} from "./type";

// ============================================================================
// FETCH CONTEXT
// ============================================================================

export const OvertimeReportFetchContext = createContext<
  OvertimeReportFetchContextType | undefined
>(undefined);

const DEFAULT_PAGE_SIZE = 10;

const initialFilters: OvertimeReportFilters = {
  searchQuery: "",
  dateFrom: undefined,
  dateTo: undefined,
  departmentId: null,
  nameFilter: null,
  statusFilter: null,
};

export function OvertimeReportFetchProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequestWithDetails[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
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
  const [filters, setFilters] = useState<OvertimeReportFilters>(initialFilters);

  // Debounce timer for search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Core fetch ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(async (
    page: number,
    size: number,
    activeFilters: OvertimeReportFilters
  ) => {
    try {
      setIsLoading(true);
      setIsError(false);
      setError(null);

      const data = await fetchOvertimeReportData({ page, pageSize: size, filters: activeFilters });

      setCurrentUser(data.currentUser);
      setDepartments(data.departments);
      setUsers(data.users);
      setOvertimeRequests(data.overtimeRequests);
      setPagination(data.pagination);
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error("Unknown error occurred"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchData(1, DEFAULT_PAGE_SIZE, initialFilters);
  }, [fetchData]);

  // ── Public refetch ─────────────────────────────────────────────────────────
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

  // ── Filter setters — reset to page 1 on filter change ─────────────────────
  const applyFilters = useCallback((newFilters: OvertimeReportFilters) => {
    setFilters(newFilters);
    setCurrentPageState(1);
    fetchData(1, pageSize, newFilters);
  }, [fetchData, pageSize]);

  const setSearchQuery = useCallback((query: string) => {
    const newFilters = { ...filters, searchQuery: query };
    setFilters(newFilters);
    // Debounce search
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

  // ── Check if HR admin ──────────────────────────────────────────────────────
  const isHRAdmin = currentUser?.user_department === 2 || currentUser?.isAdmin === true;

  // ── Employee names for filter dropdown ────────────────────────────────────
  const employeeNames = React.useMemo(() => {
    let usersToFilter = users;
    if (isHRAdmin && filters.departmentId !== null) {
      usersToFilter = users.filter(u => u.user_department === filters.departmentId);
    }
    const names = usersToFilter.map(
      u => `${u.user_fname} ${u.user_mname ? u.user_mname + " " : ""}${u.user_lname}`
    );
    return Array.from(new Set(names)).sort();
  }, [users, isHRAdmin, filters.departmentId]);

  const value: OvertimeReportFetchContextType = {
    overtimeRequests,
    departments,
    users,
    currentUser,
    isLoading,
    isError,
    error,
    refetch,
  };

  return (
    <OvertimeReportFetchContext.Provider value={value}>
      {/* Expose filter/pagination via sibling contexts below */}
      <OvertimeReportFilterContext.Provider value={{
        filters,
        setSearchQuery,
        setDateFrom,
        setDateTo,
        setDepartmentId,
        setNameFilter,
        setStatusFilter,
        resetFilters,
        // No-op: filtering is now server-side
        filterRequests: (reqs) => reqs,
        employeeNames,
        isHRAdmin,
      }}>
        <OvertimeReportPaginationContext.Provider value={{
          pagination,
          setCurrentPage,
          setPageSize,
          // No-op: pagination is now server-side
          paginateRequests: (reqs) => ({ paginatedData: reqs, pagination }),
        }}>
          {children}
        </OvertimeReportPaginationContext.Provider>
      </OvertimeReportFilterContext.Provider>
    </OvertimeReportFetchContext.Provider>
  );
}

// ============================================================================
// FILTER CONTEXT
// ============================================================================

interface OvertimeReportFilterContextExtended extends OvertimeReportFilterContextType {
  employeeNames: string[];
  isHRAdmin: boolean;
}

export const OvertimeReportFilterContext = createContext<
  OvertimeReportFilterContextExtended | undefined
>(undefined);

// Stub provider — actual logic is in FetchProvider above
export function OvertimeReportFilterProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// ============================================================================
// PAGINATION CONTEXT
// ============================================================================

export const OvertimeReportPaginationContext = createContext<
  OvertimeReportPaginationContextType | undefined
>(undefined);

// Stub provider — actual logic is in FetchProvider above
export function OvertimeReportPaginationProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
