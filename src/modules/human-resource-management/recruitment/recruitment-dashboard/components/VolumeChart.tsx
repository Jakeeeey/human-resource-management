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
import type { DayBucket, Granularity } from "../types";
import { GRANULARITIES } from "../types";

type Bucket = {
    readonly key: string;
    readonly label: string;
    readonly count: number;
};

function mondayOf(day: string): string {
    const date = new Date(`${day}T00:00:00Z`);
    const dow = (date.getUTCDay() + 6) % 7;
    const monday = new Date(date.getTime() - dow * 86400000);
    return monday.toISOString().slice(0, 10);
}

function parseDay(day: string): Date {
    return new Date(`${day}T00:00:00Z`);
}

function formatDay(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function eachDay(start: string, end: string): string[] {
    const days: string[] = [];
    const cursor = parseDay(start);
    const last = parseDay(end);
    while (cursor.getTime() <= last.getTime()) {
        days.push(formatDay(cursor));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return days;
}

function eachMonth(start: string, end: string): string[] {
    const months: string[] = [];
    let year = Number(start.slice(0, 4));
    let month = Number(start.slice(5, 7));
    const endYear = Number(end.slice(0, 4));
    const endMonth = Number(end.slice(5, 7));
    while (year < endYear || (year === endYear && month <= endMonth)) {
        months.push(`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`);
        month += 1;
        if (month > 12) {
            month = 1;
            year += 1;
        }
    }
    return months;
}

function addDays(day: string, amount: number): string {
    return formatDay(new Date(parseDay(day).getTime() + amount * 86400000));
}

function bucketize(
    daily: readonly DayBucket[],
    granularity: Granularity,
    rangeStart: string | null,
    rangeEnd: string | null
): Bucket[] {
    const counts = new Map(daily.map((d) => [d.day, d.count]));
    if (rangeStart === null || rangeEnd === null || rangeStart > rangeEnd) {
        return daily.map((d) => ({ key: d.day, label: d.day.slice(5), count: d.count }));
    }
    if (granularity === "day") {
        return eachDay(rangeStart, rangeEnd).map((day) => ({
            key: day,
            label: day.slice(5),
            count: counts.get(day) ?? 0,
        }));
    }
    if (granularity === "month") {
        return eachMonth(rangeStart, rangeEnd).map((month) => {
            let count = 0;
            for (const [day, dayCount] of counts) {
                if (day.startsWith(month)) count += dayCount;
            }
            return { key: month, label: month, count };
        });
    }
    const mondays: string[] = [];
    let cursor = mondayOf(rangeStart);
    while (cursor <= rangeEnd) {
        mondays.push(cursor);
        cursor = addDays(cursor, 7);
    }
    return mondays.map((monday) => {
        const weekEnd = addDays(monday, 6);
        let count = 0;
        for (const [day, dayCount] of counts) {
            if (day >= monday && day <= weekEnd) count += dayCount;
        }
        return { key: monday, label: `w/o ${monday.slice(5)}`, count };
    });
}

const GRANULARITY_LABELS: Record<Granularity, string> = {
    day: "Daily",
    week: "Weekly",
    month: "Monthly",
};

const GRADIENT_TOP = "#8b5cf6";
const GRADIENT_BOTTOM = "#6366f1";
const FALLBACK_GRADIENT_ID = "volumeBarGradient";

type PaletteEntry = {
    readonly from: string;
    readonly to: string;
};

const PALETTES: Record<Granularity, readonly PaletteEntry[]> = {
    day: [
        { from: "#a78bfa", to: "#8b5cf6" },
        { from: "#8b5cf6", to: "#7c3aed" },
        { from: "#818cf8", to: "#6366f1" },
        { from: "#a5b4fc", to: "#818cf8" },
    ],
    week: [
        { from: "#818cf8", to: "#6366f1" },
        { from: "#60a5fa", to: "#3b82f6" },
        { from: "#38bdf8", to: "#0ea5e9" },
        { from: "#7dd3fc", to: "#38bdf8" },
    ],
    month: [
        { from: "#c084fc", to: "#a855f7" },
        { from: "#e879f9", to: "#c026d3" },
        { from: "#f0abfc", to: "#d946ef" },
        { from: "#a78bfa", to: "#8b5cf6" },
    ],
};

function gradientId(granularity: Granularity, index: number): string {
    const palette = PALETTES[granularity];
    return `vol-${granularity}-${index % palette.length}`;
}

export function GranularityControl({
    value,
    onChange,
}: {
    readonly value: Granularity;
    readonly onChange: (granularity: Granularity) => void;
}) {
    return (
        <div
            role="group"
            aria-label="Applicant volume granularity"
            className="flex gap-1 rounded-full border border-border/70 bg-muted/60 p-1"
        >
            {GRANULARITIES.map((g) => {
                const active = value === g;
                return (
                    <button
                        key={g}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onChange(g)}
                        className={
                            active
                                ? "rounded-full bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                : "rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        }
                    >
                        {GRANULARITY_LABELS[g]}
                    </button>
                );
            })}
        </div>
    );
}

export function VolumeChart({
    daily,
    rangeStart,
    rangeEnd,
    granularity: controlledGranularity,
    onGranularityChange,
}: {
    readonly daily: readonly DayBucket[];
    readonly rangeStart: string | null;
    readonly rangeEnd: string | null;
    readonly granularity?: Granularity;
    readonly onGranularityChange?: (granularity: Granularity) => void;
}) {
    const [innerGranularity, setInnerGranularity] = React.useState<Granularity>("day");
    const granularity = controlledGranularity ?? innerGranularity;
    const handleChange = React.useCallback(
        (next: Granularity) => {
            setInnerGranularity(next);
            onGranularityChange?.(next);
        },
        [onGranularityChange]
    );
    const buckets = React.useMemo(
        () => bucketize(daily, granularity, rangeStart, rangeEnd),
        [daily, granularity, rangeStart, rangeEnd]
    );
    const total = buckets.reduce((sum, b) => sum + b.count, 0);
    const tickInterval: number | "preserveStartEnd" =
        buckets.length <= 12 ? "preserveStartEnd" : Math.ceil(buckets.length / 9) - 1;
    const palette = PALETTES[granularity];
    return (
        <Card className="flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)] dark:border-white/25 dark:bg-card dark:shadow-[0_4px_16px_rgba(0,0,0,0.45)]">
            <CardContent className="flex flex-1 flex-col px-5 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="text-base font-bold tracking-tight text-foreground">Applicant volume</h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {rangeStart && rangeEnd
                                ? `${total} applicants from ${rangeStart} to ${rangeEnd}`
                                : "No applications in range"}
                        </p>
                    </div>
                    <div className="shrink-0">
                        <GranularityControl value={granularity} onChange={handleChange} />
                    </div>
                </div>
                {buckets.length === 0 ? (
                    <p className="flex flex-1 items-center justify-center py-10 text-center text-sm text-muted-foreground">
                        No applicant activity yet.
                    </p>
                ) : (
                    <div className="mt-3 min-h-[248px] flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={buckets} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                                <defs>
                                    <linearGradient id={FALLBACK_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={GRADIENT_TOP} />
                                        <stop offset="100%" stopColor={GRADIENT_BOTTOM} />
                                    </linearGradient>
                                    {palette.map((entry, index) => (
                                        <linearGradient
                                            key={`vol-${granularity}-${index}`}
                                            id={`vol-${granularity}-${index}`}
                                            x1="0"
                                            y1="0"
                                            x2="0"
                                            y2="1"
                                        >
                                            <stop offset="0%" stopColor={entry.from} />
                                            <stop offset="100%" stopColor={entry.to} />
                                        </linearGradient>
                                    ))}
                                </defs>
                                <CartesianGrid
                                    stroke="#cbd5e1"
                                    strokeOpacity={0.45}
                                    strokeDasharray="2 6"
                                    vertical={false}
                                />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                                    tickLine={false}
                                    axisLine={false}
                                    interval={tickInterval}
                                />
                                <YAxis
                                    allowDecimals={false}
                                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                                    tickLine={false}
                                    axisLine={false}
                                    width={36}
                                />
                                <Tooltip
                                    formatter={(value) => [value, "Applicants"]}
                                    labelFormatter={(label) => `Period: ${label}`}
                                    contentStyle={{
                                        backgroundColor: "#1e1b4b",
                                        border: "none",
                                        borderRadius: 12,
                                        fontSize: 12,
                                        color: "#ffffff",
                                    }}
                                    cursor={{ fill: "#7c3aed", fillOpacity: 0.1 }}
                                />
                                <Bar dataKey="count" fill={`url(#${FALLBACK_GRADIENT_ID})`} radius={[8, 8, 0, 0]} maxBarSize={30} isAnimationActive={false}>
                                    {buckets.map((bucket, index) => (
                                        <Cell
                                            key={bucket.key}
                                            fill={`url(#${gradientId(granularity, index)})`}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
