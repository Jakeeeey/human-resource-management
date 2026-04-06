// src/modules/human-resource-management/workforce/attendance-report/employee-report/hooks/useEmployeeReport.ts

import { useEffect, useState, useCallback } from 'react';

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
  directus_id:     number | null;
  log_date:        string;
  time_in:         string | null;
  lunch_start:     string | null;
  lunch_end:       string | null;
  break_start:     string | null;
  break_end:       string | null;
  time_out:        string | null;
  status:          string;
  approval_status: string;
  work_hours:      number;
  overtime:        number;
  late:            number;
  undertime:       number;
  is_rest_day:     boolean;
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

interface UseEmployeesResult {
  loading:     boolean;
  error:       string | null;
  employees:   Employee[];
  departments: { id: number; name: string }[];
}

interface UseEmployeeAttendanceResult {
  loading:   boolean;
  error:     string | null;
  logs:      EmployeeAttendanceRow[];
  employee:  Employee | null;
  refetch:   () => void;
}

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

const MAX_WORK_MINS = 480; 

function computeWorkHours(timeIn: string | null, timeOut: string | null,
  lunchStart: string | null, lunchEnd: string | null): number {
  if (!timeIn || !timeOut) return 0;
  let total = toMins(timeOut) - toMins(timeIn);
  if (lunchStart && lunchEnd) total -= (toMins(lunchEnd) - toMins(lunchStart));
  return Math.min(Math.max(0, total), MAX_WORK_MINS);
}

function computeUndertime(timeOut: string | null, workEnd: string | null): number {
  if (!timeOut || !workEnd) return 0;
  const diff = toMins(workEnd) - toMins(timeOut);
  return Math.max(0, diff);
}

export function useEmployees(): UseEmployeesResult {
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [employees,   setEmployees]   = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    async function fetch_() {
      try {
        const res = await fetch('/api/hrm/attendance-report/employee-report', { credentials: 'include' });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data = await res.json();
        const emps: Employee[] = data.data ?? [];
        setEmployees(emps);
        const deptMap = new Map<number, string>();
        emps.forEach((e) => {
          if (e.department_id && e.department_name && String(e.department_name).trim() !== '—') {
            deptMap.set(e.department_id, String(e.department_name).trim());
          }
        });
        setDepartments(Array.from(deptMap.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name)));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load employees');
      } finally {
        setLoading(false);
      }
    }
    fetch_();
  }, []);

  return { loading, error, employees, departments };
}

export function useEmployeeAttendance(
  userId: number | null,
  from: string,
  to: string,
): UseEmployeeAttendanceResult {
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [logs,     setLogs]     = useState<EmployeeAttendanceRow[]>([]);
  const [employee, setEmployee] = useState<Employee | null>(null);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ userId: String(userId), from, to });
      const res = await fetch(`/api/hrm/attendance-report/employee-report/history?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();

      const emp: Employee = data.employee;
      const rawLogs: Record<string, unknown>[] = data.logs ?? [];
      const workEnd = emp.work_end;

      const mapped: EmployeeAttendanceRow[] = rawLogs.map((l) => {
        const ti  = extractTime(l.time_in as string | null);
        const to_ = extractTime(l.time_out as string | null);
        const ls  = extractTime(l.lunch_start as string | null);
        const le  = extractTime(l.lunch_end as string | null);
        const wh  = computeWorkHours(ti, to_, ls, le);
        const logWorkEnd = extractTime(l.work_end as string | null) ?? workEnd;

        return {
          log_id:          l.log_id as number,
          directus_id:     (l.directus_id as number | null) ?? null,
          log_date:        l.log_date as string,
          time_in:         ti,
          lunch_start:     ls,
          lunch_end:       le,
          break_start:     extractTime(l.break_start as string | null),
          break_end:       extractTime(l.break_end as string | null),
          time_out:        to_,
          status:          l.status as string,
          approval_status: l.approval_status as string,
          work_hours:      wh,
          overtime:        (l.overtime as number) ?? 0,
          late:            (l.late as number) ?? 0,
          undertime:       computeUndertime(to_, logWorkEnd),
          is_rest_day:     (l.status as string) === 'Holiday',
          is_oncall:       !!(l.is_oncall),
          oncall_schedule: (l.is_oncall && l.work_start && l.work_end) ? {
            work_start:   extractTime(l.work_start as string | null),
            work_end:     extractTime(l.work_end as string | null),
            lunch_start:  extractTime(l.lunch_start as string | null),
            lunch_end:    extractTime(l.lunch_end as string | null),
            break_start:  extractTime(l.break_start as string | null),
            break_end:    extractTime(l.break_end as string | null),
          } : null,
        };
      });

      setEmployee(emp);
      setLogs(mapped);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load attendance history');
    } finally {
      setLoading(false);
    }
  }, [userId, from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);
  return { loading, error, logs, employee, refetch: fetchData };
}