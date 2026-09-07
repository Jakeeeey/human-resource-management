"use client";

import React from "react";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Users } from "lucide-react";
import type { ApplicantRow } from "../types";
import { ApplicationViewDialog } from "@/modules/human-resource-management/recruitment/manpower-recommendation/components/ApplicationViewDialog";
import { getApplicantStageColor } from "./columns";

function formatSubmitted(value: string | null | undefined) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface ApplicantDetailDrawerProps {
    row: ApplicantRow | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ApplicantDetailDrawer({ row, open, onOpenChange }: ApplicantDetailDrawerProps) {
    const hasApplication = row !== null && row.application_id !== null;
    const [isApplicationOpen, setIsApplicationOpen] = React.useState(false);

    React.useEffect(() => {
        if (!open) setIsApplicationOpen(false);
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={false} className="detail-drawer w-[95vw] sm:w-full sm:max-w-lg p-0 overflow-hidden border border-border/40 shadow-2xl bg-background rounded-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-border/40 bg-card">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-extrabold flex items-center gap-3">
                            <Users className="w-6 h-6 text-primary shrink-0" />
                            <span className="truncate">{row?.full_name || "Applicant"}</span>
                        </DialogTitle>
                    </DialogHeader>
                </div>

                <div className="p-6 flex-1 overflow-y-auto min-h-0 space-y-6">
                    <div className="bg-card shadow-sm border border-border/50 rounded-xl p-6 space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                            <Users className="w-5 h-5 text-primary/70" />
                            <h3 className="text-lg font-semibold tracking-tight">Summary</h3>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                                    Position
                                </span>
                                <div className="font-medium text-foreground p-3 bg-muted/30 rounded-md border border-border/50 truncate">
                                    {row?.position_applied_for || "—"}
                                </div>
                            </div>
                            <div>
                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                                    Submitted
                                </span>
                                <div className="font-medium text-foreground p-3 bg-muted/30 rounded-md border border-border/50">
                                    {formatSubmitted(row?.submitted_at)}
                                </div>
                            </div>
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                                <div className="flex-1">
                                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                                        Stage
                                    </span>
                                    {row ? (
                                        <Badge
                                            variant="outline"
                                            className={`px-3 py-1.5 rounded-full font-bold uppercase tracking-wider ${getApplicantStageColor(row.stage)}`}
                                        >
                                            {row.stage}
                                        </Badge>
                                    ) : (
                                        <span className="font-medium">—</span>
                                    )}
                                </div>
                                {hasApplication && row && (
                                    <Button
                                        variant="outline"
                                        className="w-full sm:w-auto shrink-0"
                                        onClick={() => setIsApplicationOpen(true)}
                                        aria-label={`View application of ${row.full_name}`}
                                    >
                                        <FileText className="mr-2 h-4 w-4" />
                                        Application Form
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                </div>

                <div className="p-4 md:p-6 bg-muted/20 border-t border-border/40">
                    <DialogFooter className="flex w-full sm:justify-end gap-3 items-center">
                        <DialogClose asChild>
                            <Button type="button" variant="outline" className="rounded-full px-6 w-full sm:w-auto">
                                Close
                            </Button>
                        </DialogClose>
                    </DialogFooter>
                </div>
            </DialogContent>
            <ApplicationViewDialog
                applicantId={row?.id ?? null}
                applicantName={row?.full_name || "Applicant"}
                open={isApplicationOpen}
                onOpenChange={setIsApplicationOpen}
            />
        </Dialog>
    );
}
