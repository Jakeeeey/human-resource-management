"use client";

import Link from "next/link";
import { Briefcase, ChevronDown, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { StatusCount } from "../types";

const TOP_N = 7;

const CHIP_TINTS = [
    "bg-violet-100 text-violet-600 dark:bg-violet-500/25 dark:text-violet-300",
    "bg-sky-100 text-sky-600 dark:bg-sky-500/25 dark:text-sky-300",
    "bg-orange-100 text-orange-600 dark:bg-orange-500/25 dark:text-orange-300",
    "bg-rose-100 text-rose-600 dark:bg-rose-500/25 dark:text-rose-300",
    "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/25 dark:text-emerald-300",
] as const;

function topPositions(rows: readonly StatusCount[]): { readonly top: StatusCount[]; readonly rest: number } {
    const sorted = [...rows].sort((a, b) => b.count - a.count);
    return { top: sorted.slice(0, TOP_N), rest: Math.max(0, sorted.length - TOP_N) };
}

const POSITION_ICON: LucideIcon = Briefcase;

export function PositionList({ rows }: { readonly rows: readonly StatusCount[] }) {
    const { top, rest } = topPositions(rows);
    const Icon = POSITION_ICON;
    return (
        <Card className="h-full rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)] dark:border-white/25 dark:bg-card dark:shadow-[0_4px_16px_rgba(0,0,0,0.45)]">
            <CardContent className="p-5 sm:p-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold tracking-tight text-foreground">Applicants by position</h2>
                    <Link
                        href="/hrm/applicants"
                        aria-label="View all applicants"
                        className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        All
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                </div>
                {top.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">No data.</p>
                ) : (
                    <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/10">
                        {top.map((row, index) => (
                            <li key={row.status} className="flex items-center gap-3 py-2.5">
                                <span
                                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${CHIP_TINTS[index % CHIP_TINTS.length]}`}
                                >
                                    <Icon className="h-4 w-4" aria-hidden="true" />
                                </span>
                                <span
                                    title={row.status}
                                    className="min-w-0 flex-1 truncate pr-3 text-sm font-medium text-foreground"
                                >
                                    {row.status}
                                </span>
                                <span className="shrink-0 text-base font-bold tabular-nums text-foreground">
                                    {row.count}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
                {rest > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">+{rest} more positions.</p>
                )}
            </CardContent>
        </Card>
    );
}
