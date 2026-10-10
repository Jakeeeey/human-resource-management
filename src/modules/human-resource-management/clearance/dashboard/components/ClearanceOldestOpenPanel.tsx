"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { CircleCheck, Hourglass } from "lucide-react";
import { CLEARANCE_REQUEST_STATUS_LABELS } from "../types";
import type { ClearanceDashboardOldestOpen } from "../types/clearance-dashboard.schema";
import { formatPHT } from "../utils/time";

const CARD_SHELL =
    "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.05)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.45)]";

const FOCUS_RING =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function formatDaysOpen(days: number): string {
    return `${days} day${days === 1 ? "" : "s"}`;
}

export function ClearanceOldestOpenPanel({
    rows,
    totalOpen,
}: {
    readonly rows: readonly ClearanceDashboardOldestOpen[];
    readonly totalOpen: number;
}) {
    const title = "Longest-Open Clearances";
    const capped = totalOpen > rows.length;
    const subtitle = capped
        ? `Showing the ${rows.length} oldest of ${totalOpen} open · chase these first`
        : "Oldest open clearances · chase these first";
    return (
        <Card className={`${CARD_SHELL} h-full`}>
            <CardContent className="flex h-full flex-col p-5 sm:p-6">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                        {rows.length === 0 ? (
                            <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--success))]" aria-hidden="true" />
                        ) : (
                            <Hourglass className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--warning))]" aria-hidden="true" />
                        )}
                        <div className="min-w-0">
                            <h2 className="truncate text-base font-bold tracking-tight text-foreground">{title}</h2>
                            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
                        </div>
                    </div>
                    {capped && (
                        <Link
                            href="/hrm/clearance/hub"
                            className={`shrink-0 rounded-full text-xs font-semibold text-primary underline-offset-4 hover:underline ${FOCUS_RING}`}
                        >
                            View all in hub
                        </Link>
                    )}
                </div>
                {rows.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
                        <CircleCheck className="h-8 w-8 text-[hsl(var(--success))]" aria-hidden="true" />
                        <p className="text-sm font-medium text-foreground">Nothing open</p>
                        <p className="max-w-xs text-xs text-muted-foreground">
                            Every clearance is confirmed. New assignments will appear here while they stay open.
                        </p>
                    </div>
                ) : (
                    <React.Fragment>
                        <ul className="mt-3 max-h-[320px] space-y-2 overflow-auto md:hidden">
                            {rows.map((row) => (
                                <li key={row.request_id} className="rounded-xl border border-border p-3">
                                    <Link
                                        href={`/hrm/clearance/hub/${row.request_id}`}
                                        className={`block min-w-0 ${FOCUS_RING} rounded-lg`}
                                        aria-label={`Open clearance ${row.request_id} for ${row.employee_name}`}
                                    >
                                        <span className="block truncate text-sm font-semibold text-foreground" title={row.employee_name}>
                                            {row.employee_name}
                                        </span>
                                        <span className="mt-0.5 block break-words text-xs text-muted-foreground" title={row.template_title}>
                                            {row.template_title}
                                        </span>
                                    </Link>
                                    <span className="mt-2 flex items-center justify-between gap-2">
                                        <span className="text-xs font-semibold tabular-nums text-foreground">
                                            {formatDaysOpen(row.days_open)}
                                        </span>
                                        <StatusBadge tone={row.status === "in_progress" ? "info" : "neutral"}>
                                            {CLEARANCE_REQUEST_STATUS_LABELS[row.status]}
                                        </StatusBadge>
                                    </span>
                                    <span className="mt-1 block text-[11px] text-muted-foreground">
                                        Opened {formatPHT(row.created_at, { includeTime: false })}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <div className="mt-3 hidden max-h-[320px] overflow-auto rounded-xl border border-border md:block">
                            <table className="w-full min-w-[560px] text-left text-xs">
                                <thead className="sticky top-0 z-10 bg-muted">
                                    <tr>
                                        <th scope="col" className="px-3 py-2 font-semibold text-muted-foreground">Employee</th>
                                        <th scope="col" className="px-3 py-2 font-semibold text-muted-foreground">Template</th>
                                        <th scope="col" className="px-3 py-2 text-right font-semibold tabular-nums text-muted-foreground">Open</th>
                                        <th scope="col" className="px-3 py-2 font-semibold text-muted-foreground">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {rows.map((row) => (
                                        <tr key={row.request_id}>
                                            <td className="max-w-[160px] truncate px-3 py-2 font-medium text-foreground" title={row.employee_name}>
                                                <Link
                                                    href={`/hrm/clearance/hub/${row.request_id}`}
                                                    className={`rounded text-primary underline-offset-4 hover:underline ${FOCUS_RING}`}
                                                    aria-label={`Open clearance ${row.request_id} for ${row.employee_name}`}
                                                >
                                                    {row.employee_name}
                                                </Link>
                                                <span className="block truncate font-normal text-muted-foreground" title={`Opened ${formatPHT(row.created_at, { includeTime: false })}`}>
                                                    Opened {formatPHT(row.created_at, { includeTime: false })}
                                                </span>
                                            </td>
                                            <td className="max-w-[180px] truncate px-3 py-2 text-muted-foreground" title={row.template_title}>
                                                {row.template_title}
                                            </td>
                                            <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">
                                                {formatDaysOpen(row.days_open)}
                                            </td>
                                            <td className="px-3 py-2">
                                                <StatusBadge tone={row.status === "in_progress" ? "info" : "neutral"}>
                                                    {CLEARANCE_REQUEST_STATUS_LABELS[row.status]}
                                                </StatusBadge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </React.Fragment>
                )}
            </CardContent>
        </Card>
    );
}
