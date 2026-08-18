import React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { EmployeeType } from "../types";

interface EmployeeTypeViewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    record?: EmployeeType | null;
}

export function EmployeeTypeViewDialog({
    open,
    onOpenChange,
    record,
}: EmployeeTypeViewDialogProps) {
    if (!record) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>View Employee Type</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-3 items-start gap-4">
                        <div className="font-semibold text-sm">ID</div>
                        <div className="col-span-2 text-sm">{record.id}</div>
                    </div>
                    <div className="grid grid-cols-3 items-start gap-4">
                        <div className="font-semibold text-sm">Type Name</div>
                        <div className="col-span-2 text-sm">{record.type_name}</div>
                    </div>
                    <div className="grid grid-cols-3 items-start gap-4">
                        <div className="font-semibold text-sm">Description</div>
                        <div className="col-span-2 text-sm break-words">{record.description || "N/A"}</div>
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
