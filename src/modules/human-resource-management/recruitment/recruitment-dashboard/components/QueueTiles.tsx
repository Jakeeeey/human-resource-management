"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
    ArrowRight,
    Award,
    BadgeCheck,
    Briefcase,
    ClipboardList,
    FilePlus2,
    GraduationCap,
    Inbox,
    Mic,
    PenLine,
    Route,
    ShieldCheck,
    TriangleAlert,
    UserCheck,
    type LucideIcon,
} from "lucide-react";
import type { QueueTile, QueueTone } from "../types";

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

const TONE_CARD: Record<QueueTone, string> = {
    info: "border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950",
    attention: "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950",
    success: "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950",
    danger: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950",
    neutral: "border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-950",
};

const TONE_TEXT: Record<QueueTone, string> = {
    info: "text-sky-700 dark:text-sky-300",
    attention: "text-amber-700 dark:text-amber-300",
    success: "text-emerald-700 dark:text-emerald-300",
    danger: "text-red-700 dark:text-red-300",
    neutral: "text-stone-600 dark:text-stone-300",
};

const TONE_ICON_WRAP: Record<QueueTone, string> = {
    info: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    attention: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    danger: "bg-red-500/15 text-red-700 dark:text-red-300",
    neutral: "bg-stone-500/15 text-stone-600 dark:text-stone-300",
};

function QueueTileCard({ tile }: { readonly tile: QueueTile }) {
    const Icon = TILE_ICONS[tile.key] ?? Inbox;
    const live = tile.count > 0;
    return (
        <Link
            href={tile.href}
            aria-label={`${tile.label}: ${tile.count} waiting. ${tile.hint}.`}
            className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
            <Card
                className={`h-full transition-shadow hover:shadow-md ${live ? TONE_CARD[tile.tone] : "border-muted bg-muted/30"}`}
            >
                <CardContent className="flex h-full flex-col gap-2 p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-2">
                        <span className={`rounded-lg p-2 ${live ? TONE_ICON_WRAP[tile.tone] : "bg-muted text-muted-foreground"}`}>
                            <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <ArrowRight
                            className={`h-4 w-4 shrink-0 ${live ? TONE_TEXT[tile.tone] : "text-muted-foreground"}`}
                            aria-hidden="true"
                        />
                    </div>
                    <p className={`text-2xl font-extrabold tabular-nums sm:text-3xl ${live ? TONE_TEXT[tile.tone] : "text-muted-foreground"}`}>
                        {tile.count}
                    </p>
                    <p className="text-xs font-semibold sm:text-sm">{tile.label}</p>
                    <p className="mt-auto text-[11px] text-muted-foreground sm:text-xs">
                        {tile.hint}
                        {tile.share !== null && ` · ${tile.share}% of applicants`}
                    </p>
                </CardContent>
            </Card>
        </Link>
    );
}

export function QueueTiles({ queues }: { readonly queues: readonly QueueTile[] }) {
    return (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {queues.map((tile) => (
                <QueueTileCard key={tile.key} tile={tile} />
            ))}
        </div>
    );
}
