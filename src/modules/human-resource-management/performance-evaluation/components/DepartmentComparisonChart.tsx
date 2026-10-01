"use client";

import * as React from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Inbox } from "lucide-react";
import type { PerformanceDashboardDepartment } from "../types/performance-dashboard.schema";

const CARD_SHELL =
    "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.05)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.45)]";

const DEPARTMENT_FILLS = ["#8b5cf6", "#38bdf8", "#34d399", "#fbbf24", "#fb7185", "#94a3b8"];

function shortName(name: string): string {
    return name.length > 18 ? `${name.slice(0, 17)}…` : name;
}

interface DepartmentRow {
    readonly name: string;
    readonly short: string;
    readonly avg: number | null;
    readonly count: number;
    readonly highPct: number | null;
    readonly fill: string;
}

function weightedAvg(rows: readonly PerformanceDashboardDepartment[]): number | null {
    let weighted = 0;
    let weight = 0;
    for (const row of rows) {
        if (row.avg_score === null) continue;
        weighted += row.avg_score * row.count;
        weight += row.count;
    }
    return weight > 0 ? weighted / weight : null;
}

export function DepartmentComparisonChart({ departments }: { readonly departments: readonly PerformanceDashboardDepartment[] }) {
    const sorted = React.useMemo<DepartmentRow[]>(() => {
        const ranked = [...departments].sort((a, b) => (b.avg_score ?? -1) - (a.avg_score ?? -1));
        const head = ranked.slice(0, 5);
        const rest = ranked.slice(5);
        const rows: DepartmentRow[] = head
            .filter((row) => row.avg_score !== null)
            .map((row, index) => ({
                name: row.department_name,
                short: shortName(row.department_name),
                avg: row.avg_score,
                count: row.count,
                highPct: row.high_performer_pct,
                fill: DEPARTMENT_FILLS[index % DEPARTMENT_FILLS.length],
            }));
        if (rest.length > 0) {
            const avg = weightedAvg(rest);
            if (avg !== null) {
                rows.push({
                    name: `Other (${rest.length} departments)`,
                    short: `Other (${rest.length})`,
                    avg,
                    count: rest.reduce((sum, row) => sum + row.count, 0),
                    highPct: null,
                    fill: DEPARTMENT_FILLS[5],
                });
            }
        }
        return [...rows].reverse();
    }, [departments]);
    const tableRows = React.useMemo(
        () => [...departments].sort((a, b) => (b.avg_score ?? -1) - (a.avg_score ?? -1)),
        [departments]
    );
    const totalCount = departments.reduce((sum, row) => sum + row.count, 0);
    const title = "Average Score by Department";
    const subtitle = `Average score by department · ${totalCount} evaluated`;
    const ariaSummary = sorted.length === 0
        ? "Department comparison chart with no data"
        : `Department comparison chart. ${sorted.map((r) => `${r.name} ${r.avg !== null ? r.avg.toFixed(2) : "no data"}`).join(", ")}.`;
    return (
        <Card className={`${CARD_SHELL} h-full`}>
            <CardContent className="flex h-full flex-col p-5 sm:p-6">
                <h2 className="truncate text-base font-bold tracking-tight text-foreground">{title}</h2>
                <p className="mt-1 text-xs tabular-nums text-muted-foreground">{subtitle}</p>
                {sorted.length === 0 ? (
                    <div className="flex min-h-[280px] flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
                        <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                        <p className="text-sm font-medium text-foreground">No department scores yet</p>
                        <p className="max-w-xs text-xs text-muted-foreground">
                            Department averages will appear here once evaluations are recorded.
                        </p>
                    </div>
                ) : (
                    <React.Fragment>
                        <div className="mt-3 h-[220px] min-h-[220px] sm:h-[260px]" role="img" aria-label={ariaSummary}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
                                    <CartesianGrid stroke="#94a3b8" strokeOpacity={0.12} vertical={false} />
                                    <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                                    <YAxis
                                        type="category"
                                        dataKey="short"
                                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                                        tickLine={false}
                                        axisLine={false}
                                        width={128}
                                    />
                                    <Tooltip
                                        formatter={(value, name) => {
                                            if (name === "Evaluations") return [value, "Evaluations"];
                                            return [typeof value === "number" ? value.toFixed(2) : value, "Avg score"];
                                        }}
                                        labelFormatter={(label) => {
                                            const row = sorted.find((entry) => entry.short === label);
                                            return row ? row.name : label;
                                        }}
                                        contentStyle={{
                                            backgroundColor: "hsl(var(--popover))",
                                            border: "1px solid hsl(var(--border))",
                                            borderRadius: 12,
                                            fontSize: 12,
                                        }}
                                        labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                                        itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                                        cursor={{ fill: "#7c3aed", fillOpacity: 0.1 }}
                                    />
                                    <Bar dataKey="avg" name="Avg score" radius={[0, 8, 8, 0]} maxBarSize={26} isAnimationActive={false}>
                                        {sorted.map((row) => (
                                            <Cell key={row.name} fill={row.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-border">
                            <table className="w-full text-left text-xs">
                                <thead className="sticky top-0 bg-muted">
                                    <tr>
                                        <th scope="col" className="px-3 py-2 font-semibold text-muted-foreground">Department</th>
                                        <th scope="col" className="px-3 py-2 text-right font-semibold tabular-nums text-muted-foreground">Avg</th>
                                        <th scope="col" className="px-3 py-2 text-right font-semibold tabular-nums text-muted-foreground">n</th>
                                        <th scope="col" className="px-3 py-2 text-right font-semibold tabular-nums text-muted-foreground">High %</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {tableRows.map((row) => {
                                        const empty = row.count === 0;
                                        return (
                                            <tr key={`${row.department_id ?? "none"}-${row.department_name}`}>
                                                <td className="max-w-[140px] truncate px-3 py-2 font-medium text-foreground" title={row.department_name}>
                                                    {row.department_name}
                                                </td>
                                                <td className={empty ? "px-3 py-2 text-right tabular-nums text-muted-foreground" : "px-3 py-2 text-right tabular-nums text-foreground"}>
                                                    {empty ? "No evaluations yet" : row.avg_score === null ? "—" : row.avg_score.toFixed(2)}
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{row.count}</td>
                                                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                                    {row.high_performer_pct === null ? "—" : `${row.high_performer_pct.toFixed(1)}%`}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </React.Fragment>
                )}
            </CardContent>
        </Card>
    );
}
