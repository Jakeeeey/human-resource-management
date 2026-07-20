"use client";

import React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Plus,
    Edit2,
    Trash2,
    Factory,
    Target,
    Clock,
    Users,
    UserCircle,
} from "lucide-react";
import type { ManufacturingLine, LinePosition, PositionFormValues } from "../types";
import { PositionDialog } from "./PositionDialog";

interface PositionManagementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    line: ManufacturingLine | null;
    positions: LinePosition[];
    isLoading: boolean;
    onAddPosition: () => void;
    onEditPosition: (position: LinePosition) => void;
    onDeletePosition: (position: LinePosition) => void;
    onSubmitPosition: (data: PositionFormValues) => Promise<boolean>;
    isPositionDialogOpen: boolean;
    setIsPositionDialogOpen: (open: boolean) => void;
    selectedPosition: LinePosition | null;
}

export function PositionManagementDialog({
    open,
    onOpenChange,
    line,
    positions,
    isLoading,
    onAddPosition,
    onEditPosition,
    onDeletePosition,
    onSubmitPosition,
    isPositionDialogOpen,
    setIsPositionDialogOpen,
    selectedPosition,
}: PositionManagementDialogProps) {
    if (!line) return null;

    const totalPersons = positions.reduce((sum, p) => sum + p.persons_allowed, 0);

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent showCloseButton={false} className="p-0 sm:max-w-[700px] overflow-hidden rounded-2xl border shadow-2xl flex flex-col bg-background/95 backdrop-blur-sm max-h-[85vh]">
                    <DialogHeader className="p-6 pb-4 border-b bg-muted/20 relative">
                        <div className="flex items-center gap-4">
                            <div className="bg-primary/10 p-3 rounded-2xl shadow-inner ring-1 ring-primary/20">
                                <Users className="h-6 w-6 text-primary" />
                            </div>
                            <div className="space-y-0.5 flex-1 min-w-0">
                                <DialogTitle className="text-xl font-black tracking-tighter text-foreground leading-none truncate">
                                    Position Management
                                </DialogTitle>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-60 truncate">
                                    {line.line_name}
                                </p>
                            </div>
                        </div>

                        {/* Line Summary Stats */}
                        <div className="grid grid-cols-3 gap-3 mt-4">
                            <div className="bg-card/80 rounded-xl border border-muted-foreground/5 p-3 space-y-1">
                                <div className="flex items-center gap-1.5">
                                    <Factory className="h-3 w-3 text-primary/60" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Line</span>
                                </div>
                                <p className="text-sm font-black text-foreground truncate">{line.line_name}</p>
                            </div>
                            <div className="bg-card/80 rounded-xl border border-emerald-500/10 p-3 space-y-1">
                                <div className="flex items-center gap-1.5">
                                    <Target className="h-3 w-3 text-emerald-600/60" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">8-Hr Target</span>
                                </div>
                                <p className="text-sm font-black text-emerald-700 tabular-nums">{line.target_produce_8_hrs.toLocaleString()} pcs</p>
                            </div>
                            <div className="bg-card/80 rounded-xl border border-amber-500/10 p-3 space-y-1">
                                <div className="flex items-center gap-1.5">
                                    <Clock className="h-3 w-3 text-amber-600/60" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">OT / Hr</span>
                                </div>
                                <p className="text-sm font-black text-amber-700 tabular-nums">{line.overtime_target_per_hr.toLocaleString()} pcs</p>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="px-6 pt-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                                {positions.length} position(s)
                            </span>
                            <span className="text-[9px] font-bold text-muted-foreground/40">•</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600/60">
                                {totalPersons} total personnel
                            </span>
                        </div>
                        <Button
                            onClick={onAddPosition}
                            size="sm"
                            className="h-8 rounded-xl px-4 font-black shadow-lg shadow-primary/15 bg-primary text-[9px] uppercase tracking-widest transition-all active:scale-95 gap-1.5"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Add Position
                        </Button>
                    </div>

                    <ScrollArea className="flex-1 min-h-0 px-6 pb-6 pt-3">
                        {isLoading ? (
                            <div className="space-y-3">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-muted-foreground/5">
                                        <div className="h-9 w-9 rounded-lg bg-muted/20 animate-pulse" />
                                        <div className="flex-1 space-y-2">
                                            <div className="h-3.5 w-36 bg-muted/20 rounded animate-pulse" />
                                            <div className="h-3 w-24 bg-muted/10 rounded animate-pulse" />
                                        </div>
                                        <div className="h-3.5 w-12 bg-muted/15 rounded animate-pulse" />
                                    </div>
                                ))}
                            </div>
                        ) : positions.length > 0 ? (
                            <div className="rounded-xl border bg-card overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted/10">
                                        <TableRow className="hover:bg-transparent border-b-muted-foreground/5">
                                            <TableHead className="h-9 px-4 text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground/70">Position</TableHead>
                                            <TableHead className="h-9 px-4 text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground/70">Persons Allowed</TableHead>
                                            <TableHead className="h-9 px-4 text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground/70">Hourly Rate</TableHead>
                                            <TableHead className="h-9 px-4 text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground/70 text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {positions.map((position) => (
                                            <TableRow key={position.id} className="group">
                                                <TableCell className="py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-blue-500/5 p-1.5 rounded-lg border border-blue-500/10">
                                                            <UserCircle className="h-3.5 w-3.5 text-blue-600" />
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="font-black text-xs tracking-tight text-foreground truncate">
                                                                {position.position_name}
                                                            </span>
                                                            <span className="text-[9px] text-muted-foreground font-medium truncate opacity-70">
                                                                {position.description || "No description"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-3">
                                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-blue-500/15 bg-blue-500/5">
                                                        <Users className="h-3 w-3 text-blue-600" />
                                                        <span className="text-[10px] font-black text-blue-700 tabular-nums">
                                                            {position.persons_allowed}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-3">
                                                    <span className="text-xs font-black text-foreground tabular-nums">
                                                        ₱{Number(position.position_rate || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            title="Edit Position"
                                                            onClick={() => onEditPosition(position)}
                                                            className="h-7 w-7 rounded-lg text-muted-foreground hover:bg-muted active:scale-90 transition-all"
                                                        >
                                                            <Edit2 className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            title="Delete Position"
                                                            onClick={() => onDeletePosition(position)}
                                                            className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10 active:scale-90 transition-all"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="bg-muted/10 p-4 rounded-2xl border border-dashed border-muted-foreground/10 mb-4">
                                    <Users className="h-8 w-8 text-muted-foreground/30" />
                                </div>
                                <p className="text-xs font-black text-muted-foreground/50 uppercase tracking-widest">
                                    No positions configured
                                </p>
                                <p className="text-[10px] text-muted-foreground/40 mt-1">
                                    Click &quot;Add Position&quot; to get started
                                </p>
                            </div>
                        )}
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            {/* Nested Position Add/Edit Dialog */}
            <PositionDialog
                open={isPositionDialogOpen}
                onOpenChange={setIsPositionDialogOpen}
                onSubmit={onSubmitPosition}
                position={selectedPosition}
            />
        </>
    );
}
