"use client";

import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  LogIn,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Eye,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import type { TotalHoursRecord, PaginationState } from "../type";
import { TotalHoursDetailModal } from "./TotalHoursDetailModal";

interface TotalHoursReportTableProps {
  data: TotalHoursRecord[];
  isLoading: boolean;
  pagination: PaginationState;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

function formatMinutes(minutes: number): { text: string; hours: string } {
  if (!minutes || minutes <= 0) return { text: "0m", hours: "0.0h" };
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hoursDecimal = (minutes / 60).toFixed(1) + "h";
  if (h === 0) return { text: `${m}m`, hours: hoursDecimal };
  if (m === 0) return { text: `${h}h`, hours: hoursDecimal };
  return { text: `${h}h ${m}m`, hours: hoursDecimal };
}

function formatTime(isoStr: string | null | undefined): string {
  if (!isoStr) return "—";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) {
      if (isoStr.includes(":")) {
        const [h, m] = isoStr.split(":");
        const hour = parseInt(h, 10);
        const ampm = hour >= 12 ? "PM" : "AM";
        const h12 = hour % 12 || 12;
        return `${String(h12).padStart(2, "0")}:${m} ${ampm}`;
      }
      return isoStr;
    }
    return format(d, "hh:mm a");
  } catch {
    return isoStr;
  }
}

export function TotalHoursReportTable({
  data,
  isLoading,
  pagination,
  onPageChange,
  onPageSizeChange,
}: TotalHoursReportTableProps) {
  const [selectedRecord, setSelectedRecord] = useState<TotalHoursRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleOpenDetails = (record: TotalHoursRecord) => {
    setSelectedRecord(record);
    setModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 px-4 text-center">
        <div className="rounded-full bg-muted p-3 mb-3">
          <Clock className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold">No attendance records found</h3>
        <p className="text-xs text-muted-foreground max-w-sm mt-1">
          No approved attendance records match the selected date range or department filter. Try selecting different dates or clearing the filters.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[240px] font-semibold">Employee</TableHead>
              <TableHead className="w-[140px] font-semibold">Date</TableHead>
              <TableHead className="font-semibold text-center">
                Approved Work Hours
              </TableHead>
              <TableHead className="font-semibold text-center">
                Approved Late
              </TableHead>
              <TableHead className="font-semibold text-center">
                Approved Undertime
              </TableHead>
              <TableHead className="font-semibold text-center">
                Approved Overtime
              </TableHead>
              <TableHead className="w-[100px] text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((record) => {
              const work = formatMinutes(record.work_minutes);
              const late = formatMinutes(record.late_minutes);
              const undertime = formatMinutes(record.undertime_minutes);
              const overtime = formatMinutes(record.overtime_minutes);

              const hasTimeIn = Boolean(record.time_in);
              const hasTimeOut = Boolean(record.time_out);

              return (
                <React.Fragment key={record.id}>
                  {/* MAIN ROW: Approved Hours & Employee Info */}
                  <TableRow className="border-b-0 hover:bg-muted/30 transition-colors">
                    {/* Employee */}
                    <TableCell className="align-top py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 shrink-0 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs text-primary">
                          {record.employee_name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">
                            {record.employee_name}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                            <span>ID: {record.employee_id}</span>
                            <span>•</span>
                            <span className="truncate max-w-[120px]">
                              {record.department_name}
                            </span>
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Date */}
                    <TableCell className="align-top py-3">
                      <div className="font-medium text-xs sm:text-sm">
                        {record.log_date}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {record.day_of_week}
                      </div>
                    </TableCell>

                    {/* Approved Work Hours */}
                    <TableCell className="align-top text-center py-3">
                      <div className="inline-flex flex-col items-center">
                        <span className="font-bold text-sm text-emerald-700 dark:text-emerald-400">
                          {work.text}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {work.hours}
                        </span>
                      </div>
                    </TableCell>

                    {/* Approved Late */}
                    <TableCell className="align-top text-center py-3">
                      <div className="inline-flex flex-col items-center">
                        {record.late_minutes > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            {late.text}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground font-medium">
                            0m
                          </span>
                        )}
                        {record.late_minutes > 0 && (
                          <span className="text-[10px] text-muted-foreground mt-0.5">
                            deducted
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Approved Undertime */}
                    <TableCell className="align-top text-center py-3">
                      <div className="inline-flex flex-col items-center">
                        {record.undertime_minutes > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                            {undertime.text}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground font-medium">
                            0m
                          </span>
                        )}
                        {record.undertime_minutes > 0 && (
                          <span className="text-[10px] text-muted-foreground mt-0.5">
                            early out
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Approved Overtime */}
                    <TableCell className="align-top text-center py-3">
                      <div className="inline-flex flex-col items-center">
                        {record.overtime_minutes > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                            {overtime.text}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground font-medium">
                            0m
                          </span>
                        )}
                        {record.overtime_minutes > 0 && (
                          <span className="text-[10px] text-muted-foreground mt-0.5">
                            {overtime.hours}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Action */}
                    <TableCell className="align-top text-right py-3">
                      <Button
                        variant="ghost"
                        size="xs"
                        className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                        onClick={() => handleOpenDetails(record)}
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>

                  {/* SUB-ROW: Actual Time In & Time Out (Rendered directly below the approved hours) */}
                  <TableRow className="border-b bg-muted/15 hover:bg-muted/25 transition-colors">
                    <TableCell colSpan={7} className="py-2 px-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                        {/* Actual Clocks */}
                        <div className="flex flex-wrap items-center gap-4">
                          <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Actual Clock Times:
                          </span>

                          {/* Time In */}
                          <div className="flex items-center gap-1.5">
                            <LogIn className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span className="text-muted-foreground">Time In:</span>
                            {hasTimeIn ? (
                              <span className="font-semibold text-foreground bg-background/80 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/40">
                                {formatTime(record.time_in)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-200">
                                <AlertCircle className="h-3 w-3" />
                                No Time In
                              </span>
                            )}
                          </div>

                          {/* Time Out */}
                          <div className="flex items-center gap-1.5">
                            <LogOut className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                            <span className="text-muted-foreground">Time Out:</span>
                            {hasTimeOut ? (
                              <span className="font-semibold text-foreground bg-background/80 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800/40">
                                {formatTime(record.time_out)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-200">
                                <AlertCircle className="h-3 w-3" />
                                No Time Out
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Scheduled Time info & remarks */}
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                          {record.sched_time_in && record.sched_time_out && (
                            <span className="hidden sm:inline">
                              Sched: {record.sched_time_in.slice(0, 5)} - {record.sched_time_out.slice(0, 5)}
                            </span>
                          )}
                          {record.remarks && (
                            <span className="italic text-foreground/80 max-w-[200px] truncate">
                              &ldquo;{record.remarks}&rdquo;
                            </span>
                          )}
                          <Badge
                            variant="outline"
                            className="text-[10px] h-4.5 px-1.5 capitalize text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                          >
                            Approved
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <Select
            value={String(pagination.pageSize)}
            onValueChange={(val) => onPageSizeChange(Number(val))}
          >
            <SelectTrigger className="h-8 w-18 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span>
            Showing{" "}
            <span className="font-medium text-foreground">
              {Math.min(
                (pagination.currentPage - 1) * pagination.pageSize + 1,
                pagination.totalItems
              )}
            </span>{" "}
            to{" "}
            <span className="font-medium text-foreground">
              {Math.min(
                pagination.currentPage * pagination.pageSize,
                pagination.totalItems
              )}
            </span>{" "}
            of{" "}
            <span className="font-medium text-foreground">
              {pagination.totalItems}
            </span>{" "}
            entries
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="xs"
            className="h-8 px-2"
            disabled={pagination.currentPage <= 1}
            onClick={() => onPageChange(pagination.currentPage - 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <div className="px-2 text-xs font-medium">
            Page {pagination.currentPage} of {Math.max(1, pagination.totalPages)}
          </div>
          <Button
            variant="outline"
            size="xs"
            className="h-8 px-2"
            disabled={pagination.currentPage >= pagination.totalPages}
            onClick={() => onPageChange(pagination.currentPage + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Modal */}
      <TotalHoursDetailModal
        isOpen={modalOpen}
        record={selectedRecord}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
