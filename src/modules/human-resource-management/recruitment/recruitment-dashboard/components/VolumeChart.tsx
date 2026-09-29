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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

function bucketize(daily: readonly DayBucket[], granularity: Granularity): Bucket[] {
    if (granularity === "day") {
        return daily.map((d) => ({ key: d.day, label: d.day.slice(5), count: d.count }));
    }
    const totals = new Map<string, number>();
    for (const d of daily) {
        const key = granularity === "week" ? mondayOf(d.day) : d.day.slice(0, 7);
        totals.set(key, (totals.get(key) ?? 0) + d.count);
    }
    return [...totals.entries()]
        .map(([key, count]) => ({
            key,
            label: granularity === "week" ? `w/o ${key.slice(5)}` : key,
            count,
        }))
        .sort((a, b) => (a.key < b.key ? -1 : 1));
}

const GRANULARITY_LABELS: Record<Granularity, string> = {
    day: "Daily",
    week: "Weekly",
    month: "Monthly",
};

export function VolumeChart({
    daily,
    rangeStart,
    rangeEnd,
}: {
    readonly daily: readonly DayBucket[];
    readonly rangeStart: string | null;
    readonly rangeEnd: string | null;
}) {
    const [granularity, setGranularity] = React.useState<Granularity>("day");
    const buckets = React.useMemo(() => bucketize(daily, granularity), [daily, granularity]);
    const total = buckets.reduce((sum, b) => sum + b.count, 0);
    return (
        <Card>
            <CardHeader className="border-b">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <CardTitle className="text-sm font-bold">Applicant volume</CardTitle>
                        <CardDescription>
                            {rangeStart && rangeEnd
                                ? `${total} applicants from ${rangeStart} to ${rangeEnd}`
                                : "No applications in range"}
                        </CardDescription>
                    </div>
                    <div className="flex gap-1">
                        {GRANULARITIES.map((g) => (
                            <Button
                                key={g}
                                variant={granularity === g ? "default" : "outline"}
                                size="sm"
                                onClick={() => setGranularity(g)}
                            >
                                {GRANULARITY_LABELS[g]}
                            </Button>
                        ))}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-4">
                {buckets.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                        No applicant activity yet.
                    </p>
                ) : (
                    <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={buckets} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                            <Tooltip
                                formatter={(value) => [value, "Applicants"]}
                                labelFormatter={(label) => `Period: ${label}`}
                            />
                            <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}
