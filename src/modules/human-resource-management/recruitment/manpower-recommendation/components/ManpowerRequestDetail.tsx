"use client";

import { useManpowerRecommendation } from "../hooks/useManpowerRecommendation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";

import { Eye, FileText } from "lucide-react";

export function ManpowerRequestDetail() {
    const { recommendations, applicants, isDetailOpen, setIsDetailOpen, selectedRequest, openRecommendForm, handleView } = useManpowerRecommendation();

    if (!selectedRequest) return null;

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Recommended': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
            case 'Approved': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
            case 'Hired': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
            case 'Rejected': return 'bg-red-500/10 text-red-600 border-red-500/20';
            case 'Withdrawn': return 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20';
            default: return 'bg-primary/10 text-primary border-primary/20';
        }
    };

    const applicantMap = new Map(applicants.map((a) => [a.id, a]));
    const related = recommendations.filter((r) => r.manpower_request_id === selectedRequest.id);
    const approvedCount = related.filter((r) => r.status === 'Approved' || r.status === 'Hired').length;
    const hiredCount = related.filter((r) => r.status === 'Hired').length;
    const totalSlots = selectedRequest.no_manpower_needed ?? 0;
    const isClosed = totalSlots > 0 && hiredCount >= totalSlots;
    const isFull = totalSlots > 0 && approvedCount >= totalSlots && !isClosed;


    return (
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
            <DialogContent className="w-[95vw] sm:max-w-[700px] p-0 overflow-hidden border border-border/40 shadow-2xl bg-background rounded-2xl flex flex-col max-h-[90vh]">
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

                <div className="p-6 flex-1 overflow-y-auto min-h-0">
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
                                        <span className="font-medium truncate max-w-full sm:max-w-[160px] flex-1 min-w-0" title={applicant?.full_name ?? `Applicant #${rec.applicant_id}`}>
                                            {applicant?.full_name ?? `Applicant #${rec.applicant_id}`}
                                        </span>
                                        <div className="flex w-full items-center gap-3 shrink-0 sm:ml-auto sm:w-auto">
                                            <Badge variant="outline" className={`px-3 py-1.5 text-xs rounded-full font-bold uppercase tracking-wider w-[130px] justify-center shrink-0 ${getStatusColor(rec.status ?? "Recommended")}`}>
                                                {rec.status ?? "Recommended"}
                                            </Badge>
                                            <Button variant="ghost" size="sm" className="flex-1 sm:flex-none" onClick={() => handleView(rec)} aria-label={`View recommendation ${rec.id}`}>
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
