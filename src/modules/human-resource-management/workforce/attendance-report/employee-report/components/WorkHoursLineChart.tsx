// employee-report/components/WorkHoursLineChart.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";
import type { EmployeeAttendanceRow } from "../hooks/useEmployeeReport";

/** Convert total minutes to "Xh Ym" string */
function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Convert minutes to decimal hours for the Y-axis scale */
function minsToHrs(mins: number): number {
  return parseFloat((mins / 60).toFixed(2));
}

export function WorkHoursLineChart({ logs }: { logs: EmployeeAttendanceRow[] }) {
  const data = logs
    .filter((l) => l.work_hours > 0)
    .slice(0, 14)
    .reverse()
    .map((l) => ({
      date:         l.log_date.slice(5),
      workMins:     l.work_hours,
      lateMins:     l.late,
      overtimeMins: l.overtime ?? 0,
      hours:        minsToHrs(l.work_hours),
      late:         minsToHrs(l.late),
      overtime:     minsToHrs(l.overtime ?? 0),
    }));

  return (
    <Card className="shadow-none border-border">
      <CardHeader className="border-b border-border/50 pb-3">
        <CardTitle className="text-sm font-bold">Work Hours Trend</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[200px]">
            <p className="text-sm text-muted-foreground">No data for selected range</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.1)" />
              <XAxis dataKey="date" fontSize={10} />
              <YAxis
                fontSize={10}
                tickFormatter={(v) => `${v}h`}
                allowDecimals={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const point = data.find((d) => d.date === label);
                  return (
                    <div className="bg-popover border border-border rounded-lg shadow px-3 py-2 text-xs space-y-1">
                      <p className="font-bold text-foreground">{label}</p>
                      {payload.map((p, i) => {
                        const rawMins =
                          p.dataKey === "hours"
                            ? (point?.workMins ?? 0)
                            : p.dataKey === "late"
                            ? (point?.lateMins ?? 0)
                            : (point?.overtimeMins ?? 0);
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: p.color }} />
                            <span className="text-muted-foreground">{p.name}:</span>
                            <span className="font-semibold">{fmtMins(rawMins)}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="hours"    name="Work Hrs"     stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="overtime" name="Overtime Hrs" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="late"     name="Late Hrs"     stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
