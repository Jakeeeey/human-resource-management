"use client";

import React from "react";
import type { EmploymentStatus } from "../types";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function pickString(obj: Record<string, unknown>, keys: string[]): string {
    for (const k of keys) {
        const v = obj[k];
        if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
}

function formatUser(value: unknown): string {
    if (!value) return "-";

    if (typeof value === "string" || typeof value === "number") {
        return String(value);
    }

    if (typeof value === "object") {
        const obj = value as Record<string, unknown>;
        const directName = pickString(obj, [
            "name",
            "full_name",
            "display_name",
            "user_name",
            "username",
        ]);
        if (directName) return directName;

        const first = pickString(obj, [
            "Firstname",
            "FirstName",
            "firstName",
            "firstname",
            "first_name",
            "user_fname",
            "user_firstname",
            "user_first_name",
            "user_first",
        ]);
        const last = pickString(obj, [
            "LastName",
            "Lastname",
            "lastName",
            "lastname",
            "last_name",
            "user_lname",
            "user_lastname",
            "user_last_name",
            "user_last",
        ]);
        const email = pickString(obj, ["email", "Email", "user_email"]);
        const name = [first, last].filter(Boolean).join(" ");
        if (name) return name;
        if (email) return email;
        if (typeof obj.user_id === "string" || typeof obj.user_id === "number") {
            return String(obj.user_id);
        }
        if (typeof obj.id === "string" || typeof obj.id === "number") {
            return String(obj.id);
        }
    }

    return "-";
}

function formatDateTime(value: string): string {
    if (!value) return "-";
    try {
        return new Date(value).toLocaleString("en-US", {
            timeZone: "UTC",
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return value;
    }
}

interface EmploymentStatusRegistrationViewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    record: EmploymentStatus | null;
}

export function EmploymentStatusRegistrationViewDialog({
    open,
    onOpenChange,
    record,
}: EmploymentStatusRegistrationViewDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-120">
                <DialogHeader>
                    <DialogTitle>Employment Status Details</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <div className="text-sm text-muted-foreground">Name</div>
                        <div className="font-medium">{record?.name || "-"}</div>
                    </div>

                    <div>
                        <div className="text-sm text-muted-foreground">Description</div>
                        <div className="whitespace-pre-wrap text-sm">
                            {record?.description || "-"}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <div className="text-sm text-muted-foreground">Created By</div>
                            <div className="text-sm">
                                {formatUser(record?.created_by)}
                            </div>
                        </div>
                        <div>
                            <div className="text-sm text-muted-foreground">Created At</div>
                            <div className="text-sm">
                                {formatDateTime(record?.created_at || "")}
                            </div>
                        </div>
                        <div>
                            <div className="text-sm text-muted-foreground">Updated By</div>
                            <div className="text-sm">
                                {formatUser(record?.updated_by)}
                            </div>
                        </div>
                        <div>
                            <div className="text-sm text-muted-foreground">Updated At</div>
                            <div className="text-sm">
                                {formatDateTime(record?.updated_at || "")}
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
