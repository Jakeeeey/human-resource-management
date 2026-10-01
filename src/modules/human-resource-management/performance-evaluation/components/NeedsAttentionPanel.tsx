"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight, CircleCheck, TriangleAlert } from "lucide-react";
import type {
    PerformanceDashboardAttention,
    PerformanceDashboardPips,
} from "../types/performance-dashboard.schema";
import { StatusPill } from "./StatusPill";

const CARD_SHELL =
    "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.05)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.45)]";

export function NeedsAttentionPanel({
    items,
    pips,
}: {
    readonly items: readonly PerformanceDashboardAttention[];
    readonly pips: PerformanceDashboardPips;
}) {
    const title = "Needs Attention";
    const subtitle = "Probation risk or open PIP · review and act";
    return (
        <Card className={`${CARD_SHELL} h-full`}>
            <CardContent className="flex h-full flex-col p-5 sm:p-6">
                <div className="flex items-start gap-2">
                    {items.length === 0 ? (
                        <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--success))]" aria-hidden="true" />
                    ) : (
                        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--warning))]" aria-hidden="true" />
                    )}
                    <div className="min-w-0">
                        <h2 className="truncate text-base font-bold tracking-tight text-foreground">{title}</h2>
                        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
                    </div>
                </div>
                {items.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
                        <CircleCheck className="h-8 w-8 text-[hsl(var(--success))]" aria-hidden="true" />
                        <p className="text-sm font-medium text-foreground">All clear</p>
                        <p className="max-w-xs text-xs text-muted-foreground">
                            No employees are flagged for probation risk or an open PIP.
                        </p>
                    </div>
                ) : (
                    <ul className="mt-3 max-h-[380px] space-y-2 overflow-y-auto" aria-label="Employees needing attention">
                        {items.map((item) => {
                            const linkable =
                                typeof item.user_id === "number" &&
                                Number.isInteger(item.user_id) &&
                                item.user_id > 0;
                            if (!linkable) {
                                return (
                                    <li
                                        key={`${item.user_id}-${item.name}`}
                                        className="rounded-xl border border-border bg-muted/40 px-3 py-2.5"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-semibold text-foreground" title={item.name}>
                                                    {item.name}
                                                </span>
                                                <span className="block truncate text-xs text-muted-foreground" title={item.department_name ?? "No department"}>
                                                    {item.department_name ?? "No department"}
                                                </span>
                                            </span>
                                            <StatusPill status={item.status} />
                                        </div>
                                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{item.reason}</p>
                                    </li>
                                );
                            }
                            return (
                                <li
                                    key={`${item.user_id}-${item.name}`}
                                    className="rounded-xl border border-border bg-muted/40 transition-colors"
                                >
                                    <Link
                                        href={`/hrm/performance-evaluation/admin-evaluation/${item.user_id}`}
                                        aria-label={`Open ${item.name}'s evaluation workspace`}
                                        className="group block rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-semibold text-foreground" title={item.name}>
                                                    {item.name}
                                                </span>
                                                <span className="block truncate text-xs text-muted-foreground" title={item.department_name ?? "No department"}>
                                                    {item.department_name ?? "No department"}
                                                </span>
                                            </span>
                                            <span className="flex shrink-0 items-center gap-1">
                                                <StatusPill status={item.status} />
                                                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-focus-within:opacity-100" aria-hidden="true" />
                                            </span>
                                        </div>
                                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{item.reason}</p>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                )}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-xs tabular-nums text-muted-foreground">
                    <span>
                        <span className="font-semibold text-foreground">{pips.open}</span> open PIPs
                    </span>
                    <span>
                        <span className="font-semibold text-foreground">{pips.passed}</span> passed
                    </span>
                    <span>
                        <span className="font-semibold text-foreground">{pips.failed}</span> failed
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}
