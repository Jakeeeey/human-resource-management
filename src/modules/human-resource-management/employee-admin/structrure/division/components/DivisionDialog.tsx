"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";

import {
    Dialog, DialogContent, DialogDescription,
    DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

import {
    Form, FormControl, FormField,
    FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";

import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from "@/components/ui/select";

import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { X, Building2, CreditCard, Plus } from "lucide-react";

import type { DivisionWithRelations, User, Department, BankAccount, DepartmentAssignment } from "../types";
import { getUserFullName } from "../types";

import { SingleDatePicker } from "@/modules/human-resource-management/employee-admin/structrure/department/components/SingleDatePicker";


// ======================================================
// TYPES
// ======================================================

interface DivisionFormData {
    division_name: string;
    division_code: string;
    division_head_id: string;
    division_description: string;
    date_added: Date | null;
}

interface DivisionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    division?: DivisionWithRelations | null;
    users: User[];
    departments: Department[];
    bankAccounts: BankAccount[];
    onSubmit: (data: Record<string, unknown>) => Promise<void>;
}


// ======================================================
// COMPONENT
// ======================================================

export function DivisionDialog({
    open,
    onOpenChange,
    division,
    users,
    departments,
    bankAccounts,
    onSubmit,
}: DivisionDialogProps) {
    const isEdit = !!division;
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<DivisionFormData>({
        defaultValues: {
            division_name: "",
            division_code: "",
            division_head_id: "",
            division_description: "",
            date_added: null, // Initialize to null to avoid hydration mismatch
        },
    });

    // State for department assignments (department_id + bank_id)
    const [assignments, setAssignments] = useState<DepartmentAssignment[]>([]);

    // Derived state for available departments (not yet selected)
    const availableDepartments = departments.filter(d =>
        !assignments.some(a => a.department_id === d.department_id)
    );

    // =============================
    // Reset on open/edit
    // =============================

    useEffect(() => {
        if (open && division) {
            form.reset({
                division_name: division.division_name,
                division_code: division.division_code || "",
                division_head_id: division.division_head_id?.toString() || "",
                division_description: division.division_description || "",
                date_added: division.date_added
                    ? new Date(division.date_added)
                    : new Date(),
            });

            // Initialize assignments from existing data
            if (division.departments) {
                const initialAssignments = division.departments.map(d => ({
                    department_id: d.department_id,
                    bank_id: d.bank_id || null
                }));
                setAssignments(initialAssignments);
            } else {
                setAssignments([]);
            }

        } else if (open && !division) {
            form.reset({
                division_name: "",
                division_code: "",
                division_head_id: "",
                division_description: "",
                date_added: new Date(),
            });

            setAssignments([]);
        }

    }, [open, division, form]);


    // =============================
    // Assignment Handlers
    // =============================

    const addDepartment = (deptId: number) => {
        setAssignments(prev => [
            ...prev,
            { department_id: deptId, bank_id: null }
        ]);
    };

    const removeDepartment = (deptId: number) => {
        setAssignments(prev => prev.filter(a => a.department_id !== deptId));
    };

    const updateBankAssignment = (deptId: number, bankId: string) => {
        const parsedBankId = bankId === "none" ? null : parseInt(bankId, 10);

        setAssignments(prev => prev.map(a =>
            a.department_id === deptId
                ? { ...a, bank_id: parsedBankId }
                : a
        ));
    };


    // =============================
    // Submit
    // =============================

    const handleSubmit = async (data: DivisionFormData) => {
        setIsSubmitting(true);
        try {
            if (assignments.length === 0) {
                form.setError("root", {
                    message: "Please select at least one department"
                });
                return;
            }

            const payload = {
                division_name: data.division_name,
                division_code: data.division_code,
                division_head_id: parseInt(data.division_head_id, 10),
                division_description: data.division_description,
                date_added: data.date_added?.toISOString(),
                department_assignments: assignments,
            };

            // ✅ Log what we're sending
            console.log('Submitting division:', payload);

            await onSubmit(payload);

            onOpenChange(false);
            form.reset();
            setAssignments([]);

        } catch (error) {
            // ✅ Log the actual error
            console.error("Error submitting division:", error);
        } finally {
            setIsSubmitting(false);
        }
    };


    // Helper to get department name
    const getDeptName = (id: number) => departments.find(d => d.department_id === id)?.department_name || "Unknown Department";


    // =============================
    // UI
    // =============================

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">

                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? "Edit Division" : "Create Division"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? "Update the division information and manage department bank assignments."
                            : "Fill in the information to create a new division."}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">

                        {/* Basic Info Section */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">General Information</h4>
                            <Separator />

                            <div className="grid grid-cols-2 gap-4">
                                {/* Division Name */}
                                <FormField
                                    control={form.control}
                                    name="division_name"
                                    rules={{ required: "Division name is required" }}
                                    render={({ field }) => (
                                        <FormItem className="col-span-2">
                                            <FormLabel>Division Name *</FormLabel>
                                            <FormControl>
                                                <Input {...field} placeholder="e.g. Finance & Administration" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Division Code */}
                                <FormField
                                    control={form.control}
                                    name="division_code"
                                    rules={{ required: "Division code is required" }}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Division Code *</FormLabel>
                                            <FormControl>
                                                <Input maxLength={10} {...field} placeholder="e.g. FIN-ADMIN" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Division Head */}
                                <FormField
                                    control={form.control}
                                    name="division_head_id"
                                    rules={{ required: "Division head is required" }}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Division Head *</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select user" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {users.map(user => (
                                                        <SelectItem key={user.user_id} value={user.user_id.toString()}>
                                                            {getUserFullName(user)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Date Added */}
                                <FormField
                                    control={form.control}
                                    name="date_added"
                                    render={({ field }) => (
                                        <FormItem className="col-span-2">
                                            <FormLabel>Date Added</FormLabel>
                                            <FormControl>
                                                <SingleDatePicker
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    placeholder="Select date"
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                {/* Description */}
                                <FormField
                                    control={form.control}
                                    name="division_description"
                                    render={({ field }) => (
                                        <FormItem className="col-span-2">
                                            <FormLabel>Description</FormLabel>
                                            <FormControl>
                                                <Textarea {...field} placeholder="Optional description..." />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* Department Assignments Section */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Department Assignments</h4>
                                <Badge variant="secondary" className="text-xs">
                                    {assignments.length} Selected
                                </Badge>
                            </div>
                            <Separator />

                            {form.formState.errors.root && (
                                <div className="text-sm text-destructive font-medium">
                                    {form.formState.errors.root.message}
                                </div>
                            )}

                            {/* Add Department Command Interface */}
                            <div className="space-y-2">
                                <FormLabel>Add Department</FormLabel>
                                <div className="border rounded-md">
                                    <Command>
                                        <CommandInput placeholder="Search departments to add..." />
                                        <CommandList>
                                            <CommandEmpty>No departments found.</CommandEmpty>
                                            <CommandGroup heading="Available Departments">
                                                {availableDepartments.length === 0 ? (
                                                    <div className="py-6 text-center text-sm text-muted-foreground">
                                                        No departments available
                                                    </div>
                                                ) : (
                                                    availableDepartments.map((dept) => (
                                                        <CommandItem
                                                            key={dept.department_id}
                                                            onSelect={() => addDepartment(dept.department_id)}
                                                        >
                                                            {dept.department_name}
                                                            <Plus className="ml-auto h-4 w-4 opacity-50" />
                                                        </CommandItem>
                                                    ))
                                                )}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </div>
                            </div>

                            {/* Selected Assignments List */}
                            <div className="space-y-3 mt-4">
                                {assignments.length === 0 ? (
                                    <div className="text-center py-8 border rounded-md border-dashed text-muted-foreground text-sm bg-muted/20">
                                        No departments selected. Use the search above to add departments.
                                    </div>
                                ) : (
                                    assignments.map((assignment) => (
                                        <Card key={assignment.department_id} className="relative overflow-hidden">
                                            <CardContent className="p-4 flex items-start gap-4">
                                                <div className="p-2 bg-primary/10 rounded-md">
                                                    <Building2 className="h-5 w-5 text-primary" />
                                                </div>

                                                <div className="flex-1 space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <h5 className="font-medium text-sm">{getDeptName(assignment.department_id)}</h5>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon-xs"
                                                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                            onClick={() => removeDepartment(assignment.department_id)}
                                                            type="button"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>

                                                    <div className="flex items-center gap-2 mt-2">
                                                        <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                                                        <Select
                                                            value={assignment.bank_id?.toString() || "none"}
                                                            onValueChange={(val) => updateBankAssignment(assignment.department_id, val)}
                                                        >
                                                            <SelectTrigger className="h-8 text-xs w-full max-w-[250px]">
                                                                <SelectValue placeholder="Select Bank Account" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none">
                                                                    <span className="text-muted-foreground italic">No Bank Account</span>
                                                                </SelectItem>
                                                                {bankAccounts.filter(b => b.is_active).map(bank => (
                                                                    <SelectItem key={bank.bank_id} value={bank.bank_id.toString()}>
                                                                        {bank.bank_name} - {bank.account_number}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isEdit ? "Update" : "Create"} Division
                            </Button>
                        </DialogFooter>

                    </form>
                </Form>

            </DialogContent>
        </Dialog>
    );
}
