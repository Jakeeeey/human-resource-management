// employee-report/components/EmployeeHistoryView.tsx
"use client";

import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Clock, Check, X, Clock3, Zap, AlertCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportAttendancePDF } from "../../todays-report/utils/exportAttendancePDF";
import type { Employee, EmployeeAttendanceRow } from "../hooks/useEmployeeReport";
import { MetricCard }          from "./MetricCard";
import { WorkHoursLineChart }  from "./WorkHoursLineChart";
import { StatusBarChart }      from "./StatusBarChart";
import { GeotagEvidencePanel } from "./GeotagEvidencePanel";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmployeeHistoryViewProps {
  employee:     Employee;
  logs:         EmployeeAttendanceRow[];
  from:         string;
  to:           string;
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

const QUICK_FILTERS = [
  { label: "This Week",     days: 7  },
  { label: "Last 2 Weeks",  days: 14 },
  { label: "This Month",    days: 30 },
  { label: "Last 3 Months", days: 90 },
];

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (PRESENT_STATUSES.has(status))
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border border-green-500 text-green-600 bg-green-50">Present</span>;
  if (status === "Rest Day")
    return <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">Rest Day</span>;
  if (status === "Holiday")
    return <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200">Holiday</span>;
  if (status === "Leave")
    return <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200">Leave</span>;
  if (status === "Incomplete")
    return <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-300">Incomplete</span>;
  return <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200">{status || "Absent"}</span>;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, image }: { name: string; image: string | null }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  if (image) return <img src={image} alt={name} className="w-10 h-10 rounded-full object-cover shrink-0" />;
  return (
    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold select-none shrink-0">
      {initials}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EmployeeHistoryView({
  employee, logs, from, to, onBack, onFromChange, onToChange,
}: EmployeeHistoryViewProps) {
  const [page, setPage] = useState(1);
  const [quickFilter,  setQuickFilter]  = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showRestDay,  setShowRestDay]  = useState(true);
  // Use log_date as key — always unique per employee/range, avoids -1 duplicate-key bug
  const [expandedLog,  setExpandedLog]  = useState<number | null>(null);
  const [logsWithGeotag, setLogsWithGeotag] = useState<Set<number>>(new Set());

  // Fetch which logs have geotag data
  React.useEffect(() => {
    const fetchGeotagInfo = async () => {
      const validLogIds = logs
        .filter((l) => l.log_id && l.log_id > 0)
        .map((l) => String(l.log_id));
      
      if (validLogIds.length === 0) {
        setLogsWithGeotag(new Set());
        return;
      }

      try {
        const res = await fetch(`/api/hrm/attendance-report/employee-report/geotag/check?logIds=${validLogIds.join(',')}`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        setLogsWithGeotag(new Set(data.logIdsWithGeotag || []));
      } catch (err) {
        console.error('Error fetching geotag info:', err);
        setLogsWithGeotag(new Set());
      }
    };
    
    fetchGeotagInfo();
  }, [logs]);

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

  const totalPages = Math.max(1, Math.ceil(visibleLogs.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const start      = (safePage - 1) * PAGE_SIZE;
  // Sort in descending order by log_date (most recent first)
  const sortedAndPaginated = [...visibleLogs].sort((a, b) => 
    new Date(b.log_date).getTime() - new Date(a.log_date).getTime()
  );
  const paginatedLogs = sortedAndPaginated.slice(start, start + PAGE_SIZE);

  // Reset to page 1 when filters change
  if (page > totalPages && totalPages > 0) setPage(1);

  function applyQuick(days: number, label: string) {
    setQuickFilter(label);
    const t = new Date();
    const f = new Date(t);
    f.setDate(t.getDate() - (days - 1));
    onToChange(format(t, "yyyy-MM-dd"));
    onFromChange(format(f, "yyyy-MM-dd"));
  }

  const schedule = employee.work_start && employee.work_end
    ? `${fmtTime(employee.work_start)} - ${fmtTime(employee.work_end)}`
    : null;

  const TABLE_COLS = [
    "Date", "Schedule", "Time In", "Lunch Start", "Lunch End",
    "Break Start", "Break End", "Time Out", "Late", "Overtime", "Punctuality", "Status", "Geotag",
  ];

  return (
    <div className="space-y-4">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onBack}
          className="flex items-center gap-1 px-3 py-1.5 text-xs border border-border rounded-md hover:bg-accent transition-colors"
        >
          ← Back
        </button>
        <h1 className="text-sm font-bold">Attendance History</h1>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-md px-3 py-1.5">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {fmtDate(from, "MMM d, yyyy")} — {fmtDate(to, "MMM d, yyyy")}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs"
            onClick={async () => {
              // Export only the currently visible (filtered, sorted, paginated) logs, with all columns matching the table
              const exportRows = sortedAndPaginated.slice(start, start + PAGE_SIZE);
              // Map to export format with all columns
              const exportData = exportRows.map((log) => ({
                date: fmtDate(log.log_date, "MMM d, yyyy"),
                day: fmtDate(log.log_date, "EEEE"),
                schedule: (!NEUTRAL_STATUSES.has(log.status) && employee.work_start && employee.work_end)
                  ? `${fmtTime(employee.work_start)} - ${fmtTime(employee.work_end)}`
                  : "—",
                time_in: log.time_in ? fmtTime(log.time_in) : "—",
                lunch_start: log.lunch_start ? fmtTime(log.lunch_start) : "—",
                lunch_end: log.lunch_end ? fmtTime(log.lunch_end) : "—",
                break_start: log.break_start ? fmtTime(log.break_start) : "—",
                break_end: log.break_end ? fmtTime(log.break_end) : "—",
                time_out: log.time_out ? fmtTime(log.time_out) : "—",
                late: log.late > 0 ? minsToHM(log.late) : "—",
                overtime: log.overtime > 0 ? minsToHM(log.overtime) : "—",
                punctuality:
                  log.status === "On Time" || log.status === "Present" ? "On Time"
                  : log.status === "Late" ? `Late${log.late ? ` (${minsToHM(log.late)})` : ""}`
                  : "—",
                status: log.status,
                geotag: (log.log_id && logsWithGeotag.has(log.log_id) && PRESENT_STATUSES.has(log.status)) ? "Yes" : "—",
              }));
              // Dynamically import the PDF export utility and call with the correct arguments
              const { exportEmployeeHistoryToPDF } = await import("../utils/exportEmployeePDF");
              // Export the filtered, sorted, paginated logs for this employee and date range
              exportEmployeeHistoryToPDF(employee, exportRows, from, to);
            }}
          >
            <Download className="h-3.5 w-3.5" /> Export PDF
          </Button>
        </div>
      </div>

      {/* ── Employee card ────────────────────────────────────────────────────── */}
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
          {schedule              && <div className="text-xs text-muted-foreground">Schedule: {schedule}</div>}
          {employee.workdays_note && <div className="text-xs text-muted-foreground">Workdays: {employee.workdays_note}</div>}
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">From</label>
          <input type="date" value={from}
            onChange={(e) => { onFromChange(e.target.value); setQuickFilter(""); }}
            className="border border-border rounded-md px-2.5 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">To</label>
          <input type="date" value={to}
            onChange={(e) => { onToChange(e.target.value); setQuickFilter(""); }}
            className="border border-border rounded-md px-2.5 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Quick Filter</label>
          <select value={quickFilter}
            onChange={(e) => {
              const f = QUICK_FILTERS.find((x) => x.label === e.target.value);
              if (f) applyQuick(f.days, f.label); else setQuickFilter("");
            }}
            className="border border-border rounded-md px-2.5 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">— Select —</option>
            {QUICK_FILTERS.map((f) => <option key={f.label} value={f.label}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-border rounded-md px-2.5 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-ring">
            {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none mb-1">
          <input type="checkbox" checked={showRestDay} onChange={(e) => setShowRestDay(e.target.checked)}
            className="w-3.5 h-3.5 accent-blue-600" />
          Show Rest Day
        </label>
      </div>

      {/* ── Metric cards — MetricCard component ─────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard
          title="Attended"
          value={summary.attended}
          sub={`${summary.attended} day${summary.attended !== 1 ? "s" : ""}`}
          icon={<Check className="h-5 w-5" />}
        />
        <MetricCard
          title="Absent"
          value={summary.absent}
          sub={`${summary.absent} day${summary.absent !== 1 ? "s" : ""}`}
          icon={<X className="h-5 w-5" />}
        />
        <MetricCard
          title="Work Hours"
          value={minsToHM(summary.workMins)}
          sub={`${summary.workMins} minutes`}
          icon={<Clock3 className="h-5 w-5" />}
        />
        <MetricCard
          title="Overtime"
          value={minsToHM(summary.otMins)}
          sub={`${summary.otMins} minutes`}
          icon={<Zap className="h-5 w-5" />}
        />
        <MetricCard
          title="Late"
          value={minsToHM(summary.lateMins)}
          sub={`${summary.lateMins} minutes`}
          icon={<AlertCircle className="h-5 w-5" />}
        />
      </div>

      {/* ── Charts — WorkHoursLineChart + StatusBarChart components ─────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-border rounded-lg p-4">
          <div className="text-xs font-semibold mb-3">Work Hours Trend</div>
          <WorkHoursLineChart logs={logs} />
        </div>
        <div className="border border-border rounded-lg p-4">
          <div className="text-xs font-semibold mb-3">Attendance Breakdown</div>
          <StatusBarChart logs={logs} />
        </div>
      </div>

      {/* ── Time Logs table ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border overflow-hidden bg-background">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-xs font-bold uppercase tracking-wide">Time Logs</span>
          <span className="text-xs text-muted-foreground">
            {visibleLogs.length} record{visibleLogs.length !== 1 ? "s" : ""} of {logs.length}
          </span>
        </div>

        {visibleLogs.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-10">
            No records match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border">
                  {TABLE_COLS.map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map((log) => {
                  const rowKey     = log.log_date; // always unique — fixes duplicate-key -1 bug
                  const geotagKey  = log.log_id && log.log_id > 0 ? log.log_id : null; // For geotag tracking
                  const isNeutral  = NEUTRAL_STATUSES.has(log.status);
                  const isExpanded = expandedLog === geotagKey;
                  const hasGeotag  = geotagKey !== null && logsWithGeotag.has(geotagKey) && PRESENT_STATUSES.has(log.status);
                  const schedStr   = !isNeutral && employee.work_start && employee.work_end
                    ? `${fmtTime(employee.work_start)} - ${fmtTime(employee.work_end)}`
                    : "—";
                  const punctuality =
                    log.status === "On Time" || log.status === "Present" ? "On Time"
                    : log.status === "Late" ? "Late"
                    : null;

                  return (
                    <React.Fragment key={rowKey}>
                      <tr
                        className={[
                          "border-b border-border transition-colors",
                          isNeutral  ? "text-muted-foreground" : "hover:bg-muted/30",
                          isExpanded ? "bg-muted/40" : "",
                        ].join(" ")}
                      >
                        {/* Date */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-semibold">{fmtDate(log.log_date, "MMM d, yyyy")}</div>
                          <div className="text-[11px] text-muted-foreground">{fmtDate(log.log_date, "EEEE")}</div>
                        </td>

                        {/* Schedule */}
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{schedStr}</td>

                        {/* Time In — bold when punched */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {log.time_in
                            ? <span className="font-bold">{fmtTime(log.time_in)}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">{log.lunch_start ? fmtTime(log.lunch_start) : <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{log.lunch_end   ? fmtTime(log.lunch_end)   : <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{log.break_start ? fmtTime(log.break_start) : <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{log.break_end   ? fmtTime(log.break_end)   : <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{log.time_out    ? fmtTime(log.time_out)    : <span className="text-muted-foreground">—</span>}</td>

                        {/* Late */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {log.late > 0 ? <span className="font-semibold text-red-600">{minsToHM(log.late)}</span> : <span className="text-muted-foreground">—</span>}
                        </td>

                        {/* Overtime */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {log.overtime > 0 ? <span className="font-semibold text-blue-600">{minsToHM(log.overtime)}</span> : <span className="text-muted-foreground">—</span>}
                        </td>

                        {/* Punctuality */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {punctuality === "On Time" && <span className="text-green-600 font-semibold">On Time</span>}
                          {punctuality === "Late"    && <span className="text-red-500 font-semibold">Late{log.late ? ` (${minsToHM(log.late)})` : ""}</span>}
                          {!punctuality             && <span className="text-muted-foreground">—</span>}
                        </td>

                        <td className="px-4 py-3"><StatusBadge status={log.status} /></td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          {hasGeotag ? (
                            <button
                              onClick={() => setExpandedLog(isExpanded ? null : geotagKey)}
                              className="text-xs px-2.5 py-1 rounded border border-border hover:bg-accent transition-colors"
                            >
                              {isExpanded ? "Hide" : "View"}
                            </button>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>

                      {/* GeotagEvidencePanel component */}
                      {isExpanded && geotagKey && (
                        <tr key={`${geotagKey}-geo`}>
                          <td colSpan={13} className="p-0 border-b border-border">
                            <GeotagEvidencePanel
                              logId={geotagKey}
                              logDate={log.log_date}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        {visibleLogs.length > 0 && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-4 flex-wrap bg-muted/20">
            <span className="text-xs text-muted-foreground">
              Showing{" "}
              <span className="font-semibold text-foreground">{visibleLogs.length === 0 ? 0 : start + 1}</span>
              {" "}–{" "}
              <span className="font-semibold text-foreground">{Math.min(start + PAGE_SIZE, visibleLogs.length)}</span>
              {" "}of{" "}
              <span className="font-semibold text-foreground">{visibleLogs.length}</span> records
            </span>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1 mr-3">
                <Clock className="h-3 w-3" />
                {new Date().toLocaleTimeString("en-PH")}
              </span>
              <Button
                variant="outline" size="sm" className="h-7 w-7 p-0"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs font-medium text-foreground min-w-[60px] text-center">
                Page {safePage} / {totalPages}
              </span>
              <Button
                variant="outline" size="sm" className="h-7 w-7 p-0"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}