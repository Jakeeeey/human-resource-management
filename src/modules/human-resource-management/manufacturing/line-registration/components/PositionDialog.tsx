"use client";

import React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, UserCircle, Users } from "lucide-react";
import type { LinePosition, PositionFormValues } from "../types";
import { positionFormSchema } from "../types";

interface PositionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: PositionFormValues) => Promise<boolean>;
    position?: LinePosition | null;
}

export function PositionDialog({
    open,
    onOpenChange,
    onSubmit,
    position,
}: PositionDialogProps) {
    const isEdit = !!position;
    const [isSaving, setIsSaving] = React.useState(false);
    const [errors, setErrors] = React.useState<Record<string, string>>({});

    const [formData, setFormData] = React.useState({
        position_name: "",
        description: "",
        persons_allowed: 1,
        position_rate: 0.00,
    });

    React.useEffect(() => {
        if (position) {
            setFormData({
                position_name: position.position_name,
                description: position.description || "",
                persons_allowed: position.persons_allowed,
                position_rate: Number(position.position_rate) || 0.00,
            });
        } else {
            setFormData({
                position_name: "",
                description: "",
                persons_allowed: 1,
                position_rate: 0.00,
            });
        }
        setErrors({});
    }, [position, open]);

    const handleChange = (field: string, value: string | number) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    };

    const handleAction = async () => {
        const result = positionFormSchema.safeParse({
            ...formData,
            persons_allowed: Number(formData.persons_allowed),
            position_rate: Number(formData.position_rate),
        });

        if (!result.success) {
            const fieldErrors: Record<string, string> = {};
            result.error.issues.forEach((err) => {
                const field = err.path[0] as string;
                if (!fieldErrors[field]) fieldErrors[field] = err.message;
            });
            setErrors(fieldErrors);
            return;
        }

        setIsSaving(true);
        try {
            const success = await onSubmit(result.data);
            if (success) {
                onOpenChange(false);
            }
        } catch (error) {
            console.error("Submission failed:", error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={false} className="p-0 sm:max-w-[480px] overflow-hidden rounded-2xl border shadow-2xl flex flex-col bg-background/95 backdrop-blur-sm">
                <DialogHeader className="p-6 pb-4 border-b bg-muted/20 relative">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-500/10 p-3 rounded-2xl shadow-inner ring-1 ring-blue-500/20">
                            <UserCircle className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="space-y-0.5">
                            <DialogTitle className="text-xl font-black tracking-tighter text-foreground leading-none">
                                {isEdit ? "Update Position" : "Add Position"}
                            </DialogTitle>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">
                                Line Position Configuration
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1 max-h-[70vh]">
                    <div className="p-6 space-y-6">
                        {/* Position Name */}
                        <div className="space-y-2">
                            <Label htmlFor="position_name" className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/70 flex items-center gap-1.5">
                                <UserCircle className="h-3 w-3" /> Position Name
                            </Label>
                            <Input
                                id="position_name"
                                value={formData.position_name}
                                onChange={(e) => handleChange("position_name", e.target.value)}
                                className="h-10 rounded-xl border-muted-foreground/10 focus-visible:ring-primary/20 bg-card font-black text-sm tracking-tight placeholder:text-muted-foreground/30 placeholder:italic placeholder:font-medium"
                                placeholder="e.g. Quality Inspector"
                            />
                            {errors.position_name && (
                                <p className="text-[10px] font-bold text-destructive">{errors.position_name}</p>
                            )}
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label htmlFor="pos_description" className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/70">
                                Description
                            </Label>
                            <Textarea
                                id="pos_description"
                                value={formData.description}
                                onChange={(e) => handleChange("description", e.target.value)}
                                className="min-h-[80px] rounded-xl border-muted-foreground/10 focus-visible:ring-primary/20 bg-card text-xs font-semibold text-muted-foreground shadow-sm placeholder:text-muted-foreground/30 placeholder:italic placeholder:font-medium resize-none"
                                placeholder="Brief description of this position's responsibilities..."
                            />
                        </div>

                        {/* Persons Allowed & Hourly Rate side-by-side */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <Label htmlFor="persons_allowed" className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/70 flex items-center gap-1.5">
                                    <Users className="h-3 w-3" /> Persons Allowed
                                </Label>
                                <Input
                                    id="persons_allowed"
                                    type="number"
                                    min={1}
                                    value={formData.persons_allowed || ""}
                                    onChange={(e) =>
                                        handleChange("persons_allowed", e.target.value === "" ? 0 : parseInt(e.target.value, 10))
                                    }
                                    className="h-10 rounded-xl border-muted-foreground/10 focus-visible:ring-primary/20 bg-card font-black text-sm tabular-nums placeholder:text-muted-foreground/30 placeholder:italic placeholder:font-medium"
                                    placeholder="e.g. 2"
                                />
                                {errors.persons_allowed && (
                                    <p className="text-[10px] font-bold text-destructive">{errors.persons_allowed}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="position_rate" className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/70 flex items-center gap-1.5">
                                    <span className="font-extrabold text-[10px]">₱</span> Hourly Rate
                                </Label>
                                <Input
                                    id="position_rate"
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    value={formData.position_rate === 0 ? "" : formData.position_rate}
                                    onChange={(e) =>
                                        handleChange("position_rate", e.target.value === "" ? 0 : parseFloat(e.target.value))
                                    }
                                    className="h-10 rounded-xl border-muted-foreground/10 focus-visible:ring-primary/20 bg-card font-black text-sm tabular-nums placeholder:text-muted-foreground/30 placeholder:italic placeholder:font-medium"
                                    placeholder="e.g. 15.50"
                                />
                                {errors.position_rate && (
                                    <p className="text-[10px] font-bold text-destructive">{errors.position_rate}</p>
                                )}
                            </div>
                        </div>
                    </div>
                </ScrollArea>

                <DialogFooter className="p-6 py-4 border-t bg-muted/10 flex items-center justify-end gap-3 shadow-[0_-8px_15px_-10px_rgba(0,0,0,0.05)]">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="flex-1 sm:flex-none rounded-xl px-8 font-black h-10 text-[10px] uppercase opacity-70 border border-muted-foreground/10 hover:opacity-100 transition-all hover:bg-background hover:shadow-sm"
                        disabled={isSaving}
                    >
                        CANCEL
                    </Button>
                    <Button
                        onClick={handleAction}
                        disabled={isSaving}
                        className="flex-1 sm:flex-none rounded-xl px-12 font-black shadow-xl shadow-primary/20 bg-primary h-10 text-[10px] uppercase tracking-widest transition-all active:scale-95"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            isEdit ? "UPDATE" : "ADD POSITION"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
