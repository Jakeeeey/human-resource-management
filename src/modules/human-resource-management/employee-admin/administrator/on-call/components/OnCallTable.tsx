"use client";

import React from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, RefreshCw, Edit2, Trash2, Calendar, Clock, Users } from "lucide-react";
import { format, parse } from "date-fns";
import { useOnCall } from "../hooks/useOnCall";
import { OnCallDialog } from "./OnCallDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatInManilaTime } from "../../utils/utils";
import type { EnrichedOnCallSchedule } from "../types/on-call.schema";
import type { DepartmentWithRelations, User } from "../../../structrure/department/types";

interface OnCallTableProps {
    departments: DepartmentWithRelations[];
    users: User[];
    isLoadingDeps?: boolean;
}

export function OnCallTable({ departments, users, isLoadingDeps = false }: OnCallTableProps) {
    const { data, isLoading, error, deleteSchedule, refresh } = useOnCall();
    const [selectedSchedule, setSelectedSchedule] = React.useState<EnrichedOnCallSchedule | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [idToDelete, setIdToDelete] = React.useState<number | null>(null);

    const handleEdit = (schedule: EnrichedOnCallSchedule) => {
        setSelectedSchedule(schedule);
        setIsEditDialogOpen(true);
    };

    const confirmDelete = (id: number) => {
        setIdToDelete(id);
        setIsDeleteDialogOpen(true);
    };

    const handleDelete = async () => {
        if (idToDelete) {
            await deleteSchedule(idToDelete);
            setIsDeleteDialogOpen(false);
            setIdToDelete(null);
        }
    };

    const formatTime = (time: string | null) => {
        if (!time) return "--:--";
        try {
            return format(parse(time, "HH:mm:ss", new Date()), "hh:mm a");
        } catch {
            return time;
        }
    };

    // Render body content based on state without early returns,
    // so dialogs remain mounted throughout loading/error cycles.
    const renderBody = () => {
        if (isLoading) {
            return (
                <div className="space-y-3">
                    <Skeleton className="h-[400px] w-full" />
                </div>
            );
        }

        if (error) {
            return (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription className="flex items-center justify-between">
                        <span>{error}</span>
                        <Button variant="outline" size="sm" onClick={() => refresh()}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Retry
                        </Button>
                    </AlertDescription>
                </Alert>
            );
        }

        return (
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead>Department</TableHead>
                            <TableHead>Group</TableHead>
                            <TableHead>Schedule Date</TableHead>
                            <TableHead>Work Hours</TableHead>
                            <TableHead>Workdays</TableHead>
                            <TableHead>Assigned Staff</TableHead>
                            <TableHead>Last Edited By</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center">
                                    No schedules found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.map((item) => (
                                <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{item.department_name}</span>
                                            <span className="text-xs text-muted-foreground italic">ID: {item.department_id as number}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="font-normal capitalize px-3">
                                            {item.group}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="text-sm">
                                                {format(parse(item.schedule_date, "yyyy-MM-dd", new Date()), "MMM dd, yyyy")}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-3.5 w-3.5 text-blue-500" />
                                                <span className="text-sm font-medium">
                                                    {formatTime(item.work_start)} - {formatTime(item.work_end)}
                                                </span>
                                            </div>
                                            {(item.lunch_start || item.lunch_end) && (
                                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                                    <span className="font-semibold uppercase text-[9px] bg-muted px-1 rounded">Lunch:</span>
                                                    <span>{formatTime(item.lunch_start)} - {formatTime(item.lunch_end)}</span>
                                                </div>
                                            )}
                                            {(item.break_start || item.break_end) && (
                                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                                    <span className="font-semibold uppercase text-[9px] bg-muted px-1 rounded">Break:</span>
                                                    <span>{formatTime(item.break_start)} - {formatTime(item.break_end)}</span>
                                                </div>
                                            )}
                                            {item.grace_period !== undefined && (
                                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                                                    <span className="font-semibold uppercase text-[9px] bg-blue-500/10 text-blue-500 px-1 rounded border border-blue-500/20">Grace:</span>
                                                    <span>{item.grace_period} min</span>
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">{item.working_days} days/week</span>
                                            <span className="text-xs text-muted-foreground">{item.workdays || "Not specified"}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5">
                                            <Users className="h-3.5 w-3.5 text-blue-500" />
                                            <span className="text-sm font-medium">{item.assigned_staff.length}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">
                                                {item.last_edited_by?.user_fname} {item.last_edited_by?.user_lname}
                                            </span>
                                            <span className="text-xs text-muted-foreground italic flex items-center gap-1.5 mt-0.5">
                                                <Clock className="h-3.5 w-3.5" />
                                                {formatInManilaTime(item.last_edited_by?.updated_at)}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(item)} className="h-8 w-8 text-muted-foreground hover:text-blue-600">
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => confirmDelete(item.id!)} className="h-8 w-8 text-muted-foreground hover:text-red-600">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        );
    };

    return (
        <>
            {renderBody()}

            {/* Edit dialog is always in the tree when a schedule is selected,
                so it never unmounts mid-refresh and avoids Radix UI re-mount loops */}
            {selectedSchedule && (
                <OnCallDialog
                    open={isEditDialogOpen}
                    onOpenChange={setIsEditDialogOpen}
                    schedule={selectedSchedule}
                    departments={departments}
                    users={users}
                    isLoadingDeps={isLoadingDeps}
                />
            )}

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent className="max-w-md bg-card border-none shadow-2xl p-8 rounded-2xl animate-in fade-in zoom-in-95 duration-300">
                    <AlertDialogHeader className="space-y-4">
                        <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-2">
                             <Trash2 className="h-8 w-8 text-red-600" />
                        </div>
                        <AlertDialogTitle className="text-2xl font-bold text-center">Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription className="text-center text-base">
                            This action cannot be undone. This will permanently delete the on-call schedule for this department and date.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-4 mt-8 pt-6 border-t">
                        <AlertDialogCancel className="w-full sm:w-1/2 h-12 rounded-xl font-semibold border-none hover:bg-muted/50 transition-all">Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleDelete} 
                            className="w-full sm:w-1/2 h-12 rounded-xl font-bold bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/20 transition-all active:scale-95"
                        >
                            Delete Schedule
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </>
    );
}
