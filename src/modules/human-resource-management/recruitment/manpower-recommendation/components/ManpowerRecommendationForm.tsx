"use client";

import { useManpowerRecommendation } from "../hooks/useManpowerRecommendation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserCheck, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ManpowerRecommendationCreateInput } from "../types";

const ManpowerRecommendationFormSchema = z.object({
    manpower_request_id: z.number({ error: "Please select a manpower request" }),
    applicant_id: z.number({ error: "Please select an applicant" }),
    recommendation_notes: z.string().nullable().optional(),
});

type ManpowerRecommendationFormValues = z.infer<typeof ManpowerRecommendationFormSchema>;

export function ManpowerRecommendationForm() {
    const { isCreateOpen, setIsCreateOpen, submitRecommendation, openRequests, applicants, pendingRequestId, setPendingRequestId } = useManpowerRecommendation();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<ManpowerRecommendationFormValues>({
        resolver: zodResolver(ManpowerRecommendationFormSchema),
        defaultValues: {
            manpower_request_id: undefined as unknown as number,
            applicant_id: undefined as unknown as number,
            recommendation_notes: "",
        },
    });

    const prevOpen = useRef(isCreateOpen);
    useEffect(() => {
        if (isCreateOpen && !prevOpen.current) {
            form.reset({
                manpower_request_id: (pendingRequestId ?? undefined) as unknown as number,
                applicant_id: undefined as unknown as number,
                recommendation_notes: "",
            });
        }
        if (!isCreateOpen && prevOpen.current) {
            setPendingRequestId(null);
        }
        prevOpen.current = isCreateOpen;
        // Transition guard intentionally runs on open-state change only — reset once on open, clear once on close.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCreateOpen]);

    const onSubmit = async (values: ManpowerRecommendationFormValues) => {
        setIsSubmitting(true);
        try {
            // Wire payload is exactly the 3 API-owned keys — status /
            // recommended_by / recommended_at are injected server-side (Task 4).
            // The cast satisfies the provider's CreateInput param (whose status key
            // is required only as a Zod-output artifact); nothing extra is sent.
            const payload = {
                manpower_request_id: values.manpower_request_id,
                applicant_id: values.applicant_id,
                recommendation_notes: values.recommendation_notes || null,
            };
            const success = await submitRecommendation(payload as ManpowerRecommendationCreateInput);
            if (success) {
                setIsCreateOpen(false);
                form.reset();
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to submit recommendation.";
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogContent className="w-[95vw] sm:max-w-[500px] p-0 overflow-hidden border border-border/40 shadow-2xl bg-background rounded-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-border/40 bg-card">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-extrabold flex items-center gap-3">
                            <UserCheck className="w-6 h-6 text-primary" />
                            Recommend Applicant
                        </DialogTitle>
                        <DialogDescription className="text-sm mt-2">
                            Select an open manpower request and an applicant to recommend.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-6 flex-1 overflow-y-auto min-h-0">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="manpower_request_id"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-xs font-bold uppercase text-muted-foreground mb-2">Manpower Request <span className="text-destructive">*</span></FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        aria-expanded={false}
                                                        className={cn(
                                                            "w-full justify-between bg-muted/30 focus:bg-background transition-colors font-normal",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                    >
                                                        <span className="truncate">
                                                            {field.value
                                                                ? (() => {
                                                                    const selected = openRequests.filter((r) => r.status === 'Approved').find((r) => r.id === field.value);
                                                                    return selected ? `${selected.request_no} — ${selected.position}` : "Select manpower request";
                                                                })()
                                                                : "Select manpower request"}
                                                        </span>
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                                <Command>
                                                    <CommandInput placeholder="Search manpower request..." />
                                                    <CommandList className="max-h-64 overflow-y-auto overscroll-contain">
                                                        <CommandEmpty>No manpower request found.</CommandEmpty>
                                                        <CommandGroup>
                                                            {openRequests.filter((req) => req.status === 'Approved').map((req) => (
                                                                <CommandItem
                                                                    value={`${req.request_no} ${req.position}`}
                                                                    key={req.id}
                                                                    onSelect={() => {
                                                                        field.onChange(req.id);
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4",
                                                                            req.id === field.value
                                                                                ? "opacity-100"
                                                                                : "opacity-0"
                                                                        )}
                                                                    />
                                                                    <span className="truncate" title={`${req.request_no} — ${req.position}`}>
                                                                        {req.request_no} — {req.position}
                                                                    </span>
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="applicant_id"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-xs font-bold uppercase text-muted-foreground mb-2">Applicant <span className="text-destructive">*</span></FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        aria-expanded={false}
                                                        className={cn(
                                                            "w-full justify-between bg-muted/30 focus:bg-background transition-colors font-normal",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                    >
                                                        <span className="truncate">
                                                            {field.value
                                                                ? applicants.find((a) => a.id === field.value)?.full_name || "Select applicant"
                                                                : "Select applicant"}
                                                        </span>
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                                <Command>
                                                    <CommandInput placeholder="Search applicant..." />
                                                    <CommandList className="max-h-64 overflow-y-auto overscroll-contain">
                                                        <CommandEmpty>No applicant found.</CommandEmpty>
                                                        <CommandGroup>
                                                            {applicants.map((applicant) => (
                                                                <CommandItem
                                                                    value={applicant.full_name}
                                                                    key={applicant.id}
                                                                    onSelect={() => {
                                                                        field.onChange(applicant.id);
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4",
                                                                            applicant.id === field.value
                                                                                ? "opacity-100"
                                                                                : "opacity-0"
                                                                        )}
                                                                    />
                                                                    <span className="truncate" title={applicant.full_name}>
                                                                        {applicant.full_name}
                                                                    </span>
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="recommendation_notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Recommendation Notes</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Why is this applicant a strong fit? (optional)"
                                                className="min-h-[100px] resize-none bg-muted/30 focus:bg-background transition-colors"
                                                rows={4}
                                                {...field}
                                                value={field.value || ""}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </form>
                    </Form>
                </div>

                <div className="p-4 md:p-6 bg-muted/20 border-t border-border/40">
                    <DialogFooter className="flex w-full sm:justify-end gap-3">
                        <DialogClose asChild>
                            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-full px-6">
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={isSubmitting} onClick={form.handleSubmit(onSubmit)} className="rounded-full px-8 shadow-sm hover:shadow-md transition-all">
                            {isSubmitting ? (
                                <>
                                    <div className="w-4 h-4 mr-2 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                                    Submitting...
                                </>
                            ) : (
                                "Submit Recommendation"
                            )}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
