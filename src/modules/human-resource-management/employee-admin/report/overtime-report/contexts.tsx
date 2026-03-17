"use client";

import React, { createContext, useEffect, useState } from "react";
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

export function OvertimeReportFetchProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [overtimeRequests, setOvertimeRequests] = useState<
    OvertimeRequestWithDetails[]
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

      const data = await fetchOvertimeReportData();

      setCurrentUser(data.currentUser);
      setDepartments(data.departments);
      setOvertimeRequests(data.overtimeRequests);
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

  const value: OvertimeReportFetchContextType = {
    overtimeRequests,
    departments,
    currentUser,
    isLoading,
    isError,
    error,
    refetch,
  };

  return (
    <OvertimeReportFetchContext.Provider value={value}>
      {children}
    </OvertimeReportFetchContext.Provider>
  );
}

// ============================================================================
// FILTER CONTEXT
// ============================================================================

export const OvertimeReportFilterContext = createContext<
  OvertimeReportFilterContextType | undefined
>(undefined);

const initialFilters: OvertimeReportFilters = {
  searchQuery: "",
  dateFrom: undefined,
  dateTo: undefined,
  departmentId: null,
  nameFilter: null,
  statusFilter: null,
};

export function OvertimeReportFilterProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [filters, setFilters] = useState<OvertimeReportFilters>(initialFilters);

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
    return (requests: OvertimeRequestWithDetails[]) => {
      let filtered = [...requests];

      if (filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase();
        filtered = filtered.filter(
          (req) =>
            req.employee_name.toLowerCase().includes(query) ||
            req.purpose?.toLowerCase().includes(query) ||
            req.remarks?.toLowerCase().includes(query)
        );
      }

      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        filtered = filtered.filter((req) => {
          const reqDate = new Date(req.request_date);
          return reqDate >= fromDate;
        });
      }

      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter((req) => {
          const reqDate = new Date(req.request_date);
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

  const value: OvertimeReportFilterContextType = {
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
    <OvertimeReportFilterContext.Provider value={value}>
      {children}
    </OvertimeReportFilterContext.Provider>
  );
}

// ============================================================================
// PAGINATION CONTEXT
// ============================================================================

export const OvertimeReportPaginationContext = createContext<
  OvertimeReportPaginationContextType | undefined
>(undefined);

const DEFAULT_PAGE_SIZE = 10;

export function OvertimeReportPaginationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const paginateRequests = React.useMemo(() => {
    return (requests: OvertimeRequestWithDetails[]) => {
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

  const value: OvertimeReportPaginationContextType = {
    pagination,
    setCurrentPage,
    setPageSize,
    paginateRequests,
  };

  return (
    <OvertimeReportPaginationContext.Provider value={value}>
      {children}
    </OvertimeReportPaginationContext.Provider>
  );
}
