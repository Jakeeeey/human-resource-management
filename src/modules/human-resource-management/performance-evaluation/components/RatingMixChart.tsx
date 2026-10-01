"use client";

import * as React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Inbox } from "lucide-react";
import type { PerformanceDashboardBandCount } from "../types/performance-dashboard.schema";

const CARD_SHELL =
    "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.05)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.45)]";

const BAND_ORDER = ["Outstanding", "Very Good", "Satisfactory", "Needs Improvement", "Unsatisfactory"];

const BAND_FILL: Record<string, string> = {
    Outstanding: "#10b981",
    "Very Good": "#0ea5e9",
    Satisfactory: "#94a3b8",
    "Needs Improvement": "#f59e0b",
    Unsatisfactory: "#f43f5e",
};

interface BandSlice {
    readonly band: string;
    readonly count: number;
    readonly fill: string;
}

export function RatingMixChart({ distribution }: { readonly distribution: readonly PerformanceDashboardBandCount[] }) {
    const slices = React.useMemo<BandSlice[]>(() => {
        const counts = new Map(distribution.map((entry) => [entry.band, entry.count]));
        return BAND_ORDER.map((band) => ({
            band,
            count: counts.get(band) ?? 0,
            fill: BAND_FILL[band] ?? "#94a3b8",
        }));
    }, [distribution]);
    const total = slices.reduce((sum, slice) => sum + slice.count, 0);
    const title = "Rating Distribution";
    const subtitle = `Share of ratings · n=${total} evaluated`;
    const ariaSummary = total === 0
        ? "Rating mix chart with no data"
        : `Rating mix chart. ${slices.map((s) => `${s.band} ${s.count}`).join(", ")}.`;
    return (
        <Card className={`${CARD_SHELL} h-full`}>
            <CardContent className="flex h-full flex-col p-5 sm:p-6">
                <h2 className="truncate text-base font-bold tracking-tight text-foreground">{title}</h2>
                <p className="mt-1 text-xs tabular-nums text-muted-foreground">{subtitle}</p>
                {total === 0 ? (
                    <div className="flex min-h-[280px] flex-1 flex-col items-center justify-center gap-2 py-10 text-center sm:min-h-[320px]">
                        <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                        <p className="text-sm font-medium text-foreground">No ratings yet</p>
                        <p className="max-w-xs text-xs text-muted-foreground">
                            The rating mix will appear here once evaluations are recorded.
                        </p>
                    </div>
                ) : (
                    <React.Fragment>
                        <div className="relative mx-auto mt-2 h-[200px] w-full max-w-[280px] sm:h-[220px]" role="img" aria-label={ariaSummary}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Tooltip
                                        formatter={(value, name) => [value, name]}
                                        contentStyle={{
                                            backgroundColor: "#1e1b4b",
                                            border: "none",
                                            borderRadius: 12,
                                            fontSize: 12,
                                            color: "#ffffff",
                                        }}
                                    />
                                    <Pie
                                        data={slices}
                                        dataKey="count"
                                        nameKey="band"
                                        innerRadius="64%"
                                        outerRadius="88%"
                                        paddingAngle={2}
                                        strokeWidth={0}
                                        isAnimationActive={false}
                                    >
                                        {slices.map((slice) => (
                                            <Cell key={slice.band} fill={slice.fill} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-3xl font-bold tabular-nums tracking-tight text-foreground">{total}</span>
                                <span className="text-xs text-muted-foreground">evaluated</span>
                            </div>
                        </div>
                        <ul className="mt-3 space-y-1.5">
                            {slices.map((slice) => (
                                <li key={slice.band} className="flex items-center gap-2 text-xs">
                                    <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: slice.fill }} aria-hidden="true" />
                                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">{slice.band}</span>
                                    <span className="shrink-0 tabular-nums text-muted-foreground">
                                        {slice.count} · {total > 0 ? ((slice.count / total) * 100).toFixed(0) : "0"}%
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </React.Fragment>
                )}
            </CardContent>
        </Card>
    );
}
