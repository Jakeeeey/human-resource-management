"use client";

import * as React from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { BarChart3, Inbox, Table2 } from "lucide-react";
import type { PerformanceDashboardPerformer } from "../types/performance-dashboard.schema";

const CARD_SHELL =
    "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.05)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.45)]";

const BAND_TONE: Record<string, StatusTone> = {
    Outstanding: "success",
    "Very Good": "info",
    Satisfactory: "neutral",
    "Needs Improvement": "warning",
    Unsatisfactory: "destructive",
};

const BAND_BADGE_CLASS: Record<StatusTone, string> = {
    neutral: "border-transparent bg-muted text-foreground",
    success: "border-transparent bg-[hsl(var(--success-bg))] text-[hsl(var(--success))]",
    warning: "border-transparent bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning))]",
    info: "border-transparent bg-[hsl(var(--info-bg))] text-[hsl(var(--info))]",
    destructive: "border-transparent bg-destructive/10 text-destructive",
};

function performerShort(name: string): string {
    return name.length > 18 ? `${name.slice(0, 17)}…` : name;
}

export function TopPerformersPanel({ performers }: { readonly performers: readonly PerformanceDashboardPerformer[] }) {
    const [view, setView] = React.useState<"chart" | "table">("chart");
    const rows = React.useMemo(
        () => [...performers].sort((a, b) => b.score - a.score),
        [performers]
    );
    const chartRows = React.useMemo(
        () => [...rows].reverse().map((row) => ({ ...row, short: performerShort(row.name) })),
        [rows]
    );
    const title = "Top Performers";
    const subtitle = `Ranked by evaluation score · top ${rows.length}`;
    const chartHeight = Math.max(220, Math.min(420, 72 + chartRows.length * 40));
    const ariaSummary = rows.length === 0
        ? "Top performers chart with no data"
        : `Top performers chart. ${rows.slice(0, 5).map((r) => `${r.name} ${r.score.toFixed(2)}`).join(", ")}.`;
    return (
        <Card className={`${CARD_SHELL} h-full`}>
            <CardContent className="flex h-full flex-col p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                        <h2 className="truncate text-base font-bold tracking-tight text-foreground">{title}</h2>
                        <p className="mt-1 text-xs tabular-nums text-muted-foreground">{subtitle}</p>
                    </div>
                    {rows.length > 0 && (
                        <div role="group" aria-label="Top performers view" className="flex shrink-0 gap-1 rounded-full border border-border bg-muted/60 p-1">
                            <button
                                type="button"
                                aria-pressed={view === "chart"}
                                aria-label="Show as chart"
                                onClick={() => setView("chart")}
                                className={view === "chart"
                                    ? "rounded-full bg-background p-1.5 text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    : "rounded-full p-1.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"}
                            >
                                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                                type="button"
                                aria-pressed={view === "table"}
                                aria-label="Show as table"
                                onClick={() => setView("table")}
                                className={view === "table"
                                    ? "rounded-full bg-background p-1.5 text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    : "rounded-full p-1.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"}
                            >
                                <Table2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                        </div>
                    )}
                </div>
                {rows.length === 0 ? (
                    <div className="flex min-h-[280px] flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
                        <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                        <p className="text-sm font-medium text-foreground">No top performers yet</p>
                        <p className="max-w-xs text-xs text-muted-foreground">
                            Ranked performers will appear here once evaluations are recorded.
                        </p>
                    </div>
                ) : view === "table" ? (
                    <div className="mt-3 overflow-x-auto rounded-xl border border-border">
                        <table className="w-full min-w-[420px] text-left text-xs">
                            <thead className="bg-muted/80">
                                <tr>
                                    <th scope="col" className="px-3 py-2 font-semibold tabular-nums text-muted-foreground">#</th>
                                    <th scope="col" className="px-3 py-2 font-semibold text-muted-foreground">Name</th>
                                    <th scope="col" className="px-3 py-2 font-semibold text-muted-foreground">Department</th>
                                    <th scope="col" className="px-3 py-2 text-right font-semibold tabular-nums text-muted-foreground">Score</th>
                                    <th scope="col" className="px-3 py-2 font-semibold text-muted-foreground">Band</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {rows.map((row, index) => {
                                    const tone = BAND_TONE[row.band] ?? "neutral";
                                    return (
                                        <tr key={row.user_id}>
                                            <td className="px-3 py-2 tabular-nums text-muted-foreground">{index + 1}</td>
                                            <td className="max-w-[140px] truncate px-3 py-2 font-medium text-foreground" title={row.name}>
                                                {row.name}
                                            </td>
                                            <td className="max-w-[120px] truncate px-3 py-2 text-muted-foreground" title={row.department_name ?? "—"}>
                                                {row.department_name ?? "—"}
                                            </td>
                                            <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">
                                                {row.score.toFixed(2)}
                                            </td>
                                            <td className="px-3 py-2">
                                                <StatusBadge tone={tone} className={BAND_BADGE_CLASS[tone]}>
                                                    {row.band}
                                                </StatusBadge>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="mt-3 min-h-[220px] flex-1" style={{ height: chartHeight }} role="img" aria-label={ariaSummary}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartRows} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
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
                                    formatter={(value) => [typeof value === "number" ? value.toFixed(2) : value, "Score"]}
                                    labelFormatter={(label) => {
                                        const row = chartRows.find((entry) => entry.short === label);
                                        return row ? `${row.name} · ${row.band}` : label;
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
                                <Bar dataKey="score" name="Score" fill="#10b981" radius={[0, 8, 8, 0]} maxBarSize={26} isAnimationActive={false} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
