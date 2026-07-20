"use client";

import React from "react";
import { SchedulingFetchProvider } from "./providers/fetchProvider";
import { useScheduling } from "./hooks/useScheduling";
import { SchedulingTable } from "./components/SchedulingTable";
import { ScheduleDialog } from "./components/ScheduleDialog";
import { ScheduleAttachmentsDialog } from "./components/ScheduleAttachmentsDialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, ShieldAlert, Target, Award, ListTodo, Plus } from "lucide-react";

const ProductionSchedulingContent = () => {
    const {
        schedules,
        lines,
        isLoading,
        isDialogOpen,
        setIsDialogOpen,
        selectedSchedule,
        isDeleteOpen,
        setIsDeleteOpen,
        isDeleting,
        isAttachmentsOpen,
        setIsAttachmentsOpen,
        attachmentsSchedule,
        handleAdd,
        handleEdit,
        handleRequestDelete,
        handleAttachments,
        handleConfirmDelete,
        handleSubmit,
    } = useScheduling();

    // ─── Stat Dashboard Calculations ───────────────────────────────
    const totalSchedules = schedules.length;
    
    // Count schedules that require target approval or position headcount approval
    const targetPendingCount = schedules.filter((s) => {
        const status = s.approval_status || s.target_approval_status;
        if (status !== "PENDING_APPROVAL") return false;
        return s.daily_target < (s.line?.target_produce_8_hrs || 0);
    }).length;

    const headcountPendingCount = schedules.reduce((acc, s) => {
        const status = s.approval_status || s.target_approval_status;
        if (status !== "PENDING_APPROVAL") return acc;
        const positions = s.positions || s.manu_hr_schedule_positions || [];
        const pendingPositions = positions.filter(
            (p) => p.assigned_persons > (p.position?.persons_allowed || 0)
        );
        return acc + pendingPositions.length;
    }, 0);

    const pendingApprovalsCount = targetPendingCount + headcountPendingCount;

    const totalActualProduce = schedules.reduce((sum, s) => sum + (s.actual_produce || 0), 0);

    return (
        <div className="flex-1 space-y-8 p-6 pt-8 h-full overflow-auto bg-gradient-to-br from-background via-background/95 to-primary/[0.03]">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1.5">
                    <h2 className="text-3xl font-black tracking-tight text-foreground leading-tight bg-gradient-to-r from-foreground via-foreground/90 to-primary/80 bg-clip-text text-transparent">
                        Production Scheduling
                    </h2>
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.25em] opacity-80 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Line assignment & daily target approval control
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        onClick={handleAdd}
                        className="h-11 rounded-2xl bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-black uppercase tracking-wider gap-2 px-5 shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
                    >
                        <Plus className="h-4 w-4" /> Add Schedule
                    </Button>
                </div>
            </div>

            {/* Premium Stat Summary Dashboard */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="relative overflow-hidden rounded-2xl border bg-card/60 backdrop-blur-md p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/10 group">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-foreground group-hover:scale-110 transition-transform">
                        <Calendar className="h-24 w-24" />
                    </div>
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/70 flex items-center gap-1.5">
                            <ListTodo className="h-3 w-3 text-primary" /> Total Schedules
                        </p>
                        <span className="text-3xl font-black tracking-tight tabular-nums block">
                            {totalSchedules}
                        </span>
                        <p className="text-[10px] text-muted-foreground font-medium">
                            Total registered production runs
                        </p>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border bg-card/60 backdrop-blur-md p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/10 group">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-foreground group-hover:scale-110 transition-transform">
                        <ShieldAlert className="h-24 w-24" />
                    </div>
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/70 flex items-center gap-1.5">
                            <ShieldAlert className="h-3 w-3 text-amber-500 animate-bounce" /> Pending Approvals
                        </p>
                        <span className="text-3xl font-black tracking-tight tabular-nums block text-amber-500">
                            {pendingApprovalsCount}
                        </span>
                        <p className="text-[10px] text-muted-foreground font-medium">
                            Schedules waiting manager override
                        </p>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border bg-card/60 backdrop-blur-md p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/10 group">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-foreground group-hover:scale-110 transition-transform">
                        <Award className="h-24 w-24" />
                    </div>
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/70 flex items-center gap-1.5">
                            <Target className="h-3 w-3 text-emerald-500" /> Total Actual Output
                        </p>
                        <span className="text-3xl font-black tracking-tight tabular-nums block text-emerald-600">
                            {totalActualProduce.toLocaleString()}
                        </span>
                        <p className="text-[10px] text-muted-foreground font-medium">
                            Total units manufactured to date
                        </p>
                    </div>
                </div>
            </div>

            <SchedulingTable
                data={schedules}
                onEdit={handleEdit}
                onDelete={handleRequestDelete}
                onAdd={handleAdd}
                onAttachments={handleAttachments}
                isLoading={isLoading}
            />

            {/* Form Dialog */}
            <ScheduleDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                schedule={selectedSchedule}
                onSubmit={handleSubmit}
                lines={lines}
                schedules={schedules}
            />

            {/* Confirm Delete Dialog */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent className="rounded-2xl max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-base font-black uppercase tracking-wider">
                            Confirm Deletion
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-xs font-semibold text-muted-foreground leading-relaxed">
                            Are you absolutely sure you want to delete this schedule run? This action is permanent and cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-3 gap-2">
                        <AlertDialogCancel className="h-10 rounded-xl text-xs font-black uppercase tracking-wider border-muted-foreground/10 hover:bg-muted/5">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            disabled={isDeleting}
                            className="h-10 rounded-xl text-xs font-black uppercase tracking-wider bg-destructive hover:bg-destructive/95 text-destructive-foreground"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                "Delete"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <ScheduleAttachmentsDialog
                open={isAttachmentsOpen}
                onOpenChange={setIsAttachmentsOpen}
                schedule={attachmentsSchedule}
            />
        </div>
    );
};

export const ProductionSchedulingModule = () => {
    return (
        <SchedulingFetchProvider>
            <ProductionSchedulingContent />
        </SchedulingFetchProvider>
    );
};
