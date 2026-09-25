"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
    createMsCatalog,
    patchMsCatalog,
} from "../providers/msCatalog";
import {
    MS_EVENT_KEY_PATTERN,
    type MsCatalogRow,
    type MsVariableRow,
} from "../types/ms-catalog.schema";
import { validateVariableRows } from "../utils/ms-event-variables";
import { VariableBuilder } from "./VariableBuilder";

const KEY_SHAPE_HINT = "Lowercase letters, numbers, dots and underscores only (e.g. leave.approved).";

function stripMachinePrefix(message: string): string {
    return message.replace(/^(?:[A-Z][A-Z0-9_]*:\s*)+/, "").trim();
}

export function humaniseRegistryError(message: string, eventKey?: string): string {
    const upper = message.toUpperCase();
    const stripped = stripMachinePrefix(message);
    if (
        upper.includes("ALREADY_EXISTS") ||
        upper.includes("EVENT_KEY_EXISTS") ||
        upper.includes("DUPLICATE") ||
        upper.includes("CONFLICT") ||
        upper.includes("ALREADY REGISTERED")
    ) {
        return eventKey
            ? `Event key “${eventKey}” is already registered — edit the existing row instead.`
            : "That event key is already registered — edit the existing row instead.";
    }
    if (upper.includes("UNKNOWN_EVENT_KEY")) {
        return eventKey
            ? `Event key “${eventKey}” is not a known catalog key — register it here first.`
            : "That event key is not a known catalog key — register it here first.";
    }
    if (upper.includes("NOT_FOUND")) {
        return "That event key no longer exists — refresh the list and try again.";
    }
    if (upper.includes("VALIDATION_FAILED") || upper.includes("INVALID")) {
        return stripped.length > 0
            ? stripped
            : "The registry rejected that change — check the highlighted fields and try again.";
    }
    return stripped.length > 0
        ? stripped
        : "Something went wrong saving the registry. Try again.";
}

interface RegistryDialogProps {
    readonly mode: "create" | "edit";
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly row: MsCatalogRow | null;
    readonly initialVariables: readonly MsVariableRow[];
    readonly onSaved: () => void;
}

export function RegistryDialog({ mode, open, onOpenChange, row, initialVariables, onSaved }: RegistryDialogProps) {
    const [eventKey, setEventKey] = useState("");
    const [label, setLabel] = useState("");
    const [description, setDescription] = useState("");
    const [moduleName, setModuleName] = useState("");
    const [variables, setVariables] = useState<MsVariableRow[]>([]);
    const [formError, setFormError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const isCreate = mode === "create";

    useEffect(() => {
        if (!open) return;
        if (isCreate) {
            setEventKey("");
            setLabel("");
            setDescription("");
            setModuleName("");
        } else {
            setEventKey(row?.event_key ?? "");
            setLabel(row?.label ?? "");
            setDescription(row?.description ?? "");
            setModuleName(row?.module ?? "");
        }
        setVariables(initialVariables.map((entry) => ({ ...entry })));
        setFormError(null);
        setBusy(false);
    }, [open, initialVariables, isCreate, row]);

    const editKey = row?.event_key ?? "";
    const draftKeyCount = variables.filter((entry) => entry.name.trim().length > 0).length;

    const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        setFormError(null);
        const key = eventKey.trim();
        if (key.length === 0) {
            setFormError("Event key is required.");
            return;
        }
        if (!MS_EVENT_KEY_PATTERN.test(key)) {
            setFormError(`Event key: ${KEY_SHAPE_HINT}`);
            return;
        }
        if (label.trim().length === 0) {
            setFormError("Label is required.");
            return;
        }
        const problem = validateVariableRows(variables);
        if (problem !== null) {
            setFormError(problem);
            return;
        }
        setBusy(true);
        try {
            if (isCreate) {
                await createMsCatalog({
                    event_key: key,
                    label: label.trim(),
                    ...(description.trim().length > 0 ? { description: description.trim() } : {}),
                    ...(moduleName.trim().length > 0 ? { module: moduleName.trim() } : {}),
                    variables,
                });
                toast.success(`Event key ${key} registered.`);
            } else {
                await patchMsCatalog(editKey, {
                    ...(key !== editKey ? { event_key: key } : {}),
                    label: label.trim(),
                    description: description.trim(),
                    module: moduleName.trim().length > 0 ? moduleName.trim() : null,
                    variables,
                });
                toast.success(`Event key ${key} saved.`);
            }
            onSaved();
            onOpenChange(false);
        } catch (cause) {
            const raw = cause instanceof Error ? cause.message : String(cause);
            setFormError(humaniseRegistryError(raw, key || undefined));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[85vh] w-[95vw] flex-col overflow-hidden rounded-2xl p-0 sm:max-w-[700px]">
                <DialogHeader className="px-6 pt-6 text-left">
                    <DialogTitle className="line-clamp-1" title={isCreate ? "Register event key" : `Edit ${editKey}`}>
                        {isCreate ? "Register event key" : `Edit ${editKey}`}
                    </DialogTitle>
                    <DialogDescription>
                        {isCreate
                            ? "Declare a key and the payload variables its templates may use."
                            : "Edit the event key, label, description, module and the payload variables its templates may use."}
                    </DialogDescription>
                </DialogHeader>
                <form className="flex min-h-0 flex-1 flex-col overflow-hidden" data-testid="registry-form" onSubmit={(event) => void handleSubmit(event)}>
                    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="flex flex-col gap-2">
                                <Label className="text-xs font-medium text-muted-foreground" htmlFor="registry-event-key">
                                    Event key <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    className="h-8 font-mono text-xs"
                                    id="registry-event-key"
                                    placeholder="leave.approved"
                                    spellCheck={false}
                                    value={eventKey}
                                    onChange={(event) => setEventKey(event.target.value)}
                                />
                                <p className="text-[11px] leading-snug text-muted-foreground">{KEY_SHAPE_HINT}</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label className="text-xs font-medium text-muted-foreground" htmlFor="registry-label">
                                    Label <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    className="h-8 text-xs"
                                    id="registry-label"
                                    placeholder="Leave approved"
                                    value={label}
                                    onChange={(event) => setLabel(event.target.value)}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label className="text-xs font-medium text-muted-foreground" htmlFor="registry-description">
                                    Description
                                </Label>
                                <Input
                                    className="h-8 text-xs"
                                    id="registry-description"
                                    placeholder="Fired when a leave request is approved"
                                    value={description}
                                    onChange={(event) => setDescription(event.target.value)}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label className="text-xs font-medium text-muted-foreground" htmlFor="registry-module">
                                    Module
                                </Label>
                                <Input
                                    className="h-8 text-xs"
                                    id="registry-module"
                                    placeholder="leave"
                                    value={moduleName}
                                    onChange={(event) => setModuleName(event.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            {isCreate ? (
                                <span className="text-xs font-medium text-muted-foreground" id="registry-contract-hint">
                                    Payload variables
                                </span>
                            ) : null}
                            <VariableBuilder
                                idPrefix={isCreate ? "registry-new" : `schema-${editKey}`}
                                rows={variables}
                                onChange={setVariables}
                            />
                        </div>
                        <p className="text-[11px] leading-snug text-muted-foreground">
                            Variable names are the only tokens templates bound to this
                            event may use
                            {draftKeyCount > 0 ? ` (currently ${draftKeyCount})` : ""}.
                        </p>
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
                            {isCreate ? (busy ? "Registering" : "Register key") : busy ? "Saving" : "Save changes"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
