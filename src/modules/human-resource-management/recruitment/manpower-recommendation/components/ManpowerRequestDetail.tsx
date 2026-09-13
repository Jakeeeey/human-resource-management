"use client";

import { useManpowerRecommendation } from "../hooks/useManpowerRecommendation";
import { applicantStatusLabel } from "../utils/applicantPipeline";
import { countRequestApplicants, deriveRequestEffectiveStatus } from "../utils/requestStatus";
import { RequestStatusPill } from "./RequestStatusPill";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";

import { Eye, FileText } from "lucide-react";

export function ManpowerRequestDetail() {
    const { recommendations, applicants, divisions, isDetailOpen, setIsDetailOpen, selectedRequest, openRecommendForm, handleView } = useManpowerRecommendation();

    if (!selectedRequest) return null;

    // Badge colour keyed by the APPLICANT pipeline status (snake_case), since the
    // row surfaces the pipeline truth rather than the recommendation artifact.
    const getStatusColor = (status: string | null | undefined) => {
        switch (status) {
            case 'final_approved':
            case 'hired': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
            case 'rejected': return 'bg-red-500/10 text-red-600 border-red-500/20';
            case 'withdrawn': return 'bg-stone-500/10 text-stone-600 border-stone-500/20';
            case 'recommended':
            case 'verdict_pending':
            case 'for_signing':
            case 'incomplete': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
            case 'initial_interview':
            case 'final_interview': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
            default: return 'bg-primary/10 text-primary border-primary/20';
        }
    };

    const applicantMap = new Map(applicants.map((a) => [a.id, a]));
    const related = recommendations.filter((r) => r.manpower_request_id === selectedRequest.id);
    // Slot/hire counts and the effective status follow the shared derivation
    // (utils/requestStatus.ts) — the SAME source the open-requests list pill uses.
    const statusCounts = countRequestApplicants(recommendations, selectedRequest.id, new Map(applicants.map((a) => [a.id, a.status])));
    const totalSlots = selectedRequest.no_manpower_needed ?? 0;
    const effectiveStatus = deriveRequestEffectiveStatus(selectedRequest.status, totalSlots, statusCounts);
    const isClosed = totalSlots > 0 && statusCounts.hired >= totalSlots;
    const isFull = totalSlots > 0 && statusCounts.approved >= totalSlots && !isClosed;
    const divisionName = selectedRequest.division_id == null ? "N/A" : (divisions.find((d) => d.id === selectedRequest.division_id)?.name ?? String(selectedRequest.division_id));


    return (
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
            <DialogContent showCloseButton={false} className="w-[95vw] sm:max-w-[700px] p-0 overflow-hidden border border-border/40 shadow-2xl bg-background rounded-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-border/40 bg-card">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-extrabold flex items-center gap-3">
                            <span className="truncate" title={selectedRequest.request_no}>{selectedRequest.request_no}</span>
                        </DialogTitle>
                        <DialogDescription className="text-sm mt-2">
                            <span className="truncate block" title={selectedRequest.position}>{selectedRequest.position}</span>
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-6 flex-1 overflow-y-auto min-h-0 space-y-6">
                    {/* Request-level fields render even with zero recommendations,
                        so a request is viewable without depending on a hiree row. */}
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <div>
                            <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Division</p>
                            <p className="text-sm font-medium text-foreground truncate" title={divisionName}>{divisionName}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Slots Needed</p>
                            <p className="text-sm font-medium text-foreground">{totalSlots}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Slots Filled</p>
                            <p className="text-sm font-medium text-foreground">{statusCounts.approved}/{totalSlots}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Status</p>
                            <RequestStatusPill status={effectiveStatus} />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Recommendations</h3>
                    {related.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-muted-foreground text-center h-24">
                            <FileText className="w-12 h-12 text-muted-foreground/30 mb-3" />
                            <p className="font-medium">No recommendations yet for this request.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {related.map((rec) => {
                                const applicant = applicantMap.get(rec.applicant_id);
                                return (
                                    <div key={rec.id} className="flex flex-col gap-3 p-3 border border-border/50 rounded-xl bg-card sm:flex-row sm:items-center">
                                        <span className="font-medium truncate max-w-full sm:max-w-[280px] flex-1 min-w-0" title={applicant?.full_name ?? `Applicant #${rec.applicant_id}`}>
                                            {applicant?.full_name ?? `Applicant #${rec.applicant_id}`}
                                        </span>
                                        <div className="flex w-full items-center justify-between gap-3 shrink-0 sm:ml-auto sm:w-auto sm:justify-start">
                                            <Badge
                                                variant="outline"
                                                className={`px-3 py-1.5 text-xs rounded-full font-bold uppercase tracking-wider w-[130px] justify-center shrink-0 ${getStatusColor(applicant?.status)}`}
                                                title="Applicant pipeline status — drives the Slots Filled count"
                                            >
                                                {applicantStatusLabel(applicant?.status)}
                                            </Badge>
                                            <Button variant="ghost" size="sm" className="flex-none shrink-0" onClick={() => handleView(rec)} aria-label={`View recommendation ${rec.id}`}>
                                                <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                                                View
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    </div>
                </div>

                <div className="p-4 md:p-6 bg-muted/20 border-t border-border/40">
                    <DialogFooter className="flex w-full sm:justify-end gap-3 items-center">
                        {selectedRequest.status !== 'Approved' ? (
                            <span className="text-muted-foreground text-xs mr-auto">Awaiting approval — recommendations open after approval.</span>
                        ) : isClosed ? (
                            <span className="text-muted-foreground text-xs mr-auto">Hiring complete.</span>
                        ) : isFull ? (
                            <span className="text-muted-foreground text-xs mr-auto">All slots filled.</span>
                        ) : (
                            <Button
                                type="button"
                                onClick={() => { setIsDetailOpen(false); openRecommendForm(selectedRequest.id); }}
                                className="w-full rounded-full px-8 shadow-sm hover:shadow-md transition-all sm:w-auto"
                            >
                                Recommend
                            </Button>
                        )}
                        <DialogClose asChild>
                            <Button type="button" variant="outline" className="w-full rounded-full px-6 sm:w-auto">
                                Close
                            </Button>
                        </DialogClose>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
