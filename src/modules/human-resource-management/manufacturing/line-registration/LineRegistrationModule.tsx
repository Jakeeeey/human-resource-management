"use client";

import React from "react";
import { LineRegistrationFetchProvider } from "./providers/fetchProvider";
import { useLineRegistration } from "./hooks/useLineRegistration";
import { LineRegistrationTable } from "./components/LineRegistrationTable";
import { LineDialog } from "./components/LineDialog";
import { PositionManagementDialog } from "./components/PositionManagementDialog";
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
import { Loader2 } from "lucide-react";
import type { ManufacturingLine, LinePosition } from "./types";

const LineRegistrationContent = () => {
    const {
        // Lines
        lines,
        isLoading,
        isLineDialogOpen,
        setIsLineDialogOpen,
        selectedLine,
        handleAddLine,
        handleEditLine,
        handleRequestDeleteLine,
        handleSubmitLine,

        // Position management
        isPositionMgmtOpen,
        setIsPositionMgmtOpen,
        managedLine,
        positions,
        isPositionsLoading,
        handleManagePositions,

        // Position dialog
        isPositionDialogOpen,
        setIsPositionDialogOpen,
        selectedPosition,
        handleAddPosition,
        handleEditPosition,
        handleRequestDeletePosition,
        handleSubmitPosition,

        // Delete confirmation
        isDeleteOpen,
        setIsDeleteOpen,
        deleteTarget,
        isDeleting,
        handleConfirmDelete,
    } = useLineRegistration();

    const deleteLabel = deleteTarget
        ? deleteTarget.type === "line"
            ? (deleteTarget.item as ManufacturingLine).line_name
            : (deleteTarget.item as LinePosition).position_name
        : "";

    // Calculate simple stats summary in-memory for the dashboard cards
    const totalLines = lines.length;
    const total8HrTargets = lines.reduce((sum, line) => sum + (line.target_produce_8_hrs || 0), 0);
    const averageOTTarget = totalLines > 0 
        ? Math.round(lines.reduce((sum, line) => sum + (line.overtime_target_per_hr || 0), 0) / totalLines) 
        : 0;

    return (
        <div className="flex-1 space-y-8 p-6 pt-8 h-full overflow-auto bg-gradient-to-br from-background via-background/95 to-primary/[0.03]">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1.5">
                    <h2 className="text-3xl font-black tracking-tight text-foreground leading-tight bg-gradient-to-r from-foreground via-foreground/90 to-primary/80 bg-clip-text text-transparent">
                        Line Registration
                    </h2>
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.25em] opacity-80 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                        Manufacturing Production Line Registry
                    </p>
                </div>
            </div>

            {/* Premium Stat Summary Dashboard */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="relative overflow-hidden rounded-2xl border bg-card/60 backdrop-blur-md p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/10 group">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-foreground group-hover:scale-110 transition-transform">
                        <svg className="h-24 w-24" fill="currentColor" viewBox="0 0 24 24"><path d="M4 19h16v2H4v-2zm16-2H4V3h16v14zM6 5v10h12V5H6z"/></svg>
                    </div>
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/70">
                            Active Lines
                        </p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black tracking-tight tabular-nums">
                                {totalLines}
                            </span>
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                ONLINE
                            </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-medium">
                            Configured production routing nodes
                        </p>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border bg-card/60 backdrop-blur-md p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/10 group">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-foreground group-hover:scale-110 transition-transform">
                        <svg className="h-24 w-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.25z"/></svg>
                    </div>
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/70">
                            Combined Shift Output Target
                        </p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black tracking-tight tabular-nums">
                                {total8HrTargets.toLocaleString()}
                            </span>
                            <span className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest">
                                units
                            </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-medium">
                            Based on standard 8-hour production schedule
                        </p>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border bg-card/60 backdrop-blur-md p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/10 group">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-foreground group-hover:scale-110 transition-transform">
                        <svg className="h-24 w-24" fill="currentColor" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 2 22 6.48 22 12s-4.48-10-10.01-10zm.01 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/></svg>
                    </div>
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/70">
                            Avg Overtime Rate
                        </p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black tracking-tight tabular-nums">
                                {averageOTTarget.toLocaleString()}
                            </span>
                            <span className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest">
                                units / hr
                            </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-medium">
                            Overall mean output target during OT hours
                        </p>
                    </div>
                </div>
            </div>

            <LineRegistrationTable
                data={lines}
                onAdd={handleAddLine}
                onEdit={handleEditLine}
                onDelete={handleRequestDeleteLine}
                onManagePositions={handleManagePositions}
                isLoading={isLoading}
            />

            <LineDialog
                open={isLineDialogOpen}
                onOpenChange={setIsLineDialogOpen}
                onSubmit={handleSubmitLine}
                line={selectedLine}
            />

            <PositionManagementDialog
                open={isPositionMgmtOpen}
                onOpenChange={setIsPositionMgmtOpen}
                line={managedLine}
                positions={positions}
                isLoading={isPositionsLoading}
                onAddPosition={handleAddPosition}
                onEditPosition={handleEditPosition}
                onDeletePosition={handleRequestDeletePosition}
                onSubmitPosition={handleSubmitPosition}
                isPositionDialogOpen={isPositionDialogOpen}
                setIsPositionDialogOpen={setIsPositionDialogOpen}
                selectedPosition={selectedPosition}
            />

            {/* Unified Delete Confirmation — AlertDialog (no browser confirm) */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent className="rounded-2xl border shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-lg font-black tracking-tight">
                            Confirm Deletion
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-muted-foreground">
                            Are you sure you want to delete{" "}
                            <span className="font-black text-foreground">&quot;{deleteLabel}&quot;</span>?
                            {deleteTarget?.type === "line" && (
                                <span className="block mt-1 text-[11px] text-destructive/80 font-bold">
                                    All positions assigned to this line will also be permanently removed.
                                </span>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            className="rounded-xl font-black text-[10px] uppercase tracking-widest"
                            disabled={isDeleting}
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            disabled={isDeleting}
                            className="rounded-xl font-black text-[10px] uppercase tracking-widest bg-destructive hover:bg-destructive/90 shadow-lg shadow-destructive/20"
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
        </div>
    );
};

export const LineRegistrationModule = () => {
    return (
        <LineRegistrationFetchProvider>
            <LineRegistrationContent />
        </LineRegistrationFetchProvider>
    );
};
