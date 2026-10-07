"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Clock,
  Calendar,
  User,
  Building,
  CheckCircle2,
  AlertTriangle,
  ArrowDownRight,
  Flame,
  Info,
  LogIn,
  LogOut,
  Coffee,
  UtensilsCrossed,
} from "lucide-react";
import { format } from "date-fns";
import type { TotalHoursRecord } from "../type";

interface TotalHoursDetailModalProps {
  isOpen: boolean;
  record: TotalHoursRecord | null;
  onClose: () => void;
}

function formatMinutes(minutes: number): string {
  if (!minutes || minutes <= 0) return "0 mins";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} mins`;
  if (m === 0) return `${h} hrs`;
  return `${h}h ${m}m`;
}

function formatTime(isoStr: string | null | undefined): string {
  if (!isoStr) return "Not recorded";
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
    return format(d, "hh:mm:ss a");
  } catch {
    return isoStr;
  }
}

export function TotalHoursDetailModal({
  isOpen,
  record,
  onClose,
}: TotalHoursDetailModalProps) {
  if (!record) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between pr-4">
            <div>
              <DialogTitle className="text-xl font-bold">
                Daily Attendance & Hours Detail
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Approved hours evaluation and actual biometric punches
              </p>
            </div>
            <Badge
              variant={record.approval_status === "approved" ? "default" : "outline"}
              className="text-xs capitalize"
            >
              {record.approval_status}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Employee & Date banner */}
          <div className="rounded-lg bg-muted/50 p-3.5 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                {record.employee_name.charAt(0)}
              </div>
              <div>
                <div className="font-semibold">{record.employee_name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <span>ID: {record.employee_id}</span>
                  {record.employee_code && (
                    <span>• Bio: {record.employee_code}</span>
                  )}
                  <span>• {record.department_name}</span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="font-medium flex items-center gap-1.5 justify-end">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {record.log_date}
              </div>
              <div className="text-xs text-muted-foreground">
                {record.day_of_week}
              </div>
            </div>
          </div>

          {/* Section 1: APPROVED HOURS */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Approved Evaluation
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-md border p-2.5 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40">
                <span className="text-xs text-muted-foreground block">
                  Work Hours
                </span>
                <span className="text-base font-bold text-emerald-700 dark:text-emerald-400">
                  {formatMinutes(record.work_minutes)}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  {(record.work_minutes / 60).toFixed(2)} hours
                </span>
              </div>

              <div className="rounded-md border p-2.5 bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40">
                <span className="text-xs text-muted-foreground block">Late</span>
                <span className="text-base font-bold text-amber-700 dark:text-amber-400">
                  {formatMinutes(record.late_minutes)}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  Grace: {record.grace_period ?? 5}m
                </span>
              </div>

              <div className="rounded-md border p-2.5 bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40">
                <span className="text-xs text-muted-foreground block">
                  Undertime
                </span>
                <span className="text-base font-bold text-rose-700 dark:text-rose-400">
                  {formatMinutes(record.undertime_minutes)}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  Early departure
                </span>
              </div>

              <div className="rounded-md border p-2.5 bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/40">
                <span className="text-xs text-muted-foreground block">
                  Overtime
                </span>
                <span className="text-base font-bold text-indigo-700 dark:text-indigo-400">
                  {formatMinutes(record.overtime_minutes)}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  {(record.overtime_minutes / 60).toFixed(2)} hours
                </span>
              </div>
            </div>

            {/* Approver & Remarks */}
            <div className="mt-2.5 rounded-md border p-2.5 text-xs bg-muted/20 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Approved By:</span>
                <span className="font-medium">
                  {record.approved_by_name || (record.approved_by ? `User #${record.approved_by}` : "System / Approved")}
                </span>
              </div>
              {record.approved_at && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Approved At:</span>
                  <span>{formatTime(record.approved_at)}</span>
                </div>
              )}
              {record.remarks && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Remarks:</span>
                  <span className="font-medium text-foreground">{record.remarks}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Section 2: ACTUAL CLOCK PUNCHES */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-blue-600" />
              Actual Clock Times (Punches)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Actual Time In */}
              <div className="rounded-md border p-3 flex items-start gap-3">
                <div className="rounded-md bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                  <LogIn className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Actual Time In</div>
                  <div className="text-sm font-bold mt-0.5">
                    {formatTime(record.time_in)}
                  </div>
                  {record.sched_time_in && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Scheduled: {record.sched_time_in}
                    </div>
                  )}
                </div>
              </div>

              {/* Actual Time Out */}
              <div className="rounded-md border p-3 flex items-start gap-3">
                <div className="rounded-md bg-rose-100 p-2 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400">
                  <LogOut className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Actual Time Out</div>
                  <div className="text-sm font-bold mt-0.5">
                    {formatTime(record.time_out)}
                  </div>
                  {record.sched_time_out && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Scheduled: {record.sched_time_out}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Breaks & Lunch if present */}
            {(record.lunch_start || record.break_start) && (
              <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                {record.lunch_start && (
                  <div className="rounded-md border p-2 flex items-center gap-2 bg-muted/20">
                    <UtensilsCrossed className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>
                      Lunch: {formatTime(record.lunch_start)} - {formatTime(record.lunch_end)}
                    </span>
                  </div>
                )}
                {record.break_start && (
                  <div className="rounded-md border p-2 flex items-center gap-2 bg-muted/20">
                    <Coffee className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>
                      Break: {formatTime(record.break_start)} - {formatTime(record.break_end)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
