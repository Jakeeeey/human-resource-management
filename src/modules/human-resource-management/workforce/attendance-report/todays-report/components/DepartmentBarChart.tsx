// todays-report/components/DepartmentBarChart.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { SearchX } from "lucide-react";
import { buildDeptChartData } from "../utils";
import type { AttendanceRecord } from "../../../attendance-report/todays-report/hooks/useAttendance";

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[200px] gap-2">
      <SearchX className="w-7 h-7 text-muted-foreground/40" />
      <p className="text-sm font-medium text-muted-foreground">No data available</p>
      <p className="text-xs text-muted-foreground/60 max-w-[180px] text-center">{message}</p>
    </div>
  );
}

interface Props { records: AttendanceRecord[]; isFiltered?: boolean; }

export function DepartmentBarChart({ records, isFiltered }: Props) {
  const data    = buildDeptChartData(records);
  const isEmpty = isFiltered && data.length === 0;

  return (
    <Card className="shadow-none border-border">
      <CardHeader className="border-b border-border/50 pb-3">
        <CardTitle className="text-sm font-bold">Attendance by Department</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {isEmpty ? (
          <EmptyState message="No department data for the selected filters." />
        ) : data.length === 0 ? (
          <EmptyState message="No attendance data available." />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data} margin={{ top: 0, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.1)" />
                <XAxis dataKey="name" fontSize={10} tickFormatter={(v) => v.length > 8 ? v.slice(0, 8) + "…" : v} />
                <YAxis fontSize={10} allowDecimals={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-xs space-y-1">
                        <p className="font-bold text-foreground mb-1">{label}</p>
                        {payload.map((p, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: p.fill }} />
                            <span className="text-muted-foreground">{p.name}:</span>
                            <span className="font-semibold text-foreground">{p.value}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Bar dataKey="onTime" name="On Time" fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={20} />
                <Bar dataKey="late"   name="Late"    fill="#f97316" radius={[3, 3, 0, 0]} maxBarSize={20} />
                <Bar dataKey="absent" name="Absent"  fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-5 mt-2 pl-1">
              {[["#22c55e", "On Time"], ["#f97316", "Late"], ["#ef4444", "Absent"]].map(([color, label]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
