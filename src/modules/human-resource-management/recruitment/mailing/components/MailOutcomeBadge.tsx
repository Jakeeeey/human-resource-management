"use client";

import { cn } from "@/lib/utils";

const OUTCOME_TONE_CLASS: Record<string, string> = {
    sent: "badge-success",
    active: "badge-success",
    enabled: "badge-success",
    failed: "badge-destructive",
    queued: "badge-info",
    dry_run: "badge-warning",
    warning: "badge-warning",
    skipped: "badge-neutral",
    inactive: "badge-neutral",
    disabled: "badge-neutral",
};

function defaultOutcomeLabel(status: string): string {
    const spaced = status.replace(/_/g, " ");
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export interface MailOutcomeBadgeProps {
    status: string;
    label?: string;
    className?: string;
}

export function MailOutcomeBadge({ status, label, className }: MailOutcomeBadgeProps) {
    const toneClass = OUTCOME_TONE_CLASS[status] ?? "badge-neutral";
    return (
        <span
            data-slot="mail-outcome-badge"
            className={cn(
                "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors duration-150",
                toneClass,
                className,
            )}
        >
            {label ?? defaultOutcomeLabel(status)}
        </span>
    );
}
