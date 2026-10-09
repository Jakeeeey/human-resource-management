"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { createMsGroup, patchMsGroup } from "../providers/msGroupsClient";
import type { MsGroupRow } from "../types";

type GroupStatusChoice = "active" | "inactive";

interface GroupDialogProps {
    readonly mode: "create" | "edit";
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly row: MsGroupRow | null;
    readonly onSaved: () => void;
}

function rowIsActive(row: MsGroupRow | null): boolean {
    return row?.is_active === true || row?.is_active === 1;
}

export function GroupDialog({ mode, open, onOpenChange, row, onSaved }: GroupDialogProps) {
    const [groupKey, setGroupKey] = useState("");
    const [groupName, setGroupName] = useState("");
    const [description, setDescription] = useState("");
    const [status, setStatus] = useState<GroupStatusChoice>("active");
    const [formError, setFormError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const isCreate = mode === "create";

    useEffect(() => {
        if (!open) return;
        setGroupKey("");
        setGroupName(isCreate ? "" : (row?.group_name ?? ""));
        setDescription(isCreate ? "" : (row?.description ?? ""));
        setStatus(rowIsActive(row) ? "active" : "inactive");
        setFormError(null);
        setBusy(false);
    }, [open, isCreate, row]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        setFormError(null);
        const name = groupName.trim();
        if (name.length === 0) {
            setFormError("Group name is required.");
            return;
        }
        const trimmedDescription = description.trim();
        setBusy(true);
        try {
            if (isCreate) {
                const key = groupKey.trim();
                if (key.length === 0) {
                    setFormError("Group key is required.");
                    return;
                }
                await createMsGroup({
                    group_key: key,
                    group_name: name,
                    description: trimmedDescription.length > 0 ? trimmedDescription : null,
                    is_active: status === "active",
                });
            } else {
                if (!row) {
                    setFormError("That group no longer exists — refresh the list and try again.");
                    return;
                }
                await patchMsGroup(row.id, {
                    group_name: name,
                    description: trimmedDescription.length > 0 ? trimmedDescription : null,
                    is_active: status === "active",
                });
            }
            onSaved();
            onOpenChange(false);
        } catch (cause) {
            setFormError(cause instanceof Error ? cause.message : String(cause));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[85vh] w-[95vw] flex-col overflow-hidden rounded-2xl p-0 sm:max-w-[520px]">
                <DialogHeader className="px-6 pt-6 text-left">
                    <DialogTitle>{isCreate ? "New group" : `Edit ${row?.group_name ?? "group"}`}</DialogTitle>
                    <DialogDescription>
                        {isCreate
                            ? "The group key is set once here and can never be changed afterwards."
                            : "The group key can never be changed — only the name, description and status can be edited."}
                    </DialogDescription>
                </DialogHeader>
                <form
                    className="flex min-h-0 flex-1 flex-col overflow-hidden"
                    data-testid="group-form"
                    onSubmit={(event) => void handleSubmit(event)}
                >
                    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
                        {isCreate ? (
                            <div className="flex flex-col gap-2">
                                <Label className="text-xs font-medium text-muted-foreground" htmlFor="group-key">
                                    Group key <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    className="h-8 font-mono text-xs"
                                    id="group-key"
                                    placeholder="vip-customers"
                                    spellCheck={false}
                                    value={groupKey}
                                    onChange={(event) => setGroupKey(event.target.value)}
                                />
                                <p className="text-[11px] leading-snug text-muted-foreground">
                                    Unique identifier for this group — it cannot be changed after creation.
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-medium text-muted-foreground">Group key (cannot be changed)</span>
                                <span className="truncate font-mono text-xs" title={row?.group_key ?? ""}>
                                    {row?.group_key ?? ""}
                                </span>
                            </div>
                        )}
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs font-medium text-muted-foreground" htmlFor="group-name">
                                Group name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                className="h-8 text-xs"
                                id="group-name"
                                placeholder="VIP customers"
                                value={groupName}
                                onChange={(event) => setGroupName(event.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs font-medium text-muted-foreground" htmlFor="group-description">
                                Description
                            </Label>
                            <Input
                                className="h-8 text-xs"
                                id="group-description"
                                placeholder="Who belongs in this group"
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs font-medium text-muted-foreground" htmlFor="group-status">
                                Status
                            </Label>
                            <Select value={status} onValueChange={(next) => setStatus(next as GroupStatusChoice)}>
                                <SelectTrigger className="h-8 text-xs" id="group-status" size="sm">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {formError ? (
                            <p className="text-xs text-destructive" role="alert">
                                {formError}
                            </p>
                        ) : null}
                    </div>
                    <DialogFooter className="flex-row justify-end border-t bg-muted/20 px-6 py-4">
                        <DialogClose asChild>
                            <Button className="min-h-11 md:min-h-0" disabled={busy} size="sm" type="button" variant="outline">
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button className="min-h-11 md:min-h-0" disabled={busy} size="sm" type="submit">
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            {isCreate ? (busy ? "Creating" : "Create group") : busy ? "Saving" : "Save changes"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
