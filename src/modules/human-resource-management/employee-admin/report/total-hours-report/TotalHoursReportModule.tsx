"use client";

import React, { useCallback, useState } from "react";
import { TotalHoursReportProvider } from "./contexts";
import { useTotalHoursReport } from "./hooks/useTotalHoursReport";
import { TotalHoursSummaryCards } from "./components/TotalHoursSummaryCards";
import { TotalHoursReportFilters } from "./components/TotalHoursReportFilters";
import { DepartmentSummaryTable } from "./components/DepartmentSummaryTable";
import { TotalHoursReportTable } from "./components/TotalHoursReportTable";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertCircle,
  RefreshCw,
  Download,
  Printer,
  Table as TableIcon,
  ListFilter,
} from "lucide-react";
import type { TotalHoursRecord } from "./type";

function formatTime(isoStr: string | null | undefined): string {
  if (!isoStr) return "N/A";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoStr;
  }
}

function TotalHoursReportModuleContent() {
  const {
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
    filters,
    setSearchQuery,
    setDateFrom,
    setDateTo,
    setDateRangePreset,
    setDepartmentId,
    setNameFilter,
    setApprovalStatus,
    resetFilters,
    pagination,
    setCurrentPage,
    setPageSize,
  } = useTotalHoursReport();

  const [activeTab, setActiveTab] = useState<"summary" | "detailed">("summary");

  // Export Matrix or Logs to CSV
  const handleExportCSV = useCallback(() => {
    if (activeTab === "summary" && matrix && matrix.employees.length > 0) {
      // Export Matrix CSV
      const dateHeaders = matrix.dates.map((d) => `"${d.displayHeader} (T)","${d.displayHeader} (L)","${d.displayHeader} (O)","${d.displayHeader} (U)"`).join(",");
      const headers = `"Employee Name","Position","Department",${dateHeaders},"Total Work (hrs)","Total Late (hrs)","Total OT (hrs)","Total UT (hrs)"`;

      const rows = matrix.employees.map((emp) => {
        const dateVals = matrix.dates.map((d) => {
          const day = emp.days[d.date];
          if (!day || day.isAbsent) {
            return `"Absent","Absent","Absent","Absent"`;
          }
          return `"${day.work_formatted}","${day.late_formatted}","${day.overtime_formatted}","${day.undertime_formatted}"`;
        }).join(",");

        return `"${emp.employee_name}","${emp.employee_position}","${emp.department_name}",${dateVals},"${(emp.totals.total_work_minutes / 60).toFixed(2)}","${(emp.totals.total_late_minutes / 60).toFixed(2)}","${(emp.totals.total_overtime_minutes / 60).toFixed(2)}","${(emp.totals.total_undertime_minutes / 60).toFixed(2)}"`;
      });

      const csvContent =
        "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      const today = new Date().toISOString().split("T")[0];
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Department_Hours_Summary_${today}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (records.length === 0) return;

    const headers = [
      "Employee ID",
      "Employee Name",
      "Department",
      "Date",
      "Day",
      "Approved Work Hours",
      "Approved Work Minutes",
      "Approved Late (mins)",
      "Approved Undertime (mins)",
      "Approved Overtime (mins)",
      "Actual Time In",
      "Actual Time Out",
      "Scheduled In",
      "Scheduled Out",
      "Approval Status",
      "Remarks",
    ];

    const rows = records.map((r: TotalHoursRecord) => [
      `"${r.employee_id}"`,
      `"${r.employee_name}"`,
      `"${r.department_name}"`,
      `"${r.log_date}"`,
      `"${r.day_of_week}"`,
      `"${(r.work_minutes / 60).toFixed(2)}"`,
      `"${r.work_minutes}"`,
      `"${r.late_minutes}"`,
      `"${r.undertime_minutes}"`,
      `"${r.overtime_minutes}"`,
      `"${formatTime(r.time_in)}"`,
      `"${formatTime(r.time_out)}"`,
      `"${r.sched_time_in || "N/A"}"`,
      `"${r.sched_time_out || "N/A"}"`,
      `"${r.approval_status}"`,
      `"${(r.remarks || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    const today = new Date().toISOString().split("T")[0];
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Total_Hours_Report_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [activeTab, matrix, records]);

  // Handle Print
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Total Hours Report</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>{error?.message || "An unexpected error occurred."}</span>
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
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Total Hours Report
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Department-wide approved working hours (T), lateness (L), overtime (O), and undertime (U) with actual biometric punch times.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={isLoading}
            className="h-9 text-xs"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            disabled={isLoading}
            className="h-9 text-xs"
          >
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Print
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="h-9 text-xs"
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${
                isLoading ? "animate-spin" : ""
              }`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <TotalHoursSummaryCards summary={summary} isLoading={isLoading} />

      {/* Filters Card */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <TotalHoursReportFilters
            filters={filters}
            departments={departments}
            employeeNames={employeeNames}
            isHRAdmin={isHRAdmin}
            onSearchChange={setSearchQuery}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            onDateRangePreset={setDateRangePreset}
            onDepartmentChange={setDepartmentId}
            onNameFilterChange={setNameFilter}
            onApprovalStatusChange={setApprovalStatus}
            onResetFilters={resetFilters}
          />
        </CardContent>
      </Card>

      {/* View Mode Tabs: Department Summary Matrix vs Detailed Daily Logs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "summary" | "detailed")}
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <TabsList className="bg-muted/60 p-1">
            <TabsTrigger
              value="summary"
              className="text-xs font-semibold gap-1.5 data-[state=active]:bg-background"
            >
              <TableIcon className="h-3.5 w-3.5 text-primary" />
              Department Matrix Summary
            </TabsTrigger>
            <TabsTrigger
              value="detailed"
              className="text-xs font-semibold gap-1.5 data-[state=active]:bg-background"
            >
              <ListFilter className="h-3.5 w-3.5 text-muted-foreground" />
              Detailed Daily Logs
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Department Matrix Table (Matching user's sample table!) */}
        <TabsContent value="summary" className="m-0 focus-visible:outline-none">
          <DepartmentSummaryTable matrix={matrix} isLoading={isLoading} />
        </TabsContent>

        {/* Tab 2: Detailed Daily Logs Table */}
        <TabsContent value="detailed" className="m-0 focus-visible:outline-none">
          <TotalHoursReportTable
            data={records}
            isLoading={isLoading}
            pagination={pagination}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function TotalHoursReportModule() {
  return (
    <TotalHoursReportProvider>
      <TotalHoursReportModuleContent />
    </TotalHoursReportProvider>
  );
}
