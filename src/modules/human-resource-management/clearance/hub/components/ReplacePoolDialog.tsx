"use client";

import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useClearanceHubContext } from "../providers/ClearanceHubProvider";
import type { ClearanceHubCandidate } from "../hooks/useClearanceHub";

interface ReplacePoolDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => Promise<void>;
    requestId: number | null;
    itemId: number | null;
    itemLabel: string;
    members: ClearanceHubCandidate[];
}

function parseUserIds(raw: string): number[] | null {
    const ids: number[] = [];
    for (const part of raw.split(/[\s,]+/)) {
        if (part.trim() === "") continue;
        const parsed = Number(part.trim());
        if (!Number.isInteger(parsed) || parsed <= 0) return null;
        if (!ids.includes(parsed)) ids.push(parsed);
    }
    return ids;
}

export function ReplacePoolDialog({
    isOpen,
    onClose,
    onSaved,
    requestId,
    itemId,
    itemLabel,
    members,
}: ReplacePoolDialogProps) {
    const { replacePool } = useClearanceHubContext();
    const [userIds, setUserIds] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setUserIds(members.map((member) => String(member.user_id)).join(", "));
            setFormError(null);
            setIsSaving(false);
        }
    }, [isOpen, members]);

    const handleSave = async () => {
        if (requestId === null || itemId === null) return;
        const parsed = parseUserIds(userIds);
        if (!parsed || parsed.length === 0) {
            setFormError("Enter at least one valid user ID");
            return;
        }
        setIsSaving(true);
        setFormError(null);
        try {
            await replacePool(requestId, itemId, parsed);
            toast.success("Signatory pool replaced");
            await onSaved();
            onClose();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to replace signatories";
            setFormError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(next) => { if (!next) onClose(); }}>
            <DialogContent className="sm:max-w-125 data-[state=closed]:duration-100 data-[state=open]:duration-150">
                <DialogHeader>
                    <DialogTitle>Replace Signatory Pool</DialogTitle>
                    <DialogDescription>{itemLabel}</DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {members.length > 0 && (
                        <div className="grid gap-1">
                            <p className="text-xs text-muted-foreground">Current pool members</p>
                            <ul className="text-sm">
                                {members.map((member) => (
                                    <li key={member.user_id} className="truncate">
                                        {member.full_name}
                                        {member.is_department_head ? " · Department Head" : ""}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="grid gap-2">
                        <Label htmlFor="clearance-pool-ids">User IDs (comma-separated)</Label>
                        <Textarea
                            id="clearance-pool-ids"
                            value={userIds}
                            onChange={(e) => setUserIds(e.target.value)}
                            disabled={isSaving}
                            rows={3}
                        />
                    </div>

                    {formError && (
                        <Alert variant="destructive">
                            <AlertDescription>{formError}</AlertDescription>
                        </Alert>
                    )}
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Saving..." : "Replace Pool"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
