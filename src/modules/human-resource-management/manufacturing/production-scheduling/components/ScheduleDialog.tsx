"use client";

import React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Calendar, Target, Factory, Users, AlertTriangle, Info } from "lucide-react";
import type { ProductionSchedule, ScheduleFormValues } from "../types";
import type { ManufacturingLine, LinePosition } from "../../line-registration/types";
import { scheduleFormSchema } from "../types";
import { LineRegistrationService } from "../../line-registration/services/LineRegistrationService";

interface ScheduleDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: ScheduleFormValues) => Promise<boolean>;
    lines: ManufacturingLine[];
    schedule?: ProductionSchedule | null;
}

export function ScheduleDialog({
    open,
    onOpenChange,
    onSubmit,
    lines,
    schedule,
}: ScheduleDialogProps) {
    const isEdit = !!schedule;
    const [isSaving, setIsSaving] = React.useState(false);
    const [errors, setErrors] = React.useState<Record<string, string>>({});

    // Form states
    const [scheduleDate, setScheduleDate] = React.useState("");
    const [lineId, setLineId] = React.useState<number>(0);
    const [dailyTarget, setDailyTarget] = React.useState<number>(0);
    const [actualProduce, setActualProduce] = React.useState<number>(0);

    // Selected Line configurations
    const [selectedLineInfo, setSelectedLineInfo] = React.useState<ManufacturingLine | null>(null);
    const [linePositions, setLinePositions] = React.useState<LinePosition[]>([]);
    const [isLineLoading, setIsLineLoading] = React.useState(false);

    // Position assignments map: position_id -> assigned_persons
    const [assignments, setAssignments] = React.useState<Record<number, number>>({});

    // Load schedule parameters if editing
    React.useEffect(() => {
        const loadInitialData = async () => {
            if (schedule) {
                setScheduleDate(schedule.schedule_date);
                setLineId(schedule.line_id);
                setDailyTarget(schedule.daily_target);
                setActualProduce(schedule.actual_produce || 0);

                setIsLineLoading(true);
                try {
                    const details = await LineRegistrationService.getLineById(schedule.line_id);
                    if (details) {
                        setSelectedLineInfo(details);
                        setLinePositions(details.positions || []);

                        // Prefill position assignments
                        const initialAssignments: Record<number, number> = {};
                        // Initialize all positions from line to 0
                        (details.positions || []).forEach((p) => {
                            initialAssignments[p.id] = 0;
                        });
                        // Override with values from schedule
                        const schedPosList = schedule.positions || schedule.manu_hr_schedule_positions || [];
                        schedPosList.forEach((sp) => {
                            const posId = typeof sp.position_id === "object" && sp.position_id !== null
                                ? (sp.position_id as { id: number }).id
                                : Number(sp.position_id);
                            
                            if (posId) {
                                initialAssignments[posId] = sp.assigned_persons;
                            }
                        });
                        setAssignments(initialAssignments);
                    }
                } catch (err) {
                    console.error("Failed to load line details:", err);
                } finally {
                    setIsLineLoading(false);
                }
            } else {
                setScheduleDate(new Date().toISOString().split("T")[0]);
                setLineId(0);
                setDailyTarget(0);
                setActualProduce(0);
                setSelectedLineInfo(null);
                setLinePositions([]);
                setAssignments({});
            }
            setErrors({});
        };

        if (open) {
            loadInitialData();
        }
    }, [schedule, open]);

    // Handle production line change: fetch positions and initialize inputs
    const handleLineChange = async (val: string) => {
        const id = parseInt(val, 10);
        setLineId(id);
        setSelectedLineInfo(null);
        setLinePositions([]);
        setAssignments({});
        
        if (!id) return;

        setIsLineLoading(true);
        try {
            const details = await LineRegistrationService.getLineById(id);
            if (details) {
                setSelectedLineInfo(details);
                setLinePositions(details.positions || []);

                const initialAssignments: Record<number, number> = {};
                (details.positions || []).forEach((p) => {
                    initialAssignments[p.id] = 0;
                });
                setAssignments(initialAssignments);
                
                // Pre-fill daily target with line standard target if currently 0
                if (dailyTarget === 0) {
                    setDailyTarget(details.target_produce_8_hrs);
                }
            }
        } catch (err) {
            console.error("Error fetching line specs:", err);
        } finally {
            setIsLineLoading(false);
        }
    };

    const handleAssignmentChange = (posId: number, count: number) => {
        setAssignments((prev) => ({
            ...prev,
            [posId]: count,
        }));
    };

    const handleAction = async () => {
        // Compile position array
        const posArray = Object.entries(assignments).map(([posId, count]) => ({
            position_id: parseInt(posId, 10),
            assigned_persons: count,
        }));

        const payload = {
            schedule_date: scheduleDate,
            line_id: lineId,
            daily_target: dailyTarget,
            actual_produce: actualProduce,
            positions: posArray,
        };

        // Validate via Zod
        const result = scheduleFormSchema.safeParse(payload);
        if (!result.success) {
            const fieldErrors: Record<string, string> = {};
            result.error.issues.forEach((err) => {
                const path = err.path.join(".");
                fieldErrors[path] = err.message;
            });
            setErrors(fieldErrors);
            return;
        }

        setIsSaving(true);
        try {
            const success = await onSubmit(result.data);
            if (success) {
                onOpenChange(false);
            }
        } catch (error) {
            console.error("Submission failed:", error);
        } finally {
            setIsSaving(false);
        }
    };

    // Derived approval warnings for real-time user help
    const targetRequiresApproval = selectedLineInfo && dailyTarget < selectedLineInfo.target_produce_8_hrs;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={false} className="p-0 sm:max-w-[550px] max-h-[85vh] overflow-hidden rounded-2xl border shadow-2xl flex flex-col bg-background/95 backdrop-blur-sm">
                <DialogHeader className="p-6 pb-4 border-b bg-muted/20 relative">
                    <div className="flex items-center gap-4">
                        <div className="bg-primary/10 p-3 rounded-2xl shadow-inner ring-1 ring-primary/20">
                            <Calendar className="h-6 w-6 text-primary" />
                        </div>
                        <div className="space-y-0.5">
                            <DialogTitle className="text-xl font-black tracking-tighter text-foreground leading-none">
                                {isEdit ? "Update Schedule" : "Create Daily Schedule"}
                            </DialogTitle>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">
                                Line Assignment & Target Setup
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto">
                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            {/* Date Picker */}
                            <div className="space-y-2">
                                <Label htmlFor="schedule_date" className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/70 flex items-center gap-1.5">
                                    <Calendar className="h-3 w-3" /> Schedule Date
                                </Label>
                                <Input
                                    id="schedule_date"
                                    type="date"
                                    value={scheduleDate}
                                    onChange={(e) => setScheduleDate(e.target.value)}
                                    className="h-10 rounded-xl border-muted-foreground/10 focus-visible:ring-primary/20 bg-card font-black text-sm"
                                />
                                {errors.schedule_date && (
                                    <p className="text-[10px] font-bold text-destructive">{errors.schedule_date}</p>
                                )}
                            </div>

                            {/* Line Dropdown */}
                            <div className="space-y-2">
                                <Label htmlFor="line_id" className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/70 flex items-center gap-1.5">
                                    <Factory className="h-3 w-3" /> Production Line
                                </Label>
                                <Select
                                    value={lineId > 0 ? String(lineId) : ""}
                                    onValueChange={handleLineChange}
                                    disabled={isEdit} // Disable line changing during edit to preserve mappings
                                >
                                    <SelectTrigger className="h-10 rounded-xl border-muted-foreground/10 focus-visible:ring-primary/20 bg-card text-xs font-black">
                                        <SelectValue placeholder="Select working line" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border shadow-2xl">
                                        {lines.map((l) => (
                                            <SelectItem key={l.id} value={String(l.id)} className="text-xs font-bold rounded-lg my-0.5">
                                                {l.line_name} (Std: {l.target_produce_8_hrs} pcs)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.line_id && (
                                    <p className="text-[10px] font-bold text-destructive">{errors.line_id}</p>
                                )}
                            </div>
                        </div>

                        {/* Targets Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <Label htmlFor="daily_target" className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/70 flex items-center gap-1.5">
                                    <Target className="h-3 w-3" /> Daily Target (pcs)
                                </Label>
                                <Input
                                    id="daily_target"
                                    type="number"
                                    min={1}
                                    value={dailyTarget || ""}
                                    onChange={(e) => setDailyTarget(e.target.value === "" ? 0 : parseInt(e.target.value, 10))}
                                    className="h-10 rounded-xl border-muted-foreground/10 focus-visible:ring-primary/20 bg-card font-black text-sm tabular-nums"
                                    placeholder="e.g. 1000"
                                />
                                {errors.daily_target && (
                                    <p className="text-[10px] font-bold text-destructive">{errors.daily_target}</p>
                                )}
                            </div>

                            {isEdit && (
                                <div className="space-y-2">
                                    <Label htmlFor="actual_produce" className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/70 flex items-center gap-1.5">
                                        Actual Output (pcs)
                                    </Label>
                                    <Input
                                        id="actual_produce"
                                        type="number"
                                        min={0}
                                        value={actualProduce}
                                        onChange={(e) => setActualProduce(e.target.value === "" ? 0 : parseInt(e.target.value, 10))}
                                        className="h-10 rounded-xl border-muted-foreground/10 focus-visible:ring-primary/20 bg-card font-black text-sm tabular-nums"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Real-time Target Approval Warning */}
                        {targetRequiresApproval && (
                            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                                <AlertTriangle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-800">
                                        Target Approval Needed
                                    </p>
                                    <p className="text-[9px] text-amber-700/90 font-bold leading-normal uppercase">
                                        The daily target is lower than the line standard of {selectedLineInfo.target_produce_8_hrs} pcs. This will require manager approval.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Position Assignments Section */}
                        {lineId > 0 && (
                            <div className="space-y-4 border-t border-muted-foreground/10 pt-5">
                                <div className="flex items-center gap-2">
                                    <Users className="h-4.5 w-4.5 text-primary/60" />
                                    <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                                        Position Headcounts
                                    </h3>
                                </div>

                                {isLineLoading ? (
                                    <div className="flex items-center justify-center py-6 gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground">Loading positions...</span>
                                    </div>
                                ) : linePositions.length > 0 ? (
                                    <div className="space-y-4">
                                        {linePositions.map((pos) => {
                                            const assigned = assignments[pos.id] || 0;
                                            const isOverhead = assigned > pos.persons_allowed;

                                            return (
                                                <div key={pos.id} className="p-4 rounded-2xl border bg-card/40 space-y-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-xs font-black text-foreground truncate">
                                                                {pos.position_name}
                                                            </span>
                                                            <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">
                                                                Standard Limit: {pos.persons_allowed} allowed • ₱{Number(pos.position_rate || 0).toFixed(2)}/hr
                                                            </span>
                                                        </div>
                                                        <div className="w-24 shrink-0">
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                value={assigned || ""}
                                                                onChange={(e) => handleAssignmentChange(pos.id, e.target.value === "" ? 0 : parseInt(e.target.value, 10))}
                                                                className="h-9 rounded-xl border-muted-foreground/10 text-right font-black text-xs tabular-nums"
                                                                placeholder="0"
                                                            />
                                                        </div>
                                                    </div>

                                                    {isOverhead && (
                                                        <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-start gap-2 animate-in fade-in slide-in-from-top-1.5 duration-200">
                                                            <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
                                                            <div className="space-y-0.5">
                                                                <p className="text-[9px] font-black uppercase tracking-wider text-orange-800">
                                                                    Headcount Limit Exceeded
                                                                </p>
                                                                <p className="text-[8px] text-orange-700/90 font-bold leading-normal uppercase">
                                                                    Requires approval since it exceeds limits ({pos.persons_allowed} persons max).
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 p-3 bg-muted/20 border border-dashed rounded-xl justify-center text-center text-xs font-bold text-muted-foreground/50 py-6 uppercase tracking-wider">
                                        <Info className="h-4.5 w-4.5" /> No positions registered on this line
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="p-6 py-4 border-t bg-muted/10 flex items-center justify-end gap-3 shadow-[0_-8px_15px_-10px_rgba(0,0,0,0.05)]">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="flex-1 sm:flex-none rounded-xl px-8 font-black h-10 text-[10px] uppercase opacity-70 border border-muted-foreground/10 hover:opacity-100 transition-all hover:bg-background hover:shadow-sm"
                        disabled={isSaving}
                    >
                        CANCEL
                    </Button>
                    <Button
                        onClick={handleAction}
                        disabled={isSaving || lineId === 0 || isLineLoading}
                        className="flex-1 sm:flex-none rounded-xl px-12 font-black shadow-xl shadow-primary/20 bg-primary h-10 text-[10px] uppercase tracking-widest transition-all active:scale-95"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            isEdit ? "UPDATE" : "CREATE"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
