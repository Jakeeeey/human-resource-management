// src/modules/human-resource-management/workforce/attendance-report/employee-report/components/EmployeeHistoryView.tsx
"use client";

import React, { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import { format } from "date-fns";
import {
  ChevronLeft, ChevronRight, Clock,
  Check, X, Clock3, Zap, AlertCircle, Download, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Employee, EmployeeAttendanceRow } from "../hooks/useEmployeeReport";
import { MetricCard }          from "./MetricCard";
import { WorkHoursLineChart }  from "./WorkHoursLineChart";
import { StatusBarChart }      from "./StatusBarChart";
import { GeotagEvidencePanel } from "./GeotagEvidencePanel";

export interface EmployeeHistoryViewProps {
  employee:     Employee;
  logs:         EmployeeAttendanceRow[];
  from:         string;
  to:           string;
  /** True only on re-fetches (date change) — previous logs remain visible */
  refreshing:   boolean;
  onBack:       () => void;
  onFromChange: (v: string) => void;
  onToChange:   (v: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fmtDate(dateStr: string, pattern: string) {
  return format(parseLocal(dateStr), pattern);
}

function fmtTime(t: string | null): string {
  if (!t) return "—";
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")}${h >= 12 ? "pm" : "am"}`;
}

function minsToHM(mins: number): string {
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  return `${h}h ${m}m`;
}

const PRESENT_STATUSES = new Set(["Present", "On Time", "Late"]);
const NEUTRAL_STATUSES = new Set(["Rest Day", "Holiday"]);
const PAGE_SIZE = 10;

const TABLE_COLS = [
  "Date", "Schedule", "Time In", "Lunch Start", "Lunch End",
  "Break Start", "Break End", "Time Out", "Late", "Overtime",
  "Punctuality", "Status", "Geotag",
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (PRESENT_STATUSES.has(status))
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border border-green-500 text-green-600 bg-green-50">Present</span>;
  if (status === "Rest Day")
    return <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">Rest Day</span>;
  if (status === "Holiday" || status === "Leave")
    return <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200">{status}</span>;
  if (status === "Incomplete")
    return <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-300">Incomplete</span>;
  return <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200">{status || "Absent"}</span>;
}

function Avatar({ name, image }: { name: string; image: string | null }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  if (image) return (
    <div className="relative w-10 h-10 shrink-0">
      <Image src={image} alt={name} fill className="rounded-full object-cover" />
    </div>
  );
  return (
    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold select-none shrink-0">
      {initials}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EmployeeHistoryView({
  employee, logs, from, to, refreshing,
  onBack, onFromChange, onToChange,
}: EmployeeHistoryViewProps) {
  const [page,         setPage]         = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [showRestDay,  setShowRestDay]  = useState(true);
  const [expandedLog,  setExpandedLog]  = useState<number | null>(null);
  const [geotagIds,    setGeotagIds]    = useState<Set<number>>(new Set());

  // ── Geotag check ──────────────────────────────────────────────────────────
  useEffect(() => {
    const directusIds = logs
      .map((l) => l.directus_id)
      .filter((id): id is number => id !== null && id > 0);

    if (directusIds.length === 0) {
      setGeotagIds(new Set());
      return;
    }

    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(
          `/api/hrm/workforce/attendance-report/employee-report/geotag/check?logIds=${directusIds.join(",")}`,
        );
        if (!res.ok) throw new Error(`Geotag check failed: ${res.status}`);
        const data = await res.json() as { logIdsWithGeotag?: number[] };
        if (!cancelled) setGeotagIds(new Set(data.logIdsWithGeotag ?? []));
      } catch (err) {
        console.error("Geotag check error:", err);
        if (!cancelled) setGeotagIds(new Set());
      }
    };
    check();
    return () => { cancelled = true; };
  }, [logs]);

  // ── Derived state ─────────────────────────────────────────────────────────

  const summary = useMemo(() => ({
    attended: logs.filter((l) => PRESENT_STATUSES.has(l.status)).length,
    absent:   logs.filter((l) => l.status === "Absent").length,
    workMins: logs.reduce((s, l) => s + (l.work_hours || 0), 0),
    otMins:   logs.reduce((s, l) => s + (l.overtime   || 0), 0),
    lateMins: logs.reduce((s, l) => s + (l.late       || 0), 0),
  }), [logs]);

  const statusOptions = useMemo(() =>
    ["All", ...Array.from(new Set(logs.map((l) => l.status))).sort()],
  [logs]);

  const visibleLogs = useMemo(() => logs.filter((l) => {
    if (!showRestDay && NEUTRAL_STATUSES.has(l.status)) return false;
    if (statusFilter !== "All" && l.status !== statusFilter) return false;
    return true;
  }), [logs, showRestDay, statusFilter]);

  const totalPages    = Math.max(1, Math.ceil(visibleLogs.length / PAGE_SIZE));
  const safePage      = Math.min(page, totalPages);
  const start         = (safePage - 1) * PAGE_SIZE;
  const sortedLogs    = [...visibleLogs].sort((a, b) =>
    new Date(b.log_date).getTime() - new Date(a.log_date).getTime()
  );
  const paginatedLogs = sortedLogs.slice(start, start + PAGE_SIZE);

  const schedule = employee.work_start && employee.work_end
    ? `${fmtTime(employee.work_start)} - ${fmtTime(employee.work_end)}`
    : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onBack}
          className="flex items-center gap-1 px-3 py-1.5 text-xs border border-border rounded-md hover:bg-accent transition-colors"
        >
          ← Back
        </button>
        <h1 className="text-sm font-bold">Attendance History</h1>

        {/* Subtle refreshing indicator — shown inline, does NOT clear the table */}
        {refreshing && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            Updating…
          </span>
        )}

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-md px-3 py-1.5">
            <Clock className="w-3.5 h-3.5" />
            {fmtDate(from, "MMM d, yyyy")} — {fmtDate(to, "MMM d, yyyy")}
          </div>
          <Button
            variant="outline" size="sm"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs"
            onClick={async () => {
              const { exportEmployeeHistoryToPDF } = await import("../utils/exportEmployeePDF");
              exportEmployeeHistoryToPDF(employee, sortedLogs, from, to);
            }}
          >
            <Download className="h-3.5 w-3.5" /> Export PDF
          </Button>
        </div>
      </div>

      {/* Employee card */}
      <div className="border border-border rounded-lg px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Avatar name={`${employee.user_fname} ${employee.user_lname}`} image={employee.user_image} />
          <div>
            <div className="font-bold text-sm">{employee.user_fname} {employee.user_lname}</div>
            <div className="text-xs text-muted-foreground">{employee.user_position}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-bold text-sm">{employee.department_name}</div>
          {schedule && <div className="text-xs text-muted-foreground">Schedule: {schedule}</div>}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">From</label>
          <input
            type="date" value={from}
            onChange={(e) => { onFromChange(e.target.value); setPage(1); }}
            className="border border-border rounded-md px-2.5 py-1.5 text-xs bg-background"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">To</label>
          <input
            type="date" value={to}
            onChange={(e) => { onToChange(e.target.value); setPage(1); }}
            className="border border-border rounded-md px-2.5 py-1.5 text-xs bg-background"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="border border-border rounded-md px-2.5 py-1.5 text-xs bg-background"
          >
            {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none mb-1">
          <input
            type="checkbox" checked={showRestDay}
            onChange={(e) => { setShowRestDay(e.target.checked); setPage(1); }}
            className="w-3.5 h-3.5 accent-blue-600"
          />
          Show Rest Day
        </label>
      </div>

      {/* Metric cards — always visible, update smoothly when new data arrives */}
      <div className={`grid grid-cols-2 md:grid-cols-5 gap-4 transition-opacity duration-300 ${refreshing ? "opacity-60" : "opacity-100"}`}>
        <MetricCard title="Attended"   value={summary.attended}           sub={`${summary.attended} days`} icon={<Check       className="h-5 w-5" />} />
        <MetricCard title="Absent"     value={summary.absent}             sub={`${summary.absent} days`}   icon={<X           className="h-5 w-5" />} />
        <MetricCard title="Work Hours" value={minsToHM(summary.workMins)} sub={`${summary.workMins}m`}     icon={<Clock3      className="h-5 w-5" />} />
        <MetricCard title="Overtime"   value={minsToHM(summary.otMins)}   sub={`${summary.otMins}m`}       icon={<Zap         className="h-5 w-5" />} />
        <MetricCard title="Late"       value={minsToHM(summary.lateMins)} sub={`${summary.lateMins}m`}     icon={<AlertCircle className="h-5 w-5" />} />
      </div>

      {/* Charts — fade during refresh instead of disappearing */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity duration-300 ${refreshing ? "opacity-60" : "opacity-100"}`}>
        <div className="border border-border rounded-lg p-4">
          <div className="text-xs font-semibold mb-3">Work Hours Trend</div>
          <WorkHoursLineChart logs={logs} />
        </div>
        <div className="border border-border rounded-lg p-4">
          <div className="text-xs font-semibold mb-3">Attendance Breakdown</div>
          <StatusBarChart logs={logs} />
        </div>
      </div>

      {/* Table — stays visible during refresh, subtle opacity shift */}
      <div className={`rounded-xl border border-border overflow-hidden bg-background transition-opacity duration-300 ${refreshing ? "opacity-60" : "opacity-100"}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border">
                {TABLE_COLS.map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedLogs.map((log) => {
                const directusId = log.directus_id ?? null;
                const isExpanded = directusId !== null && expandedLog === directusId;
                const hasGeotag  =
                  directusId !== null &&
                  geotagIds.has(directusId) &&
                  PRESENT_STATUSES.has(log.status);

                return (
                  <React.Fragment key={log.log_date}>
                    <tr className={`border-b border-border transition-colors ${isExpanded ? "bg-muted/40" : "hover:bg-muted/30"}`}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold">{fmtDate(log.log_date, "MMM d, yyyy")}</div>
                        <div className="text-[11px] text-muted-foreground">{fmtDate(log.log_date, "EEEE")}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {!NEUTRAL_STATUSES.has(log.status) ? (schedule ?? "—") : "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-bold">
                        {log.time_in ? fmtTime(log.time_in) : "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{fmtTime(log.lunch_start)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{fmtTime(log.lunch_end)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{fmtTime(log.break_start)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{fmtTime(log.break_end)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {log.time_out ? fmtTime(log.time_out) : "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-red-600">
                        {log.late > 0 ? minsToHM(log.late) : "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-blue-600">
                        {log.overtime > 0 ? minsToHM(log.overtime) : "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-semibold">
                        {PRESENT_STATUSES.has(log.status)
                          ? (log.late > 0 ? "Late" : "On Time")
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={log.status} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {hasGeotag ? (
                          <button
                            onClick={() => setExpandedLog(isExpanded ? null : directusId)}
                            className="text-xs px-2.5 py-1 rounded border border-border hover:bg-accent transition-colors"
                          >
                            {isExpanded ? "Hide" : "View"}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>

                    {isExpanded && directusId !== null && (
                      <tr key={`${log.log_date}-geo`}>
                        <td colSpan={13} className="p-0 border-b border-border">
                          <GeotagEvidencePanel logId={directusId} logDate={log.log_date} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Page {safePage} / {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
