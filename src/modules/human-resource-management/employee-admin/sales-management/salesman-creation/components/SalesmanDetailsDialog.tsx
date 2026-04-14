"use client";

import type { ReactNode } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    User,
    Truck,
    Building2,
    Clock,
    Tag,
    Barcode,
    MapPin,
    CheckCircle2,
    XCircle,
    Building,
    Briefcase,
} from "lucide-react";
import type { SalesmanWithRelations } from "../types";

interface SalesmanDetailsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    salesman: SalesmanWithRelations | null;
}

function Field({ label, value, icon: Icon }: { label: string; value: ReactNode; icon?: React.ElementType }) {
    return (
        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                {Icon && <Icon className="h-4 w-4" />}
                {label}
            </div>
            <div className="text-sm font-semibold leading-none tracking-tight text-foreground mt-1">
                {value}
            </div>
        </div>
    );
}

function StatusBadge({ active, trueLabel = "Active", falseLabel = "Inactive" }: { active: boolean; trueLabel?: string; falseLabel?: string }) {
    return active ? (
        <Badge variant="default" className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-400">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            {trueLabel}
        </Badge>
    ) : (
        <Badge variant="secondary" className="bg-muted text-muted-foreground hover:bg-muted/80">
            <XCircle className="mr-1 h-3 w-3" />
            {falseLabel}
        </Badge>
    );
}

function ValueOrDash({ value }: { value: ReactNode }) {
    if (value === null || value === undefined || value === "") {
        return <span className="text-muted-foreground/50 font-normal italic">Not specified</span>;
    }

    return <>{value}</>;
}

function formatDateTime(value: string | null | undefined): string | null {
    if (!value) return null;
    const time = Date.parse(value);
    if (Number.isNaN(time)) return value;

    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(time));
}

function formatInventoryDay(value: number | null | undefined): string | null {
    if (value === null || value === undefined) return null;

    const dayMap: Record<number, string> = {
        1: "Sunday",
        2: "Monday",
        3: "Tuesday",
        4: "Wednesday",
        5: "Thursday",
        6: "Friday",
        7: "Saturday",
    };

    return dayMap[value] ?? String(value);
}

export function SalesmanDetailsDialog({
    open,
    onOpenChange,
    salesman,
}: SalesmanDetailsDialogProps) {
    const isActive = (salesman?.isActive ?? 0) === 1;
    const isInventory = (salesman?.isInventory ?? 0) === 1;
    const canCollect = (salesman?.canCollect ?? 0) === 1;
    const formattedModifiedDate = formatDateTime(salesman?.modified_date);
    const formattedInventoryDay = formatInventoryDay(salesman?.inventory_day ?? null);

    const employeeLabel = salesman?.employee
        ? `${salesman.employee.user_fname} ${salesman.employee.user_lname}`
        : salesman?.employee_id
          ? String(salesman.employee_id)
          : null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] p-0 flex flex-col overflow-hidden bg-background max-h-[90vh]">
                <DialogHeader className="px-6 py-5 pb-5 border-b bg-muted/30">
                    <div className="flex items-start justify-between">
                        <div className="space-y-1.5">
                            <DialogTitle className="flex items-center gap-3 text-xl">
                                {salesman?.salesman_name ? (
                                    <span className="font-semibold">{salesman.salesman_name}</span>
                                ) : (
                                    "Salesman Details"
                                )}
                            </DialogTitle>
                            <DialogDescription className="flex flex-wrap items-center gap-3 text-sm">
                                {salesman?.salesman_code && (
                                    <span className="flex items-center font-mono text-muted-foreground">
                                        <Barcode className="mr-1.5 h-3.5 w-3.5" />
                                        {salesman.salesman_code}
                                    </span>
                                )}
                                {salesman && (
                                    <span className="flex gap-2">
                                        <StatusBadge active={isActive} />
                                    </span>
                                )}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1 overflow-y-auto">
                    <div className="px-6 py-6">
                        {!salesman ? (
                            <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center bg-muted/10">
                                <User className="mb-4 h-10 w-10 text-muted-foreground/50" />
                                <h3 className="text-lg font-medium text-foreground">No Salesman Selected</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Please select a salesman to view their detailed information.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-8 pb-4">
                                {/* Highlights Section */}
                                <section>
                                    <h4 className="mb-3 text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
                                        <Tag className="h-4 w-4 text-primary" />
                                        Quick Overview
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="flex flex-col gap-1 rounded-xl bg-primary/5 p-4 border border-primary/10">
                                            <span className="text-xs font-medium text-muted-foreground">Collection</span>
                                            <div className="mt-1">
                                                <StatusBadge active={canCollect} trueLabel="Allowed" falseLabel="No Access" />
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1 rounded-xl bg-blue-500/5 p-4 border border-blue-500/10 dark:bg-blue-500/10">
                                            <span className="text-xs font-medium text-muted-foreground">Inventory</span>
                                            <div className="mt-1">
                                                <StatusBadge active={isInventory} trueLabel="Enabled" falseLabel="Disabled" />
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1 rounded-xl bg-muted/30 p-4 border">
                                            <span className="text-xs font-medium text-muted-foreground">Price Type</span>
                                            <div className="mt-1 font-semibold text-sm">
                                                <ValueOrDash value={salesman.price_type} />
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1 rounded-xl bg-muted/30 p-4 border">
                                            <span className="text-xs font-medium text-muted-foreground">Inventory Day</span>
                                            <div className="mt-1 font-semibold text-sm">
                                                <ValueOrDash value={isInventory ? formattedInventoryDay : null} />
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <Separator className="bg-muted" />

                                {/* Main Details Section */}
                                <section>
                                    <h4 className="mb-3 text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
                                        <Briefcase className="h-4 w-4 text-primary" />
                                        Assignment Details
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <Field
                                            icon={User}
                                            label="Assigned Employee"
                                            value={<ValueOrDash value={employeeLabel} />}
                                        />
                                        <Field
                                            icon={Truck}
                                            label="Truck Plate No."
                                            value={<ValueOrDash value={salesman.truck_plate} />}
                                        />
                                        <Field
                                            icon={Building}
                                            label="Division"
                                            value={<ValueOrDash value={salesman.division?.division_name} />}
                                        />
                                        <Field
                                            icon={Building2}
                                            label="Operation"
                                            value={<ValueOrDash value={salesman.operation_details?.operation_name} />}
                                        />
                                    </div>
                                </section>

                                <Separator className="bg-muted" />

                                {/* Branch Information Section */}
                                <section>
                                    <h4 className="mb-3 text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-primary" />
                                        Branch Information
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <Field
                                            icon={MapPin}
                                            label="Main Branch"
                                            value={<ValueOrDash value={salesman.branch?.branch_name} />}
                                        />
                                        <Field
                                            icon={MapPin}
                                            label="Bad Orders Branch"
                                            value={<ValueOrDash value={salesman.bad_branch?.branch_name} />}
                                        />
                                    </div>
                                </section>

                                {/* Meta Data */}
                                {formattedModifiedDate && (
                                    <div className="flex items-center justify-end text-xs text-muted-foreground pt-2">
                                        <Clock className="mr-1.5 h-3 w-3" />
                                        Last modified on {formattedModifiedDate}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <DialogFooter className="px-6 py-4 border-t bg-muted/10 shadow-[0_-1px_3px_rgba(0,0,0,0.02)] sm:justify-end">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto min-w-[100px]">
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
