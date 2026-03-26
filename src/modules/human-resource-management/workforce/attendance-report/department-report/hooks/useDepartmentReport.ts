// hooks/useDepartmentReport.ts
import { useEffect, useState, useCallback } from 'react';

export interface DeptAttendanceRow {
  log_id:        number | null;
  user_id:       number;
  user_fname:    string;
  user_lname:    string;
  user_position: string;
  department_id: number;
  log_date:      string; // always YYYY-MM-DD after normalization
  time_in:       string | null; // HH:mm
  time_out:      string | null; // HH:mm
  lunch_start:   string | null;
  lunch_end:     string | null;
  break_start:   string | null;
  break_end:     string | null;
  status:        string;
  work_hours:    number; // minutes
  overtime:      number; // minutes
  late:          number; // minutes
  punctuality:   string | null;
}

export interface Department {
  department_id:   number;
  department_name: string;
  work_start:      string | null;
  work_end:        string | null;
  grace_period:    number;
}

interface UseDepartmentReportResult {
  loading:     boolean;
  error:       string | null;
  rows:        DeptAttendanceRow[];
  departments: Department[];
  refetch:     () => void;
}

/**
 * Extracts HH:mm from any datetime format MySQL/Node.js might return:
 *   "2026-03-17T08:00:00.000Z"  → uses local time getters
 *   "2026-03-17 08:00:00"       → split on space
 *   "08:00:00" or "08:00"       → already a time string
 *   null / undefined            → null
 */
function extractTime(raw: unknown): string | null {
  if (!raw) return null;
  const s = String(raw);

  // Full ISO string with T — parse as Date and use LOCAL time getters
  if (s.includes('T')) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    }
  }

  // MySQL datetime: "2026-03-17 08:00:00" — take the time portion
  if (s.includes(' ') && s.includes('-')) {
    return s.split(' ')[1].slice(0, 5);
  }

  // Already a time string "08:00:00" or "08:00"
  return s.slice(0, 5);
}

/**
 * Extracts a local YYYY-MM-DD string from whatever the DB/API returns.
 * NEVER passes bare "YYYY-MM-DD" into new Date() — JS parses it as UTC
 * midnight, which in UTC+8 rolls back to the previous day.
 */
function extractDate(raw: unknown): string {
  if (!raw) return '';
  const s = String(raw);
  // Already bare date "YYYY-MM-DD" — return directly, no Date() parsing
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // MySQL datetime "2026-03-17 00:00:00" — split on space
  if (s.includes(' ') && s.includes('-') && !s.includes('T')) return s.split(' ')[0];
  // ISO string with T — parse and use LOCAL getters (not UTC)
  if (s.includes('T')) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm   = String(d.getMonth() + 1).padStart(2, '0');
      const dd   = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  return s.slice(0, 10);
}

function toMins(t: string): number {
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  return h * 60 + (m || 0);
}

function computeWorkHours(ti: string | null, to: string | null, ls: string | null, le: string | null, bs: string | null, be: string | null): number {
  if (!ti || !to) return 0;
  let total = toMins(to) - toMins(ti);
  
  // Deduct lunch: if punched, use actual; if not punched, use default 60m
  if (ls && le) {
    total -= (toMins(le) - toMins(ls));
  } else {
    total -= 60;  // Default lunch duration
  }
  
  // Note: Break time is NOT deducted
  
  return Math.max(0, total);
}

function computeLate(ti: string | null, ws: string | null, grace: number): number {
  if (!ti || !ws) return 0;
  return Math.max(0, toMins(ti) - (toMins(ws) + grace));
}

function computeOvertime(to: string | null, we: string | null): number {
  if (!to || !we) return 0;
  return Math.max(0, toMins(to) - toMins(we));
}

function derivePunctuality(ti: string | null, ws: string | null, grace: number, status: string): string | null {
  if (status === 'Absent' || status === 'Holiday') return null;
  if (status === 'Late') return 'Late';
  if (!ti || !ws) return null;
  return toMins(ti) <= toMins(ws) + grace ? 'On Time' : 'Late';
}

export function useDepartmentReport(
  deptId: number | null,
  from: string,
  to: string,
): UseDepartmentReportResult {
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [rows,        setRows]        = useState<DeptAttendanceRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      if (deptId) params.set('deptId', String(deptId));

      const res = await fetch(
        `/api/hrm/attendance-report/department-report?${params}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

      const data = await res.json();

      // ── Departments ──────────────────────────────────────────────
      const depts: Department[] = (data.departments ?? []).map((d: Record<string, unknown>) => ({
        department_id:   Number(d.department_id),
        department_name: String(d.department_name ?? ''),
        work_start:      d.work_start ? String(d.work_start).slice(0, 5) : null,
        work_end:        d.work_end   ? String(d.work_end).slice(0, 5)   : null,
        grace_period:    Number(d.grace_period ?? 5),
      }));
      setDepartments(depts);

      const schedMap = new Map(depts.map((d) => [d.department_id, d]));

      // ── Logs ─────────────────────────────────────────────────────
      const rawLogs: Record<string, unknown>[] = data.logs ?? [];

      const mapped: DeptAttendanceRow[] = rawLogs.map((l) => {
        const dId   = Number(l.department_id);
        const sched = schedMap.get(dId);
        const ws    = sched?.work_start ?? null;
        const we    = sched?.work_end   ?? null;
        const grace = sched?.grace_period ?? 5;

        const ti  = extractTime(l.time_in);
        const to_ = extractTime(l.time_out);
        const ls  = extractTime(l.lunch_start);
        const le  = extractTime(l.lunch_end);
        const bs  = extractTime(l.break_start);
        const be  = extractTime(l.break_end);

        const logDate = extractDate(l.log_date);
        const status  = String(l.status ?? 'Absent');

        return {
          log_id:        l.log_id != null ? Number(l.log_id) : null,
          user_id:       Number(l.user_id),
          user_fname:    String(l.user_fname ?? '—'),
          user_lname:    String(l.user_lname ?? '—'),
          user_position: String(l.user_position ?? '—'),
          department_id: dId,
          log_date:      logDate,
          time_in:       ti,
          time_out:      to_,
          lunch_start:   ls,
          lunch_end:     le,
          break_start:   bs,
          break_end:     be,
          status,
          work_hours:    computeWorkHours(ti, to_, ls, le, bs, be),
          overtime:      computeOvertime(to_, we),
          late:          computeLate(ti, ws, grace),
          punctuality:   derivePunctuality(ti, ws, grace, status),
        };
      });

      // Client-side date filter — guards against server timezone mismatches
      let filtered = mapped.filter((r) => r.log_date >= from && r.log_date <= to);
      
      // Filter by department if deptId is specified
      if (deptId) {
        filtered = filtered.filter((r) => r.department_id === deptId);
      }
      
      setRows(filtered);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [deptId, from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { loading, error, rows, departments, refetch: fetchData };
}