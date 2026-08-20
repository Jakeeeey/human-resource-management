"use client";

import { useManpowerRequest } from "../hooks/useManpowerRequest";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ManpowerRequestSchema } from "../types";
import { z } from "zod";
import { Building2, Briefcase, FileText, Users, User, CheckCircle2, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function ManpowerRequestForm() {
    const { isCreateOpen, setIsCreateOpen, submitRequest, departments, divisions } = useManpowerRequest();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof ManpowerRequestSchema>>({
        resolver: zodResolver(ManpowerRequestSchema),
        defaultValues: {
            request_no: "",
            requesting_department_id: undefined as unknown as number,
            position: "",
            division_id: undefined as unknown as number | undefined,
            no_manpower_needed: 1,
            purpose: "New Position",
            replacement_name: "",
            employment_type: "Regular",
            employment_others: "",
            reason_justification: "",
            qualification: "Any",
            qualification_description: "",
            applicant_name: "",
            rate: 0,
        },
    });

    const purposeValue = form.watch("purpose");
    const employmentTypeValue = form.watch("employment_type");

    const onSubmit = async (values: z.infer<typeof ManpowerRequestSchema>) => {
        setIsSubmitting(true);
        try {
            const success = await submitRequest(values);
            if (success) {
                setIsCreateOpen(false);
                form.reset();
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to submit form.";
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogContent className="sm:max-w-[85vw] lg:max-w-[1000px] w-full p-0 overflow-hidden border border-border/40 shadow-2xl bg-background rounded-2xl">
                <div className="p-6 md:p-8 border-b border-border/40 bg-card">
                    <DialogHeader>
                        <DialogTitle className="text-2xl md:text-3xl font-extrabold flex items-center gap-3">
                            <FileText className="w-8 h-8 text-primary" />
                            MANPOWER REQUEST FORM
                        </DialogTitle>
                        <DialogDescription className="text-base mt-2">
                            Please fill in the details below to formally request additional manpower.
                        </DialogDescription>
                    </DialogHeader>
                </div>
                
                <div className="p-6 md:p-8 max-h-[70vh] overflow-y-auto">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                            
                            {/* Section 1: Basic Info */}
                            <div className="bg-card shadow-sm border border-border/50 rounded-xl p-6 space-y-6">
                                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                                    <Building2 className="w-5 h-5 text-primary/70" />
                                    <h3 className="text-lg font-semibold tracking-tight">Department & Position</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="request_no"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Request ID # <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g. MR-2026-001" className="bg-muted/30 focus:bg-background transition-colors" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="requesting_department_id"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-col">
                                                <FormLabel className="text-xs font-bold uppercase text-muted-foreground mb-2">Department <span className="text-destructive">*</span></FormLabel>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <FormControl>
                                                            <Button
                                                                variant="outline"
                                                                role="combobox"
                                                                className={cn(
                                                                    "w-full justify-between bg-muted/30 focus:bg-background transition-colors font-normal",
                                                                    !field.value && "text-muted-foreground"
                                                                )}
                                                            >
                                                                {field.value
                                                                    ? departments.find(
                                                                          (d) => d.id === field.value
                                                                      )?.name
                                                                    : "Select Department"}
                                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                            </Button>
                                                        </FormControl>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[300px] p-0" align="start">
                                                        <Command>
                                                            <CommandInput placeholder="Search department..." />
                                                            <CommandList>
                                                                <CommandEmpty>No department found.</CommandEmpty>
                                                                <CommandGroup>
                                                                    {departments.map((dept) => (
                                                                        <CommandItem
                                                                            value={dept.name}
                                                                            key={dept.id}
                                                                            onSelect={() => {
                                                                                field.onChange(dept.id);
                                                                                // Optional: close popover logic usually goes here if using controlled state
                                                                            }}
                                                                        >
                                                                            <Check
                                                                                className={cn(
                                                                                    "mr-2 h-4 w-4",
                                                                                    dept.id === field.value
                                                                                        ? "opacity-100"
                                                                                        : "opacity-0"
                                                                                )}
                                                                            />
                                                                            {dept.name}
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
                                        name="division_id"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-col">
                                                <FormLabel className="text-xs font-bold uppercase text-muted-foreground mb-2">Division</FormLabel>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <FormControl>
                                                            <Button
                                                                variant="outline"
                                                                role="combobox"
                                                                className={cn(
                                                                    "w-full justify-between bg-muted/30 focus:bg-background transition-colors font-normal",
                                                                    !field.value && "text-muted-foreground"
                                                                )}
                                                            >
                                                                {field.value
                                                                    ? divisions.find(
                                                                          (d) => d.id === field.value
                                                                      )?.name
                                                                    : "Select Division"}
                                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                            </Button>
                                                        </FormControl>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[300px] p-0" align="start">
                                                        <Command>
                                                            <CommandInput placeholder="Search division..." />
                                                            <CommandList>
                                                                <CommandEmpty>No division found.</CommandEmpty>
                                                                <CommandGroup>
                                                                    {divisions.map((div) => (
                                                                        <CommandItem
                                                                            value={div.name}
                                                                            key={div.id}
                                                                            onSelect={() => {
                                                                                field.onChange(div.id);
                                                                            }}
                                                                        >
                                                                            <Check
                                                                                className={cn(
                                                                                    "mr-2 h-4 w-4",
                                                                                    div.id === field.value
                                                                                        ? "opacity-100"
                                                                                        : "opacity-0"
                                                                                )}
                                                                            />
                                                                            {div.name}
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
                                        name="position"
                                        render={({ field }) => (
                                            <FormItem className="md:col-span-3">
                                                <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Position Title <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Enter Job Position Title..." className="bg-muted/30 focus:bg-background transition-colors text-lg py-6" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            {/* Section 2: Purpose & Employment */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="bg-card shadow-sm border border-border/50 rounded-xl p-6 space-y-6 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <Briefcase className="w-24 h-24" />
                                    </div>
                                    <div className="flex items-center gap-2 pb-2 border-b border-border/50 relative z-10">
                                        <h3 className="text-lg font-semibold tracking-tight">Request Purpose <span className="text-destructive">*</span></h3>
                                    </div>
                                    
                                    <FormField
                                        control={form.control}
                                        name="purpose"
                                        render={({ field }) => (
                                            <FormItem className="relative z-10">
                                                <FormControl>
                                                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col gap-3">
                                                        <FormItem className="flex items-center space-x-3 space-y-0 p-3 rounded-lg border border-transparent hover:border-primary/20 hover:bg-primary/5 transition-all cursor-pointer">
                                                            <FormControl><RadioGroupItem value="New Position" /></FormControl>
                                                            <FormLabel className="font-medium cursor-pointer w-full">New Position</FormLabel>
                                                        </FormItem>
                                                        <FormItem className="flex items-center space-x-3 space-y-0 p-3 rounded-lg border border-transparent hover:border-primary/20 hover:bg-primary/5 transition-all cursor-pointer">
                                                            <FormControl><RadioGroupItem value="Additional" /></FormControl>
                                                            <FormLabel className="font-medium cursor-pointer w-full">Additional</FormLabel>
                                                        </FormItem>
                                                        <FormItem className="flex items-center space-x-3 space-y-0 p-3 rounded-lg border border-transparent hover:border-primary/20 hover:bg-primary/5 transition-all cursor-pointer">
                                                            <FormControl><RadioGroupItem value="Replacement" /></FormControl>
                                                            <FormLabel className="font-medium cursor-pointer w-full">Replacement</FormLabel>
                                                        </FormItem>
                                                    </RadioGroup>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    {purposeValue === "Replacement" && (
                                        <FormField
                                            control={form.control}
                                            name="replacement_name"
                                            render={({ field }) => (
                                                <FormItem className="animate-in fade-in slide-in-from-top-2 duration-300 relative z-10">
                                                    <FormControl>
                                                        <Input placeholder="Enter name of replaced employee..." className="border-primary/30 shadow-sm" {...field} value={field.value || ''} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )}

                                    <FormField
                                        control={form.control}
                                        name="no_manpower_needed"
                                        render={({ field }) => (
                                            <FormItem className="mt-4 relative z-10">
                                                <FormLabel className="text-xs font-bold uppercase text-muted-foreground">No. of Manpower Needed <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <Input 
                                                        type="number" 
                                                        min="1" 
                                                        className="w-1/2 text-lg font-bold" 
                                                        {...field} 
                                                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} 
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="bg-card shadow-sm border border-border/50 rounded-xl p-6 space-y-6">
                                    <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                                        <Users className="w-5 h-5 text-primary/70" />
                                        <h3 className="text-lg font-semibold tracking-tight">Employment Type <span className="text-destructive">*</span></h3>
                                    </div>
                                        <FormField
                                            control={form.control}
                                            name="employment_type"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                                                            {["Regular", "Seasonal", "Reliever", "Others"].map((type) => (
                                                                <FormItem key={type} className="flex items-center space-x-3 space-y-0 bg-muted/20 p-3 rounded-lg border hover:border-primary/30 hover:bg-primary/5 transition-colors cursor-pointer">
                                                                    <FormControl><RadioGroupItem value={type} /></FormControl>
                                                                    <FormLabel className="font-medium cursor-pointer w-full text-sm md:text-base">{type}</FormLabel>
                                                                </FormItem>
                                                            ))}
                                                        </RadioGroup>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    {employmentTypeValue === "Others" && (
                                        <FormField
                                            control={form.control}
                                            name="employment_others"
                                            render={({ field }) => (
                                                <FormItem className="animate-in fade-in zoom-in-95 duration-200">
                                                    <FormControl>
                                                        <Input placeholder="Please specify..." className="border-primary/30 shadow-sm" {...field} value={field.value || ''} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Section 3: Justification & Qualifications */}
                            <div className="bg-card shadow-sm border border-border/50 rounded-xl p-6 space-y-6">
                                <FormField
                                    control={form.control}
                                    name="reason_justification"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                                                Reason / Justification <span className="text-destructive">*</span>
                                            </FormLabel>
                                            <FormControl>
                                                <Textarea 
                                                    placeholder="Provide detailed reasoning for this request..." 
                                                    className="min-h-[120px] resize-none bg-muted/30 focus:bg-background transition-colors text-base" 
                                                    {...field} 
                                                    value={field.value || ''} 
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="bg-card shadow-sm border border-border/50 rounded-xl p-6 space-y-6">
                                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                                    <CheckCircle2 className="w-5 h-5 text-primary/70" />
                                    <h3 className="text-lg font-semibold tracking-tight">Qualifications & Details <span className="text-destructive">*</span></h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-6">
                                        <FormField
                                            control={form.control}
                                            name="qualification"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Gender Preference <span className="text-destructive">*</span></FormLabel>
                                                    <FormControl>
                                                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value || "Any"} className="flex gap-4">
                                                            <FormItem className="flex items-center space-x-2 space-y-0 p-2 px-4 rounded-full border bg-muted/20 hover:bg-primary/5 transition-colors cursor-pointer">
                                                                <FormControl><RadioGroupItem value="Male" /></FormControl>
                                                                <FormLabel className="cursor-pointer font-medium">Male</FormLabel>
                                                            </FormItem>
                                                            <FormItem className="flex items-center space-x-2 space-y-0 p-2 px-4 rounded-full border bg-muted/20 hover:bg-primary/5 transition-colors cursor-pointer">
                                                                <FormControl><RadioGroupItem value="Female" /></FormControl>
                                                                <FormLabel className="cursor-pointer font-medium">Female</FormLabel>
                                                            </FormItem>
                                                            <FormItem className="hidden">
                                                                <FormControl><RadioGroupItem value="Any" /></FormControl>
                                                                <FormLabel>Any</FormLabel>
                                                            </FormItem>
                                                        </RadioGroup>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="qualification_description"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Other Qualifications <span className="text-destructive">*</span></FormLabel>
                                                    <FormControl>
                                                        <Textarea 
                                                            placeholder="List other necessary skills and qualifications..." 
                                                            className="min-h-[100px] resize-none bg-muted/30 focus:bg-background transition-colors" 
                                                            {...field} 
                                                            value={field.value || ''} 
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <div className="space-y-6 bg-muted/10 p-6 rounded-xl border border-dashed border-border/60">
                                        <FormField
                                            control={form.control}
                                            name="applicant_name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                                                        <User className="w-4 h-4" /> Name of Applicant <span className="opacity-60 lowercase">(if any)</span>
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Applicant name..." className="bg-background" {...field} value={field.value || ''} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="rate"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                                                        <span className="flex items-center justify-center w-4 h-4 text-base font-serif leading-none opacity-80">₱</span>
                                                        Proposed Rate
                                                    </FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                                <span className="text-muted-foreground sm:text-sm">₱</span>
                                                            </div>
                                                            <Input 
                                                                type="number" 
                                                                step="0.01" 
                                                                placeholder="0.00" 
                                                                className="pl-7 bg-background text-lg font-medium" 
                                                                {...field} 
                                                                value={field.value ?? ""} 
                                                                onChange={(e) => field.onChange(e.target.value === "" ? null : parseFloat(e.target.value) || 0)} 
                                                            />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            {/* Empty space at bottom to ensure scroll padding */}
                            <div className="h-4"></div>
                        </form>
                    </Form>
                </div>
                
                <div className="p-4 md:p-6 bg-card border-t border-border/40">
                    <DialogFooter className="flex w-full sm:justify-end gap-3">
                        <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-full px-6">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting} onClick={form.handleSubmit(onSubmit)} className="rounded-full px-8 shadow-sm hover:shadow-md transition-all">
                            {isSubmitting ? (
                                <>
                                    <div className="w-4 h-4 mr-2 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                                    Submitting...
                                </>
                            ) : (
                                "Submit Request"
                            )}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
