"use client";

import { useEffect, useState } from "react";
import { useManpowerRecommendationContext } from "../providers/ManpowerRecommendationProvider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Building2, FileText, UserCheck, Loader2, Pencil } from "lucide-react";
import { ApplicationViewDialog } from "./ApplicationViewDialog";

const STATUS_OPTIONS = ["Recommended", "Approved", "Hired", "Rejected", "Withdrawn"] as const;

type StatusOption = (typeof STATUS_OPTIONS)[number];

function toStatusOption(value: string | null | undefined): StatusOption {
    return (STATUS_OPTIONS as readonly string[]).includes(value || "")
        ? (value as StatusOption)
        : "Recommended";
}

function getStatusColor(status: string) {
    switch (status) {
        case "Recommended": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
        case "Approved": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
        case "Hired": return "bg-purple-500/10 text-purple-600 border-purple-500/20";
        case "Rejected": return "bg-red-500/10 text-red-600 border-red-500/20";
        case "Withdrawn": return "bg-zinc-500/10 text-zinc-600 border-zinc-500/20";
        default: return "bg-primary/10 text-primary border-primary/20";
    }
}

export function ManpowerRecommendationView() {
    const { isViewOpen, setIsViewOpen, selectedRecommendation, updateRecommendation, applicants, openRequests, users } = useManpowerRecommendationContext();

    const [newStatus, setNewStatus] = useState<StatusOption>("Recommended");
    const [decisionNotes, setDecisionNotes] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEditingStatus, setIsEditingStatus] = useState(false);
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [isResumeOpen, setIsResumeOpen] = useState(false);

    useEffect(() => {
        if (selectedRecommendation) {
            setNewStatus(toStatusOption(selectedRecommendation.status));
            setDecisionNotes(selectedRecommendation.decision_notes || "");
            setIsEditingStatus(false);
            setIsEditingNotes(false);
            setIsResumeOpen(false);
        }
    }, [selectedRecommendation]);

    if (!selectedRecommendation) return null;

    // openRequests only holds Draft rows — a recommendation whose request later
    // left Draft won't be in the list, so fall back to the raw id (never blank).
    const matchedRequest = openRequests.find(r => r.id === selectedRecommendation.manpower_request_id);
    const requestNo = matchedRequest?.request_no || String(selectedRecommendation.manpower_request_id);
    const position = matchedRequest?.position || `Request #${selectedRecommendation.manpower_request_id}`;
    const applicantName = applicants.find(a => a.id === selectedRecommendation.applicant_id)?.full_name || `Applicant #${selectedRecommendation.applicant_id}`;
    // recommended_by/decision_by are plain INT (no Directus relation) — join full
    // names from the users lookup, falling back to the raw id (never blank).
    const userName = (id: number | null | undefined) =>
        id == null ? "-" : users.find(u => Number(u.id) === id)?.name || `User #${id}`;
    const recommendedByName = userName(selectedRecommendation.recommended_by);
    const decisionByName = userName(selectedRecommendation.decision_by);

    const handleUpdateStatus = async () => {
        if (selectedRecommendation.id == null) return;
        setIsSubmitting(true);
        try {
            // NOTE: send ONLY { status, decision_notes } — decision_by/decision_at
            // are injected server-side by the Task 5 PATCH route (no userId exists
            // in client scope; mirrors the updated_by injection pattern).
            const ok = await updateRecommendation(selectedRecommendation.id, {
                status: newStatus,
                decision_notes: decisionNotes.trim() ? decisionNotes : null,
            });
            if (ok) setIsViewOpen(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
        <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
            <DialogContent className="sm:max-w-[85vw] lg:max-w-[1000px] w-full p-0 overflow-hidden border border-border/40 shadow-2xl bg-background rounded-2xl flex flex-col max-h-[calc(100vh-3rem)]">
                <div className="p-6 md:p-8 border-b border-border/40 bg-card">
                    <DialogHeader>
                        <DialogTitle className="text-2xl md:text-3xl font-extrabold flex items-center gap-3">
                            <FileText className="w-8 h-8 text-primary" />
                            MANPOWER RECOMMENDATION DETAILS
                        </DialogTitle>
                        <DialogDescription className="text-base mt-2">
                            View details for recommendation for {applicantName} ({requestNo}).
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="px-6 md:px-8 py-4 flex-1 overflow-y-auto min-h-0 space-y-8">
                    {/* Section 1: Request & Applicant */}
                    <div className="bg-card shadow-sm border border-border/50 rounded-xl p-6 space-y-6">
                        <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                            <Building2 className="w-5 h-5 text-primary/70" />
                            <h3 className="text-lg font-semibold tracking-tight">Request & Applicant</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Request No</label>
                                <div className="font-medium text-foreground p-3 bg-muted/30 rounded-md border border-border/50">{requestNo}</div>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Position</label>
                                <div className="font-medium text-foreground p-3 bg-muted/30 rounded-md border border-border/50">{position}</div>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Applicant Name</label>
                                <div className="font-medium text-foreground p-3 bg-muted/30 rounded-md border border-border/50">{applicantName}</div>
                            </div>
                            <div className="md:col-span-3">
                                <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Status</label>
                                <div className="flex items-center gap-2">
                                    {isEditingStatus ? (
                                        <Select value={newStatus} onValueChange={(v) => setNewStatus(toStatusOption(v))}>
                                            <SelectTrigger className="truncate">
                                                <SelectValue placeholder="Select status" className="truncate" />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-60">
                                                {STATUS_OPTIONS.map((option) => (
                                                    <SelectItem key={option} value={option}>
                                                        {option}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <span className={`px-3 py-1.5 border text-xs rounded-full font-bold uppercase tracking-wider ${getStatusColor(newStatus)}`}>
                                            {newStatus}
                                        </span>
                                    )}
                                    <Button variant="ghost" size="sm" onClick={() => setIsEditingStatus((v) => !v)} aria-label="Edit status">
                                        <Pencil className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                    <Button variant="outline"               size="lg"
              className="ml-auto" onClick={() => setIsResumeOpen(true)} aria-label={`View application of ${applicantName}`}>
                                        <FileText className="mr-2 h-4 w-4" />
                                        Application Form
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Recommendation */}
                    <div className="bg-card shadow-sm border border-border/50 rounded-xl p-6 space-y-6">
                        <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                            <FileText className="w-5 h-5 text-primary/70" />
                            <h3 className="text-lg font-semibold tracking-tight">Recommendation</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                                <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Recommendation Notes</label>
                                <div className="font-medium text-foreground p-3 bg-muted/30 rounded-md border border-border/50 whitespace-pre-wrap min-h-[100px] max-h-[400px] overflow-y-auto">{selectedRecommendation.recommendation_notes || "-"}</div>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Recommended By</label>
                                <div className="font-medium text-foreground p-3 bg-muted/30 rounded-md border border-border/50">{recommendedByName}</div>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Recommended At</label>
                                <div className="font-medium text-foreground p-3 bg-muted/30 rounded-md border border-border/50">{selectedRecommendation.recommended_at || "-"}</div>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Decision */}
                    <div className="bg-card shadow-sm border border-border/50 rounded-xl p-6 space-y-6">
                        <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                            <UserCheck className="w-5 h-5 text-primary/70" />
                            <h3 className="text-lg font-semibold tracking-tight">Decision</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Decision By</label>
                                <div className="font-medium text-foreground p-3 bg-muted/30 rounded-md border border-border/50">{decisionByName}</div>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Decision At</label>
                                <div className="font-medium text-foreground p-3 bg-muted/30 rounded-md border border-border/50">{selectedRecommendation.decision_at || "-"}</div>
                            </div>
                            <div className="md:col-span-2">
                                <div className="flex items-center gap-1 mb-1">
                                    <label className="text-xs font-bold uppercase text-muted-foreground block">Decision Notes</label>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIsEditingNotes((v) => !v)} aria-label="Edit decision notes">
                                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                    </Button>
                                </div>
                                {isEditingNotes ? (
                                    <Textarea
                                        placeholder="Add decision notes..."
                                        rows={2}
                                        className="min-h-[60px] resize-none bg-muted/30 focus:bg-background transition-colors"
                                        value={decisionNotes}
                                        onChange={(e) => setDecisionNotes(e.target.value)}
                                    />
                                ) : (
                                    <div className="font-medium text-foreground p-3 bg-muted/30 rounded-md border border-border/50 whitespace-pre-wrap min-h-[100px] max-h-[400px] overflow-y-auto">{decisionNotes || "-"}</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-4 md:p-6 border-t border-border/40 bg-card/50 flex items-center gap-3 justify-end rounded-b-2xl">
                    <DialogClose asChild>
                        <Button variant="outline" className="w-full sm:w-auto h-12 px-8 font-semibold shadow-sm">
                            Close
                        </Button>
                    </DialogClose>
                    <Button onClick={handleUpdateStatus} disabled={isSubmitting} className="w-full sm:w-auto h-12 px-8 font-semibold shadow-sm">
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Update Status
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        <ApplicationViewDialog
            applicantId={selectedRecommendation.applicant_id}
            applicantName={applicantName}
            open={isResumeOpen}
            onOpenChange={setIsResumeOpen}
        />
        </>
    );
}
