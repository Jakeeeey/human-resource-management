"use client";

import { useManpowerApproval } from "../hooks/useManpowerApproval";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Building2, Briefcase, FileText, Users, User, CheckCircle2, Check, X } from "lucide-react";
import { useState } from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function ManpowerApprovalView() {
    const { isViewOpen, setIsViewOpen, selectedRequest, departments, divisions, approveRequest, rejectRequest } = useManpowerApproval();
    const [confirmAction, setConfirmAction] = useState<'Approve' | 'Reject' | null>(null);

    if (!selectedRequest) return null;

    const departmentName = departments.find(d => d.id === selectedRequest.requesting_department_id)?.name || selectedRequest.requesting_department_id;
    const divisionName = selectedRequest.division_id ? (divisions.find(d => d.id === selectedRequest.division_id)?.name || selectedRequest.division_id) : "N/A";

    const handleConfirm = async () => {
        if (!confirmAction) return;
        if (confirmAction === 'Approve') {
            await approveRequest(selectedRequest.id!);
        } else {
            await rejectRequest(selectedRequest.id!);
        }
        setConfirmAction(null);
    };

    return (
        <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
            <DialogContent className="sm:max-w-[85vw] lg:max-w-[1000px] w-full p-0 overflow-hidden border border-border/40 shadow-2xl bg-background rounded-2xl">
                <div className="p-6 md:p-8 border-b border-border/40 bg-card">
                    <DialogHeader>
                        <DialogTitle className="text-2xl md:text-3xl font-extrabold flex items-center gap-3">
                            <FileText className="w-8 h-8 text-primary" />
                            MANPOWER REQUEST DETAILS
                        </DialogTitle>
                        <DialogDescription className="text-base mt-2">
                            View details for manpower request {selectedRequest.request_no}.
                        </DialogDescription>
                    </DialogHeader>
                </div>
                
                <div className="p-6 md:p-8 max-h-[70vh] overflow-y-auto space-y-8">
                    {/* Section 1: Basic Info */}
                    <div className="bg-card shadow-sm border border-border/50 rounded-xl p-6 space-y-6">
                        <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                            <Building2 className="w-5 h-5 text-primary/70" />
                            <h3 className="text-lg font-semibold tracking-tight">Department & Position</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Request ID #</label>
                                <div className="font-medium text-foreground p-3 bg-muted/30 rounded-md border border-border/50">{selectedRequest.request_no}</div>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Department</label>
                                <div className="font-medium text-foreground p-3 bg-muted/30 rounded-md border border-border/50">{departmentName}</div>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Division</label>
                                <div className="font-medium text-foreground p-3 bg-muted/30 rounded-md border border-border/50">{divisionName}</div>
                            </div>
                            <div className="md:col-span-3">
                                <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Job Position / Title</label>
                                <div className="font-medium text-foreground p-3 bg-muted/30 rounded-md border border-border/50">{selectedRequest.position}</div>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Purpose */}
                    <div className="bg-card shadow-sm border border-border/50 rounded-xl p-6 space-y-6">
                        <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                            <Briefcase className="w-5 h-5 text-primary/70" />
                            <h3 className="text-lg font-semibold tracking-tight">Purpose & Employment Status</h3>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Purpose</label>
                                    <div className="font-medium text-foreground p-3 bg-muted/30 rounded-md border border-border/50">{selectedRequest.purpose}</div>
                                </div>
                                {selectedRequest.purpose === "Replacement" && (
                                    <div>
                                        <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Name of replaced employee</label>
                                        <div className="font-medium text-foreground p-3 bg-muted/30 rounded-md border border-border/50">{selectedRequest.replacement_name || "-"}</div>
                                    </div>
                                )}
                                <div>
                                    <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">No. of Manpower Needed</label>
                                    <div className="font-medium text-foreground p-3 bg-muted/30 rounded-md border border-border/50">{selectedRequest.no_manpower_needed}</div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Employment Status / Nature</label>
                                    <div className="font-medium text-foreground p-3 bg-muted/30 rounded-md border border-border/50">{selectedRequest.employment_type}</div>
                                </div>
                                {selectedRequest.employment_type === "Others" && (
                                    <div>
                                        <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Specific Employment Type</label>
                                        <div className="font-medium text-foreground p-3 bg-muted/30 rounded-md border border-border/50">{selectedRequest.employment_others || "-"}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Justification & Qualifications */}
                    <div className="bg-card shadow-sm border border-border/50 rounded-xl p-6 space-y-6">
                        <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                            <Users className="w-5 h-5 text-primary/70" />
                            <h3 className="text-lg font-semibold tracking-tight">Justification & Qualifications</h3>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Reason / Justification</label>
                                    <div className="font-medium text-foreground p-3 bg-muted/30 rounded-md border border-border/50 whitespace-pre-wrap min-h-[100px]">{selectedRequest.reason_justification}</div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Gender Preference</label>
                                    <div className="font-medium text-foreground p-3 bg-muted/30 rounded-md border border-border/50">{selectedRequest.qualification}</div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Other Qualifications</label>
                                    <div className="font-medium text-foreground p-3 bg-muted/30 rounded-md border border-border/50 whitespace-pre-wrap min-h-[100px]">{selectedRequest.qualification_description}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 4: Budget & Target */}
                    <div className="bg-card shadow-sm border border-border/50 rounded-xl p-6 space-y-6">
                        <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                            <CheckCircle2 className="w-5 h-5 text-primary/70" />
                            <h3 className="text-lg font-semibold tracking-tight">Applicant & Rate</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2 mb-1">
                                    <User className="w-4 h-4" /> Name of Applicant (if any)
                                </label>
                                <div className="font-medium text-foreground p-3 bg-muted/30 rounded-md border border-border/50">{selectedRequest.applicant_name || "-"}</div>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2 mb-1">
                                    <span className="flex items-center justify-center w-4 h-4 text-base font-serif leading-none opacity-80">₱</span>
                                    Proposed Rate
                                </label>
                                <div className="font-medium text-foreground p-3 bg-muted/30 rounded-md border border-border/50">
                                    ₱ {selectedRequest.rate != null && !isNaN(Number(selectedRequest.rate)) ? Number(selectedRequest.rate).toFixed(2) : "0.00"}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-4 md:p-6 border-t border-border/40 bg-card/50 flex flex-col sm:flex-row items-center gap-3 justify-end rounded-b-2xl">
                    <Button variant="outline" onClick={() => setIsViewOpen(false)} className="w-full sm:w-auto h-12 px-8 font-semibold shadow-sm mr-auto">
                        Close
                    </Button>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <Button 
                            variant="destructive" 
                            className="w-full sm:w-auto px-6 rounded-md h-12 font-semibold shadow-sm hover:shadow-md transition-all gap-2"
                            onClick={() => setConfirmAction('Reject')}
                        >
                            <X className="w-5 h-5" /> Reject
                        </Button>
                        <Button 
                            className="w-full sm:w-auto px-8 rounded-md h-12 font-bold shadow-md hover:shadow-lg transition-all bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                            onClick={() => setConfirmAction('Approve')}
                        >
                            <Check className="w-5 h-5" /> Approve
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
            
            <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will {confirmAction?.toLowerCase()} the manpower request <span className="font-bold">{selectedRequest.request_no}</span>. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleConfirm}
                            className={confirmAction === 'Approve' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}
                        >
                            Yes, {confirmAction}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Dialog>
    );
}
