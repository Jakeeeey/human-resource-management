"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Loader2, Paperclip, Send, X } from "lucide-react";
import { ATTACHMENT_ALLOWED_MIME, ATTACHMENT_MAX_BYTES, REASON_MAX_LENGTH, ResignationFormSchema } from "../types";
import { phToday } from "../utils/time";
import { useResignationFilingContext } from "../providers/ResignationFilingProvider";

const ALLOWED_MIME_LIST = ATTACHMENT_ALLOWED_MIME as readonly string[];
const MAX_MB = ATTACHMENT_MAX_BYTES / (1024 * 1024);

interface PendingAttachment {
    uuid: string;
    name: string;
    fileType: string;
}

export function ResignationFilingForm() {
    const { submitFiling, uploadAttachment } = useResignationFilingContext();
    const [resignationDate, setResignationDate] = useState("");
    const [reason, setReason] = useState("");
    const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const clearForm = () => {
        setResignationDate("");
        setReason("");
        setAttachment(null);
        setFieldErrors({});
        setUploadError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const picked = event.target.files?.[0] ?? null;
        if (!picked) {
            return;
        }
        setUploadError(null);
        if (picked.size > ATTACHMENT_MAX_BYTES) {
            setUploadError(`File is too large. Maximum size is ${MAX_MB} MB.`);
            event.target.value = "";
            return;
        }
        if (!ALLOWED_MIME_LIST.includes(picked.type)) {
            setUploadError("Invalid file type. Only images (JPEG, PNG, WebP, GIF) or PDF files are allowed.");
            event.target.value = "";
            return;
        }
        setIsUploading(true);
        const uploaded = await uploadAttachment(picked);
        setIsUploading(false);
        if (!uploaded) {
            event.target.value = "";
            return;
        }
        setAttachment({ uuid: uploaded.id, name: uploaded.name, fileType: uploaded.fileType });
    };

    const removeAttachment = () => {
        setAttachment(null);
        setUploadError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const parsed = ResignationFormSchema.safeParse({
            resignation_date: resignationDate,
            reason,
            attachment_uuid: attachment?.uuid ?? null,
            attachment_name: attachment?.name ?? null,
            attachment_type: attachment?.fileType ?? null,
        });
        if (!parsed.success) {
            const nextErrors: Record<string, string> = {};
            for (const issue of parsed.error.issues) {
                const key = issue.path.length > 0 ? String(issue.path[0]) : "reason";
                if (!nextErrors[key]) {
                    nextErrors[key] = issue.message;
                }
            }
            setFieldErrors(nextErrors);
            return;
        }
        setFieldErrors({});
        setIsSubmitting(true);
        const result = await submitFiling(parsed.data);
        setIsSubmitting(false);
        if (result.ok) {
            clearForm();
        } else {
            setFieldErrors(result.fieldErrors);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    File a Resignation
                </CardTitle>
                <CardDescription>Choose your resignation date, state your reason, and optionally attach a supporting document.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="max-w-[16rem] space-y-2">
                            <Label htmlFor="resignation-date">
                                Resignation date <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="resignation-date"
                                type="date"
                                min={phToday()}
                                value={resignationDate}
                                onChange={(event) => setResignationDate(event.target.value)}
                                disabled={isSubmitting}
                            />
                            {fieldErrors.resignation_date && (
                                <p className="text-xs font-semibold text-destructive">{fieldErrors.resignation_date}</p>
                            )}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="resignation-reason">
                                Reason <span className="text-destructive">*</span>
                            </Label>
                            <span className="text-xs text-muted-foreground">
                                {reason.length}/{REASON_MAX_LENGTH}
                            </span>
                        </div>
                        <Textarea
                            id="resignation-reason"
                            placeholder="State the reason for your resignation..."
                            maxLength={REASON_MAX_LENGTH}
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            disabled={isSubmitting}
                            className="min-h-[140px] resize-none"
                        />
                        {fieldErrors.reason && (
                            <p className="text-xs font-semibold text-destructive">{fieldErrors.reason}</p>
                        )}
                    </div>
                    <div className="space-y-2 border-t pt-5">
                        <Label>Attachment (optional)</Label>
                        <p className="text-xs text-muted-foreground">Support your filing with a document.</p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                            className="hidden"
                            onChange={handleFileChange}
                            disabled={isSubmitting || isUploading}
                        />
                        {attachment ? (
                            <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                                    <Paperclip className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold">{attachment.name}</p>
                                    <p className="truncate text-xs text-muted-foreground">{attachment.fileType || "Unknown type"}</p>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={removeAttachment}
                                    disabled={isSubmitting || isUploading}
                                    className="shrink-0"
                                >
                                    <X className="h-4 w-4" />
                                    Remove
                                </Button>
                            </div>
                        ) : (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isSubmitting || isUploading}
                                className="gap-2"
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <Paperclip className="h-4 w-4" />
                                        Choose file
                                    </>
                                )}
                            </Button>
                        )}
                        {uploadError && <p className="text-xs font-semibold text-destructive">{uploadError}</p>}
                        <p className="text-xs text-muted-foreground">Images or PDF only, up to {MAX_MB} MB.</p>
                    </div>
                    <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground">Your filing goes to HR for review after submission.</p>
                        <Button type="submit" disabled={isSubmitting || isUploading} className="gap-2 sm:shrink-0">
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    <Send className="h-4 w-4" />
                                    Submit Resignation
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
