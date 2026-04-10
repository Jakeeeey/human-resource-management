// hooks/useDepartmentReport.ts
import { useEffect, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeptAttendanceRow {
  log_id:         number | null;
  user_id:        number;
  user_fname:     string;
  user_lname:     string;
  user_position:  string;
  user_image:     string | null;
  department_id:  number;
  department_name: string;
  log_date:       string;       // always YYYY-MM-DD
  time_in:        string | null; // HH:mm
  time_out:       string | null;
  lunch_start:    string | null;
  lunch_end:      string | null;
  break_start:    string | null;
  break_end:      string | null;
  status:         string;
  work_start:     string | null;
  work_end:       string | null;
  grace_period:   number;
  // Server-computed — never re-derived on the client
  work_hours:     number; // minutes
  overtime:       number; // minutes
  late:           number; // minutes
  punctuality:    string | null; // "On Time" | "Late" | null
  // On-call
  is_oncall:          boolean;
  oncall_work_start:  string | null;
  oncall_work_end:    string | null;
  oncall_lunch_start: string | null;
  oncall_lunch_end:   string | null;
  oncall_break_start: string | null;
  oncall_break_end:   string | null;
}

export interface Department {
  department_id:   number;
  department_name: string;
  work_start:      string | null;
  work_end:        string | null;
  grace_period:    number;
}

interface UseDepartmentReportResult {
  loading:          boolean;
  loadingDepts:     boolean;
  error:            string | null;
  rows:             DeptAttendanceRow[];
  departments:      Department[];
  refetch:          () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractTime(raw: unknown): string | null {
  if (!raw) return null;
  const s = String(raw);
  if (s.includes('T')) {
    const d = new Date(s);
    if (!isNaN(d.getTime()))
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  if (s.includes(' ') && s.includes('-')) return s.split(' ')[1].slice(0, 5);
  return s.slice(0, 5);
}

function extractDate(raw: unknown): string {
  if (!raw) return '';
  const s = String(raw);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (s.includes(' ') && s.includes('-') && !s.includes('T')) return s.split(' ')[0];
  if (s.includes('T')) {
    const d = new Date(s);
    if (!isNaN(d.getTime()))
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return s.slice(0, 10);
}

function mapLog(l: Record<string, unknown>): DeptAttendanceRow {
  const serverLate     = Number(l.late      ?? 0);
  const serverOvertime = Number(l.overtime  ?? 0);
  const serverWorkMins = Number(l.work_mins ?? 0);

  const serverPunctuality: string | null =
    l.punctuality != null
      ? String(l.punctuality)
      : l.time_in
        ? (serverLate > 0 ? 'Late' : 'On Time')
        : null;

  return {
    log_id:          l.log_id != null ? Number(l.log_id) : null,
    user_id:         Number(l.user_id),
    user_fname:      String(l.user_fname    ?? '—'),
    user_lname:      String(l.user_lname    ?? '—'),
    user_position:   String(l.user_position ?? '—'),
    user_image:      (l.user_image as string | null) ?? null,
    department_id:   Number(l.department_id ?? 0),
    department_name: String(l.department_name ?? '—'),
    log_date:        extractDate(l.log_date),
    time_in:         extractTime(l.time_in),
    time_out:        extractTime(l.time_out),
    lunch_start:     extractTime(l.lunch_start),
    lunch_end:       extractTime(l.lunch_end),
    break_start:     extractTime(l.break_start),
    break_end:       extractTime(l.break_end),
    status:          String(l.status ?? 'Absent'),
    work_start:      extractTime(l.work_start),
    work_end:        extractTime(l.work_end),
    grace_period:    Number(l.grace_period ?? 5),
    work_hours:      serverWorkMins,
    overtime:        serverOvertime,
    late:            serverLate,
    punctuality:     serverPunctuality,
    is_oncall:           !!(l.is_oncall),
    oncall_work_start:   extractTime(l.oncall_work_start)  ?? null,
    oncall_work_end:     extractTime(l.oncall_work_end)    ?? null,
    oncall_lunch_start:  extractTime(l.oncall_lunch_start) ?? null,
    oncall_lunch_end:    extractTime(l.oncall_lunch_end)   ?? null,
    oncall_break_start:  extractTime(l.oncall_break_start) ?? null,
    oncall_break_end:    extractTime(l.oncall_break_end)   ?? null,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDepartmentReport(
  deptId: number | null,
  from:   string,
  to:     string,
): UseDepartmentReportResult {
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [rows,         setRows]         = useState<DeptAttendanceRow[]>([]);
  const [departments,  setDepartments]  = useState<Department[]>([]);

  // ── Step 1: fetch department list once on mount ───────────────────────────
  // This is a lightweight call — no logs, no date range.
  // The module uses the returned list to set the initial deptId,
  // which then triggers Step 2.
  useEffect(() => {
    let cancelled = false;
    setLoadingDepts(true);

    fetch('/api/hrm/attendance-report/department-report?from=1970-01-01&to=1970-01-01', {
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const depts: Department[] = (data.departments ?? []).map((d: Record<string, unknown>) => ({
          department_id:   Number(d.department_id),
          department_name: String(d.department_name ?? ''),
          work_start:      d.work_start ? String(d.work_start).slice(0, 5) : null,
          work_end:        d.work_end   ? String(d.work_end).slice(0, 5)   : null,
          grace_period:    Number(d.grace_period ?? 5),
        }));
        setDepartments(depts);
      })
      .catch(() => { /* non-fatal — dept list can retry */ })
      .finally(() => { if (!cancelled) setLoadingDepts(false); });

    return () => { cancelled = true; };
  }, []); // ← runs once, never re-runs

  // ── Step 2: fetch logs — ONLY when deptId is known ────────────────────────
  // deptId === null means "not chosen yet" — we skip entirely so the API
  // never fires without a filter and returns every department's data.
  const fetchData = useCallback(async () => {
    if (deptId === null) return; // ← guard: do nothing until a dept is selected

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ from, to, deptId: String(deptId) });

      const res = await fetch(
        `/api/hrm/attendance-report/department-report?${params}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

      const data = await res.json();

      const rawLogs: Record<string, unknown>[] = data.logs ?? [];
      const mapped  = rawLogs.map(mapLog);

      // Client-side date guard — protects against server timezone edge cases
      setRows(mapped.filter((r) => r.log_date >= from && r.log_date <= to));

    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [deptId, from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { loading, loadingDepts, error, rows, departments, refetch: fetchData };
}