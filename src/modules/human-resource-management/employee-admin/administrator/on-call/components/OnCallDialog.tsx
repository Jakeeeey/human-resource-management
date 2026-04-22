"use client";

/**
 * OnCallDialog
 * Create / Edit dialog for On-Call schedules.
 * Uses the module-local OnCallModal (createPortal) instead of Radix UI Dialog
 * to avoid the Radix state-machine infinite-loop that occurs when this dialog
 * is rendered inside a rapid-re-rendering context tree.
 */

import React from "react";
import { OnCallModal, OnCallModalFooter } from "./OnCallModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// Checkbox intentionally replaced with native <input type="checkbox"> below
// to avoid CheckboxPrimitive.Indicator's internal setState loop.
import { Badge } from "@/components/ui/badge";
import { useOnCall } from "../hooks/useOnCall";
import { EnrichedOnCallSchedule } from "../types/on-call.schema";
import { format, parseISO } from "date-fns";
import { Users, Search, X, RefreshCw } from "lucide-react";
import type { DepartmentWithRelations, User } from "../../../structrure/department/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface OnCallDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    schedule?: EnrichedOnCallSchedule;
    departments: DepartmentWithRelations[];
    users: User[];
    isLoadingDeps?: boolean;
}

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ─────────────────────────────────────────────────────────────────────────────
// Public export — thin wrapper so callers don't need to manage the split
// ─────────────────────────────────────────────────────────────────────────────

export function OnCallDialog(props: OnCallDialogProps) {
    // Only mount the heavy form content when the dialog is actually open,
    // so hooks inside don't run unnecessarily and cause re-render churn.
    if (!props.open) return null;
    return <OnCallDialogContent {...props} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner form — only rendered while open
// ─────────────────────────────────────────────────────────────────────────────

function OnCallDialogContent({
    open,
    onOpenChange,
    schedule,
    departments,
    users,
    isLoadingDeps = false,
}: OnCallDialogProps) {
    const { createSchedule, updateSchedule, allSchedules } = useOnCall();

    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [staffSearch, setStaffSearch] = React.useState("");

    // ── Form state ──────────────────────────────────────────────────────────
    const initialForm = React.useMemo(() => {
        if (schedule) {
            return {
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
                staffIds: schedule.assigned_staff?.map((s) => s.user_id) || [],
                grace_period: (schedule.grace_period ?? 5).toString(),
            };
        }
        return {
            department_id: "",
            group: "",
            schedule_date: "",
            work_start: "08:00:00",
            work_end: "17:00:00",
            lunch_start: "12:00:00",
            lunch_end: "13:00:00",
            break_start: "15:00:00",
            break_end: "15:30:00",
            workdays: [] as string[],
            staffIds: [] as number[],
            grace_period: "5",
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // computed once on mount — dialog unmounts on close so this is safe

    const [formData, setFormData] = React.useState(initialForm);

    // ── Derived: staff unavailability map ───────────────────────────────────
    const unavailableStaffMap = React.useMemo(() => {
        const map = new Map<number, string>();
        if (!formData.schedule_date) return map;
        allSchedules
            .filter((s) => s.schedule_date === formData.schedule_date && s.id !== schedule?.id)
            .forEach((s) => {
                s.assigned_staff.forEach((staff) => {
                    map.set(staff.user_id, s.department_name || "Another department");
                });
            });
        return map;
    }, [allSchedules, formData.schedule_date, schedule?.id]);

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleDepartmentChange = React.useCallback((val: string) => {
        setFormData((prev) => ({ ...prev, department_id: val, staffIds: [] }));
    }, []);

    const handleDateChange = (dateStr: string) => {
        setFormData((prev) => {
            const nextData = { ...prev, schedule_date: dateStr };
            if (!dateStr) return nextData;

            const date = parseISO(dateStr);
            if (isNaN(date.getTime())) return nextData;

            const dayName = format(date, "EEEE");

            const newUnavailableMap = new Map<number, string>();
            allSchedules
                .filter((s) => s.schedule_date === dateStr && s.id !== schedule?.id)
                .forEach((s) => {
                    s.assigned_staff.forEach((staff) => {
                        newUnavailableMap.set(staff.user_id, s.department_name || "Another department");
                    });
                });

            const filteredStaff = nextData.staffIds.filter((id) => !newUnavailableMap.has(id));
            const newWorkdays = nextData.workdays.length <= 1 ? [dayName] : nextData.workdays;

            return { ...nextData, staffIds: filteredStaff, workdays: newWorkdays };
        });
    };

    const toggleDay = (day: string) => {
        setFormData((prev) => ({
            ...prev,
            workdays: prev.workdays.includes(day)
                ? prev.workdays.filter((d) => d !== day)
                : [...prev.workdays, day],
        }));
    };

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

        if (success) onOpenChange(false);
        setIsSubmitting(false);
    };

    // ── Filtered staff list ──────────────────────────────────────────────────
    const filteredUsers = React.useMemo(() => {
        return users.filter((staff) => {
            const fullName = `${staff.user_fname} ${staff.user_lname}`.toLowerCase();
            const email = staff.user_email?.toLowerCase() || "";
            const search = staffSearch.toLowerCase();
            const departmentMatch = formData.department_id
                ? staff.user_department === parseInt(formData.department_id)
                : true;
            return departmentMatch && (fullName.includes(search) || email.includes(search));
        });
    }, [users, staffSearch, formData.department_id]);

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <OnCallModal
            open={open}
            onClose={() => onOpenChange(false)}
            title={schedule ? "Edit Schedule" : "Create New Schedule"}
            description={schedule ? "Update on-call schedule details" : "Set up a new on-call schedule"}
        >
            <div className="max-h-[80vh] overflow-y-auto pr-1 scrollbar-hide">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* ── Schedule Details ── */}
                        <section className="space-y-4 rounded-xl border p-6 bg-card shadow-sm">
                            <div className="space-y-1.5 border-b pb-3">
                                <h3 className="font-bold text-base tracking-tight">Schedule Details</h3>
                                <p className="text-[11px] text-muted-foreground">Basic information about the on-call schedule</p>
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="oc-department" className="text-xs font-semibold">Department *</Label>
                                    {/*
                                     * Native <select> instead of Radix UI Select.
                                     * Radix Select's useCollection hook re-fires setState when the
                                     * `departments` prop array gets a new reference during context
                                     * re-renders, causing an infinite loop. Native select is immune.
                                     */}
                                    <select
                                        id="oc-department"
                                        value={formData.department_id}
                                        onChange={(e) => handleDepartmentChange(e.target.value)}
                                        required
                                        className="w-full h-10 px-3 rounded-lg border-2 border-transparent bg-muted/30 text-sm shadow-sm focus:border-blue-500/50 focus:outline-none transition-all"
                                    >
                                        <option value="" disabled>Select Department</option>
                                        {departments.map((d) => (
                                            <option key={d.department_id} value={d.department_id.toString()}>
                                                {d.department_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="oc-group" className="text-xs font-semibold">Group Name *</Label>
                                    <Input
                                        id="oc-group"
                                        placeholder="e.g., Team A, Night Shift"
                                        value={formData.group}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, group: e.target.value }))}
                                        className="bg-muted/30 border-2 border-transparent focus:border-blue-500/50 transition-all h-10 shadow-sm rounded-lg text-sm"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="oc-date" className="text-xs font-semibold">Schedule Date *</Label>
                                    <Input
                                        id="oc-date"
                                        type="date"
                                        value={formData.schedule_date}
                                        onChange={(e) => handleDateChange(e.target.value)}
                                        className="bg-muted/30 border-2 border-transparent focus:border-blue-500/50 transition-all h-10 shadow-sm rounded-lg text-sm"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-3 pt-1">
                                <Label className="text-xs font-semibold">Workdays *</Label>
                                <div className="flex flex-wrap gap-2">
                                    {DAYS_OF_WEEK.map((day) => (
                                        <div key={day} className="flex items-center space-x-2 bg-muted/20 px-3 py-1.5 rounded-lg border border-transparent hover:border-blue-500/20 transition-all">
                                            <input
                                                type="checkbox"
                                                id={`oc-day-${day}`}
                                                checked={formData.workdays.includes(day)}
                                                onChange={() => toggleDay(day)}
                                                className="h-4 w-4 rounded accent-blue-600 cursor-pointer"
                                            />
                                            <label
                                                htmlFor={`oc-day-${day}`}
                                                className="text-xs font-medium leading-none cursor-pointer whitespace-nowrap"
                                            >
                                                {day}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                                <Badge variant="outline" className="bg-blue-500/5 text-blue-600 border-blue-500/20 px-2 h-5 text-[10px]">
                                    Selected: {formData.workdays.length} days
                                </Badge>
                            </div>
                        </section>

                        {/* ── Work Hours ── */}
                        <section className="space-y-4 rounded-xl border p-6 bg-card shadow-sm">
                            <div className="space-y-1.5 border-b pb-3">
                                <h3 className="font-bold text-base tracking-tight">Work Hours</h3>
                                <p className="text-[11px] text-muted-foreground">Define work schedule and break times</p>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                                {[
                                    { label: "Work Start *", key: "work_start" as const, required: true },
                                    { label: "Work End *", key: "work_end" as const, required: true },
                                    { label: "Lunch Start", key: "lunch_start" as const },
                                    { label: "Lunch End", key: "lunch_end" as const },
                                    { label: "Break Start", key: "break_start" as const },
                                    { label: "Break End", key: "break_end" as const },
                                ].map(({ label, key, required }) => (
                                    <div key={key} className="space-y-2">
                                        <Label className="text-xs font-semibold">{label}</Label>
                                        <Input
                                            type="time"
                                            value={formData[key].substring(0, 5)}
                                            onChange={(e) => setFormData((prev) => ({ ...prev, [key]: `${e.target.value}:00` }))}
                                            className="bg-muted/30 border-2 border-transparent focus:border-blue-500/50 transition-all h-10 shadow-sm rounded-lg text-sm"
                                            required={required}
                                        />
                                    </div>
                                ))}
                                <div className="col-span-2 space-y-2 pt-1 border-t mt-1">
                                    <Label htmlFor="oc-grace" className="text-xs font-semibold">Grace Period (minutes) *</Label>
                                    <Input
                                        id="oc-grace"
                                        type="number"
                                        min="0"
                                        max="60"
                                        value={formData.grace_period}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, grace_period: e.target.value }))}
                                        className="bg-muted/30 border-2 border-transparent focus:border-blue-500/50 transition-all h-10 shadow-sm rounded-lg text-sm w-full"
                                        required
                                    />
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* ── Assign Staff ── */}
                    <section className="space-y-4 rounded-xl border p-6 bg-card shadow-sm">
                        <div className="space-y-1 border-b pb-3 flex items-center justify-between">
                            <div className="space-y-0.5">
                                <h3 className="font-bold text-base tracking-tight flex items-center gap-2">
                                    <Users className="h-5 w-5 text-blue-500" />
                                    Assign Staff
                                </h3>
                                <p className="text-[11px] text-muted-foreground">Select staff members for this schedule</p>
                            </div>
                            <Badge variant="outline" className="bg-blue-500/5 text-blue-600 border-blue-500/20 px-2.5 py-0.5 text-xs h-6">
                                {formData.staffIds.length} Assigned
                            </Badge>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-1">
                            {/* Available staff */}
                            <div className="space-y-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                        placeholder="Search staff members..."
                                        value={staffSearch}
                                        onChange={(e) => setStaffSearch(e.target.value)}
                                        className="pl-9 bg-muted/30 border-2 border-transparent focus:border-blue-500/50 transition-all h-10 shadow-sm rounded-lg text-xs"
                                    />
                                </div>
                                <div className="rounded-lg border bg-muted/10 overflow-hidden">
                                    <div className="p-2 bg-muted/20 border-b">
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Available Staff</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-0.5 max-h-[250px] overflow-y-auto scrollbar-hide p-1.5">
                                        {filteredUsers.length === 0 && !isLoadingDeps ? (
                                            <div className="text-center py-8">
                                                <p className="text-xs text-muted-foreground font-medium">No matches found.</p>
                                            </div>
                                        ) : (
                                            filteredUsers.map((staff) => {
                                                const isUnavailable = unavailableStaffMap.has(staff.user_id);
                                                const otherDept = unavailableStaffMap.get(staff.user_id);
                                                const isSelected = formData.staffIds.includes(staff.user_id);

                                                return (
                                                    <div
                                                        key={staff.user_id}
                                                        className={`flex items-center space-x-3 p-2 rounded-md transition-all ${
                                                            isUnavailable
                                                                ? "opacity-50 grayscale select-none"
                                                                : isSelected
                                                                    ? "bg-blue-500/10 border-blue-500/20"
                                                                    : "hover:bg-muted/50 cursor-pointer"
                                                        }`}
                                                        onClick={() => {
                                                            if (!isUnavailable) {
                                                                const checked = !isSelected;
                                                                setFormData((prev) => ({
                                                                    ...prev,
                                                                    staffIds: checked
                                                                        ? [...prev.staffIds, staff.user_id]
                                                                        : prev.staffIds.filter((id) => id !== staff.user_id),
                                                                }));
                                                            }
                                                        }}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            id={`oc-staff-${staff.user_id}`}
                                                            checked={isSelected}
                                                            disabled={isUnavailable}
                                                            readOnly
                                                            className="h-4 w-4 rounded accent-blue-600 pointer-events-none"
                                                        />
                                                        <div className="flex flex-col flex-1 min-w-0">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className={`text-xs font-semibold truncate ${isSelected ? "text-blue-700" : ""}`}>
                                                                    {staff.user_fname} {staff.user_lname}
                                                                </span>
                                                                {isUnavailable && (
                                                                    <Badge variant="outline" className="text-[8px] uppercase h-3.5 border-amber-500/20 bg-amber-500/5 text-amber-600 whitespace-nowrap px-1">
                                                                        {otherDept}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] text-muted-foreground truncate">{staff.user_email}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Assigned staff */}
                            <div className="space-y-3">
                                <div className="rounded-lg border bg-muted/10 h-full flex flex-col overflow-hidden">
                                    <div className="p-2 bg-muted/20 border-b flex items-center justify-between">
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Assigned Staff</span>
                                        {formData.staffIds.length > 0 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 px-1.5 text-[8px] uppercase font-bold text-muted-foreground hover:text-red-600 hover:bg-red-50"
                                                onClick={() => setFormData((prev) => ({ ...prev, staffIds: [] }))}
                                            >
                                                Clear All
                                            </Button>
                                        )}
                                    </div>
                                    <div className="p-3 flex-1 overflow-y-auto max-h-[250px]">
                                        {formData.staffIds.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-center space-y-2 opacity-30 py-8">
                                                <Users className="h-6 w-6" />
                                                <p className="text-xs font-medium">No staff assigned</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 gap-2">
                                                {users
                                                    .filter((u) => formData.staffIds.includes(u.user_id))
                                                    .map((u) => (
                                                        <div
                                                            key={u.user_id}
                                                            className="flex items-center justify-between p-2 rounded-lg border bg-card shadow-sm"
                                                        >
                                                            <div className="flex flex-col min-w-0 pr-2">
                                                                <span className="text-xs font-bold truncate">{u.user_fname} {u.user_lname}</span>
                                                                <span className="text-[9px] text-muted-foreground truncate">{u.user_email}</span>
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setFormData((prev) => ({
                                                                        ...prev,
                                                                        staffIds: prev.staffIds.filter((id) => id !== u.user_id),
                                                                    }));
                                                                }}
                                                                className="h-6 w-6 text-muted-foreground hover:text-red-600 hover:bg-red-50 shrink-0"
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <OnCallModalFooter>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            className="h-10 px-6 text-sm"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="h-10 px-8 font-bold bg-blue-600 hover:bg-blue-700 shadow shadow-blue-500/10 text-sm"
                        >
                            {isSubmitting ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : schedule ? (
                                "Update Schedule"
                            ) : (
                                "Create Schedule"
                            )}
                        </Button>
                    </OnCallModalFooter>
                </form>
            </div>
        </OnCallModal>
    );
}
