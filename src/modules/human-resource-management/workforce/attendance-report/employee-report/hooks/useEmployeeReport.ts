// hooks/useEmployeeReport.ts
// Fetches all users and their attendance history from Directus via proxy route.

import { useEffect, useState, useCallback, useRef } from 'react';

export interface Employee {
  user_id:         number;
  user_fname:      string;
  user_lname:      string;
  user_email:      string;
  user_position:   string;
  user_image:      string | null;
  department_id:   number;
  department_name: string;
  work_start:      string | null;
  work_end:        string | null;
  working_days:    number;
  workdays_note:   string | null;
  grace_period:    number;
}

export interface EmployeeAttendanceRow {
  log_id:          number;
  directus_id:     number | null; // Directus PK (e.g. 4195300336) — FK in attendance_log_geotag.log_id
  log_date:        string;
  time_in:         string | null;
  lunch_start:     string | null;
  lunch_end:       string | null;
  break_start:     string | null;
  break_end:       string | null;
  time_out:        string | null;
  status:          string;
  approval_status: string;
  work_hours:      number;  // minutes
  overtime:        number;  // minutes
  late:            number;  // minutes
  undertime:       number;  // minutes
  is_rest_day:     boolean;
  is_oncall:       boolean;
  oncall_schedule: {
    work_start:  string | null;
    work_end:    string | null;
    lunch_start: string | null;
    lunch_end:   string | null;
    break_start: string | null;
    break_end:   string | null;
  } | null;
}

interface UseEmployeesResult {
  loading:     boolean;
  error:       string | null;
  employees:   Employee[];
  departments: { id: number; name: string }[];
}

interface UseEmployeeAttendanceResult {
  loading:    boolean;  // true only on first load (no previous data)
  refreshing: boolean;  // true on subsequent fetches — previous data stays visible
  error:      string | null;
  logs:       EmployeeAttendanceRow[];
  employee:   Employee | null;
  refetch:    () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function toMins(t: string): number {
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

function extractTime(dt: string | null): string | null {
  if (!dt) return null;
  if (dt.includes('T')) return dt.split('T')[1].slice(0, 5);
  if (dt.includes(' ') && dt.includes('-')) return dt.split(' ')[1].slice(0, 5);
  return dt.slice(0, 5);
}

const MAX_WORK_MINS = 480; // 8 hours

function computeWorkHours(
  timeIn: string | null, timeOut: string | null,
  lunchStart: string | null, lunchEnd: string | null,
): number {
  if (!timeIn || !timeOut) return 0;
  let total = toMins(timeOut) - toMins(timeIn);
  if (lunchStart && lunchEnd) total -= (toMins(lunchEnd) - toMins(lunchStart));
  return Math.min(Math.max(0, total), MAX_WORK_MINS);
}

function computeOvertime(
  timeIn: string | null, timeOut: string | null,
  workStart: string | null, workEnd: string | null,
  lunchStart: string | null, lunchEnd: string | null,
): number {
  if (!timeIn || !timeOut || !workStart || !workEnd) return 0;

  // Only count time after scheduled work end
  const outMins = toMins(timeOut);
  const endMins = toMins(workEnd);

  if (outMins <= endMins) return 0;

  // If lunch is after work end, deduct only the portion after work end
  let lunchDeduct = 0;
  if (lunchStart && lunchEnd) {
    const lunchStartMins = toMins(lunchStart);
    const lunchEndMins = toMins(lunchEnd);
    // Only deduct lunch time that overlaps with overtime period
    if (lunchEndMins > endMins) {
      lunchDeduct = Math.max(0, Math.min(outMins, lunchEndMins) - Math.max(endMins, lunchStartMins));
    }
  }

  return (outMins - endMins) - lunchDeduct;
}

function computeLate(timeIn: string | null, workStart: string | null, grace: number): number {
  if (!timeIn || !workStart) return 0;
  const minsAfterGrace = toMins(timeIn) - (toMins(workStart) + grace);
  // Within grace period → on time
  if (minsAfterGrace <= 0) return 0;
  // Beyond grace → late is counted from workStart (grace minutes are included)
  return toMins(timeIn) - toMins(workStart);
}

function computeUndertime(timeOut: string | null, workEnd: string | null): number {
  if (!timeOut || !workEnd) return 0;
  return Math.max(0, toMins(workEnd) - toMins(timeOut));
}

// ── Hook: all employees ────────────────────────────────────────────────────────

export function useEmployees(): UseEmployeesResult {
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [employees,   setEmployees]   = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const res = await fetch(
          '/api/hrm/workforce/attendance-report/employee-report',
          { credentials: 'include' },
        );
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data = await res.json();
        if (cancelled) return;

        const emps: Employee[] = data.data ?? [];
        setEmployees(emps);

        const deptMap = new Map<number, string>();
        emps.forEach((e) => {
          if (e.department_id && e.department_name && String(e.department_name).trim() !== '—') {
            deptMap.set(e.department_id, String(e.department_name).trim());
          }
        });
        setDepartments(
          Array.from(deptMap.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load employees');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, []);

  return { loading, error, employees, departments };
}

// ── Hook: single employee attendance ──────────────────────────────────────────

export function useEmployeeAttendance(
  userId: number | null,
  from:   string,
  to:     string,
): UseEmployeeAttendanceResult {
  // loading  = no data yet (first fetch for this employee)
  // refreshing = already have data, re-fetching due to date change
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  // Stale data is kept in state until new data arrives — prevents blank flash
  const [logs,       setLogs]       = useState<EmployeeAttendanceRow[]>([]);
  const [employee,   setEmployee]   = useState<Employee | null>(null);

  // Track whether we have ever received data for the current employee
  const hasDataRef = useRef(false);
  const prevUserIdRef = useRef<number | null>(null);

  const fetchData = useCallback(async () => {
    if (!userId) return;

    // Reset stale-data tracker when employee changes
    if (prevUserIdRef.current !== userId) {
      prevUserIdRef.current = userId;
      hasDataRef.current = false;
    }

    if (hasDataRef.current) {
      // Already have data → show subtle refreshing indicator, keep old rows visible
      setRefreshing(true);
    } else {
      // First load for this employee → show full loading state
      setLoading(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams({ userId: String(userId), from, to });
      const res = await fetch(
        `/api/hrm/workforce/attendance-report/employee-report/history?${params}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();

      const emp: Employee = data.employee;
      const rawLogs: Record<string, unknown>[] = data.logs ?? [];

      const workStart   = emp.work_start;
      const workEnd     = emp.work_end;
      const gracePeriod = emp.grace_period ?? 5;

      const mapped: EmployeeAttendanceRow[] = rawLogs.map((l) => {
        const ti  = extractTime(l.time_in  as string | null);
        const to_ = extractTime(l.time_out as string | null);
        const ls  = extractTime(l.lunch_start as string | null);
        const le  = extractTime(l.lunch_end   as string | null);
        const wh  = computeWorkHours(ti, to_, ls, le);

        const logWorkStart   = extractTime(l.work_start as string | null) ?? workStart;
        const logWorkEnd     = extractTime(l.work_end   as string | null) ?? workEnd;
        const logGracePeriod = (l.grace_period as number | null) ?? gracePeriod;

        return {
          log_id:          l.log_id as number,
          directus_id:     (l.directus_id as number | null) ?? null,
          log_date:        l.log_date as string,
          time_in:         ti,
          lunch_start:     ls,
          lunch_end:       le,
          break_start:     extractTime(l.break_start as string | null),
          break_end:       extractTime(l.break_end   as string | null),
          time_out:        to_,
          status:          l.status as string,
          approval_status: l.approval_status as string,
          work_hours:      wh,
          overtime:        computeOvertime(ti, to_, logWorkStart, logWorkEnd, ls, le),
          late:            computeLate(ti, logWorkStart, logGracePeriod),
          undertime:       computeUndertime(to_, logWorkEnd),
          is_rest_day:     (l.status as string) === 'Holiday',
          is_oncall:       !!(l.is_oncall),
          oncall_schedule: (l.is_oncall && l.oncall_work_start && l.oncall_work_end) ? {
            work_start:  extractTime(l.oncall_work_start  as string | null),
            work_end:    extractTime(l.oncall_work_end    as string | null),
            lunch_start: extractTime(l.oncall_lunch_start as string | null),
            lunch_end:   extractTime(l.oncall_lunch_end   as string | null),
            break_start: extractTime(l.oncall_break_start as string | null),
            break_end:   extractTime(l.oncall_break_end   as string | null),
          } : null,
        };
      });

      setEmployee(emp);
      setLogs(mapped);
      hasDataRef.current = true;

    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load attendance history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { loading, refreshing, error, logs, employee, refetch: fetchData };
}