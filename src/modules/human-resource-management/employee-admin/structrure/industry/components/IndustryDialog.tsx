"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { 
    Code2, 
    Layers, 
    User, 
    FileText, 
    Save, 
    X, 
    Loader2 
} from "lucide-react";
import type { Industry, IndustryFormData } from "../types";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface IndustryFormValues {
    industry_code: string;
    industry_name: string;
    industry_head: string;
    industry_description: string;
    tax_id: string | number;
}

interface IndustryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    industry?: Industry | null;
    onSubmit: (data: IndustryFormData) => Promise<void>;
    existingIndustries?: Industry[];
    readOnly?: boolean;
}

export function IndustryDialog({
    open,
    onOpenChange,
    industry,
    onSubmit,
    existingIndustries = [],
    readOnly = false,
}: IndustryDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isEdit = !!industry;

    // Dynamic validation schema
    const industrySchema = z.object({
        industry_code: z.string()
            .min(1, "Industry code is required")
            .max(10, "Limit to 10 characters")
            .refine(val => {
                return !existingIndustries.some(i => 
                    i.industry_code?.toLowerCase() === val.toLowerCase() && 
                    i.id !== industry?.id
                );
            }, "This industry code is already in use"),
        industry_name: z.string()
            .min(1, "Industry name is required")
            .max(255, "Limit to 255 characters"),
        industry_head: z.string().min(1, "Industry head is required").max(255),
        industry_description: z.string().min(1, "Description is required"),
        tax_id: z.preprocess((val) => {
            if (val === "" || val === undefined || val === null) return undefined;
            const num = Number(val);
            return isNaN(num) ? undefined : num;
        }, z.number().int().nonnegative("Tax ID cannot be negative").min(1, "Tax ID is required")),
    });

    const form = useForm<IndustryFormValues>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(industrySchema) as any,
        defaultValues: {
            industry_code: "",
            industry_name: "",
            industry_head: "",
            industry_description: "",
            tax_id: "",
        },
    });

    // Reset form when industry changes or dialog opens
    useEffect(() => {
        if (open) {
            if (industry) {
                form.reset({
                    industry_code: industry.industry_code || "",
                    industry_name: industry.industry_name || "",
                    industry_head: industry.industry_head || "",
                    industry_description: industry.industry_description || "",
                    tax_id: Number(industry.tax_id) || "",
                });
            } else {
                form.reset({
                    industry_code: "",
                    industry_name: "",
                    industry_head: "",
                    industry_description: "",
                    tax_id: "",
                });
            }
        }
    }, [industry, open, form]);

    const handleFormSubmit = async (values: IndustryFormValues) => {
        try {
            setIsSubmitting(true);
            await onSubmit(values);
            onOpenChange(false);
            form.reset();
        } catch (error: unknown) {
            console.error("Industry submission failed:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px] overflow-hidden p-0 rounded-2xl border-2 shadow-2xl animate-in fade-in zoom-in-95">
                <div className="bg-gradient-to-r from-primary/10 via-background to-primary/5 p-6 pb-4">
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="p-2.5 bg-primary/10 rounded-xl">
                                <Layers className="h-6 w-6 text-primary stroke-[2.5px]" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-bold tracking-tight">
                                    {readOnly ? "Industry Information" : isEdit ? "Edit Industry Details" : "Industry Registration"}
                                </DialogTitle>
                                <DialogDescription className="text-sm font-medium opacity-70">
                                    {readOnly 
                                        ? "Full overview of the selected industry configuration."
                                        : isEdit 
                                            ? "Modify the existing industry configuration and attributes." 
                                            : "Define the parameters for a new industry registration entry."}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <Separator className="bg-primary/10" />

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleFormSubmit)} className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="industry_code"
                                render={({ field }) => (
                                    <FormItem className="space-y-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Code2 className="h-4 w-4 text-primary" />
                                            <FormLabel className="font-bold text-sm">Industry Code <span className="text-destructive">*</span></FormLabel>
                                        </div>
                                        <FormControl>
                                            <Input 
                                                placeholder="e.g. IND-001" 
                                                className={cn(
                                                    "h-11 rounded-xl border-2 bg-background/50 focus:bg-background transition-all",
                                                    readOnly && "opacity-100 disabled:opacity-100 disabled:cursor-default bg-muted/30 font-medium pointer-events-none"
                                                )}
                                                {...field} 
                                                disabled={readOnly}
                                            />
                                        </FormControl>
                                        <FormMessage className="text-xs font-bold" />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="industry_name"
                                render={({ field }) => (
                                    <FormItem className="space-y-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            <FileText className="h-4 w-4 text-primary" />
                                            <FormLabel className="font-bold text-sm">Industry Name <span className="text-destructive">*</span></FormLabel>
                                        </div>
                                        <FormControl>
                                            <Input 
                                                placeholder="e.g. Technology" 
                                                className={cn(
                                                    "h-11 rounded-xl border-2 bg-background/50 focus:bg-background transition-all",
                                                    readOnly && "opacity-100 disabled:opacity-100 disabled:cursor-default bg-muted/30 font-medium pointer-events-none"
                                                )}
                                                {...field} 
                                                disabled={readOnly}
                                            />
                                        </FormControl>
                                        <FormMessage className="text-xs font-bold" />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="industry_head"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <User className="h-4 w-4 text-primary" />
                                        <FormLabel className="font-bold text-sm">Industry Head <span className="text-destructive">*</span></FormLabel>
                                    </div>
                                    <FormControl>
                                        <Input 
                                            placeholder="Enter full name of department head" 
                                            className={cn(
                                                "h-11 rounded-xl border-2 bg-background/50 focus:bg-background transition-all",
                                                readOnly && "opacity-100 disabled:opacity-100 disabled:cursor-default bg-muted/30 font-medium pointer-events-none"
                                            )}
                                            {...field} 
                                            disabled={readOnly}
                                        />
                                    </FormControl>
                                    <FormMessage className="text-xs font-bold" />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="tax_id"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Code2 className="h-4 w-4 text-primary" />
                                        <FormLabel className="font-bold text-sm">Tax ID <span className="text-destructive">*</span></FormLabel>
                                    </div>
                                    <FormControl>
                                        <Input 
                                            type="number"
                                            min="0"
                                            placeholder="Enter tax identification number" 
                                            className={cn(
                                                "h-11 rounded-xl border-2 bg-background/50 focus:bg-background transition-all",
                                                readOnly && "opacity-100 disabled:opacity-100 disabled:cursor-default bg-muted/30 font-medium pointer-events-none"
                                            )}
                                            {...field} 
                                            disabled={readOnly}
                                        />
                                    </FormControl>
                                    <FormMessage className="text-xs font-bold" />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="industry_description"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <FileText className="h-4 w-4 text-primary" />
                                        <FormLabel className="font-bold text-sm">Description <span className="text-destructive">*</span></FormLabel>
                                    </div>
                                    <FormControl>
                                        <Textarea 
                                            placeholder="Provide a comprehensive description of the industry's focus..." 
                                            className={cn(
                                                "min-h-[100px] rounded-xl border-2 bg-background/50 focus:bg-background transition-all resize-none",
                                                readOnly && "opacity-100 disabled:opacity-100 disabled:cursor-default bg-muted/30 font-medium pointer-events-none"
                                            )}
                                            {...field} 
                                            disabled={readOnly}
                                        />
                                    </FormControl>
                                    <FormMessage className="text-xs font-bold" />
                                </FormItem>
                            )}
                        />

                        <DialogFooter className="pt-2 gap-3 pb-2">
                            {readOnly ? (
                                <Button
                                    type="button"
                                    onClick={() => onOpenChange(false)}
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground h-11 px-8 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all font-bold"
                                >
                                    Close
                                </Button>
                            ) : (
                                <>
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
                                        className="bg-primary hover:bg-primary/90 text-primary-foreground h-11 px-8 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all hover:translate-y-[-2px] active:translate-y-0"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="mr-2 h-4 w-4" />
                                                {isEdit ? "Update Industry" : "Confirm Registration"}
                                            </>
                                        )}
                                    </Button>
                                </>
                            )}
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
