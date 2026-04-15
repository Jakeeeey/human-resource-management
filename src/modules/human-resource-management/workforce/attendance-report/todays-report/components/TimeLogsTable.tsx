// todays-report/components/TimeLogsTable.tsx
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatTime } from "../utils";
import type { AttendanceRecord } from "../hooks/useAttendance";

const PAGE_SIZE = 10;

interface Props {
  records: AttendanceRecord[];
  total:   number;
}

/**
 * Converts any "HH:MM" occurrences in a schedule string to 12-hour format.
 * e.g. "08:30 - 17:30" → "8:30am - 5:30pm"
 */
function formatScheduleStr(schedule: string): string {
  return schedule.replace(/(\d{2}):(\d{2})/g, (_, hStr, mStr) => {
    const h      = parseInt(hStr, 10);
    const period = h >= 12 ? "pm" : "am";
    const hour   = h % 12 === 0 ? 12 : h % 12;
    return `${hour}:${mStr}${period}`;
  });
}

/**
 * Returns the schedule string to display for an employee.
 *
 * Priority:
 *  1. On-call schedule (work_start – work_end) when is_oncall is true
 *  2. Regular department schedule
 *  3. null — renders as "—" in the table
 *
 * Note: for on-call employees, record.schedule is always null (set in
 * transformRow), so there is no risk of the department schedule leaking
 * through as a fallback here.
 */
function getEffectiveSchedule(record: AttendanceRecord): string | null {
  if (record.is_oncall && record.oncall_schedule) {
    const { work_start, work_end } = record.oncall_schedule;
    if (work_start && work_end) {
      return `${work_start} - ${work_end}`;
    }
    // On-call flag is set but schedule hours are missing — show nothing.
    return null;
  }
  return record.schedule;
}

export function TimeLogsTable({ records, total }: Props) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const start      = (safePage - 1) * PAGE_SIZE;
  const paginated  = records.slice(start, start + PAGE_SIZE);

  // Reset to page 1 when records change (filter applied)
  if (page > totalPages && totalPages > 0) setPage(1);

  return (
    <Card className="shadow-none border-border overflow-hidden">
      <CardHeader className="bg-muted/30 border-b border-border/50 pb-3 flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-sm font-bold uppercase">Time Logs</CardTitle>
        <span className="text-xs text-muted-foreground">
          {records.length} record{records.length !== 1 ? "s" : ""} of {total} —{" "}
          {new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </span>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-bold py-4 pl-6">Employee</TableHead>
                <TableHead className="text-xs font-bold py-4">Schedule</TableHead>
                <TableHead className="text-xs font-bold py-4">Time In</TableHead>
                <TableHead className="text-xs font-bold py-4">Lunch Start</TableHead>
                <TableHead className="text-xs font-bold py-4">Lunch End</TableHead>
                <TableHead className="text-xs font-bold py-4">Break Start</TableHead>
                <TableHead className="text-xs font-bold py-4">Break End</TableHead>
                <TableHead className="text-xs font-bold py-4">Time Out</TableHead>
                <TableHead className="text-xs font-bold py-4">Punctuality</TableHead>
                <TableHead className="text-xs font-bold py-4 pr-6">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-10 text-muted-foreground text-sm">
                    No attendance records match the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((r) => {
                  const effectiveSchedule = getEffectiveSchedule(r);
                  return (
                    <TableRow key={r.log_id != null ? r.log_id : `absent-${r.user_id}-${r.log_date}`} className="border-border/40 hover:bg-muted/20">
                      <TableCell className="py-4 pl-6">
                        <div className="font-bold text-xs text-foreground">{r.user_fname} {r.user_lname}</div>
                        <div className="text-[11px] text-muted-foreground">{r.user_department} — {r.user_position}</div>
                        {r.is_oncall && (
                          <span className="inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            On-call
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground py-4">
                        {effectiveSchedule ? formatScheduleStr(effectiveSchedule) : "—"}
                      </TableCell>
                      <TableCell className="text-xs font-semibold py-4">{formatTime(r.time_in)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground py-4">{formatTime(r.lunch_start)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground py-4">{formatTime(r.lunch_end)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground py-4">{formatTime(r.break_start)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground py-4">{formatTime(r.break_end)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground py-4">{formatTime(r.time_out)}</TableCell>
                      <TableCell className="py-4">
                        {r.punctuality ? (
                          <span className={`text-xs font-semibold ${r.punctuality === "On Time" ? "text-green-600" : "text-orange-500"}`}>
                            {r.punctuality}
                          </span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="py-4 pr-6">
                        <Badge variant="outline" className={`text-[11px] font-semibold ${
                          r.presentStatus === "Present"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-red-50 text-red-600 border-red-200"
                        }`}>
                          {r.presentStatus}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer: showing info + pagination */}
        <div className="px-6 py-3 border-t border-border/50 flex items-center justify-between gap-4 flex-wrap">
          <span className="text-xs text-muted-foreground">
            Showing{" "}
            <span className="font-semibold text-foreground">{records.length === 0 ? 0 : start + 1}</span>
            {" "}–{" "}
            <span className="font-semibold text-foreground">{Math.min(start + PAGE_SIZE, records.length)}</span>
            {" "}of{" "}
            <span className="font-semibold text-foreground">{records.length}</span> records
          </span>

          <div className="flex items-center gap-2">
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
      </CardContent>
    </Card>
  );
}
