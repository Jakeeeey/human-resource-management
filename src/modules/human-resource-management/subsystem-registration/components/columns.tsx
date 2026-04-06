"use client";

import { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Edit2, Trash2, Layers, Box, LucideIcon } from "lucide-react";
import * as Icons from "lucide-react";
import { SubsystemRegistration } from "../types";
import { cn } from "@/lib/utils";

export const createColumns = (
    onEdit: (subsystem: SubsystemRegistration) => void,
    onDelete: (subsystem: SubsystemRegistration) => void,
    onManageHierarchy: (subsystem: SubsystemRegistration) => void
): ColumnDef<SubsystemRegistration>[] => [
    {
        accessorKey: "slug",
        header: "Slug Identifier",
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/20" />
                <span className="font-mono text-[10px] font-bold tracking-tighter text-muted-foreground/80">{row.original.slug}</span>
            </div>
        ),
    },
    {
        accessorKey: "title",
        header: "Subsystem Registry",
        cell: ({ row }) => {
            const iconName = row.original.icon_name as keyof typeof Icons;
            const Icon = (Icons[iconName] as LucideIcon) || Box;
            
            return (
                <div className="flex items-center gap-3 py-1">
                    <div className="bg-primary/5 p-2 rounded-xl border border-primary/10 shadow-sm">
                        <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="font-black text-sm tracking-tight text-foreground truncate">{row.original.title}</span>
                        <span className="text-[10px] text-muted-foreground font-medium truncate opacity-70">
                            {row.original.subtitle || "No description provided"}
                        </span>
                    </div>
                </div>
            );
        },
    },
    {
        accessorKey: "base_path",
        header: "Internal Path",
        cell: ({ row }) => (
            <code className="text-[10px] font-black px-2 py-0.5 rounded-md bg-muted/30 text-primary/70 border border-primary/5">
                {row.original.base_path}
            </code>
        ),
    },
    {
        accessorKey: "category",
        header: "Classification",
        cell: ({ row }) => (
            <span className="text-[11px] font-bold text-muted-foreground/80">{row.original.category}</span>
        ),
    },
    {
        accessorKey: "status",
        header: "Lifecycle",
        cell: ({ row }) => {
            const status = row.original.status;
            return (
                <div className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-wider",
                    status === 'active' 
                        ? "bg-green-500/5 text-green-600 border-green-500/20" 
                        : "bg-orange-500/5 text-orange-600 border-orange-500/20"
                )}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", status === 'active' ? "bg-green-600" : "bg-orange-600")} />
                    {status === 'active' ? 'ACTIVE' : 'SOON'}
                </div>
            );
        },
    },
    {
        id: "actions",
        header: "Architectural Controls",
        cell: ({ row }) => (
            <div className="flex items-center gap-1">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    title="Manage Hierarchy" 
                    onClick={() => onManageHierarchy(row.original)}
                    className="h-8 w-8 rounded-xl text-primary hover:bg-primary/10 active:scale-90 transition-all"
                >
                    <Layers className="h-4 w-4" />
                </Button>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    title="Edit Properties" 
                    onClick={() => onEdit(row.original)}
                    className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-muted active:scale-90 transition-all"
                >
                    <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    title="Deprioritize Node" 
                    onClick={() => onDelete(row.original)} 
                    className="h-8 w-8 rounded-xl text-destructive hover:bg-destructive/10 active:scale-90 transition-all"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
        ),
    },
];
