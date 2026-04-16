// employee-report/components/StatusBarChart.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import type { EmployeeAttendanceRow } from "../hooks/useEmployeeReport";
import { STATUS_COLORS } from "../utils";


export function StatusBarChart({ logs }: { logs: EmployeeAttendanceRow[] }) {
  const map: Record<string, number> = {};
  logs.forEach((l) => { map[l.status] = (map[l.status] ?? 0) + 1; });
  const data = Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <Card className="shadow-none border-border">
      <CardHeader className="border-b border-border/50 pb-3">
        <CardTitle className="text-sm font-bold">Attendance Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[200px]">
            <p className="text-sm text-muted-foreground">No data for selected range</p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data} margin={{ top: 0, right: 8, left: 0, bottom: 0 }} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.1)" />
                <XAxis dataKey="name" fontSize={10} />
                <YAxis fontSize={10} allowDecimals={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-popover border border-border rounded-lg shadow px-3 py-2 text-xs">
                        <p className="font-bold text-foreground mb-1">{label}</p>
                        <p className="text-muted-foreground">Count: <span className="font-semibold text-foreground">{payload[0].value}</span></p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="count" name="Days" radius={[4, 4, 0, 0]} maxBarSize={36}>
                  {data.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.name] ?? "#3b82f6"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 pl-1">
              {data.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: STATUS_COLORS[d.name] ?? "#3b82f6" }} />
                  <span className="text-xs text-muted-foreground">{d.name} <span className="font-bold text-foreground">{d.count}</span></span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
