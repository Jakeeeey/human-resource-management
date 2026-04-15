/**
 * Department Schedule Dialog Component
 * Form with time pickers for work schedule
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
    FormDescription,
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
import type { DepartmentScheduleWithRelations, Department } from "../types";
import { formatTime24Hour } from "../types";

// ============================================================================
// TYPES
// ============================================================================

interface ScheduleFormData {
    department_id: string;
    working_days: string;
    work_start: string;
    work_end: string;
    lunch_start: string;
    lunch_end: string;
    break_start: string;
    break_end: string;
    workdays_note: string;
    grace_period: string;
}

interface DepartmentScheduleDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    schedule?: DepartmentScheduleWithRelations | null;
    departments: Department[];
    onSubmit: (data: Record<string, unknown>) => Promise<void>;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function DepartmentScheduleDialog({
    open,
    onOpenChange,
    schedule,
    departments,
    onSubmit,
}: DepartmentScheduleDialogProps) {
    const isEdit = !!schedule;
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<ScheduleFormData>({
        defaultValues: {
            department_id: "",
            working_days: "5",
            work_start: "08:00",
            work_end: "17:00",
            lunch_start: "12:00",
            lunch_end: "13:00",
            break_start: "15:00",
            break_end: "15:30",
            workdays_note: "",
            grace_period: "5",
        },
    });

    useEffect(() => {
        if (open && schedule) {
            form.reset({
                department_id: schedule.department_id.toString(),
                working_days: schedule.working_days.toString(),
                work_start: schedule.work_start.substring(0, 5), // "HH:MM:SS" → "HH:MM"
                work_end: schedule.work_end.substring(0, 5),
                lunch_start: schedule.lunch_start.substring(0, 5),
                lunch_end: schedule.lunch_end.substring(0, 5),
                break_start: schedule.break_start.substring(0, 5),
                break_end: schedule.break_end.substring(0, 5),
                workdays_note: schedule.workdays_note || "",
                grace_period: schedule.grace_period.toString(),
            });
        } else if (!open) {
            form.reset({
                department_id: "",
                working_days: "5",
                work_start: "08:00",
                work_end: "17:00",
                lunch_start: "12:00",
                lunch_end: "13:00",
                break_start: "15:00",
                break_end: "15:30",
                workdays_note: "",
                grace_period: "5",
            });
        }
    }, [open, schedule, form]);

    const handleSubmit = async (data: ScheduleFormData) => {
        setIsSubmitting(true);
        try {
            await onSubmit({
                department_id: parseInt(data.department_id, 10),
                working_days: parseInt(data.working_days, 10),
                work_start: formatTime24Hour(data.work_start),
                work_end: formatTime24Hour(data.work_end),
                lunch_start: formatTime24Hour(data.lunch_start),
                lunch_end: formatTime24Hour(data.lunch_end),
                break_start: formatTime24Hour(data.break_start),
                break_end: formatTime24Hour(data.break_end),
                workdays_note: data.workdays_note,
                grace_period: parseInt(data.grace_period, 10),
            });
            onOpenChange(false);
            form.reset();
        } catch (error) {
            console.error("Error submitting schedule:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Get departments that don't have schedules (for create mode)
    const availableDepartments = isEdit
        ? departments
        : departments; // We'll filter on server side if needed

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? "Edit Schedule" : "Create Schedule"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? "Update the department schedule below."
                            : "Set up work schedule for a department."}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        {/* Department Selection */}
                        <FormField
                            control={form.control}
                            name="department_id"
                            rules={{ required: "Department is required" }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Department *</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        value={field.value}
                                        disabled={isEdit}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select department" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {availableDepartments.map((dept) => (
                                                <SelectItem
                                                    key={dept.department_id}
                                                    value={dept.department_id.toString()}
                                                >
                                                    {dept.department_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {isEdit && (
                                        <FormDescription>
                                            Department cannot be changed
                                        </FormDescription>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Working Days */}
                        <FormField
                            control={form.control}
                            name="working_days"
                            rules={{
                                required: "Working days is required",
                                min: { value: 1, message: "Must be at least 1 day" },
                                max: { value: 7, message: "Cannot exceed 7 days" }
                            }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Working Days per Week *</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min="1"
                                            max="7"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Number of working days per week (1-7)
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
 
                        {/* Grace Period */}
                        <FormField
                            control={form.control}
                            name="grace_period"
                            rules={{
                                required: "Grace period is required",
                                min: { value: 0, message: "Must be at least 0" },
                                max: { value: 60, message: "Cannot exceed 60 minutes" }
                            }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Grace Period (minutes) *</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min="0"
                                            max="60"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Allowed late time in minutes
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
 
                        {/* Work Hours */}
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="work_start"
                                rules={{ required: "Work start time is required" }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Work Start *</FormLabel>
                                        <FormControl>
                                            <Input type="time" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="work_end"
                                rules={{ required: "Work end time is required" }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Work End *</FormLabel>
                                        <FormControl>
                                            <Input type="time" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Lunch Break */}
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="lunch_start"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Lunch Start</FormLabel>
                                        <FormControl>
                                            <Input type="time" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="lunch_end"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Lunch End</FormLabel>
                                        <FormControl>
                                            <Input type="time" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Coffee Break */}
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="break_start"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Break Start</FormLabel>
                                        <FormControl>
                                            <Input type="time" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="break_end"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Break End</FormLabel>
                                        <FormControl>
                                            <Input type="time" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Notes */}
                        <FormField
                            control={form.control}
                            name="workdays_note"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notes</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Additional notes about the schedule"
                                            maxLength={64}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Maximum 64 characters
                                    </FormDescription>
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
                                {isEdit ? "Update" : "Create"} Schedule
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
