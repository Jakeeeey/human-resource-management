"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  LogisticsReportDateRange,
  LogisticsReportMeta,
  LogisticsReportResponse,
  DispatchAttendance,
} from "../type";

function getDefaultDateRange() {
  const now = new Date();
  const year = now.getFullYear();

  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  };
}

const defaultDateRange = getDefaultDateRange();

const initialMeta: LogisticsReportMeta = {
  startDate: defaultDateRange.startDate,
  endDate: defaultDateRange.endDate,
  totalDispatches: 0,
  totalStaff: 0,
  presentCount: 0,
  absentCount: 0,
};

const defaultPageSize = 10;

export function useManageLogisticsAttendance() {
  const [startDate, setStartDate] = useState(defaultDateRange.startDate);
  const [endDate, setEndDate] = useState(defaultDateRange.endDate);
  const [dispatches, setDispatches] = useState<DispatchAttendance[]>([]);
  const [meta, setMeta] = useState<LogisticsReportMeta>(initialMeta);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [driverFilter, setDriverFilter] = useState("");
  const [helperFilter, setHelperFilter] = useState("");
  const [dispatchDateFilter, setDispatchDateFilter] = useState("");
  const [showDisregarded, setShowDisregarded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const loadReport = useCallback(async (range?: LogisticsReportDateRange) => {
    const selectedRange = range ?? { startDate, endDate };

    setIsLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams({ ...selectedRange });
      const response = await fetch(
        `/api/hrm/manage-logistics-attendance?${query.toString()}`,
        {
          cache: "no-store",
        },
      );
      const payload = (await response.json()) as LogisticsReportResponse;

      if (!response.ok) {
        throw new Error(
          payload.details || payload.error || "Unable to load data",
        );
      }

      setDispatches(payload.data ?? []);
      setMeta(payload.meta ?? initialMeta);
      setCurrentPage(1);
    } catch (caughtError) {
      setDispatches([]);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load data",
      );
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  const updateDispatchStaff = async (payload: { dispatchPlanId: number; isExtra?: boolean; driverId: number | null; helperIds: number[]; timeOfDispatch?: string | null; vehicleId?: number | null; isNotPayroll?: boolean; area?: string; }) => {
    try {
      const response = await fetch("/api/hrm/manage-logistics-attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to update staff.");
      }

      await loadReport();
      return { success: true };
    } catch (err) {
        throw err;
    }
  };

  const addManualDispatch = async (payload: { docNo: string; timeOfDispatch: string; driverId: number | null; vehicleId: number | null; helperIds: number[]; }) => {
    try {
      const response = await fetch("/api/hrm/manage-logistics-attendance/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add manual dispatch.");
      }

      await loadReport();
      return { success: true };
    } catch (err) {
        throw err;
    }
  };

  useEffect(() => {
    void loadReport({ startDate, endDate });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize, searchQuery]);

  const filteredDispatches = dispatches
    .filter(
      (dispatch) => {
        const matchSearch = !searchQuery || dispatch.dispatchDocNo?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchDriver = !driverFilter || driverFilter === 'all' || 
          (dispatch.driverName && dispatch.driverName.toLowerCase().includes(driverFilter.toLowerCase())) ||
          (dispatch.driverId && dispatch.driverId.toString().includes(driverFilter));
        const matchHelper = !helperFilter || helperFilter === 'all' ||
          (dispatch.staff && dispatch.staff.some(s => 
            (s.staffName && s.staffName.toLowerCase().includes(helperFilter.toLowerCase())) ||
            (s.staffUserId && s.staffUserId.toString().includes(helperFilter))
          ));
        
        let matchDate = true;
        if (dispatchDateFilter) {
          if (!dispatch.timeOfDispatch) {
            matchDate = false;
          } else {
            const dDate = new Date(dispatch.timeOfDispatch);
            const dDateStr = `${dDate.getFullYear()}-${String(dDate.getMonth() + 1).padStart(2, '0')}-${String(dDate.getDate()).padStart(2, '0')}`;
            matchDate = dDateStr === dispatchDateFilter;
          }
        }
        
        const matchDisregarded = showDisregarded ? true : !dispatch.isNotPayroll;

        return matchSearch && matchDriver && matchHelper && matchDate && matchDisregarded;
      }
    )
    .sort((a, b) => {
      const dateA = new Date(a.timeOfDispatch || 0).getTime();
      const dateB = new Date(b.timeOfDispatch || 0).getTime();
      return dateB - dateA;
    });

  useEffect(() => {
    const nextTotalPages = Math.max(
      1,
      Math.ceil(filteredDispatches.length / pageSize),
    );
    setCurrentPage((previousPage) => Math.min(previousPage, nextTotalPages));
  }, [filteredDispatches.length, pageSize]);

  const totalItems = filteredDispatches.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedDispatches = filteredDispatches.slice(startIndex, endIndex);

  const uniqueDrivers = useMemo(() => {
    const drivers = new Set<string>();
    dispatches.forEach(d => {
      if (d.driverName) drivers.add(d.driverName);
    });
    return Array.from(drivers).sort();
  }, [dispatches]);

  const uniqueHelpers = useMemo(() => {
    const helpers = new Set<string>();
    dispatches.forEach(d => {
      d.staff?.forEach(s => {
        if (s.staffName) helpers.add(s.staffName);
      });
    });
    return Array.from(helpers).sort();
  }, [dispatches]);

  return {
    startDate,
    endDate,
    searchQuery,
    dispatches,
    paginatedDispatches,
    meta,
    isLoading,
    error,
    currentPage: safeCurrentPage,
    pageSize,
    totalItems,
    totalPages,
    startRow: totalItems === 0 ? 0 : startIndex + 1,
    endRow: Math.min(endIndex, totalItems),
    setStartDate,
    setEndDate,
    setSearchQuery,
    driverFilter,
    setDriverFilter,
    helperFilter,
    setHelperFilter,
    dispatchDateFilter,
    setDispatchDateFilter,
    showDisregarded,
    setShowDisregarded,
    uniqueDrivers,
    uniqueHelpers,
    setCurrentPage,
    setPageSize,
    loadReport,
    updateDispatchStaff,
    addManualDispatch,
  };
}
