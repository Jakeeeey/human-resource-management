"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Briefcase, FileText, Loader2, Save, X } from "lucide-react";
import type { EmploymentStatus, EmploymentStatusFormData } from "../types";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface FormData {
    name: string;
    description: string;
}

interface EmploymentStatusRegistrationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    record?: EmploymentStatus | null;
    onSubmit: (data: EmploymentStatusFormData) => Promise<void>;
}

export function EmploymentStatusRegistrationDialog({
    open,
    onOpenChange,
    record,
    onSubmit,
}: EmploymentStatusRegistrationDialogProps) {
    const isEdit = !!record;
    const [isSubmitting, setIsSubmitting] = useState(false);
    const form = useForm<FormData>({
        defaultValues: { name: "", description: "" },
    });

    useEffect(() => {
        if (open && record) {
            form.reset({
                name: record.name,
                description: record.description || "",
            });
        } else if (!open) {
            form.reset({ name: "", description: "" });
        }
    }, [open, record, form]);

    const handleSubmit = async (data: FormData) => {
        setIsSubmitting(true);
        try {
            await onSubmit(data);
            onOpenChange(false);
            form.reset();
        } catch (error) {
            console.error("Error submitting employment status:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-155 overflow-hidden p-0 rounded-2xl border-2 shadow-2xl animate-in fade-in zoom-in-95">
                <div className="bg-linear-to-r from-primary/10 via-background to-primary/5 p-6 pb-4">
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="p-2.5 bg-primary/10 rounded-xl">
                                <Briefcase className="h-6 w-6 text-primary stroke-[2.5px]" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-bold tracking-tight">
                                    {isEdit
                                        ? "Edit Employment Status"
                                        : "Add Employment Status"}
                                </DialogTitle>
                                <DialogDescription className="text-sm font-medium opacity-70">
                                    {isEdit
                                        ? "Update the employment status information below."
                                        : "Fill in the information to create a new employment status."}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <Separator className="bg-primary/10" />

                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(handleSubmit)}
                        className="p-6 space-y-6"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="name"
                                rules={{ required: "Name is required" }}
                                render={({ field }) => (
                                    <FormItem className="space-y-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Briefcase className="h-4 w-4 text-primary" />
                                            <FormLabel className="font-bold text-sm">
                                                Name <span className="text-destructive">*</span>
                                            </FormLabel>
                                        </div>
                                        <FormControl>
                                            <Input
                                                placeholder="e.g. Regular"
                                                className="h-11 rounded-xl border-2 bg-background/50 focus:bg-background transition-all"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage className="text-xs font-bold" />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem className="space-y-2 md:col-span-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            <FileText className="h-4 w-4 text-primary" />
                                            <FormLabel className="font-bold text-sm">Description</FormLabel>
                                        </div>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Enter description"
                                                className="min-h-28 rounded-xl border-2 bg-background/50 focus:bg-background transition-all"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage className="text-xs font-bold" />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <DialogFooter className="pt-2 gap-3 pb-2">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => onOpenChange(false)}
                                disabled={isSubmitting}
                                className="font-bold text-muted-foreground hover:bg-muted rounded-xl px-6 h-11"
                            >
                                <X className="mr-2 h-4 w-4" />
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground h-11 px-8 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        {isEdit ? "Update" : "Create"} Status
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
