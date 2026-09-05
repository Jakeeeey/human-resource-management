"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Paperclip, X, UploadCloud, FileText } from "lucide-react";
import { Memo, Company } from "../types";
import { MemoCreationService } from "../services/MemoCreationService";
import { memoFormSchema, MemoFormValues } from "../types/memo-creation.schema";
import { toast } from "sonner";
import dynamic from "next/dynamic";
// @ts-expect-error - react-quill-new missing types in CI
const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false }) as React.ElementType;
import "react-quill-new/dist/quill.snow.css";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8055";

interface MemoCreationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: Partial<Memo>, attachments: { id?: string | number; file_url: string; file_name: string }[]) => Promise<void>;
    memo: Memo | null;
    companies: Company[];
    isSubmitting: boolean;
    isReadOnly?: boolean;
}

export function MemoCreationDialog({ open, onOpenChange, onSubmit, memo, companies, isSubmitting, isReadOnly = false }: MemoCreationDialogProps) {
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [from, setFrom] = useState<number | "">( "");
    const [selectedCompanyIds, setSelectedCompanyIds] = useState<number[]>([]);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [errors, setErrors] = useState<Partial<Record<keyof MemoFormValues, string>>>({});
    const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);

    const getTodayDateString = () => {
        const options: Intl.DateTimeFormatOptions = {
            timeZone: 'Asia/Manila',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        };
        const formatter = new Intl.DateTimeFormat('en-CA', options);
        return formatter.format(new Date());
    };

    
    const [attachments, setAttachments] = useState<{ id?: string | number; file_url: string; file_name: string }[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        if (open) {
            setErrors({});
            if (memo) {
                setSubject(memo.subject || "");
                setBody(memo.body || "");
                setFrom(memo.from || "");
                setSelectedCompanyIds(memo.company_ids || []);
                setStartDate(memo.start_date || "");
                setEndDate(memo.end_date || "");
                setAttachments(memo.attachments || []);
            } else {
                setSubject("");
                setBody("");
                setFrom("");
                setSelectedCompanyIds([]);
                setStartDate("");
                setEndDate("");
                setAttachments([]);
            }
        }
    }, [open, memo]);

    const handleToggleCompany = (id: number) => {
        if (isReadOnly) return;
        const updated = selectedCompanyIds.includes(id) 
            ? selectedCompanyIds.filter((c) => c !== id) 
            : [...selectedCompanyIds, id];
        setSelectedCompanyIds(updated);
        setErrors((prev) => ({ ...prev, company_ids: undefined }));
    };

    const handleSelectAllCompanies = () => {
        if (isReadOnly) return;
        let updated: number[] = [];
        if (selectedCompanyIds.length !== companies.length) {
            updated = companies.map((c) => Number(c.company_id));
        }
        setSelectedCompanyIds(updated);
        setErrors((prev) => ({ ...prev, company_ids: undefined }));
    };

    const processFiles = async (filesArray: File[]) => {
        const allowedExtensions = [".pdf", ".png", ".jpg", ".jpeg"];
        const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
        const maxFileSize = 10 * 1024 * 1024; // 10MB
        
        const invalidFiles: string[] = [];
        const oversizedFiles: string[] = [];
        const validFiles: File[] = [];
        
        for (const file of filesArray) {
            const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
            const isValidExt = allowedExtensions.includes(ext);
            const isValidMime = allowedTypes.includes(file.type);
            
            if (!isValidExt && !isValidMime) {
                invalidFiles.push(file.name);
            } else if (file.size > maxFileSize) {
                oversizedFiles.push(file.name);
            } else {
                validFiles.push(file);
            }
        }
        
        if (invalidFiles.length > 0) {
            toast.error(`Invalid format for: ${invalidFiles.join(", ")}. Only PDF and standard images (PNG, JPG, JPEG) are allowed.`);
            return false;
        }
        
        if (oversizedFiles.length > 0) {
            toast.error(`File size exceeds 10MB limit for: ${oversizedFiles.join(", ")}.`);
            return false;
        }

        if (validFiles.length === 0) return true;

        setIsUploading(true);
        try {
            const uploadedList = await Promise.all(
                validFiles.map(async (file) => {
                    const result = await MemoCreationService.uploadAttachment(file);
                    return result;
                })
            );
            
            const validUploads = uploadedList.filter((item): item is { file_url: string; file_name: string } => item !== null);
            setAttachments((prev) => [...prev, ...validUploads]);
            return true;
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const filesArray = Array.from(e.target.files);
        await processFiles(filesArray);
        e.target.value = ""; // Reset file input
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isReadOnly && !isUploading) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (isReadOnly || isUploading) return;

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const filesArray = Array.from(e.dataTransfer.files);
            await processFiles(filesArray);
        }
    };

    const handleRemoveAttachment = (indexToRemove: number) => {
        setAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const payload = {
            subject,
            body,
            from: from === "" ? undefined : Number(from),
            company_ids: selectedCompanyIds,
            start_date: startDate,
            end_date: endDate
        };

        const result = memoFormSchema.safeParse(payload);
        if (!result.success) {
            const fieldErrors: Partial<Record<keyof MemoFormValues, string>> = {};
            result.error.issues.forEach((issue) => {
                const path = issue.path[0] as keyof MemoFormValues;
                if (path) {
                    fieldErrors[path] = issue.message;
                }
            });
            setErrors(fieldErrors);
            
            const firstErr = result.error.issues[0]?.message;
            if (firstErr) toast.error(firstErr);
            return;
        }

        setErrors({});
        await onSubmit(result.data, attachments);
    };

    return (
        <>
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-0 shrink-0">
                    <DialogTitle>{isReadOnly ? "View Memo" : memo ? "Edit Memo" : "Create Memo"}</DialogTitle>
                </DialogHeader>

                <form onSubmit={isReadOnly ? (e) => e.preventDefault() : handleSubmit} className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
                        {memo && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Memo No.</label>
                                <Input disabled value={memo.memo_no} className="bg-muted" />
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium">From Company<span className="text-destructive"> *</span></label>
                            <select
                                value={from}
                                disabled={isReadOnly || !!memo}
                                onChange={(e) => {
                                    const val = e.target.value === "" ? "" : Number(e.target.value);
                                    setFrom(val);
                                    setErrors((prev) => ({ ...prev, from: undefined }));
                                }}
                                className={`flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-950 ${errors.from ? "border-destructive focus-visible:ring-destructive" : "border-input"}`}
                            >
                                <option value="">Select origin company</option>
                                {companies.map((c) => (
                                    <option key={c.company_id} value={c.company_id}>
                                        {c.company_name} ({c.company_code})
                                    </option>
                                ))}
                            </select>
                            {errors.from && <p className="text-xs font-medium text-destructive">{errors.from}</p>}
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium">Target Companies<span className="text-destructive"> *</span></label>
                                {!isReadOnly && (
                                    <Button
                                        type="button"
                                        variant="link"
                                        className="h-auto p-0 text-xs text-primary"
                                        onClick={handleSelectAllCompanies}
                                    >
                                        {selectedCompanyIds.length === companies.length ? "Deselect All" : "Select All"}
                                    </Button>
                                )}
                            </div>
                            <div className={`border rounded-md p-3 max-h-[150px] overflow-y-auto space-y-2 bg-background/50 ${errors.company_ids ? "border-destructive" : ""}`}>
                                {companies.map((c) => (
                                    <label key={c.company_id} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            disabled={isReadOnly}
                                            checked={selectedCompanyIds.includes(Number(c.company_id))}
                                            onChange={() => handleToggleCompany(Number(c.company_id))}
                                            className="rounded border-input text-primary focus:ring-primary h-4 w-4 disabled:opacity-50"
                                        />
                                        <span className={isReadOnly ? "opacity-75" : ""}>
                                            {c.company_name} ({c.company_code})
                                        </span>
                                    </label>
                                ))}
                            </div>
                            {errors.company_ids && <p className="text-xs font-medium text-destructive mt-1">{errors.company_ids}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Start Date<span className="text-destructive"> *</span></label>
                                 <Input
                                    type="date"
                                    value={startDate}
                                    disabled={isReadOnly}
                                    min={memo ? memo.start_date : getTodayDateString()}
                                    onChange={(e) => {
                                        setStartDate(e.target.value);
                                        setErrors((prev) => ({ ...prev, start_date: undefined, end_date: undefined }));
                                    }}
                                    className={errors.start_date ? "border-destructive focus-visible:ring-destructive" : ""}
                                />
                                {errors.start_date && <p className="text-xs font-medium text-destructive">{errors.start_date}</p>}
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">End Date<span className="text-destructive"> *</span></label>
                                <Input
                                    type="date"
                                    value={endDate}
                                    disabled={isReadOnly}
                                    min={startDate || getTodayDateString()}
                                    onChange={(e) => {
                                        setEndDate(e.target.value);
                                        setErrors((prev) => ({ ...prev, end_date: undefined }));
                                    }}
                                    className={errors.end_date ? "border-destructive focus-visible:ring-destructive" : ""}
                                />
                                {errors.end_date && <p className="text-xs font-medium text-destructive">{errors.end_date}</p>}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Subject<span className="text-destructive"> *</span></label>
                             <Input 
                                placeholder="Enter memo subject" 
                                value={subject}
                                disabled={isReadOnly}
                                onChange={(e) => {
                                    setSubject(e.target.value);
                                    setErrors((prev) => ({ ...prev, subject: undefined }));
                                }} 
                                className={errors.subject ? "border-destructive focus-visible:ring-destructive" : ""}
                            />
                            {errors.subject && <p className="text-xs font-medium text-destructive">{errors.subject}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Message Body</label>
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full flex items-center justify-between h-10 border-dashed hover:bg-accent/40 bg-background border-primary/30 text-primary"
                                onClick={() => setIsEditorModalOpen(true)}
                            >
                                <span className="flex items-center gap-2 font-medium">
                                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                    {body ? "Message body composed" : "Write message body..."}
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary px-2.5 py-1 rounded-full animate-pulse shrink-0">
                                    {isReadOnly ? "Click to View" : (body ? "Click to Edit" : "Click to Write")}
                                </span>
                            </Button>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium">Attachments</label>
                                <span className="text-[10px] text-muted-foreground font-black uppercase tracking-wider opacity-60">
                                    PDF, PNG, JPG, JPEG (Max 10MB)
                                </span>
                            </div>
                            <div className="flex flex-col gap-2">
                                 {/* Upload Area */}
                                {!isReadOnly && (
                                    <label
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-md p-4 cursor-pointer transition-colors ${
                                            isDragging 
                                                ? "border-primary bg-primary/5 text-primary animate-pulse" 
                                                : "border-input hover:bg-accent/30"
                                        }`}
                                    >
                                        <UploadCloud className={`h-8 w-8 mb-1 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                                        <span className="text-xs font-semibold text-muted-foreground">
                                            {isUploading 
                                                ? "Uploading files..." 
                                                : isDragging 
                                                    ? "Drop files here..." 
                                                    : "Click or drag files here to upload"}
                                        </span>
                                        <input
                                            type="file"
                                            multiple
                                            accept=".pdf,image/png,image/jpeg,image/jpg"
                                            className="hidden"
                                            onChange={handleFileChange}
                                            disabled={isUploading}
                                        />
                                    </label>
                                )}

                                {/* Attachments List */}
                                {attachments.length > 0 && (
                                    <div className="border rounded-md divide-y max-h-[150px] overflow-y-auto bg-muted/20">
                                        {attachments.map((file, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2 text-xs">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                    {isReadOnly ? (
                                                        <a
                                                            href={`${DIRECTUS_URL}/assets/${file.file_url}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="truncate font-medium text-primary hover:underline"
                                                            title={file.file_name}
                                                        >
                                                            {file.file_name}
                                                        </a>
                                                    ) : (
                                                        <span className="truncate font-medium">{file.file_name}</span>
                                                    )}
                                                </div>
                                                {!isReadOnly && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 w-6 p-0 hover:text-red-600"
                                                        onClick={() => handleRemoveAttachment(idx)}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {isReadOnly ? (
                        <div className="p-6 pt-4 border-t shrink-0 flex justify-end gap-2 bg-background">
                            <Button
                                type="button"
                                onClick={() => onOpenChange(false)}
                            >
                                Close
                            </Button>
                        </div>
                    ) : (
                        <div className="p-6 pt-4 border-t shrink-0 flex justify-end gap-2 bg-background">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={isSubmitting || isUploading}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting || isUploading}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isSubmitting ? "Saving..." : "Save Draft"}
                            </Button>
                        </div>
                    )}
                 </form>
            </DialogContent>
        </Dialog>

        {/* Editor Sub-Modal */}
        <Dialog open={isEditorModalOpen} onOpenChange={setIsEditorModalOpen}>
            <DialogContent className={`sm:max-w-[700px] flex flex-col p-6 ${isReadOnly ? "max-h-[85vh]" : "h-[80vh]"}`}>
                <DialogHeader className="shrink-0">
                    <DialogTitle>{isReadOnly ? "View Message Body" : "Edit Message Body"}</DialogTitle>
                </DialogHeader>
                <div className={`py-4 min-h-0 flex flex-col ${isReadOnly ? "overflow-y-auto max-h-[65vh]" : "flex-1 overflow-hidden"}`}>
                    {isReadOnly ? (
                        <div className="ql-snow border rounded-md p-5 bg-muted/20 max-w-none text-sm leading-relaxed [&_p]:min-h-[1em]">
                            <div 
                                className="ql-editor !p-0"
                                dangerouslySetInnerHTML={{ 
                                    __html: (body || "")
                                        .replace(/<p><\/p>/g, "<p><br></p>")
                                        .replace(/&nbsp;/g, " ")
                                        .replace(/\u00a0/g, " ")
                                        .trim() || "<p class='text-muted-foreground italic'>No content.</p>" 
                                }}
                            />
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col min-h-0">
                            <ReactQuill
                                theme="snow"
                                value={body}
                                onChange={setBody}
                                className="flex-1 flex flex-col min-h-0 bg-background rounded-md [&_.ql-container]:flex-1 [&_.ql-container]:min-h-0 [&_.ql-container]:overflow-y-auto"
                                modules={{
                                    toolbar: [
                                        [{ header: [1, 2, false] }],
                                        ["bold", "italic", "underline", "strike"],
                                        [{ list: "ordered" }, { list: "bullet" }],
                                        ["link", "clean"]
                                    ]
                                }}
                            />
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-2 pt-4 shrink-0 border-t">
                    <Button type="button" onClick={() => setIsEditorModalOpen(false)}>
                        {isReadOnly ? "Close" : "Done"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    </>
    );
}
