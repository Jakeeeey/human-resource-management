/**
 * Department Dialog Component
 * Handles Create and Edit operations
 */

"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { DepartmentWithRelations, User } from "../types";
import { SingleDatePicker } from "@/modules/human-resource-management/employee-admin/structrure/department/components/SingleDatePicker";


// ============================================================================
// TYPES
// ============================================================================

interface DepartmentFormData {
    department_name: string;
    department_description: string;
    department_head: string;
    date_added: Date | null;
    positions: string[];
}

interface DepartmentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    department?: DepartmentWithRelations | null;
    users: User[];
    onSubmit: (data: Record<string, unknown>) => Promise<void>;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function DepartmentDialog({
    open,
    onOpenChange,
    department,
    users,
    onSubmit,
}: DepartmentDialogProps) {
    const isEdit = !!department;
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<DepartmentFormData>({
        defaultValues: {
            department_name: "",
            department_description: "",
            department_head: "",
            date_added: new Date(),
            positions: [],
        },
    });

    // Reset form when dialog opens/closes or department changes
    useEffect(() => {
        if (open && department) {
            form.reset({
                department_name: department.department_name,
                department_description: department.department_description || "",
                department_head: department.department_head_id?.toString() || "",
                date_added: department.date_added
                    ? new Date(department.date_added)
                    : new Date(),
                positions: department.positions?.map(p => p.position) || [],
            });
        } else if (!open) {
            form.reset({
                department_name: "",
                department_description: "",
                department_head: "",
                date_added: new Date(),
                positions: [],
            });
        }
    }, [open, department, form]);

    const handleSubmit = async (data: DepartmentFormData) => {
        setIsSubmitting(true);
        try {
            // ✅ Fixed: Convert string values to numbers for API
            await onSubmit({
                department_name: data.department_name,
                department_description: data.department_description,
                department_head: parseInt(data.department_head, 10),
                date_added: data.date_added?.toISOString(),
                positions: data.positions.filter(p => p.trim() !== ""),
            });
            onOpenChange(false);
            form.reset();
        } catch (error) {
            console.error("Error submitting department:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? "Edit Department" : "Create Department"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? "Update the department information below."
                            : "Fill in the information to create a new department."}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        {/* Department Name */}
                        <FormField
                            control={form.control}
                            name="department_name"
                            rules={{ required: "Department name is required" }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Department Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Operations" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />


                        {/* Department Head */}
                        <FormField
                            control={form.control}
                            name="department_head"
                            rules={{ required: "Department head is required" }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Department Head</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a user" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {users.map((user) => (
                                                <SelectItem
                                                    key={user.user_id}
                                                    value={user.user_id.toString()}
                                                >
                                                    {user.user_fname} {user.user_lname}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Description */}
                        <FormField
                            control={form.control}
                            name="department_description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Enter department description"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Positions */}
                        <FormField
                            control={form.control}
                            name="positions"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Positions</FormLabel>

                                    <div className="space-y-2">
                                        {field.value.map((pos, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <Input
                                                    value={pos}
                                                    onChange={(e) => {
                                                        const next = [...field.value];
                                                        next[idx] = e.target.value;
                                                        field.onChange(next);
                                                    }}
                                                    placeholder="e.g. Supervisor"
                                                />

                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => {
                                                        field.onChange(field.value.filter((_, i) => i !== idx));
                                                    }}
                                                >
                                                    Remove
                                                </Button>
                                            </div>
                                        ))}

                                        <Button
                                            type="button"
                                            variant="secondary"
                                            onClick={() => field.onChange([...(field.value || []), ""])}
                                        >
                                            Add Position
                                        </Button>
                                    </div>

                                    <FormMessage />
                                </FormItem>
                            )}
                        />


                        <FormField
                            control={form.control}
                            name="date_added"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Date Added</FormLabel>
                                    <FormControl>
                                        <SingleDatePicker
                                            placeholder="Select date"
                                            value={field.value}
                                            onChange={field.onChange}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isEdit ? "Update" : "Create"} Department
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
