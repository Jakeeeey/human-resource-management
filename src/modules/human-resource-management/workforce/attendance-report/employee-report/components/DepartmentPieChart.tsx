// employee-report/components/DepartmentPieChart.tsx
// Pie chart showing employee count per department + legend list on the right.

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import type { Employee } from "../hooks/useEmployeeReport";

const COLORS = [
  "#3b82f6","#8b5cf6","#22c55e","#f97316","#ef4444",
  "#06b6d4","#ec4899","#eab308","#a855f7","#14b8a6",
  "#f43f5e","#84cc16","#0ea5e9","#d946ef","#64748b",
];

interface Props { employees: Employee[] }

export function DepartmentPieChart({ employees }: Props) {
  // Count employees per department
  const countMap: Record<string, number> = {};
  employees.forEach((e) => {
    const name = String(e.department_name ?? "Unknown");
    countMap[name] = (countMap[name] ?? 0) + 1;
  });

  const data = Object.entries(countMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <Card className="shadow-none border-border">
      <CardHeader className="border-b border-border/50 pb-3">
        <CardTitle className="text-sm font-bold">Employees by Department</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[220px]">
            <p className="text-sm text-muted-foreground">No data available</p>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            {/* Donut pie */}
            <div className="flex-shrink-0 w-[180px] h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    innerRadius={52}
                    outerRadius={82}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {data.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const e = payload[0].payload;
                      return (
                        <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-xs space-y-0.5">
                          <p className="font-bold text-foreground">{e.name}</p>
                          <p className="text-muted-foreground">
                            {e.value} employee{e.value !== 1 ? "s" : ""}{" "}
                            ({((e.value / total) * 100).toFixed(1)}%)
                          </p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Department list */}
            <div className="flex-1 min-w-0 overflow-y-auto max-h-[220px] space-y-1 pr-1">
              {data.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between gap-2 py-1 border-b border-border/30 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-xs text-foreground font-medium truncate" title={d.name}>
                      {d.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {((d.value / total) * 100).toFixed(0)}%
                    </span>
                    <span className="text-xs font-bold text-foreground w-5 text-right">
                      {d.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
