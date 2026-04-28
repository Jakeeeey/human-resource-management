"use client";

/**
 * OnCallModal
 * Custom portal-based modal for the On-Call module.
 * Uses React.createPortal directly to avoid the Radix UI Dialog state machine
 * that conflicts with rapid context re-renders in this module.
 */

import React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface OnCallModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children: React.ReactNode;
    /** Tailwind max-width class, e.g. "max-w-[1100px]" */
    maxWidth?: string;
}

/**
 * A minimal, stable modal that renders into document.body via createPortal.
 * Does NOT use Radix UI primitives, so it is immune to Radix's internal
 * setState loops that occur during rapid context re-renders.
 */
export function OnCallModal({
    open,
    onClose,
    title,
    description,
    children,
    maxWidth = "max-w-[1100px]",
}: OnCallModalProps) {
    // Guard: only render on client
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => { setMounted(true); }, []);

    // Close on Escape key
    React.useEffect(() => {
        if (!open) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [open, onClose]);

    // Prevent body scroll when open
    React.useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => { document.body.style.overflow = ""; };
    }, [open]);

    if (!mounted || !open) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label={title}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 animate-in fade-in-0 duration-200"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Panel */}
            <div
                className={cn(
                    "relative z-10 w-full bg-background rounded-xl border shadow-2xl",
                    "animate-in fade-in-0 zoom-in-95 duration-200",
                    maxWidth,
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute top-4 right-4 inline-flex items-center justify-center rounded-sm opacity-70 hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </button>

                {/* Header */}
                <div className="px-6 pt-6 pb-0">
                    <h2 className="text-xl font-semibold leading-none">{title}</h2>
                    {description && (
                        <p className="text-xs text-muted-foreground mt-1">{description}</p>
                    )}
                </div>

                {/* Content */}
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>,
        document.body,
    );
}

/** Convenience footer row with consistent spacing */
export function OnCallModalFooter({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn("flex justify-end gap-2 pt-4 border-t", className)}>
            {children}
        </div>
    );
}
