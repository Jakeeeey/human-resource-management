"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Paperclip, Undo2 } from "lucide-react";
import { RESIGNATION_STATUS_LABELS } from "../types";
import type { EnrichedResignationRequest, ResignationStatus } from "../types";
import { formatDateOnly, formatPHT } from "@/modules/human-resource-management/shared/utils/time";

const STATUS_BADGE_STYLES: Record<ResignationStatus, string> = {
    pending: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    approved: "bg-green-600/10 text-green-700 border-green-600/30",
    rejected: "bg-rose-600/10 text-rose-700 border-rose-600/30",
    withdrawn: "bg-muted text-muted-foreground border-border",
};

interface ResignationStatusCardProps {
    filing: EnrichedResignationRequest;
    onPreview: (filing: EnrichedResignationRequest) => void;
    onWithdraw: (filing: EnrichedResignationRequest) => void;
}

export function ResignationStatusCard({ filing, onPreview, onWithdraw }: ResignationStatusCardProps) {
    const hasAttachment = Boolean(filing.attachment_uuid) || Boolean(filing.view_file_url);
    const canWithdraw = filing.status === "pending";

    return (
        <Card>
            <CardHeader className="space-y-1 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">Resignation date: {formatDateOnly(filing.resignation_date)}</span>
                    <Badge variant="outline" className={STATUS_BADGE_STYLES[filing.status]}>
                        {RESIGNATION_STATUS_LABELS[filing.status]}
                    </Badge>
                </div>
                <span className="block text-xs text-muted-foreground">Filed {formatPHT(filing.filed_at)}</span>
            </CardHeader>
            <CardContent className="space-y-3">
                <p className="max-w-prose text-sm whitespace-pre-wrap break-words">{filing.reason}</p>
                {filing.hr_remarks && (
                    <blockquote className="rounded-r-xl border border-l-4 border-l-primary bg-muted/30 p-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">HR remarks</p>
                        <p className="mt-1 text-sm whitespace-pre-wrap break-words">{filing.hr_remarks}</p>
                        {filing.reviewed_at && (
                            <p className="mt-1 text-xs text-muted-foreground">Reviewed {formatPHT(filing.reviewed_at)}</p>
                        )}
                    </blockquote>
                )}
                <div className="flex flex-wrap items-center gap-2">
                    {hasAttachment && (
                        <Button type="button" variant="outline" size="sm" onClick={() => onPreview(filing)} className="gap-2">
                            <Paperclip className="h-3.5 w-3.5" />
                            {filing.attachment_name ? filing.attachment_name : "View attachment"}
                        </Button>
                    )}
                    {canWithdraw && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => onWithdraw(filing)} className="gap-2 text-destructive">
                            <Undo2 className="h-3.5 w-3.5" />
                            Withdraw
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
