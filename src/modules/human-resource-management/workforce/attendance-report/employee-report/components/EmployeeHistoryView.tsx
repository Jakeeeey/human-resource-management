// employee-report/components/EmployeeHistoryView.tsx
"use client";
import { useState, useMemo, useEffect, Fragment } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Calendar, Printer, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { useEmployeeAttendance } from "../hooks/useEmployeeReport";
import { PdfEngine } from "@/components/pdf-layout-design/PdfEngine";
import { pdfTemplateService } from "@/components/pdf-layout-design/services/pdf-template";
import autoTable from "jspdf-autotable";
import { WorkHoursLineChart }    from "./WorkHoursLineChart";
import { StatusBarChart }        from "./StatusBarChart";
import { GeotagEvidencePanel }   from "./GeotagEvidencePanel";
import { formatTime, minsToHM, getInitials } from "../utils";
import type { Employee, EmployeeAttendanceRow } from "../hooks/useEmployeeReport";


const STANDARD_SHIFT  = 480; // 8h in mins
const SHIFT_END_HOUR  = 17;  // 5:00pm
const SHIFT_END_MIN   = 30;  // :30 → shift ends at 5:30pm

/**
 * Work hours = time_out - time_in - lunch deduction.
 * Lunch: if punched, deduct actual; if not punched, deduct default 60m.
 * Falls back to DB work_hours if punches are missing.
 */
function getDisplayWorkMins(l: EmployeeAttendanceRow): number {
  if (!l.time_in || !l.time_out) return Math.max(0, l.work_hours);
  const inDate  = new Date(`${l.log_date}T${l.time_in}`);
  let outDate   = new Date(`${l.log_date}T${l.time_out}`);
  // Handle midnight crossover (e.g. time_out = 01:02am next day)
  if (outDate <= inDate) outDate.setDate(outDate.getDate() + 1);
  const rawMins = (outDate.getTime() - inDate.getTime()) / 60000;
  
  // Deduct lunch: if punched, use actual; if not punched, use default 60m
  let lunchDeduct = 0;
  if (l.lunch_start && l.lunch_end) {
    const lunchStart = new Date(`${l.log_date}T${l.lunch_start}`);
    const lunchEnd = new Date(`${l.log_date}T${l.lunch_end}`);
    lunchDeduct = (lunchEnd.getTime() - lunchStart.getTime()) / 60000;
  } else {
    lunchDeduct = 60;  // Default lunch duration
  }
  
  return Math.max(0, rawMins - lunchDeduct);
}

/**
 * OT = work mins beyond 5:30pm shift end.
 * Calculated from time_out directly, not from work_hours.
 */
function getDisplayOvertimeMins(l: EmployeeAttendanceRow): number {
  if (!l.time_out) return 0;
  let outDate = new Date(`${l.log_date}T${l.time_out}`);
  const shiftEnd = new Date(`${l.log_date}T${String(SHIFT_END_HOUR).padStart(2,"0")}:${String(SHIFT_END_MIN).padStart(2,"0")}:00`);
  // Handle midnight crossover
  if (outDate <= new Date(`${l.log_date}T${l.time_in ?? "00:00:00"}`)) {
    outDate.setDate(outDate.getDate() + 1);
  }
  return Math.max(0, (outDate.getTime() - shiftEnd.getTime()) / 60000);
}

const PAGE_SIZE = 10;

const DOUBLE_RESTDAY_DEPTS: string[] = [
  "technical support-afternoon shift",
  "hr department",
  "development-ojt",
  "techsupport-ojt",
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getDefaultRange(): { from: string; to: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const to = new Date(today);
  to.setDate(to.getDate() - 1);
  const from = new Date(to);
  from.setDate(from.getDate() - 6);
  return { from: toYMD(from), to: toYMD(to) };
}

function formatDisplayDate(ymd: string): string {
  const d = new Date(ymd + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isRestDay(date: string, departmentName: string): boolean {
  const day  = new Date(date + "T00:00:00").getDay();
  const dept = (departmentName ?? "").toLowerCase().trim().replace(/\s*-\s*/g, "-");
  if (DOUBLE_RESTDAY_DEPTS.includes(dept)) return day === 0 || day === 6;
  return day === 0;
}

function fillRestDays(
  logs: EmployeeAttendanceRow[],
  from: string,
  to: string,
  departmentName: string,
): EmployeeAttendanceRow[] {
  if (!from || !to) return logs;
  const existingDates = new Set(logs.map((l) => l.log_date));
  const synthetic: EmployeeAttendanceRow[] = [];
  const cursor = new Date(from + "T00:00:00");
  const end    = new Date(to   + "T00:00:00");
  while (cursor <= end) {
    const dateStr = toYMD(cursor);
    if (!existingDates.has(dateStr) && isRestDay(dateStr, departmentName)) {
      synthetic.push({
        log_id:          -1,
        log_date:        dateStr,
        time_in:         null,
        time_out:        null,
        lunch_start:     null,
        lunch_end:       null,
        break_start:     null,
        break_end:       null,
        work_hours:      0,
        overtime:        0,
        late:            0,
        undertime:       0,
        status:          "Rest Day",
        approval_status: "",
        is_rest_day:     true,
        is_oncall:       false,
        ...({}),
      } as unknown as EmployeeAttendanceRow);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return [...logs, ...synthetic].sort((a, b) => b.log_date.localeCompare(a.log_date));
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "Present":
    case "On Time":    return "border-emerald-500 text-emerald-600 bg-emerald-50";
    case "Late":       return "border-orange-400 text-orange-500 bg-orange-50";
    case "Absent":     return "border-red-400 text-red-500 bg-red-50";
    case "Half Day":   return "border-yellow-400 text-yellow-600 bg-yellow-50";
    case "Rest Day":   return "border-slate-300 text-slate-500 bg-slate-50";
    case "Leave":      return "border-blue-400 text-blue-500 bg-blue-50";
    case "Holiday":    return "border-purple-400 text-purple-500 bg-purple-50";
    case "Incomplete": return "border-amber-400 text-amber-600 bg-amber-50";
    default:           return "border-border text-muted-foreground";
  }
}

function formatScheduleTime(t: string): string {
  const [hStr, mStr] = t.slice(0, 5).split(":");
  const h      = parseInt(hStr, 10);
  const period = h >= 12 ? "pm" : "am";
  const hour   = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${mStr}${period}`;
}

function formatSchedule(start: string, end: string): string {
  return `${formatScheduleTime(start)} - ${formatScheduleTime(end)}`;
}

const QUICK_FILTERS = [
  { label: "— Select —",   value: "" },
  { label: "Yesterday",    value: "yesterday" },
  { label: "Last 7 Days",  value: "7" },
  { label: "Last 14 Days", value: "14" },
  { label: "Last 30 Days", value: "30" },
  { label: "This Month",   value: "thisMonth" },
  { label: "Last Month",   value: "lastMonth" },
];

// ── PDF Export Helpers ──────────────────────────────────────────────────────────

async function fetchCompanyData() {
  try {
    const res = await fetch('/api/pdf/company', { credentials: 'include' });
    if (!res.ok) return null;
    const result = await res.json();
    const company = result.data?.[0] || (Array.isArray(result.data) ? null : result.data);
    return company ?? null;
  } catch (error) {
    console.error('Error fetching company data:', error);
    return null;
  }
}

function formatDateForPDF(ymd: string): string {
  const d = new Date(ymd + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function handleExportEmployeePDF(
  employee: Employee,
  logs: EmployeeAttendanceRow[],
  fromDate: string,
  toDate: string,
  daysAttended: number,
  daysAbsent: number,
  totalWorkMins: number,
  totalOvertMin: number,
  totalLateMins: number
) {
  // Match UI table columns: Date, Time In, Lunch Start, Lunch End, Break Start, Break End, Time Out, Work Hours, Overtime, Late, Undertime, Status
  const tableData = logs.slice(0, 50).map((l) => [
    formatDateForPDF(l.log_date),
    formatTime(l.time_in),
    formatTime(l.lunch_start),
    formatTime(l.lunch_end),
    formatTime(l.break_start),
    formatTime(l.break_end),
    formatTime(l.time_out),
    minsToHM(getDisplayWorkMins(l)),
    minsToHM(getDisplayOvertimeMins(l)),
    minsToHM(l.late),
    l.undertime > 0 ? minsToHM(l.undertime) : '—',
    l.status,
  ]);

  const fileName = `${employee.user_fname}_${employee.user_lname}_Attendance_${fromDate}_to_${toDate}.pdf`;

  try {
    const [companyData, templates] = await Promise.all([
      fetchCompanyData(),
      pdfTemplateService.fetchTemplates(),
    ]);

    const templateName = templates.find(t => t.name === 'Header')?.name || 
                        templates.find(t => t.name.includes('Letter'))?.name ||
                        templates[0]?.name || 
                        'Employee Attendance Report';

    const doc = await PdfEngine.generateWithFrame(
      templateName,
      companyData,
      (doc, startY, config) => {
        const margins = config.margins || { top: 10, bottom: 10, left: 10, right: 10 };

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`${employee.user_fname} ${employee.user_lname}`, margins.left, startY, { baseline: 'top' });

        // Add space below header line
        const headerLineY = startY + 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(
          `${employee.user_position} | ${employee.department_name}`,
          margins.left,
          headerLineY
        );
        doc.setTextColor(0, 0, 0);

        doc.setFontSize(9);
        doc.text(
          `Period: ${formatDateForPDF(fromDate)} to ${formatDateForPDF(toDate)}`,
          margins.left,
          headerLineY + 6
        );

        const summaryY = headerLineY + 12;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        const summaryText = `Days Attended: ${daysAttended} | Days Absent: ${daysAbsent} | Work: ${minsToHM(totalWorkMins)} | OT: ${minsToHM(totalOvertMin)} | Late: ${minsToHM(totalLateMins)}`;
        doc.text(summaryText, margins.left, summaryY);

        autoTable(doc, {
          startY: summaryY + 4,
          head: [['Date', 'Time In', 'Lunch Start', 'Lunch End', 'Break Start', 'Break End', 'Time Out', 'Work Hours', 'Overtime', 'Late', 'Undertime', 'Status']],
          body: tableData,
          margin: margins,
          theme: 'striped',
          tableWidth: 'auto',
          headStyles: {
            fillColor: [41, 128, 185],
            textColor: 255,
            fontSize: 8,
            fontStyle: 'bold',
            halign: 'center',
          },
          bodyStyles: { fontSize: 7.5, valign: 'middle' },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          // No fixed columnStyles: let autoTable expand to fill width
        });
      }
    );

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error generating PDF:', error);
  }
}

// ── Print via new window ───────────────────────────────────────────────────────

function buildPrintHTML(
  employee: Employee,
  logs: EmployeeAttendanceRow[],
  from: string,
  to: string,
  statusFilter: string,
  showRestDay: boolean,
  metrics: {
    daysAttended: number;
    daysAbsent: number;
    totalWorkMins: number;
    totalOvertMin: number;
    totalLateMins: number;
  },
): string {
  const ft = (v: string | null | undefined) => v ?? "-";

  const rows = logs.map((l) => {
    const dispWork = getDisplayWorkMins(l);
    const dispOT   = getDisplayOvertimeMins(l);
    const date = new Date(l.log_date + "T00:00:00").toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
    return `
      <tr>
        <td>${date}</td>
        <td>${ft(formatTime(l.time_in))}</td>
        <td>${ft(formatTime(l.lunch_start))}</td>
        <td>${ft(formatTime(l.lunch_end))}</td>
        <td>${ft(formatTime(l.break_start))}</td>
        <td>${ft(formatTime(l.break_end))}</td>
        <td>${ft(formatTime(l.time_out))}</td>
        <td>${dispWork > 0 ? minsToHM(dispWork) : "-"}</td>
        <td>${dispOT  > 0 ? minsToHM(dispOT)   : "-"}</td>
        <td>${minsToHM(l.late)}</td>
        <td>${l.undertime > 0 ? minsToHM(l.undertime) : "-"}</td>
        <td>${l.status}</td>
        <td>—</td>
      </tr>`;
  }).join("");

  const schedule = employee.work_start && employee.work_end
    ? formatSchedule(employee.work_start, employee.work_end)
    : "—";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Attendance - ${employee.user_fname} ${employee.user_lname}</title>
  <style>
    @page { size: A4 portrait; margin: 16mm 14mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; background: white; }

    .header { margin-bottom: 12px; }
    .header h1 { font-size: 18px; font-weight: bold; margin-bottom: 2px; }
    .header h2 { font-size: 13px; font-weight: bold; margin-bottom: 5px; }
    .header p  { font-size: 10px; color: #555; }

    .filters-used {
      font-size: 10px; color: #444; margin-bottom: 10px;
      padding: 6px 10px; border: 1px solid #ddd;
      border-radius: 4px; background: #f9f9f9;
    }
    .filters-used span { margin-right: 16px; }
    .filters-used strong { font-weight: bold; }

    .metrics {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 6px; margin-bottom: 12px;
    }
    .metric-box {
      border: 1px solid #ccc; border-radius: 5px;
      padding: 7px 10px; font-size: 11px;
    }
    .metric-box strong { font-weight: bold; }

    table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
    thead tr { background: #f0f0f0; }
    th { border: 1px solid #ccc; padding: 5px; text-align: left; font-weight: bold; }
    td { border: 1px solid #ddd; padding: 4px 5px; vertical-align: middle; }
    tr:nth-child(even) td { background: #fafafa; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Employee Attendance</h1>
    <h2>${employee.user_fname} ${employee.user_lname} — ${employee.user_position}</h2>
    <p>
      Department: ${employee.department_name} &nbsp;·&nbsp;
      Schedule: ${schedule} &nbsp;·&nbsp;
      ${employee.workdays_note ? `Workdays: ${employee.workdays_note} &nbsp;·&nbsp;` : ""}
      Range: ${formatDisplayDate(from)} — ${formatDisplayDate(to)}
    </p>
  </div>
  <div class="filters-used">
    <span><strong>Date Range:</strong> ${formatDisplayDate(from)} — ${formatDisplayDate(to)}</span>
    <span><strong>Status Filter:</strong> ${statusFilter}</span>
    <span><strong>Show Rest Day:</strong> ${showRestDay ? "Yes" : "No"}</span>
    <span><strong>Total Records:</strong> ${logs.length}</span>
  </div>
  <div class="metrics">
    <div class="metric-box"><strong>Days Attended:</strong> ${metrics.daysAttended}</div>
    <div class="metric-box"><strong>Days Absent:</strong> ${metrics.daysAbsent}</div>
    <div class="metric-box"><strong>Total Work Hours:</strong> ${minsToHM(metrics.totalWorkMins)}</div>
    <div class="metric-box"><strong>Total Overtime (hrs):</strong> ${minsToHM(metrics.totalOvertMin)}</div>
    <div class="metric-box"><strong>Total Late (hrs):</strong> ${minsToHM(metrics.totalLateMins)}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th><th>Time In</th><th>Lunch Start</th><th>Lunch End</th>
        <th>Break Start</th><th>Break End</th><th>Time Out</th>
        <th>Work Hours</th><th>Overtime</th><th>Late</th>
        <th>Undertime</th><th>Status</th><th>Geotag</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props { employee: Employee; onBack: () => void }

export function EmployeeHistoryView({ employee, onBack }: Props) {
  const defaultRange = getDefaultRange();
  const [from,          setFrom]          = useState(defaultRange.from);
  const [to,            setTo]            = useState(defaultRange.to);
  const [quickFilter,   setQuickFilter]   = useState("");
  const [statusFilter,  setStatusFilter]  = useState("All");
  const [showRestDay,   setShowRestDay]   = useState(true);
  const [page,          setPage]          = useState(1);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const [logsWithGeotag, setLogsWithGeotag] = useState<Set<number>>(new Set());

  function applyQuickFilter(val: string) {
    setQuickFilter(val);
    if (!val) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (val === "yesterday") {
      setFrom(toYMD(yesterday)); setTo(toYMD(yesterday));
    } else if (val === "thisMonth") {
      setFrom(toYMD(new Date(today.getFullYear(), today.getMonth(), 1)));
      setTo(toYMD(yesterday));
    } else if (val === "lastMonth") {
      setFrom(toYMD(new Date(today.getFullYear(), today.getMonth() - 1, 1)));
      setTo(toYMD(new Date(today.getFullYear(), today.getMonth(), 0)));
    } else {
      const days  = parseInt(val, 10);
      const start = new Date(yesterday);
      start.setDate(start.getDate() - (days - 1));
      setFrom(toYMD(start)); setTo(toYMD(yesterday));
    }
    setPage(1);
  }

  const { loading, error, logs: rawLogs } = useEmployeeAttendance(employee.user_id, from, to);

  const logs = useMemo(
    () => fillRestDays(rawLogs, from, to, employee.department_name),
    [rawLogs, from, to, employee.department_name],
  );

  const filtered = useMemo(() =>
    logs.filter((l) => {
      if (!showRestDay && isRestDay(l.log_date, employee.department_name)) return false;
      if (statusFilter !== "All" && l.status !== statusFilter) return false;
      return true;
    }),
    [logs, statusFilter, showRestDay, employee.department_name],
  );

  useEffect(() => { setPage(1); }, [filtered.length, from, to]);

  useEffect(() => {
    if (logs.length === 0) { setLogsWithGeotag(new Set()); return; }

    async function checkGeotags() {
      try {
        const logIds = logs
          .filter((l) => l.directus_id != null && l.directus_id > 0)
          .map((l) => l.directus_id!)
          .join(",");
        if (!logIds) { setLogsWithGeotag(new Set()); return; }
        const res = await fetch(
          `/api/hrm/attendance-report/employee-report/geotag/check?logIds=${logIds}`,
          { credentials: "include" },
        );
        if (res.ok) {
          const data = await res.json();
          setLogsWithGeotag(new Set(data.logIdsWithGeotag ?? []));
        }
      } catch (err) {
        console.error("Failed to check geotags:", err);
        setLogsWithGeotag(new Set());
      }
    }
    checkGeotags();
  }, [logs]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const start      = (safePage - 1) * PAGE_SIZE;
  const paginated  = filtered.slice(start, start + PAGE_SIZE);

  const workLogs      = logs.filter((l) => !isRestDay(l.log_date, employee.department_name));
  const daysAttended  = workLogs.filter((l) => l.status !== "Absent").length;
  const daysAbsent    = workLogs.filter((l) => l.status === "Absent").length;
  const totalWorkMins = workLogs.reduce((s, l) => s + getDisplayWorkMins(l),    0);
  const totalOvertMin = workLogs.reduce((s, l) => s + getDisplayOvertimeMins(l), 0);
  const totalLateMins = workLogs.reduce((s, l) => s + l.late, 0);

  function handlePrint() {
    const html = buildPrintHTML(
      employee, filtered, from, to, statusFilter, showRestDay,
      { daysAttended, daysAbsent, totalWorkMins, totalOvertMin, totalLateMins },
    );
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  }

  return (
    <div className="space-y-5 p-4 md:p-6">

      {/* ── Header bar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" className="h-8 px-3 text-xs gap-1.5 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Button>
        <h2 className="flex-1 text-center text-base font-bold tracking-tight">Attendance History</h2>
        <div className="flex items-center gap-1.5 text-xs border border-border rounded-md px-3 h-8 bg-background shrink-0">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium text-foreground">
            {formatDisplayDate(from)} — {formatDisplayDate(to)}
          </span>
        </div>
        <Button size="sm" className="h-8 px-3 text-xs gap-1.5 shrink-0" onClick={handlePrint}>
          <Printer className="h-3.5 w-3.5" /> Print
        </Button>
        <Button 
          size="sm" 
          variant="outline"
          className="h-8 px-3 text-xs gap-1.5 shrink-0" 
          onClick={() => handleExportEmployeePDF(employee, filtered, from, to, daysAttended, daysAbsent, totalWorkMins, totalOvertMin, totalLateMins)}
        >
          <Download className="h-3.5 w-3.5" /> Export PDF
        </Button>
      </div>

      {/* ── Employee info card ── */}
      <Card className="shadow-none border-border">
        <CardContent className="py-4 px-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-base font-bold text-primary shrink-0">
              {getInitials(String(employee.user_fname), String(employee.user_lname))}
            </div>
            <div>
              <div className="font-bold text-sm text-foreground">
                {employee.user_fname} {employee.user_lname}
              </div>
              <div className="text-xs text-muted-foreground">{employee.user_position}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-foreground">{employee.department_name}</div>
            {employee.work_start && employee.work_end && (
              <div className="text-xs text-muted-foreground">
                Schedule: {formatSchedule(employee.work_start, employee.work_end)}
              </div>
            )}
            {employee.workdays_note && (
              <div className="text-xs text-muted-foreground">Workdays: {employee.workdays_note}</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">From</label>
          <Input
            type="date" value={from}
            onChange={(e) => { setFrom(e.target.value); setQuickFilter(""); setPage(1); }}
            className="h-9 text-xs w-[145px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">To</label>
          <Input
            type="date" value={to}
            onChange={(e) => { setTo(e.target.value); setQuickFilter(""); setPage(1); }}
            className="h-9 text-xs w-[145px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">Quick Filter</label>
          <select
            value={quickFilter}
            onChange={(e) => applyQuickFilter(e.target.value)}
            className="h-9 text-xs w-[160px] rounded-md border border-input bg-background px-3 text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
          >
            {QUICK_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">Status</label>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["All","Present","On Time","Late","Absent","Half Day","Leave","Holiday","Rest Day","Incomplete"].map((s) => (
                <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium opacity-0 select-none">Show</label>
          <label className="inline-flex items-center gap-2 cursor-pointer h-9 px-3 border border-border rounded-md bg-background">
            <input
              type="checkbox" checked={showRestDay}
              onChange={(e) => setShowRestDay(e.target.checked)}
              className="w-4 h-4 accent-primary rounded"
            />
            <span className="text-xs font-medium text-foreground">Show Rest Day</span>
          </label>
        </div>
      </div>

      {/* ── Metrics ── */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-5 w-full">
        {[
          { label: "DAYS ATTENDED",        value: String(daysAttended) },
          { label: "DAYS ABSENT",          value: String(daysAbsent) },
          { label: "TOTAL WORK HOURS",     value: minsToHM(totalWorkMins) },
          { label: "TOTAL OVERTIME (HRS)", value: minsToHM(totalOvertMin) },
          { label: "TOTAL LATE (HRS)",     value: minsToHM(totalLateMins) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-background p-4 flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase leading-tight">{label}</span>
            <span className="text-2xl font-bold text-foreground">{value}</span>
          </div>
        ))}
      </div>

      {/* ── Charts ── */}
      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 w-full">
          <WorkHoursLineChart logs={logs} />
          <StatusBarChart     logs={logs} />
        </div>
      )}

      {/* ── Table ── */}
      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : error ? (
        <div className="p-6 text-center text-red-500 text-sm border border-red-200 rounded-lg">{error}</div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-background">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border hover:bg-transparent">
                  {["Date","Time In","Lunch Start","Lunch End","Break Start","Break End","Time Out",
                    "Work Hours","Overtime","Late","Undertime","Status","Geotag"].map((h) => (
                    <TableHead key={h} className="text-xs font-semibold text-foreground py-4 first:pl-6 last:pr-6 whitespace-nowrap bg-background">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-10 text-muted-foreground text-sm">
                      No records found for the selected range.
                    </TableCell>
                  </TableRow>
                ) : paginated.map((l, i) => {
                  const dispWork = getDisplayWorkMins(l);
                  const dispOT   = getDisplayOvertimeMins(l);
                  return (
                    <Fragment key={`${l.log_id}-${l.log_date}-${i}`}>
                      <TableRow className="border-b border-border/40 hover:bg-muted/20">
                        <TableCell className="text-xs font-medium py-4 pl-6 whitespace-nowrap">
                          {new Date(l.log_date + "T00:00:00").toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-xs py-4 whitespace-nowrap">{formatTime(l.time_in) ?? "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground py-4 whitespace-nowrap">{formatTime(l.lunch_start) ?? "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground py-4 whitespace-nowrap">{formatTime(l.lunch_end) ?? "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground py-4 whitespace-nowrap">{formatTime(l.break_start) ?? "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground py-4 whitespace-nowrap">{formatTime(l.break_end) ?? "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground py-4 whitespace-nowrap">{formatTime(l.time_out) ?? "-"}</TableCell>

                        {/* Work Hours — raw from DB (already net) */}
                        <TableCell className="text-xs py-4 font-medium whitespace-nowrap">
                          {dispWork > 0 ? minsToHM(dispWork) : "-"}
                        </TableCell>

                        {/* Overtime — recalculated: work_hours - 8h shift */}
                        <TableCell className="text-xs py-4 font-medium whitespace-nowrap">
                          {dispOT > 0 ? minsToHM(dispOT) : "-"}
                        </TableCell>

                        <TableCell className="text-xs py-4 font-medium whitespace-nowrap">{minsToHM(l.late)}</TableCell>
                        <TableCell className="text-xs py-4 font-medium whitespace-nowrap">
                          {l.undertime > 0
                            ? <span className="text-red-500">{minsToHM(l.undertime)}</span>
                            : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="py-4 whitespace-nowrap">
                          <Badge variant="outline" className={`text-[11px] font-semibold px-2.5 py-0.5 ${statusBadgeClass(l.status)}`}>
                            {l.status}
                          </Badge>
                        </TableCell>

                        {/* Geotag */}
                        <TableCell className="text-xs py-4 pr-6 whitespace-nowrap">
                          {l.log_id && l.log_id > 0 && logsWithGeotag.has(l.directus_id ?? l.log_id) ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 px-2.5 text-[11px] font-semibold text-violet-600 border-violet-300 hover:bg-violet-50"
                              onClick={() => setExpandedLogId(expandedLogId === l.log_id ? null : l.log_id)}
                            >
                              {expandedLogId === l.log_id ? "Hide" : "View"}
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>

                      {expandedLogId === l.log_id && l.log_id > 0 && logsWithGeotag.has(l.directus_id ?? l.log_id) && (
                        <TableRow key={`geotag-${l.log_id}-${l.log_date}`} className="hover:bg-transparent">
                          <TableCell colSpan={13} className="p-0 border-b border-border/40">
                            <GeotagEvidencePanel
                              logId={l.directus_id ?? l.log_id}
                              logDate={l.log_date}
                              employeeName={`${employee.user_fname} ${employee.user_lname}`}
                              employeeId={employee.user_id}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination footer */}
          <div className="px-6 py-3 border-t border-border/50 flex items-center justify-between gap-4 flex-wrap">
            <span className="text-xs text-muted-foreground">
              Showing{" "}
              <span className="font-semibold text-foreground">{filtered.length === 0 ? 0 : start + 1}</span>
              {" "}–{" "}
              <span className="font-semibold text-foreground">{Math.min(start + PAGE_SIZE, filtered.length)}</span>
              {" "}of{" "}
              <span className="font-semibold text-foreground">{filtered.length}</span> records
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs font-medium text-foreground min-w-[60px] text-center">
                Page {safePage} / {totalPages}
              </span>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}