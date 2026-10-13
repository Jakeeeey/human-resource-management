"use client";

import * as React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Inbox } from "lucide-react";
import { CLEARANCE_REQUEST_STATUS_LABELS } from "../types";
import type { ClearanceDashboardStatusSlice } from "../types/clearance-dashboard.schema";

const CARD_SHELL =
    "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.05)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.45)]";

const STATUS_ORDER = ["pending", "in_progress", "completed"] as const;

const STATUS_FILL: Record<string, string> = {
    pending: "hsl(var(--muted-foreground))",
    in_progress: "hsl(var(--info))",
    completed: "hsl(var(--success))",
};

const STATUS_FALLBACK_FILL = "hsl(var(--muted-foreground))";

function pluralize(count: number, singular: string, plural: string): string {
    return `${count} ${count === 1 ? singular : plural}`;
}

interface StatusSlice {
    readonly status: string;
    readonly label: string;
    readonly count: number;
    readonly fill: string;
}

interface StatusMixTooltipEntry {
    readonly name?: unknown;
    readonly value?: unknown;
    readonly payload?: { readonly label?: unknown; readonly count?: unknown } | null;
}

interface StatusMixTooltipProps {
    readonly active?: boolean;
    readonly payload?: readonly StatusMixTooltipEntry[];
}

function StatusMixTooltip({ active, payload }: StatusMixTooltipProps): React.JSX.Element | null {
    if (!active || !payload || payload.length === 0) {
        return null;
    }
    const entry = payload[0];
    const inner = entry.payload;
    const name = typeof inner?.label === "string" && inner.label.length > 0
        ? inner.label
        : typeof entry.name === "string" && entry.name.length > 0
          ? entry.name
          : "Status";
    const value = typeof inner?.count === "number" || typeof inner?.count === "string"
        ? inner.count
        : typeof entry.value === "number" || typeof entry.value === "string"
          ? entry.value
          : "";
    return (
        <div
            style={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 12,
                fontSize: 12,
                padding: "8px 12px",
            }}
        >
            <p style={{ color: "hsl(var(--popover-foreground))", fontWeight: 600, margin: 0 }}>Status</p>
            <p style={{ color: "hsl(var(--popover-foreground))", margin: "4px 0 0" }}>
                {name} : {String(value)}
            </p>
        </div>
    );
}

export function ClearanceStatusMixChart({ slices }: { readonly slices: readonly ClearanceDashboardStatusSlice[] }) {
    const rows = React.useMemo<StatusSlice[]>(() => {
        const counts = new Map(slices.map((entry) => [entry.status, entry.count]));
        return STATUS_ORDER.map((status) => ({
            status,
            label: CLEARANCE_REQUEST_STATUS_LABELS[status],
            count: counts.get(status) ?? 0,
            fill: STATUS_FILL[status] ?? STATUS_FALLBACK_FILL,
        }));
    }, [slices]);
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    const title = "Clearance Status Mix";
    const subtitle = `Share by request status · ${pluralize(total, "clearance", "clearances")}`;
    const ariaSummary = total === 0
        ? "Clearance status mix chart with no data"
        : `Clearance status mix chart. ${rows.map((r) => `${r.label} ${r.count}`).join(", ")}.`;
    return (
        <Card className={`${CARD_SHELL} h-full`}>
            <CardContent className="flex h-full flex-col p-5 sm:p-6">
                <h2 className="truncate text-base font-bold tracking-tight text-foreground">{title}</h2>
                <p className="mt-1 text-xs tabular-nums text-muted-foreground">{subtitle}</p>
                {total === 0 ? (
                    <div className="flex min-h-[280px] flex-1 flex-col items-center justify-center gap-2 py-10 text-center sm:min-h-[320px]">
                        <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                        <p className="text-sm font-medium text-foreground">No clearances yet</p>
                        <p className="max-w-xs text-xs text-muted-foreground">
                            The status mix will appear here once clearances are assigned.
                        </p>
                    </div>
                ) : (
                    <React.Fragment>
                        <div className="relative mx-auto mt-2 h-[200px] w-full max-w-[280px] sm:h-[220px]" role="img" aria-label={ariaSummary}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Tooltip
                                        content={<StatusMixTooltip />}
                                        contentStyle={{
                                            backgroundColor: "hsl(var(--popover))",
                                            border: "1px solid hsl(var(--border))",
                                            borderRadius: 12,
                                            fontSize: 12,
                                        }}
                                        labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                                        itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                                    />
                                    <Pie
                                        data={rows}
                                        dataKey="count"
                                        nameKey="label"
                                        innerRadius="64%"
                                        outerRadius="88%"
                                        paddingAngle={2}
                                        strokeWidth={0}
                                        isAnimationActive={false}
                                    >
                                        {rows.map((row) => (
                                            <Cell key={row.status} fill={row.fill} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-3xl font-bold tabular-nums tracking-tight text-foreground">{total}</span>
                                <span className="text-xs text-muted-foreground">{total === 1 ? "clearance" : "clearances"}</span>
                            </div>
                        </div>
                        <ul className="mt-3 space-y-1.5">
                            {rows.map((row) => (
                                <li key={row.status} className="flex items-center gap-2 text-xs">
                                    <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: row.fill }} aria-hidden="true" />
                                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">{row.label}</span>
                                    <span className="shrink-0 tabular-nums text-muted-foreground">
                                        {row.count} · {total > 0 ? ((row.count / total) * 100).toFixed(0) : "0"}%
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
