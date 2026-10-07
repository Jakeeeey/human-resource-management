"use client";

import React, { createContext, useCallback, useEffect, useRef, useState } from "react";
import {
  startOfToday,
  endOfToday,
  subDays,
  addDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
  subWeeks,
  setDate,
} from "date-fns";
import { fetchTotalHoursReportData } from "./providers/fetchProviders";
import type {
  TotalHoursRecord,
  TotalHoursSummary,
  User,
  Department,
  TotalHoursReportFilters,
  PaginationState,
  TotalHoursReportFetchContextType,
  TotalHoursReportFilterContextType,
  TotalHoursReportPaginationContextType,
  DepartmentMatrixData,
  DateRangePreset,
} from "./type";

// ============================================================================
// CONTEXTS
// ============================================================================

export const TotalHoursReportFetchContext = createContext<
  TotalHoursReportFetchContextType | undefined
>(undefined);

export const TotalHoursReportFilterContext = createContext<
  TotalHoursReportFilterContextType | undefined
>(undefined);

export const TotalHoursReportPaginationContext = createContext<
  TotalHoursReportPaginationContextType | undefined
>(undefined);

const DEFAULT_PAGE_SIZE = 10;

// Default to past 7 days (exactly 1 week) for rich matrix viewing immediately
const defaultDateFrom = subDays(new Date(), 6);
const defaultDateTo = new Date();

const initialFilters: TotalHoursReportFilters = {
  searchQuery: "",
  dateFrom: defaultDateFrom,
  dateTo: defaultDateTo,
  departmentId: null,
  nameFilter: null,
  approvalStatus: "approved",
};

const initialSummary: TotalHoursSummary = {
  totalWorkMinutes: 0,
  totalLateMinutes: 0,
  totalUndertimeMinutes: 0,
  totalOvertimeMinutes: 0,
  totalDays: 0,
  uniqueEmployees: 0,
};

// ============================================================================
// PROVIDER
// ============================================================================

export function TotalHoursReportProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [records, setRecords] = useState<TotalHoursRecord[]>([]);
  const [matrix, setMatrix] = useState<DepartmentMatrixData | null>(null);
  const [summary, setSummary] = useState<TotalHoursSummary>(initialSummary);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [employeeNames, setEmployeeNames] = useState<string[]>([]);
  const [isHRAdmin, setIsHRAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Pagination state
  const [currentPage, setCurrentPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    totalItems: 0,
    totalPages: 1,
  });

  // Filters state
  const [filters, setFilters] = useState<TotalHoursReportFilters>(initialFilters);

  // Debounce ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Core fetch function
  const fetchData = useCallback(
    async (
      page: number,
      size: number,
      activeFilters: TotalHoursReportFilters
    ) => {
      try {
        setIsLoading(true);
        setIsError(false);
        setError(null);

        const res = await fetchTotalHoursReportData({
          page,
          pageSize: size,
          filters: activeFilters,
        });

        setRecords(res.data);
        setMatrix(res.matrix || null);
        setSummary(res.summary);
        setDepartments(res.departments);
        setCurrentUser(res.currentUser);
        setEmployeeNames(res.employeeNames);
        setIsHRAdmin(res.isHRAdmin);
        setPagination(res.pagination);
      } catch (err) {
        setIsError(true);
        setError(err instanceof Error ? err : new Error("Failed to load total hours report"));
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchData(1, DEFAULT_PAGE_SIZE, initialFilters);
  }, [fetchData]);

  const refetch = useCallback(async () => {
    await fetchData(currentPage, pageSize, filters);
  }, [fetchData, currentPage, pageSize, filters]);

  // Page handlers
  const setCurrentPage = useCallback(
    (page: number) => {
      setCurrentPageState(page);
      fetchData(page, pageSize, filters);
    },
    [fetchData, pageSize, filters]
  );

  const setPageSize = useCallback(
    (size: number) => {
      setPageSizeState(size);
      setCurrentPageState(1);
      fetchData(1, size, filters);
    },
    [fetchData, filters]
  );

  // Filter handlers with debouncing for search
  const setSearchQuery = useCallback(
    (query: string) => {
      const next = { ...filters, searchQuery: query };
      setFilters(next);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setCurrentPageState(1);
        fetchData(1, pageSize, next);
      }, 350);
    },
    [filters, fetchData, pageSize]
  );

  const setDateFrom = useCallback(
    (date: Date | undefined) => {
      const next = { ...filters, dateFrom: date };
      if (date && filters.dateTo && filters.dateTo < date) {
        next.dateTo = date;
      }
      setFilters(next);
      setCurrentPageState(1);
      fetchData(1, pageSize, next);
    },
    [filters, fetchData, pageSize]
  );

  const setDateTo = useCallback(
    (date: Date | undefined) => {
      const next = { ...filters, dateTo: date };
      if (date && filters.dateFrom && filters.dateFrom > date) {
        next.dateFrom = date;
      }
      setFilters(next);
      setCurrentPageState(1);
      fetchData(1, pageSize, next);
    },
    [filters, fetchData, pageSize]
  );

  const navigateWeek = useCallback(
    (direction: "prev" | "next") => {
      const currentFrom = filters.dateFrom || new Date();
      const currentTo = filters.dateTo || new Date();
      const deltaDays = direction === "next" ? 7 : -7;
      const newFrom = addDays(currentFrom, deltaDays);
      const newTo = addDays(currentTo, deltaDays);
      const next = { ...filters, dateFrom: newFrom, dateTo: newTo };
      setFilters(next);
      setCurrentPageState(1);
      fetchData(1, pageSize, next);
    },
    [filters, fetchData, pageSize]
  );

  const setDateRangePreset = useCallback(
    (preset: DateRangePreset) => {
      const now = new Date();
      let from: Date | undefined;
      let to: Date | undefined;

      switch (preset) {
        case "cutoff_26_10": {
          const currentDay = now.getDate();
          if (currentDay <= 10) {
            const prevMonth = subMonths(now, 1);
            from = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 26);
            to = new Date(now.getFullYear(), now.getMonth(), 10);
          } else {
            from = new Date(now.getFullYear(), now.getMonth(), 26);
            to = new Date(now.getFullYear(), now.getMonth() + 1, 10);
          }
          break;
        }
        case "cutoff_11_25": {
          from = new Date(now.getFullYear(), now.getMonth(), 11);
          to = new Date(now.getFullYear(), now.getMonth(), 25);
          break;
        }
        case "this_week":
          from = startOfWeek(now, { weekStartsOn: 1 });
          to = endOfWeek(now, { weekStartsOn: 1 });
          break;
        case "last_week": {
          const prevWeek = subWeeks(now, 1);
          from = startOfWeek(prevWeek, { weekStartsOn: 1 });
          to = endOfWeek(prevWeek, { weekStartsOn: 1 });
          break;
        }
        case "two_weeks_ago": {
          const twoAgo = subWeeks(now, 2);
          from = startOfWeek(twoAgo, { weekStartsOn: 1 });
          to = endOfWeek(twoAgo, { weekStartsOn: 1 });
          break;
        }
        case "three_weeks_ago": {
          const threeAgo = subWeeks(now, 3);
          from = startOfWeek(threeAgo, { weekStartsOn: 1 });
          to = endOfWeek(threeAgo, { weekStartsOn: 1 });
          break;
        }
        case "this_month":
          from = startOfMonth(now);
          to = endOfMonth(now);
          break;
        case "last_month": {
          const prevMonth = subMonths(now, 1);
          from = startOfMonth(prevMonth);
          to = endOfMonth(prevMonth);
          break;
        }
        case "today":
          from = startOfToday();
          to = endOfToday();
          break;
        case "past_7_days":
        default: {
          from = subDays(now, 6);
          to = now;
          break;
        }
      }

      const next = { ...filters, dateFrom: from, dateTo: to };
      setFilters(next);
      setCurrentPageState(1);
      fetchData(1, pageSize, next);
    },
    [filters, fetchData, pageSize]
  );

  const setDepartmentId = useCallback(
    (id: number | null) => {
      const next = { ...filters, departmentId: id };
      setFilters(next);
      setCurrentPageState(1);
      fetchData(1, pageSize, next);
    },
    [filters, fetchData, pageSize]
  );

  const setNameFilter = useCallback(
    (name: string | null) => {
      const next = { ...filters, nameFilter: name };
      setFilters(next);
      setCurrentPageState(1);
      fetchData(1, pageSize, next);
    },
    [filters, fetchData, pageSize]
  );

  const setApprovalStatus = useCallback(
    (status: string) => {
      const next = { ...filters, approvalStatus: status };
      setFilters(next);
      setCurrentPageState(1);
      fetchData(1, pageSize, next);
    },
    [filters, fetchData, pageSize]
  );

  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
    setCurrentPageState(1);
    fetchData(1, pageSize, initialFilters);
  }, [fetchData, pageSize]);

  return (
    <TotalHoursReportFetchContext.Provider
      value={{
        records,
        matrix,
        summary,
        departments,
        currentUser,
        employeeNames,
        isHRAdmin,
        isLoading,
        isError,
        error,
        refetch,
      }}
    >
      <TotalHoursReportFilterContext.Provider
        value={{
          filters,
          setSearchQuery,
          setDateFrom,
          setDateTo,
          setDateRangePreset,
          navigateWeek,
          setDepartmentId,
          setNameFilter,
          setApprovalStatus,
          resetFilters,
          employeeNames,
          isHRAdmin,
        }}
      >
        <TotalHoursReportPaginationContext.Provider
          value={{
            pagination,
            setCurrentPage,
            setPageSize,
          }}
        >
          {children}
        </TotalHoursReportPaginationContext.Provider>
      </TotalHoursReportFilterContext.Provider>
    </TotalHoursReportFetchContext.Provider>
  );
}
