"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { MessageSquareWarning, Save, X, Loader2, EyeOff } from "lucide-react";
import {
    EmployeeConcernFormSchema,
    type EmployeeConcernForm,
} from "../types/employee-concern.schema";

interface EmployeeConcernDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (form: EmployeeConcernForm) => Promise<boolean>;
}

export function EmployeeConcernDialog({ open, onOpenChange, onSubmit }: EmployeeConcernDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<EmployeeConcernForm>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(EmployeeConcernFormSchema) as any,
        defaultValues: {
            subject_of_concern: "",
            concern: "",
            is_anonymous: false,
        },
    });

    // Reset form whenever the dialog is reopened.
    React.useEffect(() => {
        if (open) {
            form.reset({ subject_of_concern: "", concern: "", is_anonymous: false });
        }
    }, [open, form]);

    const handleFormSubmit = async (values: EmployeeConcernForm) => {
        try {
            setIsSubmitting(true);
            const ok = await onSubmit(values);
            if (ok) {
                form.reset();
            }
        } catch (error: unknown) {
            console.error("Concern submission failed:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px] overflow-hidden p-0 rounded-2xl border-2 shadow-2xl animate-in fade-in zoom-in-95">
                <div className="bg-gradient-to-r from-primary/10 via-background to-primary/5 p-6 pb-4">
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="p-2.5 bg-primary/10 rounded-xl">
                                <MessageSquareWarning className="h-6 w-6 text-primary stroke-[2.5px]" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-bold tracking-tight">
                                    Submit a Concern
                                </DialogTitle>
                                <DialogDescription className="text-sm font-medium opacity-70">
                                    Raise a workplace issue confidentially. HR reviews every submission.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <Separator className="bg-primary/10" />

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleFormSubmit)} className="p-6 space-y-6">
                        <FormField
                            control={form.control}
                            name="subject_of_concern"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <FormLabel className="font-bold text-sm">
                                            Subject <span className="text-destructive">*</span>
                                        </FormLabel>
                                    </div>
                                    <FormControl>
                                        <Input
                                            placeholder="Briefly summarize the issue"
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
                            name="concern"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <FormLabel className="font-bold text-sm">
                                            Concern <span className="text-destructive">*</span>
                                        </FormLabel>
                                    </div>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Describe the concern in detail — include relevant dates, people, and context..."
                                            className="min-h-[140px] rounded-xl border-2 bg-background/50 focus:bg-background transition-all resize-none"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage className="text-xs font-bold" />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="is_anonymous"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-xl border-2 p-4 bg-muted/20">
                                    <div className="space-y-0.5 flex items-start gap-3">
                                        <EyeOff className="h-5 w-5 text-muted-foreground mt-0.5" />
                                        <div>
                                            <FormLabel className="font-bold text-sm cursor-pointer">
                                                Submit anonymously
                                            </FormLabel>
                                            <FormDescription className="text-xs">
                                                Your name is hidden from the public list. HR can still
                                                trace the record for investigation.
                                            </FormDescription>
                                        </div>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

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
                                className="bg-primary hover:bg-primary/90 text-primary-foreground h-11 px-8 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all hover:translate-y-[-2px] active:translate-y-0"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Submit Concern
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
