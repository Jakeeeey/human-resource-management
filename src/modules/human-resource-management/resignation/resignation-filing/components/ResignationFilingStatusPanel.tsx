"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ban, CalendarClock, CircleCheck, ClipboardList } from "lucide-react";
import type { ResignationEligibility } from "../cooldown";
import { formatPHT } from "../utils/time";

interface ResignationFilingStatusPanelProps {
    eligibility: ResignationEligibility | null;
}

function eligibilityHeading(eligibility: ResignationEligibility | null): string {
    if (eligibility === null) {
        return "Checking your filing status...";
    }
    if (eligibility.canFile) {
        return "You can file a resignation";
    }
    return "Filing is unavailable";
}

function eligibilityDetail(eligibility: ResignationEligibility | null): string {
    if (eligibility === null) {
        return "Loading your current eligibility.";
    }
    if (eligibility.canFile) {
        return "No pending filing or restriction on your record.";
    }
    if (eligibility.reason === "pending") {
        return "You already have a pending resignation filing under review.";
    }
    if (eligibility.reason === "approved") {
        return "Your resignation has already been approved, so you cannot file again.";
    }
    if (eligibility.reason === "cooling_down") {
        if (eligibility.nextAllowedAt) {
            return `You can file a new resignation on ${formatPHT(eligibility.nextAllowedAt, { includeTime: false })}.`;
        }
        return "You cannot file a new resignation until your cooling-off period ends.";
    }
    return "You cannot file a new resignation at this time.";
}

const PROCESS_STEPS: ReadonlyArray<{ title: string; detail: string }> = [
    { title: "Submit", detail: "Send your resignation with its effective date." },
    { title: "HR review", detail: "HR reviews the filing and any attachment." },
    { title: "Decision", detail: "You are notified once it is approved or rejected." },
];

export function ResignationFilingStatusPanel({ eligibility }: ResignationFilingStatusPanelProps) {
    const canFile = eligibility !== null && eligibility.canFile;
    const isCoolingDown = eligibility !== null && !eligibility.canFile && eligibility.reason === "cooling_down";
    return (
        <Card className="bg-muted/40">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <ClipboardList className="h-4 w-4" />
                    Filing status
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="flex items-start gap-3 rounded-xl border bg-card p-3">
                    {canFile ? (
                        <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-700" />
                    ) : isCoolingDown ? (
                        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                    ) : (
                        <Ban className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                    )}
                    <div className="min-w-0">
                        <p className="text-sm font-semibold">{eligibilityHeading(eligibility)}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{eligibilityDetail(eligibility)}</p>
                    </div>
                </div>
                <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">What happens next</p>
                    <ol className="space-y-3">
                        {PROCESS_STEPS.map((step, index) => (
                            <li key={step.title} className="flex items-start gap-3">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-card text-xs font-bold">
                                    {index + 1}
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-sm font-semibold">{step.title}</span>
                                    <span className="block text-xs text-muted-foreground">{step.detail}</span>
                                </span>
                            </li>
                        ))}
                    </ol>
                </div>
            </CardContent>
        </Card>
    );
}
