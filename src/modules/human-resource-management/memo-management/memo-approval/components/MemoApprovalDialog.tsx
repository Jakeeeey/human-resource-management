"use client";

import React from "react";
import { Paperclip, FileText, Info } from "lucide-react";
import { Memo, Company } from "../types";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8055";

interface MemoApprovalDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    memo: Memo | null;
    companies: Company[];
}

export function MemoApprovalDialog({ open, onOpenChange, memo, companies }: MemoApprovalDialogProps) {
    const [isMessageModalOpen, setIsMessageModalOpen] = React.useState(false);

    if (!memo) return null;

    const fromCompany = companies.find((c) => Number(c.company_id) === Number(memo.from));
    const targetCompanies = (memo.company_ids || [])
        .map((id) => companies.find((c) => Number(c.company_id) === Number(id)))
        .filter((c): c is Company => !!c);

    const attachments = memo.attachments || [];

    // Helper to format Date string (MM/DD/YYYY)
    const formatDate = (dateStr: string) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-0 shrink-0">
                        <DialogTitle>View Memo Details</DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
                        {fromCompany?.company_code === "RSM" && (
                            <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-3 flex gap-3 items-start dark:bg-blue-950/30 dark:border-blue-800/60 dark:text-blue-400 animate-in fade-in slide-in-from-top-2">
                                <Info className="h-5 w-5 shrink-0 mt-0.5" />
                                <div className="text-sm font-medium leading-relaxed">
                                    Memos originating from Rooch Holdings (RSM) bypass the standard review workflow and are automatically assigned an Approved status upon creation.
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Memo No.</label>
                            <Input disabled value={memo.memo_no} className="bg-muted text-sm font-semibold" />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">From Company</label>
                            <Input 
                                disabled 
                                value={fromCompany ? `${fromCompany.company_name} (${fromCompany.company_code})` : `Company ID: ${memo.from}`} 
                                className="bg-muted text-sm" 
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Target Companies</label>
                            <div className="border rounded-md p-3 max-h-[150px] overflow-y-auto space-y-2 bg-muted/20">
                                {targetCompanies.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic">No target companies mapped.</p>
                                ) : (
                                    targetCompanies.map((c) => (
                                        <div key={c.company_id} className="text-sm font-medium">
                                            • {c.company_name} ({c.company_code})
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Start Date</label>
                                <Input disabled value={formatDate(memo.start_date)} className="bg-muted text-sm" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">End Date</label>
                                <Input disabled value={formatDate(memo.end_date)} className="bg-muted text-sm" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subject</label>
                            <Input disabled value={memo.subject} className="bg-muted text-sm" />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Message Body</label>
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full flex items-center justify-between h-10 border-dashed hover:bg-accent/40 bg-background border-primary/30 text-primary"
                                onClick={() => setIsMessageModalOpen(true)}
                            >
                                <span className="flex items-center gap-2 font-medium">
                                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    {memo.body ? "Message body composed" : "No message body"}
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary px-2.5 py-1 rounded-full animate-pulse shrink-0">
                                    Click to View
                                </span>
                            </Button>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Attachments</label>
                            <div className="flex flex-col gap-2">
                                {attachments.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic border border-dashed rounded-md p-3 text-center bg-muted/10">No attachments.</p>
                                ) : (
                                    <div className="border rounded-md divide-y max-h-[150px] overflow-y-auto bg-muted/20">
                                        {attachments.map((file, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2.5 text-xs">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    <a
                                                        href={`${DIRECTUS_URL}/assets/${file.file_url}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="truncate font-semibold text-primary hover:underline"
                                                        title={file.file_name}
                                                    >
                                                        {file.file_name}
                                                    </a>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-6 pt-4 border-t shrink-0 flex justify-end gap-2 bg-background">
                        <Button type="button" onClick={() => onOpenChange(false)}>
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Message Body Sub-Modal */}
            <Dialog open={isMessageModalOpen} onOpenChange={setIsMessageModalOpen}>
                <DialogContent className="sm:max-w-[700px] flex flex-col p-6 max-h-[85vh]">
                    <DialogHeader className="shrink-0">
                        <DialogTitle>View Message Body</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 min-h-0 flex flex-col overflow-y-auto max-h-[65vh]">
                        <div className="ql-snow border rounded-md p-5 bg-muted/20 max-w-none text-sm leading-relaxed [&_p]:min-h-[1em]">
                            <div 
                                className="ql-editor !p-0"
                                dangerouslySetInnerHTML={{ 
                                    __html: (memo.body || "")
                                        .replace(/<p><\/p>/g, "<p><br></p>")
                                        .replace(/&nbsp;/g, " ")
                                        .replace(/\u00a0/g, " ")
                                        .trim() || "<p class='text-muted-foreground italic'>No content.</p>" 
                                }}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4 shrink-0 border-t">
                        <Button type="button" onClick={() => setIsMessageModalOpen(false)}>
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
