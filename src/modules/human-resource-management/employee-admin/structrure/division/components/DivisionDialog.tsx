"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

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

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { X } from "lucide-react";

import type { DivisionWithRelations, User, Department } from "../types";
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
    onSubmit: (data: any) => Promise<void>;
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
                                   onSubmit,
                               }: DivisionDialogProps) {

    const isEdit = !!division;

    const form = useForm<DivisionFormData>({
        defaultValues: {
            division_name: "",
            division_code: "",
            division_head_id: "",
            division_description: "",
            date_added: new Date(),
        },
    });

    const [selectedDepartments, setSelectedDepartments] = useState<number[]>([]);


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

            setSelectedDepartments(
                division.departments?.map(d => d.department_id) || []
            );

        } else if (open && !division) {
            form.reset({
                division_name: "",
                division_code: "",
                division_head_id: "",
                division_description: "",
                date_added: new Date(),
            });

            setSelectedDepartments([]);
        }

    }, [open, division, form]);


    // =============================
    // Toggle departments
    // =============================

    const toggleDepartment = (deptId: number) => {
        setSelectedDepartments(prev =>
            prev.includes(deptId)
                ? prev.filter(id => id !== deptId)
                : [...prev, deptId]
        );
    };


    // =============================
    // Submit
    // =============================

    const handleSubmit = async (data: DivisionFormData) => {
        try {
            if (selectedDepartments.length === 0) {
                form.setError("root", {
                    message: "Please select at least one department"
                });
                return;
            }

            await onSubmit({
                division_name: data.division_name,
                division_code: data.division_code,
                division_head_id: parseInt(data.division_head_id, 10),
                division_description: data.division_description,
                date_added: data.date_added?.toISOString(),
                department_ids: selectedDepartments,
            });

            onOpenChange(false);
            form.reset();
            setSelectedDepartments([]);

        } catch (error) {
            console.error("Error submitting division:", error);
        }
    };


    const selectedDepts = departments.filter(d =>
        selectedDepartments.includes(d.department_id)
    );


    // =============================
    // UI
    // =============================

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">

                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? "Edit Division" : "Create Division"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? "Update the division information below."
                            : "Fill in the information to create a new division."}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">

                        {/* Division Name */}
                        <FormField
                            control={form.control}
                            name="division_name"
                            rules={{ required: "Division name is required" }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Division Name *</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
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
                                        <Input maxLength={10} {...field} />
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

                        {/* Departments */}
                        <div className="space-y-2">
                            <FormLabel>Departments *</FormLabel>

                            <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                                {departments.map(dept => (
                                    <div key={dept.department_id} className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedDepartments.includes(dept.department_id)}
                                            onChange={() => toggleDepartment(dept.department_id)}
                                        />
                                        <label className="text-sm">
                                            {dept.department_name}
                                        </label>
                                    </div>
                                ))}
                            </div>

                            {selectedDepts.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {selectedDepts.map(dept => (
                                        <Badge key={dept.department_id}>
                                            {dept.department_name}
                                            <button
                                                type="button"
                                                onClick={() => toggleDepartment(dept.department_id)}
                                                className="ml-1"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Description */}
                        <FormField
                            control={form.control}
                            name="division_description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        {/* Date Added */}
                        <FormField
                            control={form.control}
                            name="date_added"
                            render={({ field }) => (
                                <FormItem>
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

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">
                                {isEdit ? "Update" : "Create"} Division
                            </Button>
                        </DialogFooter>

                    </form>
                </Form>

            </DialogContent>
        </Dialog>
    );
}
