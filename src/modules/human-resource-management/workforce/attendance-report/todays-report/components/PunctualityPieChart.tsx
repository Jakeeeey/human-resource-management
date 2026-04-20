// todays-report/components/PunctualityPieChart.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { SearchX } from "lucide-react";
import { buildPunctualityData } from "../utils";
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

export function PunctualityPieChart({ records, isFiltered }: Props) {
  const data  = buildPunctualityData(records);
  const total = data.reduce((s, d) => s + d.value, 0);
  const isEmpty = isFiltered && total === 0;

  return (
    <Card className="shadow-none border-border">
      <CardHeader className="border-b border-border/50 pb-3">
        <CardTitle className="text-sm font-bold">Punctuality Overview</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {isEmpty ? (
          <EmptyState message="No punctuality data for the selected filters." />
        ) : total === 0 ? (
          <EmptyState message="No attendance data available." />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={data} innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" stroke="none">
                  {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const e = payload[0].payload;
                    return (
                      <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-xs space-y-0.5">
                        <p className="font-bold text-foreground">{e.name}</p>
                        <p className="text-muted-foreground">
                          {e.value} employees ({((e.value / total) * 100).toFixed(1)}%)
                        </p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-5 mt-1">
              {data.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-xs text-muted-foreground">
                    {d.name} <span className="font-bold text-foreground">{d.value}</span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
