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
import { Inbox } from "lucide-react";
import type { ClearanceDashboardAgingBin } from "../types/clearance-dashboard.schema";

const CARD_SHELL =
    "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.05)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.45)]";

const CHART_TICK_FILL = "hsl(var(--muted-foreground))";
const CHART_GRID_STROKE = "hsl(var(--border))";
const CHART_SERIES_FILL = "hsl(var(--warning))";
const CHART_CURSOR_FILL = "hsl(var(--primary))";

export function ClearanceAgingChart({
    bins,
    staleAfterDays,
}: {
    readonly bins: readonly ClearanceDashboardAgingBin[];
    readonly staleAfterDays: number;
}) {
    const rows = React.useMemo(
        () =>
            bins.map((entry) => ({
                label: entry.bin,
                count: entry.count,
            })),
        [bins]
    );
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    const title = "Open Clearance Aging";
    const subtitle = `Open clearances by days since created · ${total} open · stalled after ${staleAfterDays} days`;
    const ariaSummary =
        total === 0
            ? "Open clearance aging chart with no data"
            : `Open clearance aging chart. ${rows.map((r) => `${r.label}: ${r.count}`).join(", ")}.`;
    return (
        <Card className={`${CARD_SHELL} h-full`}>
            <CardContent className="flex h-full flex-col p-5 sm:p-6">
                <h2 className="truncate text-base font-bold tracking-tight text-foreground">{title}</h2>
                <p className="mt-1 text-xs tabular-nums text-muted-foreground">{subtitle}</p>
                {total === 0 ? (
                    <div className="flex min-h-[280px] flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
                        <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                        <p className="text-sm font-medium text-foreground">No open clearances</p>
                        <p className="max-w-xs text-xs text-muted-foreground">
                            The aging spread will appear here while clearances stay open.
                        </p>
                    </div>
                ) : (
                    <div className="mt-3 h-[220px] min-h-[220px] flex-1 sm:h-[260px]" role="img" aria-label={ariaSummary}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 8, left: -16 }}>
                                <CartesianGrid stroke={CHART_GRID_STROKE} vertical={false} />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 11, fill: CHART_TICK_FILL }}
                                    tickLine={false}
                                    axisLine={false}
                                    interval={0}
                                    angle={-20}
                                    dy={8}
                                    height={52}
                                />
                                <YAxis
                                    allowDecimals={false}
                                    domain={[0, "dataMax"]}
                                    tick={{ fontSize: 11, fill: CHART_TICK_FILL }}
                                    tickLine={false}
                                    axisLine={false}
                                    width={36}
                                />
                                <Tooltip
                                    formatter={(value) => [value, "Clearances"]}
                                    labelFormatter={(label) => `Open for: ${label}`}
                                    contentStyle={{
                                        backgroundColor: "hsl(var(--popover))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: 12,
                                        fontSize: 12,
                                    }}
                                    labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                                    itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                                    cursor={{ fill: CHART_CURSOR_FILL, fillOpacity: 0.1 }}
                                />
                                <Bar dataKey="count" name="Clearances" fill={CHART_SERIES_FILL} radius={[8, 8, 0, 0]} maxBarSize={44} isAnimationActive={false} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
