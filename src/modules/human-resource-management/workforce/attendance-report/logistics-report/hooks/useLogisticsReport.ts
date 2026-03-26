"use client";

import { useEffect, useState } from "react";
import {
  LogisticsReportDateRange,
  LogisticsReportMeta,
  LogisticsReportResponse,
  DispatchAttendance,
} from "../type";
import { getDefaultDateRange } from "../utils/report";

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

export function useLogisticsReport() {
  const [startDate, setStartDate] = useState(defaultDateRange.startDate);
  const [endDate, setEndDate] = useState(defaultDateRange.endDate);
  const [dispatches, setDispatches] = useState<DispatchAttendance[]>([]);
  const [meta, setMeta] = useState<LogisticsReportMeta>(initialMeta);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  async function loadReport(range?: LogisticsReportDateRange) {
    const selectedRange = range ?? { startDate, endDate };

    setIsLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams({ ...selectedRange });
      const response = await fetch(
        `/api/hrm/logistics-report?${query.toString()}`,
        {
          cache: "no-store",
        },
      );
      const payload = (await response.json()) as LogisticsReportResponse;

      if (!response.ok) {
        throw new Error(
          payload.details || payload.error || "Unable to load report",
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
          : "Unable to load report",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadReport({ startDate, endDate });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize, searchQuery]);

  const filteredDispatches = dispatches
    .filter(
      (dispatch) =>
        !searchQuery ||
        dispatch.dispatchDocNo
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()),
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
    setCurrentPage,
    setPageSize,
    loadReport,
  };
}
