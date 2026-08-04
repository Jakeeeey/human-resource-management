"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ScanFace } from "lucide-react";
import type { User, Department } from "../types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const createColumns = (
    onScanFace: (employee: User & { hasFaceBiometric?: boolean }) => void,
    departments: Department[] = []
): ColumnDef<User & { hasFaceBiometric?: boolean }>[] => [
    {
        accessorKey: "full_name",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="hover:bg-primary/10 -ml-4 rounded-xl font-semibold transition-colors"
                >
                    Employee
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            const user = row.original;
            const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`;
            return (
                <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10 ring-2 ring-primary/10 transition-all hover:ring-primary/30">
                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${initials}`} />
                        <AvatarFallback className="bg-primary/5 text-primary font-medium">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="font-semibold text-foreground tracking-tight">
                            {user.firstName} {user.lastName}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium truncate max-w-[200px]">
                            {user.email || "No email"}
                        </span>
                    </div>
                </div>
            );
        },
        filterFn: (row, id, filterValue) => {
            const name = `${row.original.firstName} ${row.original.lastName}`.toLowerCase();
            return name.includes((filterValue as string).toLowerCase());
        },
    },
    {
        accessorKey: "department",
        header: "Department",
        cell: ({ row }) => {
            const deptId = row.original.department;
            const deptName = departments.find(d => d.department_id.toString() === deptId?.toString())?.department_name || deptId || "Unassigned";
            return (
                <div className="flex flex-col gap-1">
                    <span className="font-medium text-foreground">{deptName}</span>
                    <span className="text-xs text-muted-foreground">{row.original.position || "No position"}</span>
                </div>
            );
        },
        filterFn: (row, id, value) => {
            if (!value || value === "all") return true;
            return row.original.department?.toString() === value.toString();
        },
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const isRegistered = !!row.original.hasFaceBiometric;
            return (
                <div className="flex items-center">
                    <div className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 ${
                        isRegistered ? "bg-green-500/10 text-green-600 border border-green-500/20" : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                    }`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${isRegistered ? "bg-green-500" : "bg-amber-500"}`} />
                        {isRegistered ? "Registered" : "Pending"}
                    </div>
                </div>
            );
        },
        filterFn: (row, id, value) => {
            if (!value || value === "all") return true;
            const isRegistered = !!row.original.hasFaceBiometric;
            const matchValue = value === "registered" ? true : false;
            return isRegistered === matchValue;
        },
    },
    {
        id: "actions",
        header: "Action",
        cell: ({ row }) => {
            const user = row.original;
            const isRegistered = !!row.original.hasFaceBiometric;
            return (
                <div className="flex items-center gap-2">
                    <Button 
                        variant={isRegistered ? "outline" : "default"} 
                        size="sm" 
                        onClick={() => onScanFace(user)}
                        className={isRegistered ? "hover:bg-primary/5 hover:text-primary border-primary/20" : "bg-primary text-primary-foreground hover:bg-primary/90"}
                    >
                        <ScanFace className="mr-2 h-4 w-4" />
                        {isRegistered ? "Retake Face" : "Scan Face"}
                    </Button>
                </div>
            );
        },
    },
];
