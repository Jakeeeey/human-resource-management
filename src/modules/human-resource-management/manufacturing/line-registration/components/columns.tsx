"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, Users, Factory, Target, Clock } from "lucide-react";
import type { ManufacturingLine } from "../types";

export const createColumns = (
    onEdit: (line: ManufacturingLine) => void,
    onDelete: (line: ManufacturingLine) => void,
    onManagePositions: (line: ManufacturingLine) => void
): ColumnDef<ManufacturingLine>[] => [
    {
        accessorKey: "line_name",
        header: "Production Line",
        cell: ({ row }) => (
            <div className="flex items-center gap-3.5 py-1.5">
                <div className="bg-primary/5 p-2.5 rounded-xl border border-primary/10 shadow-sm transition-all group-hover:scale-105">
                    <Factory className="h-4.5 w-4.5 text-primary" />
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="font-extrabold text-[13px] sm:text-[14px] tracking-tight text-foreground truncate">
                        {row.original.line_name}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-semibold truncate opacity-80 mt-0.5 max-w-[280px]">
                        {row.original.description || "No operational description provided"}
                    </span>
                </div>
            </div>
        ),
    },
    {
        accessorKey: "target_produce_8_hrs",
        header: "8-Hr Target",
        cell: ({ row }) => (
            <div className="flex items-center gap-2.5">
                <div className="bg-emerald-500/5 p-2 rounded-xl border border-emerald-500/10">
                    <Target className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex flex-col">
                    <span className="font-black text-sm text-foreground tabular-nums tracking-tight">
                        {row.original.target_produce_8_hrs.toLocaleString()}
                    </span>
                    <span className="text-[9px] text-emerald-600/80 font-black uppercase tracking-wider mt-0.5">
                        standard pcs
                    </span>
                </div>
            </div>
        ),
    },
    {
        accessorKey: "overtime_target_per_hr",
        header: "OT Target / Hr",
        cell: ({ row }) => (
            <div className="flex items-center gap-2.5">
                <div className="bg-amber-500/5 p-2 rounded-xl border border-amber-500/10">
                    <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <div className="flex flex-col">
                    <span className="font-black text-sm text-foreground tabular-nums tracking-tight">
                        {row.original.overtime_target_per_hr.toLocaleString()}
                    </span>
                    <span className="text-[9px] text-amber-600/80 font-black uppercase tracking-wider mt-0.5">
                        pcs / hr target
                    </span>
                </div>
            </div>
        ),
    },
    {
        id: "actions",
        header: "Controls",
        cell: ({ row }) => (
            <div className="flex items-center gap-1.5">
                <Button
                    variant="ghost"
                    size="icon"
                    title="Manage Positions"
                    onClick={() => onManagePositions(row.original)}
                    className="h-8.5 w-8.5 rounded-xl text-primary hover:bg-primary/10 active:scale-90 transition-all border border-transparent hover:border-primary/10 shadow-sm hover:shadow"
                >
                    <Users className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    title="Edit Line"
                    onClick={() => onEdit(row.original)}
                    className="h-8.5 w-8.5 rounded-xl text-muted-foreground hover:bg-muted active:scale-90 transition-all border border-transparent hover:border-muted-foreground/10"
                >
                    <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    title="Delete Line"
                    onClick={() => onDelete(row.original)}
                    className="h-8.5 w-8.5 rounded-xl text-destructive hover:bg-destructive/10 active:scale-90 transition-all border border-transparent hover:border-destructive/10"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
        ),
    },
];
