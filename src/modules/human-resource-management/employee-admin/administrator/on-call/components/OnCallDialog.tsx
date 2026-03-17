"use client";

import React, { useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useOnCall } from "../hooks/useOnCall";
import { EnrichedOnCallSchedule } from "../types/on-call.schema";
import { format } from "date-fns";
import { Users, Search, X } from "lucide-react";
import { useDepartments } from "../../../structrure/department/hooks/userDepartments";
import { DepartmentFilterProvider } from "../../../structrure/department/providers/DepartmentFilterProvider";

interface OnCallDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    schedule?: EnrichedOnCallSchedule;
}

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function OnCallDialog(props: OnCallDialogProps) {
    return (
        <DepartmentFilterProvider>
            <OnCallDialogContent {...props} />
        </DepartmentFilterProvider>
    );
}

function OnCallDialogContent({ open, onOpenChange, schedule }: OnCallDialogProps) {
    const { createSchedule, updateSchedule, allSchedules } = useOnCall();
    const { departments, users, isLoading: isLoadingDeps } = useDepartments();


    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [staffSearch, setStaffSearch] = React.useState("");

    // Form State
    const [formData, setFormData] = React.useState({
        department_id: "",
        group: "",
        schedule_date: format(new Date(), "yyyy-MM-dd"),
        work_start: "08:00:00",
        work_end: "17:00:00",
        lunch_start: "12:00:00",
        lunch_end: "13:00:00",
        break_start: "15:00:00",
        break_end: "15:30:00",
        workdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        staffIds: [] as number[],
        grace_period: "5",
    });

    // staff who already have a schedule on selected date
    const unavailableStaffMap = React.useMemo(() => {
        const map = new Map<number, string>(); // userId -> departmentName
        allSchedules
            .filter(s => s.schedule_date === formData.schedule_date && s.id !== schedule?.id)
            .forEach(s => {
                s.assigned_staff.forEach(staff => {
                    map.set(staff.user_id, s.department_name || "Another department");
                });
            });
        return map;
    }, [allSchedules, formData.schedule_date, schedule?.id]);

    // Auto-clear staff who become unavailable when date changes
    useEffect(() => {
        if (open) {
            setTimeout(() => {
                setFormData(prev => {
                    const filteredStaff = prev.staffIds.filter(id => !unavailableStaffMap.has(id));
                    if (filteredStaff.length !== prev.staffIds.length) {
                        return { ...prev, staffIds: filteredStaff };
                    }
                    return prev;
                });
            }, 0);
        }
    }, [formData.schedule_date, unavailableStaffMap, open]);

    useEffect(() => {
        if (schedule && open) {
            setTimeout(() => {
                setFormData({
                    department_id: schedule.department_id.toString(),
                    group: schedule.group,
                    schedule_date: schedule.schedule_date,
                    work_start: schedule.work_start,
                    work_end: schedule.work_end,
                    lunch_start: schedule.lunch_start || "12:00:00",
                    lunch_end: schedule.lunch_end || "13:00:00",
                    break_start: schedule.break_start || "15:00:00",
                    break_end: schedule.break_end || "15:30:00",
                    workdays: schedule.workdays ? schedule.workdays.split(",") : [],
                    staffIds: schedule.assigned_staff.map((s) => s.user_id),
                    grace_period: (schedule.grace_period ?? 5).toString(),
                });
            }, 0);
        } else if (!schedule && open) {
            setTimeout(() => {
                setFormData({
                    department_id: "",
                    group: "",
                    schedule_date: format(new Date(), "yyyy-MM-dd"),
                    work_start: "08:00:00",
                    work_end: "17:00:00",
                    lunch_start: "12:00:00",
                    lunch_end: "13:00:00",
                    break_start: "15:00:00",
                    break_end: "15:30:00",
                    workdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                    staffIds: [],
                    grace_period: "5",
                });
            }, 0);
        }
    }, [schedule, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const payload = {
            ...formData,
            department_id: parseInt(formData.department_id),
            workdays: formData.workdays.join(","),
            working_days: formData.workdays.length,
            grace_period: parseInt(formData.grace_period, 10) || 5,
        };

        let success = false;
        if (schedule?.id) {
            success = await updateSchedule(schedule.id, payload, formData.staffIds);
        } else {
            success = await createSchedule(payload, formData.staffIds);
        }

        if (success) {
            onOpenChange(false);
        }
        setIsSubmitting(false);
    };

    const toggleDay = (day: string) => {
        setFormData((prev) => ({
            ...prev,
            workdays: prev.workdays.includes(day)
                ? prev.workdays.filter((d) => d !== day)
                : [...prev.workdays, day],
        }));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl h-fit max-h-[95vh] overflow-y-auto p-6 scrollbar-hide">
                <DialogHeader>
                    <DialogTitle>{schedule ? "Edit Schedule" : "Create New Schedule"}</DialogTitle>
                    <p className="text-sm text-muted-foreground">
                        {schedule ? "Update on-call schedule details" : "Set up a new on-call schedule"}
                    </p>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 py-4">
                    <section className="space-y-4 rounded-lg border p-6 bg-white shadow-sm">
                        <div className="space-y-1">
                            <h3 className="font-semibold text-base tracking-tight">Schedule Details</h3>
                            <p className="text-xs text-muted-foreground">Basic information about the on-call schedule</p>
                        </div>
                        <div className="grid grid-cols-12 gap-6">
                            <div className="col-span-8 space-y-2">
                                <Label htmlFor="department">Department *</Label>
                                <Select
                                    value={formData.department_id}
                                    onValueChange={(val) => setFormData({ ...formData, department_id: val, staffIds: [] })}
                                    required
                                >
                                    <SelectTrigger id="department" className="bg-muted/30 border-none h-11 shadow-sm">
                                        <SelectValue placeholder="Select Department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {departments.map((d) => (
                                            <SelectItem key={d.department_id} value={d.department_id.toString()}>
                                                {d.department_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="col-span-4 space-y-2">
                                <Label htmlFor="group">Group Name *</Label>
                                <Input
                                    id="group"
                                    placeholder="e.g., Team A, Night Shift"
                                    value={formData.group}
                                    onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                                    className="bg-muted/30 border-none h-11 shadow-sm"
                                    required
                                />
                            </div>
                            <div className="col-span-12 space-y-2">
                                <Label htmlFor="date">Schedule Date *</Label>
                                <Input
                                    id="date"
                                    type="date"
                                    value={formData.schedule_date}
                                    onChange={(e) => setFormData({ ...formData, schedule_date: e.target.value })}
                                    className="bg-muted/30 border-none h-11 shadow-sm"
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-3 pt-2">
                            <Label>Workdays *</Label>
                            <div className="flex flex-wrap gap-4">
                                {DAYS_OF_WEEK.map((day) => (
                                    <div key={day} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={day}
                                            checked={formData.workdays.includes(day)}
                                            onCheckedChange={() => toggleDay(day)}
                                        />
                                        <label
                                            htmlFor={day}
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                        >
                                            {day}
                                        </label>
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground">Selected: {formData.workdays.length} days</p>
                        </div>
                    </section>

                    <section className="space-y-4 rounded-lg border p-6 bg-white shadow-sm">
                        <div className="space-y-1">
                            <h3 className="font-semibold text-base tracking-tight">Work Hours</h3>
                            <p className="text-xs text-muted-foreground">Define work schedule and break times</p>
                        </div>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                            <div className="space-y-2">
                                <Label>Work Start Time *</Label>
                                <Input
                                    type="time"
                                    value={formData.work_start.substring(0, 5)}
                                    onChange={(e) => setFormData({ ...formData, work_start: `${e.target.value}:00` })}
                                    className="bg-muted/30 border-none h-11 shadow-sm"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Work End Time *</Label>
                                <Input
                                    type="time"
                                    value={formData.work_end.substring(0, 5)}
                                    onChange={(e) => setFormData({ ...formData, work_end: `${e.target.value}:00` })}
                                    className="bg-muted/30 border-none h-11 shadow-sm"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Lunch Start Time</Label>
                                <Input
                                    type="time"
                                    value={formData.lunch_start.substring(0, 5)}
                                    onChange={(e) => setFormData({ ...formData, lunch_start: `${e.target.value}:00` })}
                                    className="bg-muted/30 border-none h-11 shadow-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Lunch End Time</Label>
                                <Input
                                    type="time"
                                    value={formData.lunch_end.substring(0, 5)}
                                    onChange={(e) => setFormData({ ...formData, lunch_end: `${e.target.value}:00` })}
                                    className="bg-muted/30 border-none h-11 shadow-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Break Start Time</Label>
                                <Input
                                    type="time"
                                    value={formData.break_start.substring(0, 5)}
                                    onChange={(e) => setFormData({ ...formData, break_start: `${e.target.value}:00` })}
                                    className="bg-muted/30 border-none h-11 shadow-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Break End Time</Label>
                                <Input
                                    type="time"
                                    value={formData.break_end.substring(0, 5)}
                                    onChange={(e) => setFormData({ ...formData, break_end: `${e.target.value}:00` })}
                                    className="bg-muted/30 border-none h-11 shadow-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="grace_period">Grace Period (minutes) *</Label>
                                <Input
                                    id="grace_period"
                                    type="number"
                                    min="0"
                                    max="60"
                                    value={formData.grace_period}
                                    onChange={(e) => setFormData({ ...formData, grace_period: e.target.value })}
                                    className="bg-muted/30 border-none h-11 shadow-sm"
                                    required
                                />
                            </div>
                        </div>
                    </section>

                    <section className="space-y-4 rounded-lg border p-6 bg-white shadow-sm">
                        <div className="space-y-1">
                            <h3 className="font-semibold text-base tracking-tight flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Assign Staff
                            </h3>
                            <p className="text-xs text-muted-foreground">Select staff members to be on-call for this schedule</p>
                        </div>

                        {/* Selected Staff Summary */}
                        {formData.staffIds.length > 0 && (
                            <div className="bg-muted/30 rounded-lg p-4 space-y-3 border">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Currently Assigned ({formData.staffIds.length})</span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-[10px] text-muted-foreground hover:text-red-600"
                                        onClick={() => setFormData(prev => ({ ...prev, staffIds: [] }))}
                                    >
                                        Clear All
                                    </Button>
                                </div>
                                <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto pr-2">
                                    {users
                                        .filter(u => formData.staffIds.includes(u.user_id))
                                        .map(u => (
                                            <Badge
                                                key={u.user_id}
                                                variant="secondary"
                                                className="bg-white border text-xs py-1 pl-2 pr-1 gap-1 group animate-in fade-in zoom-in duration-200"
                                            >
                                                {u.user_fname} {u.user_lname}
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({
                                                        ...prev,
                                                        staffIds: prev.staffIds.filter(id => id !== u.user_id)
                                                    }))}
                                                    className="rounded-full hover:bg-muted p-0.5 transition-colors"
                                                >
                                                    <X className="h-3 w-3 text-muted-foreground group-hover:text-red-600" />
                                                </button>
                                            </Badge>
                                        ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search staff by name or email..."
                                    value={staffSearch}
                                    onChange={(e) => setStaffSearch(e.target.value)}
                                    className="pl-9 bg-muted/30 border-none h-11 shadow-sm"
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2">
                                {(() => {
                                    const filteredUsers = users.filter((staff) => {
                                        const fullName = `${staff.user_fname} ${staff.user_lname}`.toLowerCase();
                                        const email = staff.user_email?.toLowerCase() || "";
                                        const search = staffSearch.toLowerCase();

                                        const departmentMatch = formData.department_id
                                            ? staff.user_department === parseInt(formData.department_id)
                                            : true;

                                        return departmentMatch && (fullName.includes(search) || email.includes(search));
                                    });

                                    if (filteredUsers.length === 0 && !isLoadingDeps) {
                                        return (
                                            <div className="text-center py-8 space-y-2">
                                                <p className="text-sm text-muted-foreground">
                                                    {formData.department_id
                                                        ? "No staff members found for this department."
                                                        : "Please select a department to see available staff."}
                                                </p>
                                                {staffSearch && (
                                                    <p className="text-xs text-muted-foreground/60 italic">
                                                        Try adjusting your search query: &quot;{staffSearch}&quot;
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    }

                                    return filteredUsers.map((staff) => {
                                        const isUnavailable = unavailableStaffMap.has(staff.user_id);
                                        const otherDept = unavailableStaffMap.get(staff.user_id);

                                        return (
                                            <div key={staff.user_id} className={`flex items-center space-x-3 p-2 rounded-md border transition-colors ${isUnavailable ? "opacity-60 bg-muted/20 grayscale-[0.5]" : "hover:bg-muted/30"}`}>
                                                <Checkbox
                                                    id={`staff-${staff.user_id}`}
                                                    checked={formData.staffIds.includes(staff.user_id)}
                                                    disabled={isUnavailable}
                                                    onCheckedChange={(checked) => {
                                                        setFormData((prev) => ({
                                                            ...prev,
                                                            staffIds: checked
                                                                ? [...prev.staffIds, staff.user_id]
                                                                : prev.staffIds.filter((id) => id !== staff.user_id),
                                                        }));
                                                    }}
                                                />
                                                <div className="flex flex-col flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <label htmlFor={`staff-${staff.user_id}`} className={`text-sm font-medium ${isUnavailable ? "cursor-not-allowed" : "cursor-pointer"}`}>
                                                            {staff.user_fname} {staff.user_lname}
                                                        </label>
                                                        {isUnavailable && (
                                                            <Badge variant="outline" className="text-[10px] py-0 h-4 border-amber-200 bg-amber-50 text-amber-700">
                                                                Scheduled in {otherDept}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">{staff.user_email}</span>
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Selected: {formData.staffIds.length} staff members</p>
                    </section>

                    <DialogFooter className="pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Saving..." : schedule ? "Update Schedule" : "Create Schedule"}
                        </Button>
                    </DialogFooter>
                </form >
            </DialogContent >
        </Dialog >
    );
}
