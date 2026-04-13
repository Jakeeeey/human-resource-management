// todays-report/utils/index.ts

import type { AttendanceRecord } from '../hooks/useAttendance';

export function formatTime(t: string | null): string {
  if (!t) return "—";
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr);
  const period = h >= 12 ? "pm" : "am";
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${mStr}${period}`;
}

export interface FilterState {
  statusFilter:      string;
  punctualityFilter: string;
  deptFilter:        string;
  search:            string;
}

export function applyFilters(records: AttendanceRecord[], f: FilterState): AttendanceRecord[] {
  return records.filter((r) => {
    // Status filter — map new statuses to record properties
    if (f.statusFilter !== "All") {
      if (f.statusFilter === "Present" && r.presentStatus !== "Present") return false;
      if (f.statusFilter === "Absent" && r.presentStatus !== "Absent") return false;
      if (f.statusFilter === "Not Present" && r.presentStatus !== "Absent") return false;
      if (f.statusFilter === "Rest Day" && r.status !== "Rest Day") return false;
    }
    if (f.punctualityFilter !== "All" && r.punctuality !== f.punctualityFilter) return false;
    if (f.deptFilter !== "All" && r.user_department !== f.deptFilter)           return false;
    const q = f.search.toLowerCase();
    if (q && !`${r.user_fname} ${r.user_lname}`.toLowerCase().includes(q) &&
             !r.user_email.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function buildDeptChartData(records: AttendanceRecord[]) {
  const map: Record<string, { onTime: number; late: number; absent: number }> = {};
  records.forEach((r) => {
    const d = r.user_department;
    if (!map[d]) map[d] = { onTime: 0, late: 0, absent: 0 };
    if (r.presentStatus === "Absent")     map[d].absent++;
    else if (r.punctuality === "Late")    map[d].late++;
    else if (r.punctuality === "On Time") map[d].onTime++;
  });
  return Object.entries(map).map(([name, v]) => ({ name, ...v }));
}

export function buildPunctualityData(records: AttendanceRecord[]) {
  return [
    { name: "On Time", value: records.filter((r) => r.punctuality === "On Time").length, color: "#22c55e" },
    { name: "Late",    value: records.filter((r) => r.punctuality === "Late").length,    color: "#f97316" },
    { name: "Absent",  value: records.filter((r) => r.presentStatus === "Absent").length, color: "#ef4444" },
  ].filter((d) => d.value > 0);
}