"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Paperclip } from "lucide-react";
import { RESIGNATION_STATUS_LABELS } from "../types";
import type { EnrichedResignationRequest, ResignationStatus } from "../types";
import { formatDateOnly, formatPHT } from "../utils/time";

export const STATUS_BADGE_STYLES: Record<ResignationStatus, string> = {
    pending: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    approved: "bg-green-600/10 text-green-700 border-green-600/30",
    clearance_ongoing: "bg-blue-600/10 text-blue-700 border-blue-600/30",
    cleared: "bg-emerald-600/10 text-emerald-700 border-emerald-600/30",
    rejected: "bg-rose-600/10 text-rose-700 border-rose-600/30",
    withdrawn: "bg-muted text-muted-foreground border-border",
};

interface ResignationStatusCardProps {
    filing: EnrichedResignationRequest;
    onPreview: (filing: EnrichedResignationRequest) => void;
}

export function ResignationStatusCard({ filing, onPreview }: ResignationStatusCardProps) {
    const hasAttachment = Boolean(filing.attachment_uuid) || Boolean(filing.view_file_url);

    return (
        <Card>
            <CardHeader className="space-y-1 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">
                        Effectivity Date: {formatDateOnly(filing.resignation_date)}
                    </span>
                    <Badge variant="outline" className={STATUS_BADGE_STYLES[filing.status]}>
                        {RESIGNATION_STATUS_LABELS[filing.status]}
                    </Badge>
                </div>
                <span className="block text-xs text-muted-foreground tabular-nums">Filed {formatPHT(filing.filed_at)}</span>
            </CardHeader>
            <CardContent className="space-y-3">
                <p className="max-w-prose text-sm whitespace-pre-wrap break-words">{filing.reason}</p>
                {filing.hr_remarks && (
                    <blockquote className="rounded-xl border bg-muted/30 p-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">HR remarks</p>
                        <p className="mt-1 text-sm whitespace-pre-wrap break-words">{filing.hr_remarks}</p>
                        {filing.reviewed_at && (
                            <p className="mt-1 text-xs text-muted-foreground tabular-nums">Reviewed {formatPHT(filing.reviewed_at)}</p>
                        )}
                    </blockquote>
                )}
                {hasAttachment && (
                    <div className="flex flex-wrap items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => onPreview(filing)} className="gap-2">
                            <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                            {filing.attachment_name ? filing.attachment_name : "View attachment"}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
