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
import { Loader2, Factory, Target, Clock } from "lucide-react";
import type { ManufacturingLine, LineFormValues } from "../types";
import { lineFormSchema } from "../types";

interface LineDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: LineFormValues) => Promise<boolean>;
    line?: ManufacturingLine | null;
}

export function LineDialog({
    open,
    onOpenChange,
    onSubmit,
    line,
}: LineDialogProps) {
    const isEdit = !!line;
    const [isSaving, setIsSaving] = React.useState(false);
    const [errors, setErrors] = React.useState<Record<string, string>>({});

    const [formData, setFormData] = React.useState({
        line_name: "",
        description: "",
        target_produce_8_hrs: 0,
        overtime_target_per_hr: 0,
    });

    React.useEffect(() => {
        if (line) {
            setFormData({
                line_name: line.line_name,
                description: line.description || "",
                target_produce_8_hrs: line.target_produce_8_hrs,
                overtime_target_per_hr: line.overtime_target_per_hr,
            });
        } else {
            setFormData({
                line_name: "",
                description: "",
                target_produce_8_hrs: 0,
                overtime_target_per_hr: 0,
            });
        }
        setErrors({});
    }, [line, open]);

    const handleChange = (field: string, value: string | number) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        // Clear field error on change
        if (errors[field]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    };

    const handleAction = async () => {
        // Validate with Zod
        const result = lineFormSchema.safeParse({
            ...formData,
            target_produce_8_hrs: Number(formData.target_produce_8_hrs),
            overtime_target_per_hr: Number(formData.overtime_target_per_hr),
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
            <DialogContent showCloseButton={false} className="p-0 sm:max-w-[520px] overflow-hidden rounded-2xl border shadow-2xl flex flex-col bg-background/95 backdrop-blur-sm">
                <DialogHeader className="p-6 pb-4 border-b bg-muted/20 relative">
                    <div className="flex items-center gap-4">
                        <div className="bg-primary/10 p-3 rounded-2xl shadow-inner ring-1 ring-primary/20">
                            <Factory className="h-6 w-6 text-primary" />
                        </div>
                        <div className="space-y-0.5">
                            <DialogTitle className="text-xl font-black tracking-tighter text-foreground leading-none">
                                {isEdit ? "Update Production Line" : "Register Production Line"}
                            </DialogTitle>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">
                                Manufacturing Line Configuration
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1 max-h-[70vh]">
                    <div className="p-6 space-y-6">
                        {/* Line Name */}
                        <div className="space-y-2">
                            <Label htmlFor="line_name" className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/70 flex items-center gap-1.5">
                                <Factory className="h-3 w-3" /> Line Name
                            </Label>
                            <Input
                                id="line_name"
                                value={formData.line_name}
                                onChange={(e) => handleChange("line_name", e.target.value)}
                                className="h-10 rounded-xl border-muted-foreground/10 focus-visible:ring-primary/20 bg-card font-black text-sm tracking-tight placeholder:text-muted-foreground/30 placeholder:italic placeholder:font-medium"
                                placeholder="e.g. Assembly Line A"
                            />
                            {errors.line_name && (
                                <p className="text-[10px] font-bold text-destructive">{errors.line_name}</p>
                            )}
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label htmlFor="description" className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/70">
                                Description
                            </Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => handleChange("description", e.target.value)}
                                className="min-h-[80px] rounded-xl border-muted-foreground/10 focus-visible:ring-primary/20 bg-card text-xs font-semibold text-muted-foreground shadow-sm placeholder:text-muted-foreground/30 placeholder:italic placeholder:font-medium resize-none"
                                placeholder="Brief description of this production line..."
                            />
                        </div>

                        {/* Target Fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <Label htmlFor="target_produce_8_hrs" className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/70 flex items-center gap-1.5">
                                    <Target className="h-3 w-3" /> 8-Hr Target (pcs)
                                </Label>
                                <Input
                                    id="target_produce_8_hrs"
                                    type="number"
                                    min={0}
                                    value={formData.target_produce_8_hrs || ""}
                                    onChange={(e) =>
                                        handleChange("target_produce_8_hrs", e.target.value === "" ? 0 : parseInt(e.target.value, 10))
                                    }
                                    className="h-10 rounded-xl border-muted-foreground/10 focus-visible:ring-primary/20 bg-card font-black text-sm tabular-nums placeholder:text-muted-foreground/30 placeholder:italic placeholder:font-medium"
                                    placeholder="e.g. 1000"
                                />
                                {errors.target_produce_8_hrs && (
                                    <p className="text-[10px] font-bold text-destructive">{errors.target_produce_8_hrs}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="overtime_target_per_hr" className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/70 flex items-center gap-1.5">
                                    <Clock className="h-3 w-3" /> OT Target / Hr (pcs)
                                </Label>
                                <Input
                                    id="overtime_target_per_hr"
                                    type="number"
                                    min={0}
                                    value={formData.overtime_target_per_hr || ""}
                                    onChange={(e) =>
                                        handleChange("overtime_target_per_hr", e.target.value === "" ? 0 : parseInt(e.target.value, 10))
                                    }
                                    className="h-10 rounded-xl border-muted-foreground/10 focus-visible:ring-primary/20 bg-card font-black text-sm tabular-nums placeholder:text-muted-foreground/30 placeholder:italic placeholder:font-medium"
                                    placeholder="e.g. 125"
                                />
                                {errors.overtime_target_per_hr && (
                                    <p className="text-[10px] font-bold text-destructive">{errors.overtime_target_per_hr}</p>
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
                            isEdit ? "UPDATE" : "REGISTER"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
