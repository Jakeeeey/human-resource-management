"use client";

import type { JSX } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { CLEARANCE_REQUEST_STATUS_LABELS, type ClearanceRequestStatus } from "../types";
import type { FilingDetail } from "../providers/clearanceFilingClient";
import { formatPHT } from "../utils/time";

interface ClearanceFilingStatusCardProps {
    detail: FilingDetail;
    employeeName: string;
}

function statusTone(status: ClearanceRequestStatus): StatusTone {
    if (status === "completed") return "success";
    if (status === "in_progress") return "info";
    return "neutral";
}

export function ClearanceFilingStatusCard({ detail, employeeName }: ClearanceFilingStatusCardProps): JSX.Element {
    return (
        <Card>
            <CardHeader className="space-y-2 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-sm">
                        {detail.template_title_snapshot ?? "Resignation Clearance"}
                    </CardTitle>
                    <StatusBadge tone={statusTone(detail.status)}>
                        {CLEARANCE_REQUEST_STATUS_LABELS[detail.status]}
                    </StatusBadge>
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                    {detail.signed_count} of {detail.total_count} categories signed
                </p>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
                <p>
                    <span className="font-semibold">Employee:</span> {employeeName}
                </p>
                <p className="tabular-nums">
                    <span className="font-semibold">Assigned:</span> {formatPHT(detail.created_at)}
                </p>
                <p className="tabular-nums">
                    <span className="font-semibold">Confirmed:</span>{" "}
                    {detail.status === "completed" ? formatPHT(detail.confirmed_at) : "Not yet confirmed"}
                </p>
                {detail.status === "completed" && (
                    <p className="text-xs text-muted-foreground">
                        This clearance is completed and locked. Contact HR if a correction is needed.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
