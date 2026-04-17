"use client";

import { LogisticsDispatchList } from "./components/LogisticsDispatchList";
import { LogisticsReportFilters } from "./components/LogisticsReportFilters";
import { LogisticsReportHeader } from "./components/LogisticsReportHeader";
import { LogisticsReportSummary } from "./components/LogisticsReportSummary";
import { useLogisticsReport } from "./hooks/useLogisticsReport";

export default function LogisticsReportModule() {
  const {
    startDate,
    endDate,
    searchQuery,
    paginatedDispatches,
    meta,
    isLoading,
    error,
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    startRow,
    endRow,
    setStartDate,
    setEndDate,
    setSearchQuery,
    setCurrentPage,
    setPageSize,
    loadReport,
    setHasUserFiltered,
  } = useLogisticsReport();

  return (
    <div className="space-y-6">
      <LogisticsReportHeader
        isLoading={isLoading}
        onRefresh={() => void loadReport()}
      />

      <LogisticsReportFilters
        startDate={startDate}
        endDate={endDate}
        searchQuery={searchQuery}
        isLoading={isLoading}
        onStartDateChange={(date) => {
          setHasUserFiltered(true);
          setStartDate(date);
        }}
        onEndDateChange={(date) => {
          setHasUserFiltered(true);
          setEndDate(date);
        }}
        onSearchQueryChange={(query) => {
          setSearchQuery(query);
        }}
      />

      <LogisticsReportSummary meta={meta} />

      <LogisticsDispatchList
        dispatches={paginatedDispatches}
        meta={meta}
        isLoading={isLoading}
        error={error}
        currentPage={currentPage}
        pageSize={pageSize}
        totalItems={totalItems}
        totalPages={totalPages}
        startRow={startRow}
        endRow={endRow}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}
