// employee-report/utils/index.ts

export function formatTime(t: string | null): string {
  if (!t) return "—";
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr);
  return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${mStr}${h >= 12 ? "pm" : "am"}`;
}

export function minsToHM(m: number): string {
  if (!m) return "0h 0m";
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function getInitials(fname: string, lname: string): string {
  return `${(fname[0] ?? "").toUpperCase()}${(lname[0] ?? "").toUpperCase()}`;
}


export function getWeekRange(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { from: mon.toISOString().split("T")[0], to: sun.toISOString().split("T")[0] };
}

export const STATUS_COLORS: Record<string, string> = {
  "On Time":   "#22c55e",
  "Late":      "#f97316",
  "Absent":    "#ef4444",
  "Half Day":  "#a855f7",
  "Leave":     "#3b82f6",
  "Holiday":   "#94a3b8",
  "Incomplete":"#eab308",
};

export function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    "On Time":   "bg-green-50 text-green-700 border-green-200",
    "Late":      "bg-orange-50 text-orange-600 border-orange-200",
    "Absent":    "bg-red-50 text-red-600 border-red-200",
    "Half Day":  "bg-purple-50 text-purple-600 border-purple-200",
    "Leave":     "bg-blue-50 text-blue-600 border-blue-200",
    "Holiday":   "bg-slate-100 text-slate-500 border-slate-200",
    "Incomplete":"bg-yellow-50 text-yellow-600 border-yellow-200",
  };
  return map[status] ?? "bg-muted text-muted-foreground border-border";
}