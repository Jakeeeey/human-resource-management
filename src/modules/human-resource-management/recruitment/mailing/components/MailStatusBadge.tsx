"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

// Module-local copy of the StatusBadge tone pattern
// (src/components/ui/status-badge.tsx:8-31 + badge-* tokens in globals.css;
// ui/* is PROTECTED — copy, never edit). Unifies dry-run/warning/status pills.

export type MailStatusTone = "neutral" | "success" | "warning" | "info" | "destructive";

/**
 * Tone pill for composer status chrome.
 * @param tone - Semantic tone (maps to badge-* tokens).
 * @param children - Pill text.
 * @param className - Extra classes.
 * @returns The pill.
 */
function MailStatusBadge({
    children,
    tone = "neutral",
    className,
}: {
    children: React.ReactNode;
    tone?: MailStatusTone;
    className?: string;
}) {
    const toneClass =
        tone === "success"
            ? "badge-success"
            : tone === "warning"
              ? "badge-warning"
              : tone === "info"
                ? "badge-info"
                : tone === "destructive"
                  ? "badge-destructive"
                  : "badge-neutral";

    return (
        <span
            data-slot="mail-status-badge"
            className={cn(
                "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                toneClass,
                className
            )}
        >
            {children}
        </span>
    );
}

export { MailStatusBadge };
