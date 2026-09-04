"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollableSearchableSelect } from "./ScrollableSearchableSelect";
import { useInterview } from "../hooks/useInterview";
import { deriveScheduleStage } from "../utils/schedule-stage";

/**
 * Schedule-step dialog: pick a quiz-completed applicant, see the derived
 * stage, submit a Pending interview row (no sheet — grading happens on the
 * grade page). The stage is derived, never picked: a Passed Initial promotes
 * to Final, anything else stays Initial, and Passed-Final applicants never
 * appear in the select. A repeat submit for the same app + stage reuses the
 * existing ungraded row (server `reused` signal) — both paths land on its
 * grade page.
 */
export function InterviewScheduleDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const router = useRouter();
    const { eligibleInitial, eligibleFinal, interviews, refresh } = useInterview();
    const [applicationId, setApplicationId] = useState<string | undefined>(undefined);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const options = useMemo(
        () =>
            eligibleInitial
                .filter((app) => deriveScheduleStage(app.id, interviews) !== null)
                .map((app) => ({ value: String(app.id), label: app.full_name })),
        [eligibleInitial, interviews],
    );

    const selectedApp = useMemo(
        () => eligibleInitial.find((app) => app.id === Number(applicationId)) ?? null,
        [eligibleInitial, applicationId],
    );

    const derivedStage = useMemo(
        () => (selectedApp ? deriveScheduleStage(selectedApp.id, interviews) : null),
        [selectedApp, interviews],
    );

    const finalLink = useMemo(
        () =>
            derivedStage === "Final" && selectedApp
                ? (eligibleFinal.find((rec) => rec.applicant_id === selectedApp.applicant_id) ?? null)
                : null,
        [derivedStage, selectedApp, eligibleFinal],
    );

    const handleOpenChange = (next: boolean) => {
        if (!next) setApplicationId(undefined);
        onOpenChange(next);
    };

    const handleSubmit = async () => {
        if (selectedApp == null || derivedStage === null) {
            toast.error("Please select an applicant to schedule.");
            return;
        }
        setIsSubmitting(true);
        try {
            const response = await fetch("/api/hrm/interviews", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ schedule: true, application_id: selectedApp.id }),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || result.error || "Could not schedule interview");
            }
            toast.success(result.reused === true ? "Already scheduled — opening the grade page." : "Interview scheduled.");
            await refresh();
            handleOpenChange(false);
            router.push(`/hrm/interviews/grade/${result.data.id}`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not schedule interview");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="w-[95vw] sm:max-w-[500px] p-0 overflow-hidden border border-border/40 shadow-2xl bg-background rounded-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-border/40 bg-card">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-extrabold flex items-center gap-3">
                            <CalendarPlus className="w-6 h-6 text-primary" />
                            Schedule Interview
                        </DialogTitle>
                        <DialogDescription className="text-sm mt-2">
                            Pick an applicant — the stage is derived from their latest initial verdict. Grading happens on the next page.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-6 flex-1 overflow-y-auto min-h-0 space-y-6">
                    <div className="space-y-2">
                        <p className="text-xs font-bold uppercase text-muted-foreground">
                            Applicant <span className="text-destructive">*</span>
                        </p>
                        <ScrollableSearchableSelect
                            options={options}
                            value={applicationId}
                            onValueChange={setApplicationId}
                            placeholder="Select applicant..."
                        />
                    </div>

                    {selectedApp && derivedStage && (
                        <div className="rounded-lg border p-3 space-y-2">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Stage:</span>
                                <Badge
                                    variant="outline"
                                    className={`px-3 py-1 text-xs rounded-full font-bold uppercase tracking-wider ${derivedStage === "Initial" ? "bg-blue-500/10 text-blue-600 border-blue-500/20" : "bg-purple-500/10 text-purple-600 border-purple-500/20"}`}
                                >
                                    {derivedStage}
                                </Badge>
                            </div>
                            {derivedStage === "Final" && (
                                <p className="text-sm text-muted-foreground">
                                    {finalLink?.position ?? (finalLink?.manpower_request_id != null ? `#${finalLink.manpower_request_id}` : "Position —")}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 md:p-6 bg-muted/20 border-t border-border/40">
                    <DialogFooter className="flex w-full sm:justify-end gap-3">
                        <DialogClose asChild>
                            <Button type="button" variant="outline" className="rounded-full px-6">
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button
                            type="button"
                            disabled={isSubmitting || selectedApp == null || derivedStage === null}
                            onClick={handleSubmit}
                            className="rounded-full px-8 shadow-sm hover:shadow-md transition-all"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Scheduling...
                                </>
                            ) : (
                                "Schedule"
                            )}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
