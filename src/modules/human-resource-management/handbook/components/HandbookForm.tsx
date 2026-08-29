"use client";

import { useState, useRef, useEffect } from "react";
import { useHandbook } from "../hooks/useHandbook";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { HandbookAttachment } from "../types";
import { Trash2, Upload, FileText, BookOpen, X, Loader2, Save } from "lucide-react";

export function HandbookForm() {
    const { isCreateOpen, setIsCreateOpen, isEditOpen, setIsEditOpen, submitHandbook, updateHandbook, selectedHandbook } = useHandbook();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [attachments, setAttachments] = useState<HandbookAttachment[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isOpen = isCreateOpen || isEditOpen;
    const isEditMode = isEditOpen && selectedHandbook != null;

    useEffect(() => {
        if (isEditMode && selectedHandbook) {
            setTitle(selectedHandbook.title);
            setDescription(selectedHandbook.description || "");
            setAttachments(selectedHandbook.attachments || []);
        } else if (isCreateOpen) {
            setTitle("");
            setDescription("");
            setAttachments([]);
        }
    }, [isEditMode, isCreateOpen, selectedHandbook]);

    const handleClose = () => {
        setIsCreateOpen(false);
        setIsEditOpen(false);
        setTitle("");
        setDescription("");
        setAttachments([]);
    };

    const processFiles = async (files: FileList | File[]) => {
        if (!files || files.length === 0) return;
        
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
        const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg"];
        const validFiles: File[] = [];

        for (const file of Array.from(files)) {
            if (file.size > MAX_FILE_SIZE) {
                toast.error(`File "${file.name}" exceeds the 10 MB limit.`);
                continue;
            }
            if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(pdf|png|jpe?g)$/i)) {
                toast.error(`File "${file.name}" is not an accepted format (only PDF, PNG, JPEG).`);
                continue;
            }
            validFiles.push(file);
        }

        if (validFiles.length === 0) return;

        setIsUploading(true);
        try {
            const uploadPromises = validFiles.map(async (file) => {
                const formData = new FormData();
                formData.append("file", file);

                const response = await fetch("/api/hrm/handbook/upload", {
                    method: "POST",
                    body: formData,
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || "Upload failed");
                }

                const result = await response.json();
                const data = result.data;
                
                return {
                    file_url: data.id,
                    file_name: data.filename_download || file.name,
                } as HandbookAttachment;
            });

            const uploadedAttachments = await Promise.all(uploadPromises);
            setAttachments((prev) => [...prev, ...uploadedAttachments]);
            toast.success("File(s) uploaded successfully");
        } catch (error: unknown) {
            toast.error((error as Error).message || "Failed to upload file");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            processFiles(e.target.files);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFiles(e.dataTransfer.files);
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(attachments.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            toast.error("Title is required");
            return;
        }

        setIsSubmitting(true);
        try {
            let success = false;
            if (isEditMode && selectedHandbook) {
                success = await updateHandbook(selectedHandbook.id!, {
                    title,
                    description,
                    attachments,
                });
            } else {
                success = await submitHandbook({
                    title,
                    description,
                    attachments,
                });
            }

            if (success) {
                handleClose();
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden bg-background border-none shadow-2xl rounded-2xl [&>button]:hidden">
                {/* Header Banner */}
                <DialogHeader className="px-8 py-6 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b flex flex-row items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/20 rounded-xl shadow-sm border border-primary/10">
                            <BookOpen className="w-6 h-6 text-primary" />
                        </div>
                        <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                            {isEditMode ? "Edit Company Handbook" : "Create Company Handbook"}
                        </DialogTitle>
                    </div>
                    <Button variant="ghost" size="icon" className="rounded-full shrink-0 hover:bg-muted/50" onClick={handleClose}>
                        <X className="h-5 w-5 text-muted-foreground" />
                    </Button>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col max-h-[80vh]">
                    <div className="px-8 py-6 space-y-6 overflow-y-auto custom-scrollbar">
                    <div className="space-y-2">
                        <Label htmlFor="title" className="text-sm font-semibold text-foreground flex items-center gap-1">
                            Handbook Title <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Employee Code of Conduct"
                            className="h-11 bg-background border-muted-foreground/20 focus-visible:ring-primary/30 rounded-xl shadow-sm hover:border-primary/50 transition-colors"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description" className="text-sm font-semibold text-foreground">Description</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief description of this handbook..."
                            className="min-h-[100px] resize-none bg-background border-muted-foreground/20 focus-visible:ring-primary/30 rounded-xl shadow-sm hover:border-primary/50 transition-colors custom-scrollbar"
                            rows={4}
                        />
                    </div>

                    <div className="space-y-3">
                        <Label className="text-sm font-semibold text-foreground flex items-center justify-between">
                            <span>Attachments</span>
                            {attachments.length > 0 && <span className="text-muted-foreground font-normal text-xs">{attachments.length} file(s)</span>}
                        </Label>
                        
                        <div 
                            className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all duration-300 group ${
                                isDragging 
                                    ? "border-primary bg-primary/5 scale-[1.01]" 
                                    : "border-muted-foreground/25 bg-muted/10 hover:bg-muted/20 hover:border-primary/40"
                            }`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                multiple
                                onChange={handleFileUpload}
                                accept=".pdf,.png,.jpeg,.jpg"
                            />
                            
                            <div className={`p-4 rounded-full mb-4 transition-colors duration-300 ${isDragging ? 'bg-primary/20' : 'bg-primary/10 group-hover:bg-primary/15'}`}>
                                <Upload className={`w-8 h-8 transition-colors duration-300 ${isDragging ? 'text-primary' : 'text-primary/80 group-hover:text-primary'}`} />
                            </div>
                            
                            <h3 className="font-semibold text-lg mb-1.5 text-foreground">
                                {isDragging ? "Drop files now" : "Drag & drop files here"}
                            </h3>
                            <p className="text-sm text-muted-foreground mb-5 text-center max-w-[280px]">
                                PDF, PNG, JPEG up to 10MB
                            </p>
                            <Button
                                type="button"
                                variant="outline"
                                className="rounded-full px-6 shadow-sm hover:shadow-md transition-all group-hover:bg-primary/5"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Uploading...
                                    </>
                                ) : "Browse Files"}
                            </Button>
                        </div>

                        {attachments.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                                {attachments.map((att, idx) => (
                                    <div 
                                        key={idx} 
                                        className="group flex items-center justify-between p-3 border border-border/50 rounded-xl bg-card hover:bg-accent/10 hover:border-primary/30 transition-all duration-300 shadow-sm"
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="p-2 bg-blue-500/10 rounded-lg shrink-0">
                                                <FileText className="h-5 w-5 text-blue-600" />
                                            </div>
                                            <span className="text-sm truncate font-medium group-hover:text-primary transition-colors" title={att.file_name}>
                                                {att.file_name}
                                            </span>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-full text-muted-foreground hover:bg-red-50 hover:text-red-600 shrink-0 transition-colors"
                                            onClick={() => removeAttachment(idx)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="px-8 py-5 border-t bg-muted/20 shrink-0">
                    <div className="flex justify-end gap-3 w-full">
                        <Button type="button" variant="outline" className="rounded-full px-6" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting || isUploading} className="rounded-full px-8 shadow-md">
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 mr-2" />
                                    {isEditMode ? "Update" : "Create"}
                                </>
                            )}
                        </Button>
                    </div>
                </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
