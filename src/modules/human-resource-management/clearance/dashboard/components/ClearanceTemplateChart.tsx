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
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import type { ClearanceDashboardTemplateRow } from "../types/clearance-dashboard.schema";

const CARD_SHELL =
    "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.05)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.45)]";

const CHART_LIMIT = 8;
const PAGE_SIZE = 6;

const FOCUS_RING =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function pluralize(count: number, singular: string, plural: string): string {
    return `${count} ${count === 1 ? singular : plural}`;
}

interface TemplateChartRow {
    readonly name: string;
    readonly completed: number;
    readonly total: number;
}

export function ClearanceTemplateChart({ rows }: { readonly rows: readonly ClearanceDashboardTemplateRow[] }) {
    const [page, setPage] = React.useState(0);
    const tableRows = React.useMemo(() => [...rows], [rows]);
    const chartRows = React.useMemo<TemplateChartRow[]>(() => {
        const top = [...rows].slice(0, CHART_LIMIT);
        const rest = rows.slice(CHART_LIMIT);
        const mapped = top.map((row) => ({
            name: row.template_title,
            completed: row.completed,
            total: row.total,
        }));
        if (rest.length > 0) {
            mapped.push({
                name: "Other",
                completed: rest.reduce((sum, row) => sum + row.completed, 0),
                total: rest.reduce((sum, row) => sum + row.total, 0),
            });
        }
        return mapped.reverse();
    }, [rows]);
    const pageCount = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
    const safePage = Math.min(page, pageCount - 1);
    const pageRows = tableRows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
    const totalCompleted = rows.reduce((sum, row) => sum + row.completed, 0);
    const totalAssigned = rows.reduce((sum, row) => sum + row.total, 0);
    const title = "Completions by Template";
    const subtitle = rows.length > CHART_LIMIT
        ? `Completed per template · ${totalCompleted} completed of ${totalAssigned} assigned · chart shows top ${CHART_LIMIT} of ${rows.length}`
        : `Completed per template · ${totalCompleted} completed of ${totalAssigned} assigned`;
    const chartHeight = Math.max(220, Math.min(420, 72 + chartRows.length * 40));
    const ariaSummary = chartRows.length === 0
        ? "Completions by template chart with no data"
        : `Completions by template chart. ${chartRows.map((r) => `${r.name} ${r.completed}`).join(", ")}.`;
    return (
        <Card className={`${CARD_SHELL} h-full`}>
            <CardContent className="flex h-full flex-col p-5 sm:p-6">
                <h2 className="truncate text-base font-bold tracking-tight text-foreground">{title}</h2>
                <p className="mt-1 text-xs tabular-nums text-muted-foreground">{subtitle}</p>
                {rows.length === 0 ? (
                    <div className="flex min-h-[280px] flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
                        <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                        <p className="text-sm font-medium text-foreground">No templates in use yet</p>
                        <p className="max-w-xs text-xs text-muted-foreground">
                            Per-template completions will appear here once clearances are assigned.
                        </p>
                    </div>
                ) : (
                    <React.Fragment>
                        <div className="mt-3 min-h-[220px] flex-1" style={{ height: chartHeight }} role="img" aria-label={ariaSummary}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartRows} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
                                    <CartesianGrid stroke="#94a3b8" strokeOpacity={0.12} vertical={false} />
                                    <XAxis type="number" allowDecimals={false} domain={[0, "dataMax"]} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                                        tickLine={false}
                                        axisLine={false}
                                        width={168}
                                    />
                                    <Tooltip
                                        formatter={(value, name) => {
                                            if (name === "Assigned") return [value, "Assigned"];
                                            return [value, "Completed"];
                                        }}
                                        labelFormatter={(label) => {
                                            const row = chartRows.find((entry) => entry.name === label);
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
                                    <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[0, 8, 8, 0]} maxBarSize={26} isAnimationActive={false} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-3 max-h-[320px] overflow-auto rounded-xl border border-border">
                            <table className="w-full min-w-[420px] text-left text-xs">
                                <thead className="sticky top-0 z-10 bg-muted">
                                    <tr>
                                        <th scope="col" className="px-3 py-2 font-semibold text-muted-foreground">Template</th>
                                        <th scope="col" className="px-3 py-2 text-right font-semibold tabular-nums text-muted-foreground">Completed</th>
                                        <th scope="col" className="px-3 py-2 text-right font-semibold tabular-nums text-muted-foreground">Assigned</th>
                                        <th scope="col" className="px-3 py-2 text-right font-semibold tabular-nums text-muted-foreground">Rate</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {pageRows.map((row) => (
                                        <tr key={row.template_id}>
                                            <td className="max-w-[180px] truncate px-3 py-2 font-medium text-foreground" title={row.template_title}>
                                                {row.template_title}
                                            </td>
                                            <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">
                                                {row.completed}
                                            </td>
                                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                                {row.total}
                                            </td>
                                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                                {row.total === 0 ? "No data" : `${((row.completed / row.total) * 100).toFixed(1)}%`}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {pageCount > 1 && (
                            <div className="mt-3 flex items-center justify-between gap-2">
                                <p className="text-xs tabular-nums text-muted-foreground">
                                    Page {safePage + 1} of {pageCount} · {pluralize(tableRows.length, "template", "templates")}
                                </p>
                                <div className="flex shrink-0 gap-1">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={safePage === 0}
                                        onClick={() => setPage(safePage - 1)}
                                        aria-label="Previous template page"
                                        className={`rounded-full ${FOCUS_RING}`}
                                    >
                                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={safePage >= pageCount - 1}
                                        onClick={() => setPage(safePage + 1)}
                                        aria-label="Next template page"
                                        className={`rounded-full ${FOCUS_RING}`}
                                    >
                                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </React.Fragment>
                )}
            </CardContent>
        </Card>
    );
}
