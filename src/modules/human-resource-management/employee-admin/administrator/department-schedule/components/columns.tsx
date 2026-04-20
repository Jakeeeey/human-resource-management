/**
 * Department Schedule Table Columns
 * Displays department info with schedule details
 */

"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, MoreHorizontal, Pencil, Trash2, Clock } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DepartmentScheduleWithRelations } from "../types";
import { getUserFullName, formatTimeRange, formatWorkingDays } from "../types";

export const createColumns = (
    onEdit: (schedule: DepartmentScheduleWithRelations) => void,
    onDelete: (schedule: DepartmentScheduleWithRelations) => void
): ColumnDef<DepartmentScheduleWithRelations>[] => [
        {
            accessorKey: "department",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        Department Name
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                const dept = row.original.department;
                return (
                    <div className="font-medium">
                        {dept?.department_name || "Unknown"}
                    </div>
                );
            },
            sortingFn: (rowA, rowB) => {
                const nameA = rowA.original.department?.department_name || "";
                const nameB = rowB.original.department?.department_name || "";
                return nameA.localeCompare(nameB);
            },
        },
        {
            accessorKey: "department_head_user",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        Department Head
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                const user = row.original.department_head_user;
                return <div>{getUserFullName(user)}</div>;
            },
            sortingFn: (rowA, rowB) => {
                const userA = rowA.original.department_head_user;
                const userB = rowB.original.department_head_user;

                const nameA = getUserFullName(userA).toLowerCase();
                const nameB = getUserFullName(userB).toLowerCase();

                return nameA.localeCompare(nameB);
            },
        },
        {
            accessorKey: "working_days",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        Working Days
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                const days = row.getValue("working_days") as number;
                return (
                    <Badge variant="outline">
                        {formatWorkingDays(days)}
                    </Badge>
                );
            },
        },
        {
            id: "work_hours",
            header: "Work Hours",
            cell: ({ row }) => {
                const schedule = row.original;
                return (
                    <div className="text-sm">
                        <Clock className="inline h-3 w-3 mr-1" />
                        {formatTimeRange(schedule.work_start, schedule.work_end)}
                    </div>
                );
            },
        },
        {
            id: "lunch_break",
            header: "Lunch Break",
            cell: ({ row }) => {
                const schedule = row.original;
                return (
                    <div className="text-sm text-muted-foreground">
                        {formatTimeRange(schedule.lunch_start, schedule.lunch_end)}
                    </div>
                );
            },
        },
        {
            id: "coffee_break",
            header: "Coffee Break",
            cell: ({ row }) => {
                const schedule = row.original;
                return (
                    <div className="text-sm text-muted-foreground">
                        {formatTimeRange(schedule.break_start, schedule.break_end)}
                    </div>
                );
            },
        },
        {
            accessorKey: "grace_period",
            header: "Grace Period",
            cell: ({ row }) => {
                const gp = row.getValue("grace_period") as number;
                return <div className="text-sm">{gp} min</div>;
            },
        },
        {
            accessorKey: "workdays_note",
            header: "Notes",
            cell: ({ row }) => {
                const note = row.getValue("workdays_note") as string | null;
                return (
                    <div className="max-w-[200px] text-sm text-muted-foreground truncate">
                        {note || "-"}
                    </div>
                );
            },
        },
        {
            accessorKey: "created_at",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        Created At
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                const dateString = row.getValue("created_at") as string;
                const date = new Date(dateString);
                return (
                    <div className="text-sm">
                        {date.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                        })}
                    </div>
                );
            },
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const schedule = row.original;

                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem
                                onClick={() =>
                                    navigator.clipboard.writeText(
                                        schedule.schedule_id.toString()
                                    )
                                }
                            >
                                Copy schedule ID
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onEdit(schedule)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit schedule
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => onDelete(schedule)}
                                className="text-red-600"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete schedule
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];
