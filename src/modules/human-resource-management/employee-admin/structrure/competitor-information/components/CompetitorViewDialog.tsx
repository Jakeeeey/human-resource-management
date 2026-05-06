"use client";

import React from "react";
import { Building2, Clock, Globe, MapPin, User } from "lucide-react";
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

import type { Competitor } from "../types";
import { formatCreatedBy, formatDateTime, toWebsiteHref } from "../utils/formatters";

interface CompetitorViewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    competitor?: Competitor | null;
}

export function CompetitorViewDialog({
    open,
    onOpenChange,
    competitor,
}: CompetitorViewDialogProps) {
    const websiteHref = toWebsiteHref(competitor?.website ?? null);
    const websiteValue = websiteHref ? (
        <a
            href={websiteHref}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
        >
            {competitor?.website || websiteHref}
        </a>
    ) : (
        competitor?.website
    );

    const fields = [
        {
            label: "Competitor Name",
            value: competitor?.name,
            icon: Building2,
        },
        {
            label: "Website",
            value: websiteValue,
            icon: Globe,
        },
        {
            label: "Province",
            value: competitor?.province,
            icon: MapPin,
        },
        {
            label: "City",
            value: competitor?.city,
            icon: MapPin,
        },
        {
            label: "Barangay",
            value: competitor?.barangay,
            icon: MapPin,
        },
        {
            label: "Created at",
            value: formatDateTime(competitor?.created_at ?? null),
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
                                <Building2 className="h-6 w-6 text-primary stroke-[2.5px]" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-bold tracking-tight">
                                    Competitor Information
                                </DialogTitle>
                                <DialogDescription className="text-sm font-medium opacity-70">
                                    Full overview of the selected competitor profile.
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
                                <div key={field.label} className="space-y-2">
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
