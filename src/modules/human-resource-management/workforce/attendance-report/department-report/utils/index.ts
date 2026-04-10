// department-report/utils/index.ts
import type { DeptAttendanceRow } from '../hooks/useDepartmentReport';

export function minsToHM(m: number): string {
  if (!m) return '0h 0m';
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function getInitials(fname: string, lname: string): string {
  return `${(fname[0] ?? '').toUpperCase()}${(lname[0] ?? '').toUpperCase()}`;
}

export function getTodayStr(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Formats a YYYY-MM-DD string for display.
 * Appends T00:00:00 so JS parses it as LOCAL midnight, not UTC midnight.
 * Without this, "2026-03-17" → new Date("2026-03-17") → UTC midnight
 * → in UTC+8 that's March 17 08:00 local, BUT getDate() returns 17 — 
 * actually safe here. The key is the T00:00:00 suffix forces local parsing.
 */
export function formatDisplayDate(d: string): string {
  // Ensure we parse as local time by appending T00:00:00 (no Z)
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('en-PH', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

export const STATUS_BADGE: Record<string, string> = {
  'Present':    'bg-green-50 text-green-700 border-green-200',
  'Absent':     'bg-red-50 text-red-600 border-red-200',
};

/** Group rows by log_date, sorted ascending */
export function groupByDate(rows: DeptAttendanceRow[]): Map<string, DeptAttendanceRow[]> {
  const map = new Map<string, DeptAttendanceRow[]>();
  rows.forEach((r) => {
    const existing = map.get(r.log_date) ?? [];
    existing.push(r);
    map.set(r.log_date, existing);
  });
  return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/** Employees who have 'On Time' punctuality consistently (all records are 'On Time') */
export function getConsistentlyOnTime(rows: DeptAttendanceRow[]): string[] {
  const onTimeMap: Record<number, boolean> = {};
  const notOnTimeMap: Record<number, boolean> = {};
  const nameMap: Record<number, string>  = {};
  rows.forEach((r) => {
    nameMap[r.user_id] = `${r.user_fname} ${r.user_lname}`;
    if (r.punctuality === 'On Time') {
      onTimeMap[r.user_id] = true;
    } else if (r.punctuality !== null) {
      notOnTimeMap[r.user_id] = true;
    }
  });
  return Object.keys(nameMap)
    .filter((id) => onTimeMap[Number(id)] && !notOnTimeMap[Number(id)])
    .map((id) => nameMap[Number(id)]);
}