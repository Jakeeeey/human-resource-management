"use client";

import React from "react";
import { Briefcase, Clock, FileText, User } from "lucide-react";
import type { EmploymentStatus } from "../types";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

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
    const fields = [
        {
            label: "Status Name",
            value: record?.name,
            icon: Briefcase,
        },
        {
            label: "Description",
            value: record?.description,
            icon: FileText,
            className: "md:col-span-2",
        },
        {
            label: "Created by",
            value: formatUser(record?.created_by),
            icon: User,
        },
        {
            label: "Created at",
            value: formatDateTime(record?.created_at || ""),
            icon: Clock,
        },
        {
            label: "Updated by",
            value: formatUser(record?.updated_by),
            icon: User,
        },
        {
            label: "Updated at",
            value: formatDateTime(record?.updated_at || ""),
            icon: Clock,
        },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-155 overflow-hidden p-0 rounded-2xl border-2 shadow-2xl animate-in fade-in zoom-in-95">
                <div className="bg-linear-to-r from-primary/10 via-background to-primary/5 p-6 pb-4">
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="p-2.5 bg-primary/10 rounded-xl">
                                <Briefcase className="h-6 w-6 text-primary stroke-[2.5px]" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-bold tracking-tight">
                                    Employment Status Information
                                </DialogTitle>
                                <DialogDescription className="text-sm font-medium opacity-70">
                                    Full overview of the selected employment status.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <Separator className="bg-primary/10" />

                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {fields.map((field) => {
                            const Icon = field.icon;
                            const hasValue =
                                field.value !== null &&
                                field.value !== undefined &&
                                field.value !== "";
                            return (
                                <div
                                    key={field.label}
                                    className={`space-y-2 ${field.className ?? ""}`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <Icon className="h-4 w-4 text-primary" />
                                        <p className="font-bold text-sm">{field.label}</p>
                                    </div>
                                    <div className="min-h-11 rounded-xl border-2 bg-muted/30 px-3 py-2 text-sm font-semibold">
                                        <span className="min-w-0 wrap-break-word">
                                            {hasValue ? field.value : "N/A"}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <DialogFooter className="px-6 pb-6">
                    <Button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground h-11 px-8 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all"
                    >
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
