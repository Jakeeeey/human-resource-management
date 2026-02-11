"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { DivisionWithRelations } from "../types";

interface Props {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    division: DivisionWithRelations | null;
    onConfirm: () => Promise<void>;
}

export function DeleteDivisionConfirmDialog({
                                                open,
                                                onOpenChange,
                                                division,
                                                onConfirm,
                                            }: Props) {
    if (!division) return null;

    const handleConfirm = async () => {
        await onConfirm();
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete Division</DialogTitle>
                </DialogHeader>

                <p className="text-sm text-muted-foreground">
                    Are you sure you want to delete <b>{division.division_name}</b>?
                </p>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleConfirm}>
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
