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
    Type, 
    FileText, 
    Save, 
    X, 
    Loader2 
} from "lucide-react";
import type { Operation, OperationFormData } from "../types";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface OperationFormValues {
    operation_code: string;
    operation_name: string;
    type: string | number;
    definition: string;
}

interface OperationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    operation?: Operation | null;
    onSubmit: (data: OperationFormData) => Promise<void>;
    existingOperations?: Operation[];
    readOnly?: boolean;
}

export function OperationDialog({
    open,
    onOpenChange,
    operation,
    onSubmit,
    existingOperations = [],
    readOnly = false,
}: OperationDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isEdit = !!operation;

    // Dynamic validation schema
    const operationSchema = z.object({
        operation_code: z.string()
            .min(1, "Operation code is required")
            .max(50, "Limit to 50 characters")
            .refine(val => {
                return !existingOperations.some(o => 
                    o.operation_code?.toLowerCase() === val.toLowerCase() && 
                    o.id !== operation?.id
                );
            }, "This operation code is already in use"),
        operation_name: z.string()
            .min(1, "Operation name is required")
            .max(255, "Limit to 255 characters")
            .refine(val => {
                return !existingOperations.some(o => 
                    o.operation_name?.toLowerCase() === val.toLowerCase() && 
                    o.id !== operation?.id
                );
            }, "This operation name is already in use"),
        type: z.preprocess((val) => {
            if (val === "" || val === undefined || val === null) return undefined;
            const num = Number(val);
            return isNaN(num) ? undefined : num;
        }, z.number().int().min(1, "Operation type is required")),
        definition: z.string().min(1, "Detailed definition is required"),
    });

    const form = useForm<OperationFormValues>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(operationSchema) as any,
        defaultValues: {
            operation_code: "",
            operation_name: "",
            type: "",
            definition: "",
        },
    });

    // Reset form when operation changes or dialog opens
    useEffect(() => {
        if (open) {
            if (operation) {
                form.reset({
                    operation_code: operation.operation_code || "",
                    operation_name: operation.operation_name || "",
                    type: Number(operation.type) || "",
                    definition: operation.definition || "",
                });
            } else {
                form.reset({
                    operation_code: "",
                    operation_name: "",
                    type: "",
                    definition: "",
                });
            }
        }
    }, [operation, open, form]);

    const handleFormSubmit = async (values: OperationFormValues) => {
        try {
            setIsSubmitting(true);
            const formattedData: OperationFormData = {
                ...values,
                definition: values.definition || "",
            };
            await onSubmit(formattedData);
            onOpenChange(false);
            form.reset();
        } catch (error: unknown) {
            console.error("Operation submission failed:", error);
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
                                    {readOnly ? "Operation Information" : isEdit ? "Edit Operation Details" : "Create New Operation"}
                                </DialogTitle>
                                <DialogDescription className="text-sm font-medium opacity-70">
                                    {readOnly 
                                        ? "Full overview of the selected operation configuration."
                                        : isEdit 
                                            ? "Modify the existing operation configuration and attributes." 
                                            : "Define the parameters for a new system operation entry."}
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
                                name="operation_code"
                                render={({ field }) => (
                                    <FormItem className="space-y-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Code2 className="h-4 w-4 text-primary" />
                                            <FormLabel className="font-bold text-sm">Operation Code <span className="text-destructive">*</span></FormLabel>
                                        </div>
                                        <FormControl>
                                            <Input 
                                                placeholder="e.g. OP-2024-001" 
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
                                name="type"
                                render={({ field }) => (
                                    <FormItem className="space-y-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Type className="h-4 w-4 text-primary" />
                                            <FormLabel className="font-bold text-sm">Operation Type <span className="text-destructive">*</span></FormLabel>
                                        </div>
                                        <FormControl>
                                            <Input 
                                                type="number"
                                                min="1"
                                                placeholder="Enter operation type"
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
                            name="operation_name"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <FileText className="h-4 w-4 text-primary" />
                                        <FormLabel className="font-bold text-sm">Operation Name <span className="text-destructive">*</span></FormLabel>
                                    </div>
                                    <FormControl>
                                        <Input 
                                            placeholder="Enter descriptive operation name" 
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
                            name="definition"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <FileText className="h-4 w-4 text-primary" />
                                        <FormLabel className="font-bold text-sm">Detailed Definition <span className="text-destructive">*</span></FormLabel>
                                    </div>
                                    <FormControl>
                                        <Textarea 
                                            placeholder="Provide a comprehensive description of the operation workflow..." 
                                            className={cn(
                                                "min-h-[120px] rounded-xl border-2 bg-background/50 focus:bg-background transition-all resize-none",
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
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground h-11 px-8 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all"
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
                                                {isEdit ? "Update Operation" : "Confirm Entry"}
                                            </>
                                        ) }
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
