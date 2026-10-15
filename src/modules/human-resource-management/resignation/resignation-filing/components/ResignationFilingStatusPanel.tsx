"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ban, CalendarClock, CircleCheck } from "lucide-react";
import type { ResignationEligibility } from "../cooldown";
import { RESIGNATION_STATUS_LABELS, type ResignationStatus } from "../types";
import { formatPHT } from "../utils/time";
import { STATUS_BADGE_STYLES } from "./ResignationStatusCard";

interface ResignationFilingStatusPanelProps {
    employeeName: string;
    status: ResignationStatus | null;
    eligibility: ResignationEligibility | null;
}

export function eligibilityReasonMessage(eligibility: ResignationEligibility | null): string {
    if (eligibility === null || eligibility.canFile) {
        return "";
    }
    if (eligibility.reason === "pending") {
        return "This employee already has a pending resignation filing under review.";
    }
    if (eligibility.reason === "approved") {
        return "This employee's resignation has already been acknowledged.";
    }
    if (eligibility.reason === "clearance_ongoing") {
        return "This employee's resignation is already in the clearance process.";
    }
    if (eligibility.reason === "cleared") {
        return "This employee's resignation has already been cleared.";
    }
    if (eligibility.reason === "cooling_down") {
        if (eligibility.nextAllowedAt) {
            return `This employee can file a new resignation on ${formatPHT(eligibility.nextAllowedAt, { includeTime: false })}.`;
        }
        return "This employee cannot file a new resignation until the cooling-off period ends.";
    }
    return "This employee cannot be filed for at this time.";
}

function eligibilityHeading(eligibility: ResignationEligibility | null): string {
    if (eligibility === null) {
        return "Checking this employee's filing status";
    }
    if (eligibility.canFile) {
        return "This employee can be filed for.";
    }
    return "Filing is unavailable";
}

function eligibilityDetail(eligibility: ResignationEligibility | null): string {
    if (eligibility === null) {
        return "Loading this employee's current eligibility.";
    }
    if (eligibility.canFile) {
        return "No pending filing or restriction on their record.";
    }
    return eligibilityReasonMessage(eligibility);
}

export function ResignationFilingStatusPanel({ employeeName, status, eligibility }: ResignationFilingStatusPanelProps) {
    const canFile = eligibility !== null && eligibility.canFile;
    const isCoolingDown = eligibility !== null && !eligibility.canFile && eligibility.reason === "cooling_down";

    return (
        <Card className="bg-muted/40">
            <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 truncate">{employeeName}</span>
                    {status !== null && (
                        <Badge variant="outline" className={STATUS_BADGE_STYLES[status]}>
                            {RESIGNATION_STATUS_LABELS[status]}
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-start gap-3">
                    {canFile ? (
                        <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-700" aria-hidden="true" />
                    ) : isCoolingDown ? (
                        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    ) : (
                        <Ban className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
                    )}
                    <div className="min-w-0">
                        <p className="text-sm font-semibold">{eligibilityHeading(eligibility)}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{eligibilityDetail(eligibility)}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
