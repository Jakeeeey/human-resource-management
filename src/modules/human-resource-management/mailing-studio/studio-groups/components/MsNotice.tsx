"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface MsNoticeValue {
    readonly tone: "info" | "error";
    readonly text: string;
}

export const MS_NOTICE_AUTO_DISMISS_MS = 6000;

interface MsNoticeProps {
    readonly notice: MsNoticeValue;
    readonly testId: string;
    readonly onDismiss: () => void;
}

export function MsNotice({ notice, testId, onDismiss }: MsNoticeProps) {
    useEffect(() => {
        if (notice.tone === "error") return;
        const timer = window.setTimeout(onDismiss, MS_NOTICE_AUTO_DISMISS_MS);
        return () => window.clearTimeout(timer);
    }, [notice.tone, notice.text, onDismiss]);

    const isError = notice.tone === "error";
    return (
        <div
            className={
                isError
                    ? "flex items-start justify-between gap-3 rounded-lg border border-destructive/40 bg-card p-4"
                    : "flex items-start justify-between gap-3 rounded-lg border bg-card p-4"
            }
            data-testid={testId}
            role={isError ? "alert" : "status"}
        >
            <p className={isError ? "text-sm text-destructive" : "text-sm"}>{notice.text}</p>
            <Button
                aria-label="Dismiss notification"
                className="h-6 w-6 shrink-0"
                size="icon"
                type="button"
                variant="ghost"
                onClick={onDismiss}
            >
                <X className="h-3.5 w-3.5" />
            </Button>
        </div>
    );
}
