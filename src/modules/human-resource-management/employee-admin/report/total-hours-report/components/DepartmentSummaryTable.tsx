"use client";

import React, { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Printer,
} from "lucide-react";
import type {
  DepartmentMatrixData,
  MatrixEmployeeRow,
  TotalHoursRecord,
} from "../type";
import { TotalHoursDetailModal } from "./TotalHoursDetailModal";

interface DepartmentSummaryTableProps {
  matrix: DepartmentMatrixData | null;
  isLoading: boolean;
  onPrint?: () => void;
}

export function DepartmentSummaryTable({
  matrix,
  isLoading,
  onPrint,
}: DepartmentSummaryTableProps) {
  const [showClockTimes, setShowClockTimes] = useState(true);
  const [pageSize, setPageSize] = useState<number>(15);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedRecordForModal, setSelectedRecordForModal] =
    useState<TotalHoursRecord | null>(null);

  const employees = useMemo(() => matrix?.employees || [], [matrix?.employees]);
  const dates = useMemo(() => matrix?.dates || [], [matrix?.dates]);

  // Client-side pagination for matrix to prevent DOM overload
  const totalPages = Math.max(1, Math.ceil(employees.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedEmployees = useMemo(() => {
    if (pageSize >= 1000) return employees;
    const start = (safePage - 1) * pageSize;
    return employees.slice(start, start + pageSize);
  }, [employees, safePage, pageSize]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!matrix || dates.length === 0 || employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 px-4 text-center">
        <div className="rounded-full bg-muted p-3 mb-3">
          <Calendar className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold">No department records available</h3>
        <p className="text-xs text-muted-foreground max-w-sm mt-1">
          No approved attendance records were found for the selected department and date range. Please select a different date range or department.
        </p>
      </div>
    );
  }

  const handleCellClick = (emp: MatrixEmployeeRow, dateStr: string) => {
    const day = emp.days[dateStr];
    if (!day) return;

    const dummyRecord: TotalHoursRecord = {
      id: `${emp.user_id}_${dateStr}`,
      log_id: null,
      approval_id: null,
      employee_id: emp.user_id,
      employee_name: emp.employee_name,
      employee_position: emp.employee_position,
      department_id: emp.department_id,
      department_name: emp.department_name,
      log_date: dateStr,
      day_of_week: dates.find((d) => d.date === dateStr)?.dayOfWeek || "",
      work_minutes: day.work_minutes,
      late_minutes: day.late_minutes,
      undertime_minutes: day.undertime_minutes,
      overtime_minutes: day.overtime_minutes,
      approval_status: "approved",
      remarks: day.remarks || (day.isAbsent ? "Absent" : "Approved"),
      time_in: day.time_in,
      time_out: day.time_out,
    };

    setSelectedRecordForModal(dummyRecord);
  };

  return (
    <div className="space-y-3">
      {/* Table controls bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <div className="flex items-center space-x-2">
            <Switch
              id="show-clock-times"
              checked={showClockTimes}
              onCheckedChange={setShowClockTimes}
            />
            <Label
              htmlFor="show-clock-times"
              className="text-xs cursor-pointer font-medium text-foreground"
            >
              Show Actual Clock Times (In / Out)
            </Label>
          </div>
          <span className="hidden sm:inline text-muted-foreground/60">•</span>
          <span className="hidden sm:inline">
            <strong className="text-foreground">{employees.length}</strong> employees across <strong className="text-foreground">{dates.length}</strong> dates
          </span>
        </div>

        {/* Legend & Print Button */}
        <div className="flex items-center gap-3 font-medium text-[11px] flex-wrap">
          <span className="flex items-center gap-1">
            <strong className="text-primary font-bold">T:</strong> Total Work
          </span>
          <span className="flex items-center gap-1">
            <strong className="text-amber-600 dark:text-amber-400 font-bold">L:</strong> Late
          </span>
          <span className="flex items-center gap-1">
            <strong className="text-indigo-600 dark:text-indigo-400 font-bold">O:</strong> Overtime
          </span>
          <span className="flex items-center gap-1">
            <strong className="text-rose-600 dark:text-rose-400 font-bold">U:</strong> Undertime
          </span>

          {onPrint && (
            <Button
              variant="outline"
              size="sm"
              onClick={onPrint}
              className="h-7 text-xs px-2.5 ml-2 font-medium gap-1 text-foreground"
            >
              <Printer className="h-3.5 w-3.5 text-primary" />
              <span>Print Summary</span>
            </Button>
          )}
        </div>
      </div>

      {/* Responsive Matrix Grid */}
      <div className="rounded-xl border bg-card shadow-xs overflow-x-auto">
        <Table className="border-collapse">
          {/* MULTI-TIER HEADER */}
          <TableHeader className="bg-muted/30">
            {/* ROW 1: Date group headers */}
            <TableRow className="border-b hover:bg-transparent">
              {/* Sticky Name column (no dropdown) */}
              <TableHead
                rowSpan={2}
                className="w-[200px] min-w-[200px] max-w-[200px] sticky left-0 z-20 bg-muted/40 backdrop-blur-md border-r font-bold text-xs uppercase tracking-wider text-foreground pl-4"
              >
                Name
              </TableHead>

              {/* Date columns */}
              {dates.map((d) => (
                <TableHead
                  key={d.date}
                  colSpan={4}
                  className="text-center font-bold text-xs py-2 px-2 border-r border-border/60 bg-muted/20 text-foreground"
                >
                  <div className="truncate">{d.displayHeader}</div>
                </TableHead>
              ))}

              {/* Period Total */}
              <TableHead
                colSpan={4}
                className="text-center font-bold text-xs py-2 px-2 bg-primary/5 text-primary border-l"
              >
                Period Summary
              </TableHead>
            </TableRow>

            {/* ROW 2: Sub-columns T, L, O, U */}
            <TableRow className="border-b hover:bg-transparent bg-muted/15">
              {dates.map((d) => (
                <React.Fragment key={`sub-${d.date}`}>
                  <TableHead className="w-[48px] min-w-[48px] max-w-[48px] text-center font-bold text-[11px] py-1.5 px-1 text-foreground">
                    T
                  </TableHead>
                  <TableHead className="w-[48px] min-w-[48px] max-w-[48px] text-center font-bold text-[11px] py-1.5 px-1 text-foreground">
                    L
                  </TableHead>
                  <TableHead className="w-[48px] min-w-[48px] max-w-[48px] text-center font-bold text-[11px] py-1.5 px-1 text-foreground">
                    O
                  </TableHead>
                  <TableHead className="w-[48px] min-w-[48px] max-w-[48px] text-center font-bold text-[11px] py-1.5 px-1 border-r border-border/60 text-foreground">
                    U
                  </TableHead>
                </React.Fragment>
              ))}

              {/* Totals Subheaders */}
              <TableHead className="w-[56px] min-w-[56px] text-center font-bold text-[11px] py-1.5 px-1 text-primary">
                Total
              </TableHead>
              <TableHead className="w-[52px] min-w-[52px] text-center font-bold text-[11px] py-1.5 px-1 text-amber-600">
                Late
              </TableHead>
              <TableHead className="w-[52px] min-w-[52px] text-center font-bold text-[11px] py-1.5 px-1 text-indigo-600">
                OT
              </TableHead>
              <TableHead className="w-[52px] min-w-[52px] text-center font-bold text-[11px] py-1.5 px-1 text-rose-600">
                UT
              </TableHead>
            </TableRow>
          </TableHeader>

          {/* TABLE BODY */}
          <TableBody>
            {paginatedEmployees.map((emp) => (
              <React.Fragment key={emp.user_id}>
                {/* MAIN EMPLOYEE MATRIX ROW */}
                <TableRow className="border-b hover:bg-muted/20 transition-colors">
                  {/* Sticky Employee Name Column (NO DROPDOWN - CLEAN AND CRISP) */}
                  <TableCell className="sticky left-0 z-10 bg-card border-r py-2.5 pl-4 pr-3 align-middle shadow-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-foreground truncate">
                        {emp.employee_name}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                        {emp.employee_position}
                      </div>
                    </div>
                  </TableCell>

                  {/* DATES DATA COLUMNS */}
                  {dates.map((d) => {
                    const day = emp.days[d.date];
                    const isAbsent = !day || day.isAbsent;

                    return (
                      <React.Fragment key={`${emp.user_id}-${d.date}`}>
                        {/* Total Work (T) */}
                        <TableCell
                          className={`py-2 px-1 text-center align-middle cursor-pointer hover:bg-primary/5 transition-colors ${
                            isAbsent ? "bg-red-50/20 dark:bg-red-950/10" : ""
                          }`}
                          onClick={() => handleCellClick(emp, d.date)}
                        >
                          {isAbsent ? (
                            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded text-[11px] font-bold bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800">
                              A
                            </span>
                          ) : (
                            <div className="text-xs font-semibold text-foreground">
                              {day.work_formatted}
                            </div>
                          )}
                        </TableCell>

                        {/* Late (L) */}
                        <TableCell
                          className={`py-2 px-1 text-center align-middle cursor-pointer hover:bg-primary/5 transition-colors ${
                            isAbsent ? "bg-red-50/20 dark:bg-red-950/10" : ""
                          }`}
                          onClick={() => handleCellClick(emp, d.date)}
                        >
                          {isAbsent ? (
                            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded text-[11px] font-bold bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800">
                              A
                            </span>
                          ) : (
                            <div
                              className={`text-xs ${
                                day.late_minutes > 0
                                  ? "font-bold text-amber-600 dark:text-amber-400"
                                  : "text-muted-foreground font-normal"
                              }`}
                            >
                              {day.late_formatted}
                            </div>
                          )}
                        </TableCell>

                        {/* Overtime (O) */}
                        <TableCell
                          className={`py-2 px-1 text-center align-middle cursor-pointer hover:bg-primary/5 transition-colors ${
                            isAbsent ? "bg-red-50/20 dark:bg-red-950/10" : ""
                          }`}
                          onClick={() => handleCellClick(emp, d.date)}
                        >
                          {isAbsent ? (
                            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded text-[11px] font-bold bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800">
                              A
                            </span>
                          ) : (
                            <div
                              className={`text-xs ${
                                day.overtime_minutes > 0
                                  ? "font-bold text-indigo-600 dark:text-indigo-400"
                                  : "text-muted-foreground font-normal"
                              }`}
                            >
                              {day.overtime_formatted}
                            </div>
                          )}
                        </TableCell>

                        {/* Undertime (U) */}
                        <TableCell
                          className={`py-2 px-1 text-center align-middle cursor-pointer hover:bg-primary/5 transition-colors border-r border-border/60 ${
                            isAbsent ? "bg-red-50/20 dark:bg-red-950/10" : ""
                          }`}
                          onClick={() => handleCellClick(emp, d.date)}
                        >
                          {isAbsent ? (
                            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded text-[11px] font-bold bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800">
                              A
                            </span>
                          ) : (
                            <div
                              className={`text-xs ${
                                day.undertime_minutes > 0
                                  ? "font-bold text-rose-600 dark:text-rose-400"
                                  : "text-muted-foreground font-normal"
                              }`}
                            >
                              {day.undertime_formatted}
                            </div>
                          )}
                        </TableCell>
                      </React.Fragment>
                    );
                  })}

                  {/* PERIOD TOTAL COLUMNS */}
                  <TableCell className="py-2 px-1 text-center align-middle font-bold text-xs text-primary bg-primary/5">
                    {Math.floor(emp.totals.total_work_minutes / 60)}h{" "}
                    {emp.totals.total_work_minutes % 60}m
                  </TableCell>
                  <TableCell className="py-2 px-1 text-center align-middle text-xs font-semibold text-amber-600 bg-primary/5">
                    {Math.floor(emp.totals.total_late_minutes / 60)}h{" "}
                    {emp.totals.total_late_minutes % 60}m
                  </TableCell>
                  <TableCell className="py-2 px-1 text-center align-middle text-xs font-semibold text-indigo-600 bg-primary/5">
                    {Math.floor(emp.totals.total_overtime_minutes / 60)}h{" "}
                    {emp.totals.total_overtime_minutes % 60}m
                  </TableCell>
                  <TableCell className="py-2 px-1 text-center align-middle text-xs font-semibold text-rose-600 bg-primary/5">
                    {Math.floor(emp.totals.total_undertime_minutes / 60)}h{" "}
                    {emp.totals.total_undertime_minutes % 60}m
                  </TableCell>
                </TableRow>

                {/* SUB-ROW: Actual Time In & Time Out below the TLOU row */}
                {showClockTimes && (
                  <TableRow className="border-b bg-muted/10 hover:bg-muted/15 transition-colors">
                    <TableCell className="sticky left-0 z-10 bg-muted/10 border-r py-1 px-4 text-[11px] text-muted-foreground font-semibold flex items-center gap-1.5 shadow-xs">
                      <Clock className="h-3 w-3 text-primary" />
                      <span>Actual Clock:</span>
                    </TableCell>

                    {dates.map((d) => {
                      const day = emp.days[d.date];
                      const isAbsent = !day || day.isAbsent;

                      return (
                        <TableCell
                          key={`clock-${emp.user_id}-${d.date}`}
                          colSpan={4}
                          className="py-1 px-1 text-center border-r border-border/60 text-[10px]"
                        >
                          {isAbsent ? (
                            <span className="text-muted-foreground/60 italic">
                              No punches
                            </span>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5 font-mono leading-tight">
                              <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                                In: {day.time_in_formatted}
                              </span>
                              <span className="text-muted-foreground/40">•</span>
                              <span className="text-rose-700 dark:text-rose-400 font-medium">
                                Out: {day.time_out_formatted}
                              </span>
                            </div>
                          )}
                        </TableCell>
                      );
                    })}

                    <TableCell
                      colSpan={4}
                      className="py-1 px-2 text-center text-[10px] text-muted-foreground font-medium bg-primary/5"
                    >
                      Attended: {emp.totals.total_days_attended}d | Absent: {emp.totals.total_days_absent}d
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Matrix Pagination Controls */}
      {employees.length > 15 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground px-1 pt-1">
          <div className="flex items-center gap-2">
            <span>Employees per page:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => {
                setPageSize(Number(val));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="1000">All</SelectItem>
              </SelectContent>
            </Select>
            <span>
              Showing {(safePage - 1) * pageSize + 1} to{" "}
              {Math.min(safePage * pageSize, employees.length)} of{" "}
              {employees.length} employees
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="xs"
              className="h-8 px-2"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <div className="px-2 text-xs font-medium">
              Page {safePage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="xs"
              className="h-8 px-2"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Modal for Day Inspection */}
      <TotalHoursDetailModal
        isOpen={Boolean(selectedRecordForModal)}
        record={selectedRecordForModal}
        onClose={() => setSelectedRecordForModal(null)}
      />
    </div>
  );
}
