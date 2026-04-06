"use client";

import React, { createContext, useEffect, useState } from "react";
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

export function LeaveReportFetchProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [leaveRequests, setLeaveRequests] = useState<
    LeaveRequestWithDetails[]
  >([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setIsError(false);
      setError(null);

      const data = await fetchLeaveReportData();

      setCurrentUser(data.currentUser);
      setDepartments(data.departments);
      setLeaveRequests(data.leaveRequests);
    } catch (err) {
      setIsError(true);
      setError(
        err instanceof Error ? err : new Error("Unknown error occurred")
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const refetch = async () => {
    await fetchData();
  };

  const value: LeaveReportFetchContextType = {
    leaveRequests,
    departments,
    currentUser,
    isLoading,
    isError,
    error,
    refetch,
  };

  return (
    <LeaveReportFetchContext.Provider value={value}>
      {children}
    </LeaveReportFetchContext.Provider>
  );
}

// ============================================================================
// FILTER CONTEXT
// ============================================================================

export const LeaveReportFilterContext = createContext<
  LeaveReportFilterContextType | undefined
>(undefined);

const initialFilters: LeaveReportFilters = {
  searchQuery: "",
  dateFrom: undefined,
  dateTo: undefined,
  departmentId: null,
  nameFilter: null,
  statusFilter: null,
};

export function LeaveReportFilterProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [filters, setFilters] = useState<LeaveReportFilters>(initialFilters);

  const setSearchQuery = (query: string) => {
    setFilters((prev) => ({ ...prev, searchQuery: query }));
  };

  const setDateFrom = (date: Date | undefined) => {
    setFilters((prev) => ({ ...prev, dateFrom: date }));
  };

  const setDateTo = (date: Date | undefined) => {
    setFilters((prev) => ({ ...prev, dateTo: date }));
  };

  const setDepartmentId = (id: number | null) => {
    setFilters((prev) => ({ ...prev, departmentId: id, nameFilter: null }));
  };

  const setNameFilter = (name: string | null) => {
    setFilters((prev) => ({ ...prev, nameFilter: name }));
  };

  const setStatusFilter = (status: string | null) => {
    setFilters((prev) => ({ ...prev, statusFilter: status }));
  };

  const resetFilters = () => {
    setFilters(initialFilters);
  };

  const filterRequests = React.useMemo(() => {
    return (requests: LeaveRequestWithDetails[]) => {
      let filtered = [...requests];

      if (filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase();
        filtered = filtered.filter(
          (req) =>
            req.employee_name.toLowerCase().includes(query) ||
            req.reason?.toLowerCase().includes(query) ||
            req.remarks?.toLowerCase().includes(query)
        );
      }

      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        filtered = filtered.filter((req) => {
          const reqDate = new Date(req.filed_at);
          return reqDate >= fromDate;
        });
      }

      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter((req) => {
          const reqDate = new Date(req.filed_at);
          return reqDate <= toDate;
        });
      }

      if (filters.departmentId !== null) {
        filtered = filtered.filter(
          (req) => req.department_id === filters.departmentId
        );
      }

      if (filters.nameFilter !== null) {
        filtered = filtered.filter(
          (req) => req.employee_name === filters.nameFilter
        );
      }

      if (filters.statusFilter !== null) {
        filtered = filtered.filter(
          (req) => req.status === filters.statusFilter
        );
      }

      return filtered;
    };
  }, [filters]);

  const value: LeaveReportFilterContextType = {
    filters,
    setSearchQuery,
    setDateFrom,
    setDateTo,
    setDepartmentId,
    setNameFilter,
    setStatusFilter,
    resetFilters,
    filterRequests,
  };

  return (
    <LeaveReportFilterContext.Provider value={value}>
      {children}
    </LeaveReportFilterContext.Provider>
  );
}

// ============================================================================
// PAGINATION CONTEXT
// ============================================================================

export const LeaveReportPaginationContext = createContext<
  LeaveReportPaginationContextType | undefined
>(undefined);

const DEFAULT_PAGE_SIZE = 10;

export function LeaveReportPaginationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const paginateRequests = React.useMemo(() => {
    return (requests: LeaveRequestWithDetails[]) => {
      const totalItems = requests.length;
      const totalPages = Math.ceil(totalItems / pageSize);

      // Clamp current page to valid range without calling setState during render
      const validPage = Math.min(Math.max(1, currentPage), totalPages || 1);

      const startIndex = (validPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedData = requests.slice(startIndex, endIndex);

      return {
        paginatedData,
        pagination: {
          currentPage: validPage,
          pageSize,
          totalItems,
          totalPages: totalPages || 1,
        },
      };
    };
  }, [currentPage, pageSize]);

  const pagination: PaginationState = {
    currentPage,
    pageSize,
    totalItems: 0,
    totalPages: 1,
  };

  const value: LeaveReportPaginationContextType = {
    pagination,
    setCurrentPage,
    setPageSize,
    paginateRequests,
  };

  return (
    <LeaveReportPaginationContext.Provider value={value}>
      {children}
    </LeaveReportPaginationContext.Provider>
  );
}
