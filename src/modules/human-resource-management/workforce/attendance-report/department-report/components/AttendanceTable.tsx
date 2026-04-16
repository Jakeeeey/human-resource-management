// department-report/components/AttendanceTable.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { minsToHM, getInitials, formatDisplayDate, groupByDate } from '../utils';
import type { DeptAttendanceRow } from '../hooks/useDepartmentReport';

interface Props { rows: DeptAttendanceRow[] }

function normalizeDate(raw: string): string {
  if (!raw) return raw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function DashBadge() {
  return (
    <span className="inline-flex items-center justify-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground min-w-[2rem]">
      —
    </span>
  );
}

// Statuses that count as "Present" for the Status badge
const PRESENT_STATUSES = new Set(['On Time', 'Late', 'Present']);

// Statuses that should show a punctuality badge (employee actually clocked in)
const HAS_PUNCTUALITY = new Set(['On Time', 'Late', 'Present']);

export function AttendanceTable({ rows }: Props) {
  const normalizedRows = rows.map((r) => ({ ...r, log_date: normalizeDate(r.log_date) }));
  const grouped        = groupByDate(normalizedRows);

  if (normalizedRows.length === 0) return (
    <Card className="shadow-none border-border">
      <CardContent className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        No attendance records found for the selected filters.
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {[...grouped.entries()].map(([date, dateRows]) => (
        <Card key={date} className="shadow-none border-border overflow-hidden">
          <CardHeader className="border-b border-border/50 py-3 px-6">
            <CardTitle className="text-sm font-bold">{formatDisplayDate(date)}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40">
                    <TableHead className="text-xs font-semibold py-3 pl-6 text-muted-foreground">Name</TableHead>
                    <TableHead className="text-xs font-semibold py-3 text-muted-foreground">Work Hours</TableHead>
                    <TableHead className="text-xs font-semibold py-3 text-muted-foreground">Overtime</TableHead>
                    <TableHead className="text-xs font-semibold py-3 text-muted-foreground">Late</TableHead>
                    <TableHead className="text-xs font-semibold py-3 text-muted-foreground">Punctuality</TableHead>
                    <TableHead className="text-xs font-semibold py-3 pr-6 text-muted-foreground">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dateRows.map((r, i) => {
                    // ── Status badge ────────────────────────────────────────────
                    const isPresent = PRESENT_STATUSES.has(r.status);
                    const statusLabel = isPresent ? 'Present'
                      : r.status === 'Rest Day' ? 'Rest Day'
                      : r.status === 'Holiday'  ? 'Holiday'
                      : r.status === 'Leave'    ? 'Leave'
                      : r.status === 'Incomplete' ? 'Incomplete'
                      : 'Absent';

                    const statusColor =
                      statusLabel === 'Present'    ? 'bg-green-50 text-green-700 border-green-200'
                      : statusLabel === 'Rest Day' ? 'bg-muted text-muted-foreground border-border'
                      : statusLabel === 'Holiday'  ? 'bg-blue-50 text-blue-600 border-blue-200'
                      : statusLabel === 'Leave'    ? 'bg-blue-50 text-blue-600 border-blue-200'
                      : statusLabel === 'Incomplete' ? 'bg-yellow-50 text-yellow-700 border-yellow-300'
                      : 'bg-red-50 text-red-600 border-red-200'; // Absent

                    // ── Punctuality badge ───────────────────────────────────────
                    // Use the server-computed `punctuality` field directly.
                    // This is derived from calculateLate() on the server, so it
                    // correctly reflects grace_period regardless of what Directus stored.
                    const punctuality = r.punctuality ?? (HAS_PUNCTUALITY.has(r.status)
                      ? (r.late > 0 ? 'Late' : 'On Time')
                      : null);

                    return (
                      <TableRow
                        key={r.log_id != null && r.log_id > 0
                          ? `log-${r.log_id}`
                          : `absent-${r.user_id}-${r.log_date}-${i}`}
                        className="border-border/40 hover:bg-muted/20"
                      >
                        {/* Name */}
                        <TableCell className="py-3 pl-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[11px] font-bold text-foreground/70 flex-shrink-0 border border-border">
                              {getInitials(r.user_fname, r.user_lname)}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-foreground leading-tight">
                                {r.user_fname} {r.user_lname}
                              </div>
                              <div className="text-xs text-muted-foreground leading-tight mt-0.5">
                                {r.user_position}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Work Hours */}
                        <TableCell className="text-sm font-medium py-3">
                          {r.work_hours > 0
                            ? <span>{minsToHM(r.work_hours)}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>

                        {/* Overtime */}
                        <TableCell className="text-sm py-3">
                          {r.overtime > 0
                            ? <span className="font-medium">{minsToHM(r.overtime)}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>

                        {/* Late */}
                        <TableCell className="text-sm py-3">
                          {r.late > 0
                            ? <span className="font-medium">{minsToHM(r.late)}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>

                        {/* Punctuality — from server-computed field, not re-derived from status */}
                        <TableCell className="py-3">
                          {punctuality === 'On Time' ? (
                            <Badge variant="outline" className="text-[11px] font-semibold bg-green-50 text-green-700 border-green-200">
                              On Time
                            </Badge>
                          ) : punctuality === 'Late' ? (
                            <Badge variant="outline" className="text-[11px] font-semibold bg-orange-50 text-orange-600 border-orange-200">
                              Late
                            </Badge>
                          ) : (
                            <DashBadge />
                          )}
                        </TableCell>

                        {/* Status */}
                        <TableCell className="py-3 pr-6">
                          <Badge variant="outline" className={`text-[11px] font-semibold ${statusColor}`}>
                            {statusLabel}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
