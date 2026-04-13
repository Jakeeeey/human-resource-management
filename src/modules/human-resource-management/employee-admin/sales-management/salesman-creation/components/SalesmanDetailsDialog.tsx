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
import type { SalesmanWithRelations } from "../types";

interface SalesmanDetailsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    salesman: SalesmanWithRelations | null;
}

function Field({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="rounded-lg border bg-muted/10 px-4 py-3">
            <div className="text-xs font-medium text-muted-foreground">{label}</div>
            <div className="mt-1 text-sm leading-6">{value}</div>
        </div>
    );
}

function ValueOrDash({ value }: { value: ReactNode }) {
    if (value === null || value === undefined || value === "") {
        return <span className="text-muted-foreground">-</span>;
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

export function SalesmanDetailsDialog({
    open,
    onOpenChange,
    salesman,
}: SalesmanDetailsDialogProps) {
    const isActive = (salesman?.isActive ?? 0) === 1;
    const isInventory = (salesman?.isInventory ?? 0) === 1;
    const canCollect = (salesman?.canCollect ?? 0) === 1;
    const formattedModifiedDate = formatDateTime(salesman?.modified_date);

    const employeeLabel = salesman?.employee
        ? `${salesman.employee.user_fname} ${salesman.employee.user_lname}`
        : salesman?.employee_id
          ? String(salesman.employee_id)
          : null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[780px] max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex flex-wrap items-center gap-2">
                        <span>Salesman Details</span>
                        {salesman?.salesman_code ? (
                            <Badge variant="outline" className="font-mono">
                                {salesman.salesman_code}
                            </Badge>
                        ) : null}
                        {salesman ? (
                            isActive ? (
                                <Badge variant="default">Active</Badge>
                            ) : (
                                <Badge variant="secondary">Inactive</Badge>
                            )
                        ) : null}
                    </DialogTitle>
                    <DialogDescription>
                        {salesman?.salesman_name ? (
                            <span className="font-medium text-foreground">{salesman.salesman_name}</span>
                        ) : (
                            "View salesman information."
                        )}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 -mx-6 px-6">
                    {!salesman ? (
                        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
                            No salesman selected.
                        </div>
                    ) : (
                        <div className="space-y-4 pb-1">
                            <div className="rounded-lg border bg-muted/10 px-4 py-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary">
                                        Employee: <span className="ml-1 font-medium text-foreground"><ValueOrDash value={employeeLabel} /></span>
                                    </Badge>
                                    <Badge variant="secondary">
                                        Price Type: <span className="ml-1 font-medium text-foreground"><ValueOrDash value={salesman.price_type} /></span>
                                    </Badge>
                                    <Badge variant="secondary">
                                        Inventory: <span className="ml-1 font-medium text-foreground">{isInventory ? "Yes" : "No"}</span>
                                    </Badge>
                                    <Badge variant="secondary">
                                        Can Collect: <span className="ml-1 font-medium text-foreground">{canCollect ? "Yes" : "No"}</span>
                                    </Badge>
                                </div>
                            </div>

                            <Separator />

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field
                                    label="Salesman Code"
                                    value={<ValueOrDash value={salesman.salesman_code} />}
                                />
                                <Field
                                    label="Truck Plate"
                                    value={<ValueOrDash value={salesman.truck_plate} />}
                                />

                                <Field
                                    label="Division"
                                    value={<ValueOrDash value={salesman.division?.division_name} />}
                                />
                                <Field
                                    label="Operation"
                                    value={<ValueOrDash value={salesman.operation_details?.operation_name} />}
                                />

                                <Field
                                    label="Branch"
                                    value={<ValueOrDash value={salesman.branch?.branch_name} />}
                                />
                                <Field
                                    label="Bad Branch"
                                    value={<ValueOrDash value={salesman.bad_branch?.branch_name} />}
                                />

                                <Field
                                    label="Inventory Day"
                                    value={
                                        <ValueOrDash
                                            value={
                                                salesman.inventory_day !== null &&
                                                salesman.inventory_day !== undefined
                                                    ? String(salesman.inventory_day)
                                                    : null
                                            }
                                        />
                                    }
                                />
                                <Field
                                    label="Last Modified"
                                    value={<ValueOrDash value={formattedModifiedDate} />}
                                />
                            </div>
                        </div>
                    )}
                </ScrollArea>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
