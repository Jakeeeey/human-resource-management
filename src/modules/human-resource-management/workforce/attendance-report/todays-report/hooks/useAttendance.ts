// hooks/useAttendance.ts
// Fetches daily attendance from the Directus API via Next.js proxy route.
// Directus returns nested objects for joined relations (user_id, department_id).

import { useEffect, useState, useCallback } from 'react';

export type AttendanceStatus =
  | 'On Time' | 'Late' | 'Absent'
  | 'Half Day' | 'Incomplete' | 'Leave' | 'Holiday' | 'Rest Day';

export type PunctualityStatus = 'On Time' | 'Late';

// ── Raw shape — flat merged response from our route ───────────────────────────

export interface RawAttendanceRow {
  // attendance_log
  log_id:          number;
  user_id:         number;
  department_id:   number;
  log_date:        string;
  time_in:         string | null;
  lunch_start:     string | null;
  lunch_end:       string | null;
  break_start:     string | null;
  break_end:       string | null;
  time_out:        string | null;
  status:          AttendanceStatus;
  approval_status: 'pending' | 'approved' | 'rejected';
  image_time_in?:  string | null;
  image_time_out?: string | null;
  // merged user fields (flat)
  user_fname:      string;
  user_lname:      string;
  user_mname?:     string | null;
  user_email:      string;
  user_position:   string;
  user_image?:     string | null;
  // merged department fields (flat)
  department_name: string;
  // merged schedule fields (flat) — department schedule
  work_start?:     string | null;
  work_end?:       string | null;
  grace_period?:   number;
  is_oncall?:      boolean;
  // merged on-call schedule fields (flat) — if employee is on-call
  oncall_work_start?:   string | null;
  oncall_work_end?:     string | null;
  oncall_lunch_start?:  string | null;
  oncall_lunch_end?:    string | null;
  oncall_break_start?:  string | null;
  oncall_break_end?:    string | null;
}

// ── Clean UI shape ─────────────────────────────────────────────────────────────
export interface AttendanceRecord {
  log_id:          number;
  user_id:         number;
  department_id:   number;
  log_date:        string;
  time_in:         string | null;  // "HH:mm"
  lunch_start:     string | null;
  lunch_end:       string | null;
  break_start:     string | null;
  break_end:       string | null;
  time_out:        string | null;
  status:          AttendanceStatus;
  approval_status: 'pending' | 'approved' | 'rejected';
  user_fname:      string;
  user_lname:      string;
  user_email:      string;
  user_department: string;
  user_position:   string;
  user_image:      string | null;
  schedule:        string | null;  // "08:00 - 17:00" — always null for on-call employees
  punctuality:     PunctualityStatus | null;
  presentStatus:   'Present' | 'Absent';
  is_oncall:       boolean;
  oncall_schedule: {
    work_start:   string | null;
    work_end:     string | null;
    lunch_start:  string | null;
    lunch_end:    string | null;
    break_start:  string | null;
    break_end:    string | null;
  } | null;
}

export interface Department {
  department_id:   number;
  department_name: string;
}

export interface AttendanceSummary {
  present: number;
  absent:  number;
  onTime:  number;
  late:    number;
  restDay: number;
}

interface UseAttendanceResult {
  loading:     boolean;
  error:       string | null;
  records:     AttendanceRecord[];
  departments: Department[];
  summary:     AttendanceSummary;
  refetch:     () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Extract "HH:mm" from ISO-like strings: "2025-10-04T11:25:00", "2025-10-04 11:25:00", "11:25:00" */
function extractTime(dt: string | null | undefined): string | null {
  if (!dt) return null;
  // ISO with T: "2025-10-04T11:25:00"
  if (dt.includes('T')) return dt.split('T')[1].slice(0, 5);
  // Space-separated: "2025-10-04 11:25:00"
  if (dt.includes(' ') && dt.includes('-')) return dt.split(' ')[1].slice(0, 5);
  // Already time only: "11:25:00" or "11:25"
  return dt.slice(0, 5);
}

function toMinutes(t: string): number {
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

/**
 * Derives punctuality using the effective work start time.
 * For on-call employees, uses the on-call schedule's work_start.
 * For regular employees, uses the department schedule's work_start.
 */
function derivePunctuality(
  timeIn: string | null,
  workStart: string | null | undefined,
  gracePeriod = 5,
): PunctualityStatus | null {
  if (!timeIn || !workStart) return null;
  const inMins    = toMinutes(timeIn);
  const limitMins = toMinutes(workStart) + gracePeriod;
  return inMins <= limitMins ? 'On Time' : 'Late';
}

function buildSchedule(ws: string | null | undefined, we: string | null | undefined): string | null {
  if (!ws || !we) return null;
  return `${ws.slice(0, 5)} - ${we.slice(0, 5)}`;
}

function transformRow(row: RawAttendanceRow): AttendanceRecord {
  const timeIn   = extractTime(row.time_in);
  const isAbsent = row.status === 'Absent' || row.status === 'Holiday';
  const isOncall = row.is_oncall ?? false;

  // For on-call employees, punctuality is checked against their on-call work_start,
  // not the department schedule's work_start.
  const effectiveWorkStart = isOncall
    ? (row.oncall_work_start ?? row.work_start)
    : row.work_start;

  const punctuality = isAbsent
    ? null
    : row.status === 'Late'
      ? 'Late'
      : derivePunctuality(timeIn, effectiveWorkStart, row.grace_period);

  return {
    log_id:          row.log_id,
    user_id:         row.user_id,
    department_id:   row.department_id,
    log_date:        row.log_date,
    time_in:         timeIn,
    lunch_start:     extractTime(row.lunch_start),
    lunch_end:       extractTime(row.lunch_end),
    break_start:     extractTime(row.break_start),
    break_end:       extractTime(row.break_end),
    time_out:        extractTime(row.time_out),
    status:          row.status,
    approval_status: row.approval_status,
    user_fname:      row.user_fname,
    user_lname:      row.user_lname,
    user_email:      row.user_email,
    user_department: row.department_name,
    user_position:   row.user_position,
    user_image:      row.user_image ?? null,
    // On-call employees: suppress the department schedule entirely.
    // The table will display oncall_schedule instead.
    schedule:        isOncall ? null : buildSchedule(row.work_start, row.work_end),
    punctuality,
    presentStatus:   isAbsent ? 'Absent' : 'Present',
    is_oncall:       isOncall,
    oncall_schedule: isOncall ? {
      work_start:   extractTime(row.oncall_work_start) ?? null,
      work_end:     extractTime(row.oncall_work_end)   ?? null,
      lunch_start:  extractTime(row.oncall_lunch_start) ?? null,
      lunch_end:    extractTime(row.oncall_lunch_end)   ?? null,
      break_start:  extractTime(row.oncall_break_start) ?? null,
      break_end:    extractTime(row.oncall_break_end)   ?? null,
    } : null,
  };
}

function deriveSummary(records: AttendanceRecord[]): AttendanceSummary {
  return {
    present: records.filter((r) => r.presentStatus === 'Present').length,
    absent:  records.filter((r) => r.presentStatus === 'Absent').length,
    onTime:  records.filter((r) => r.punctuality === 'On Time').length,
    late:    records.filter((r) => r.punctuality === 'Late').length,
    restDay: records.filter((r) => r.status === 'Holiday').length,
  };
}

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useAttendance(date?: string): UseAttendanceResult {
  const targetDate = date ?? new Date().toISOString().split('T')[0];

  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [records,     setRecords]     = useState<AttendanceRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [summary,     setSummary]     = useState<AttendanceSummary>({
    present: 0, absent: 0, onTime: 0, late: 0, restDay: 0,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ date: targetDate });
      const res = await fetch(
        `/api/hrm/workforce/attendance-report/todays-report?${params}`,
        { credentials: 'include' }
      );

      if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);

      const contentType = res.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new Error('Backend did not return JSON');
      }

      const result = await res.json();

      // Directus wraps in { data: [...] }
      const rows: RawAttendanceRow[] = Array.isArray(result)
        ? result
        : (result.data ?? result.content ?? result.records ?? []);

      const transformed = rows.map(transformRow);

      // Build unique departments list from returned data
      const deptMap = new Map<number, string>();
      transformed.forEach((r) => {
        if (r.department_id && r.user_department !== '—') {
          deptMap.set(r.department_id, r.user_department);
        }
      });
      const depts: Department[] = Array.from(deptMap.entries())
        .map(([id, name]) => ({ department_id: id, department_name: name }))
        .sort((a, b) => a.department_name.localeCompare(b.department_name));

      setRecords(transformed);
      setDepartments(depts);
      setSummary(deriveSummary(transformed));
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load attendance data.');
    } finally {
      setLoading(false);
    }
  }, [targetDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { loading, error, records, departments, summary, refetch: fetchData };
}