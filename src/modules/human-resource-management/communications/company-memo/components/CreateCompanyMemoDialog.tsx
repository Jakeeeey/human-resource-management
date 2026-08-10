"use client";

import React, { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { CompanyMemoFormSchema, COMPANY_MEMO_STATUS_LABELS, COMPANY_MEMO_PRIORITY_LABELS, COMPANY_MEMO_STATUSES, COMPANY_MEMO_PRIORITIES, CompanyMemoForm } from "../types/company-memo.schema";
import { toast } from "sonner";
import { useCompanyMemo } from "../hooks/useCompanyMemo";
import { Paperclip, X } from "lucide-react";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateCompanyMemoDialog({ open, onOpenChange }: Props) {
    const { submitMemo } = useCompanyMemo();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const form = useForm<CompanyMemoForm>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(CompanyMemoFormSchema) as any,
        defaultValues: {
            title: "",
            content: "",
            attachment: null,
            status: "DRAFT",
            priority: "NORMAL",
        },
    });

    const onSubmit = async (values: CompanyMemoForm) => {
        try {
            setIsSubmitting(true);

            let attachmentUuid = values.attachment;
            if (selectedFile) {
                const formData = new FormData();
                formData.append("file", selectedFile);
                const uploadRes = await fetch("/api/hrm/communications/company-memo/upload", {
                    method: "POST",
                    body: formData,
                });
                if (!uploadRes.ok) {
                    throw new Error("Failed to upload attachment");
                }
                const uploadData = await uploadRes.json();
                attachmentUuid = uploadData.id;
            }

            await submitMemo({ ...values, attachment: attachmentUuid });
            toast.success("Memo created successfully.");
            form.reset();
            setSelectedFile(null);
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to create memo", error);
            toast.error("Failed to create memo. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Create Company Memo</DialogTitle>
                    <DialogDescription>
                        Draft a new announcement to be broadcasted to the company.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Title</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Enter memo title" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="content"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Content</FormLabel>
                                    <FormControl>
                                        <Textarea 
                                            placeholder="Enter memo content..." 
                                            className="min-h-[150px]"
                                            {...field} 
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div>
                            <FormLabel className="mb-2 block">Attachment (Optional)</FormLabel>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={(e) => {
                                    if (e.target.files?.[0]) {
                                        setSelectedFile(e.target.files[0]);
                                    }
                                }}
                            />
                            {!selectedFile ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full h-12 border-dashed flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Paperclip className="h-4 w-4" />
                                    Select File to Upload
                                </Button>
                            ) : (
                                <div className="flex items-center justify-between p-3 border rounded-md bg-muted/30">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <Paperclip className="h-4 w-4 text-primary shrink-0" />
                                        <span className="text-sm font-medium truncate">
                                            {selectedFile.name}
                                        </span>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        onClick={() => {
                                            setSelectedFile(null);
                                            if (fileInputRef.current) fileInputRef.current.value = "";
                                        }}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                // @ts-expect-error - Type mismatch between zodResolver and react-hook-form
                                control={form.control}
                                name="priority"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Priority</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select priority" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {COMPANY_MEMO_PRIORITIES.map((p) => (
                                                    <SelectItem key={p} value={p}>
                                                        {COMPANY_MEMO_PRIORITY_LABELS[p]}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                // @ts-expect-error - Type mismatch between zodResolver and react-hook-form
                                control={form.control}
                                name="status"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Initial Status</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select status" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {COMPANY_MEMO_STATUSES.map((s) => (
                                                    <SelectItem key={s} value={s}>
                                                        {COMPANY_MEMO_STATUS_LABELS[s]}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => onOpenChange(false)}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Memo
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
