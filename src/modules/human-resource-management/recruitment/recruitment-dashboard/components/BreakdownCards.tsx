"use client";

import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecruitmentDashboardData, StatusCount } from "../types";

function HorizontalBars({ rows }: { readonly rows: readonly StatusCount[] }) {
    if (rows.length === 0) {
        return <p className="py-6 text-center text-sm text-muted-foreground">No data.</p>;
    }
    return (
        <ResponsiveContainer width="100%" height={Math.max(120, rows.length * 34)}>
            <BarChart data={[...rows]} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis
                    type="category"
                    dataKey="status"
                    width={120}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value: string) => (value.length > 18 ? `${value.slice(0, 17)}…` : value)}
                />
                <Tooltip formatter={(value) => [value, "Count"]} />
                <Bar dataKey="count" fill="var(--primary)" radius={[0, 4, 4, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
}

export function BreakdownCards({ data }: { readonly data: RecruitmentDashboardData }) {
    return (
        <Card>
            <CardHeader className="border-b">
                <CardTitle className="text-sm font-bold">Applicants by position</CardTitle>
                <CardDescription>Top positions by applicant count.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
                <HorizontalBars rows={data.breakdown.applicantsByPosition} />
            </CardContent>
        </Card>
    );
}
