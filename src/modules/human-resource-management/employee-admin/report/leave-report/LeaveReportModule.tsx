"use client";

import React from "react";
import {
  LeaveReportFetchProvider,
  LeaveReportFilterProvider,
  LeaveReportPaginationProvider
} from "./contexts";
import { useLeaveReport } from "./hooks/useLeaveReport";
import { LeaveReportFilters } from "./components/LeaveReportFilters";
import { LeaveReportTable } from "./components/LeaveReportTable";
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

function LeaveReportModuleContent() {
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
  } = useLeaveReport();

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>
            Failed to load leave report: {error?.message || "Unknown error"}
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
            Leave Report
          </h1>
          <p className="text-muted-foreground">
            {isHRAdmin
              ? "View leave reports from all departments"
              : currentUser?.user_department
              ? `View leave report for your department`
              : "View leave reports"}
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
          <LeaveReportFilters
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
          leave {pagination.totalItems === 1 ? "request" : "requests"}
        </p>
      </div>

      {/* Table */}
      <LeaveReportTable
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

export default function LeaveReportModule() {
  return (
    <LeaveReportFetchProvider>
      <LeaveReportFilterProvider>
        <LeaveReportPaginationProvider>
          <LeaveReportModuleContent />
        </LeaveReportPaginationProvider>
      </LeaveReportFilterProvider>
    </LeaveReportFetchProvider>
  );
}
