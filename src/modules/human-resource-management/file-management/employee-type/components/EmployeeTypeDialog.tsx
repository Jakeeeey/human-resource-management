import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EmployeeType, EmployeeTypeFormData } from "../types";

interface EmployeeTypeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: EmployeeTypeFormData) => Promise<void>;
    record?: EmployeeType | null;
}

export function EmployeeTypeDialog({
    open,
    onOpenChange,
    onSubmit,
    record,
}: EmployeeTypeDialogProps) {
    const [typeName, setTypeName] = useState("");
    const [description, setDescription] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            if (record) {
                setTypeName(record.type_name);
                setDescription(record.description || "");
            } else {
                setTypeName("");
                setDescription("");
            }
        }
    }, [open, record]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onSubmit({ type_name: typeName, description });
            onOpenChange(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>
                            {record ? "Edit Employee Type" : "Add Employee Type"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="typeName">Type Name <span className="text-destructive">*</span></Label>
                            <Input
                                id="typeName"
                                value={typeName}
                                onChange={(e) => setTypeName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Saving..." : "Save"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
