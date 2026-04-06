"use client";

import React from "react";
import {
  UndertimeReportFetchProvider,
  UndertimeReportFilterProvider,
  UndertimeReportPaginationProvider
} from "./contexts";
import { useUndertimeReport } from "./hooks/useUndertimeReport";
import { UndertimeReportFilters } from "./components/UndertimeReportFilters";
import { UndertimeReportTable } from "./components/UndertimeReportTable";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// ============================================================================
// INNER COMPONENT (Has access to context)
// ============================================================================

function UndertimeReportModuleContent() {
  const {
    requests,
    departments,
    currentUser,
    isHRAdmin,
    isLoading,
    isError,
    error,
    refetch,
    filters,
    setSearchQuery,
    setDateFrom,
    setDateTo,
    setDepartmentId,
    setNameFilter,
    setStatusFilter,
    resetFilters,
    employeeNames,
    pagination,
    setCurrentPage,
  } = useUndertimeReport();

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>
            Failed to load undertime report: {error?.message || "Unknown error"}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="ml-4"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Undertime Report
          </h1>
          <p className="text-muted-foreground">
            {isHRAdmin
              ? "View undertime reports from all departments"
              : currentUser?.user_department
              ? `View undertime report for your department`
              : "View undertime reports"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Filters Card */}
      <Card>
        <CardContent className="pt-6">
          <UndertimeReportFilters
            filters={filters}
            departments={departments}
            isHRAdmin={isHRAdmin}
            employeeNames={employeeNames}
            onSearchChange={setSearchQuery}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            onDepartmentChange={setDepartmentId}
            onNameFilterChange={setNameFilter}
            onStatusChange={setStatusFilter}
            onResetFilters={resetFilters}
          />
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-semibold">{pagination.totalItems}</span>{" "}
          undertime {pagination.totalItems === 1 ? "request" : "requests"}
        </p>
      </div>

      {/* Table */}
      <UndertimeReportTable
        data={requests}
        isLoading={isLoading}
        pagination={pagination}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}

// ============================================================================
// MAIN WRAPPER (PROVIDERS)
// ============================================================================

export default function UndertimeReportModule() {
  return (
    <UndertimeReportFetchProvider>
      <UndertimeReportFilterProvider>
        <UndertimeReportPaginationProvider>
          <UndertimeReportModuleContent />
        </UndertimeReportPaginationProvider>
      </UndertimeReportFilterProvider>
    </UndertimeReportFetchProvider>
  );
}
