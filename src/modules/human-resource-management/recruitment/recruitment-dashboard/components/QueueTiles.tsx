"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
    ArrowRight,
    Award,
    BadgeCheck,
    Briefcase,
    ChevronRight,
    ClipboardList,
    FilePlus2,
    GitBranch,
    GraduationCap,
    Inbox,
    Mic,
    PenLine,
    Route,
    ShieldCheck,
    TriangleAlert,
    UserCheck,
    Users,
    type LucideIcon,
} from "lucide-react";
import type { QueueTile } from "../types";

export const PIPELINE_KEYS = [
    "new",
    "quiz_ready",
    "initial",
    "final",
    "offer",
    "signing",
    "signing_done",
    "training",
    "hired",
] as const;

export const ATTENTION_KEYS = [
    "requisitions",
    "regularization",
    "termination_risk",
    "pip",
] as const;

const STAGE_SHORT: Record<string, string> = {
    new: "Applicants",
    quiz_ready: "Quiz",
    initial: "Initial interview",
    final: "Final interview",
    offer: "Recommendation",
    signing: "Offer",
    signing_done: "Signing",
    training: "Onboarding & training",
    hired: "Hired",
};

const TILE_ICONS: Record<string, LucideIcon> = {
    new: Inbox,
    quiz_ready: BadgeCheck,
    initial: Mic,
    final: Award,
    offer: FilePlus2,
    signing: PenLine,
    signing_done: Route,
    training: GraduationCap,
    hired: UserCheck,
    requisitions: Briefcase,
    regularization: ShieldCheck,
    termination_risk: TriangleAlert,
    pip: ClipboardList,
};

const CHIP_TINTS = [
    "bg-violet-100 text-violet-600 dark:bg-violet-500/25 dark:text-violet-300",
    "bg-sky-100 text-sky-600 dark:bg-sky-500/25 dark:text-sky-300",
    "bg-orange-100 text-orange-600 dark:bg-orange-500/25 dark:text-orange-300",
    "bg-rose-100 text-rose-600 dark:bg-rose-500/25 dark:text-rose-300",
    "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/25 dark:text-emerald-300",
] as const;

function iconFor(key: string): LucideIcon {
    return TILE_ICONS[key] ?? Inbox;
}

function tintFor(index: number): string {
    return CHIP_TINTS[index % CHIP_TINTS.length];
}

function orderTiles(queues: readonly QueueTile[], keys: readonly string[]): QueueTile[] {
    const byKey = new Map(queues.map((tile) => [tile.key, tile]));
    return keys.flatMap((key) => {
        const tile = byKey.get(key);
        return tile ? [tile] : [];
    });
}

const CARD_SHELL =
    "rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)] dark:border-white/25 dark:bg-card dark:shadow-[0_4px_16px_rgba(0,0,0,0.45)]";

export function SummaryStrip({
    total,
    active,
    hired,
    attention,
}: {
    readonly total: number;
    readonly active: number;
    readonly hired: number;
    readonly attention: number;
}) {
    const figures: ReadonlyArray<{ label: string; value: number; icon: LucideIcon; tint: string }> = [
        { label: "Total applicants", value: total, icon: Users, tint: CHIP_TINTS[0] },
        { label: "Active in pipeline", value: active, icon: GitBranch, tint: CHIP_TINTS[1] },
        { label: "Hired", value: hired, icon: UserCheck, tint: CHIP_TINTS[4] },
        { label: "Open actions", value: attention, icon: TriangleAlert, tint: CHIP_TINTS[3] },
    ];
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {figures.map((figure) => {
                const Icon = figure.icon;
                return (
                    <Card key={figure.label} className={CARD_SHELL}>
                        <CardContent className="flex items-center gap-4 p-5 sm:p-6">
                            <span
                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${figure.tint}`}
                            >
                                <Icon className="h-5 w-5" aria-hidden="true" />
                            </span>
                            <span className="min-w-0">
                                <span className="block text-2xl font-bold tabular-nums tracking-tight text-foreground sm:text-3xl">
                                    {figure.value}
                                </span>
                                <span className="mt-0.5 block truncate text-xs font-medium text-muted-foreground sm:text-sm">
                                    {figure.label}
                                </span>
                            </span>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}

export function StageList({ queues }: { readonly queues: readonly QueueTile[] }) {
    const stages = orderTiles(queues, PIPELINE_KEYS);
    return (
        <Card className={CARD_SHELL}>
            <CardContent className="p-5 sm:p-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold tracking-tight text-foreground">Recruitment stages</h2>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Open a stage to act on it.</p>
                <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/10">
                    {stages.map((tile, index) => {
                        const Icon = iconFor(tile.key);
                        const stage = STAGE_SHORT[tile.key] ?? tile.label;
                        return (
                            <li key={tile.key}>
                                <Link
                                    href={tile.href}
                                    aria-label={`${stage}: ${tile.count} waiting. ${tile.hint}.`}
                                    className="group flex items-center gap-3 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    <span
                                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tintFor(index)}`}
                                    >
                                        <Icon className="h-4 w-4" aria-hidden="true" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate overflow-hidden text-sm font-medium text-foreground">
                                            {stage}
                                        </span>
                                        <span className="block truncate overflow-hidden text-xs text-muted-foreground">
                                            {tile.label}
                                        </span>
                                    </span>
                                    <span className="shrink-0 text-base font-bold tabular-nums text-foreground">
                                        {tile.count}
                                    </span>
                                    <ChevronRight
                                        className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                                        aria-hidden="true"
                                    />
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </CardContent>
        </Card>
    );
}

export function AttentionHighlight({
    queues,
}: {
    readonly queues: readonly QueueTile[];
}) {
    const raw = orderTiles(queues, ATTENTION_KEYS);
    const items = raw.map((tile) =>
        tile.key === "requisitions"
            ? {
                  ...tile,
                  label: "Open manpower requests",
                  href: "/hrm/manpower-recommendation",
                  hint: "Open manpower requests awaiting action.",
              }
            : tile
    );
    const total = items.reduce((sum, tile) => sum + tile.count, 0);
    return (
        <section
            aria-label="Open actions"
            className="flex flex-col rounded-2xl bg-gradient-to-br from-violet-600 via-violet-600 to-indigo-600 p-5 text-white shadow-[0_8px_24px_rgba(124,58,237,0.35)] sm:p-6"
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
                        Open actions
                    </p>
                    <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">
                        {total}
                    </p>
                    <p className="mt-1 text-xs text-white/75">Queues outside the pipeline.</p>
                </div>
            </div>
            <ul className="mt-4 divide-y divide-white/15">
                {items.map((tile) => (
                    <li key={tile.key}>
                        <Link
                            href={tile.href}
                            aria-label={`${tile.label}: ${tile.count} waiting. ${tile.hint}.`}
                            className="group flex items-center gap-3 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                        >
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                                {tile.label}
                            </span>
                            <span className="text-base font-bold tabular-nums text-white">
                                {tile.count}
                            </span>
                            <ArrowRight
                                className="h-4 w-4 shrink-0 text-white/70 transition-transform group-hover:translate-x-0.5"
                                aria-hidden="true"
                            />
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}
