"use client";

import { useMemo, useState } from "react";
import type { JSX } from "react";
import { AlertCircle, Pencil, Plus, Power, PowerOff, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { useDialogTriggerFocus } from "../hooks/useDialogTriggerFocus";
import type { TemplateCreateInput, TemplateUpdateInput } from "../providers/clearanceTemplatesClient";
import { useClearanceTemplatesFetch } from "../providers/clearanceTemplatesProvider";
import type { ClearanceTemplate } from "../types";
import { TemplateDialog } from "./TemplateDialog";
import { TemplateToggleDialog } from "./TemplateToggleDialog";

const ICON_FOCUS_RING =
    "focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function TemplatesPanel(props: {
    selectedId: number | null;
    onSelect: (id: number) => void;
    search: string;
    onSearchChange: (value: string) => void;
}): JSX.Element {
    const { selectedId, onSelect, search, onSearchChange } = props;
    const { templates, directory, showInactive, setShowInactive } = useClearanceTemplatesFetch();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<ClearanceTemplate | null>(null);
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [toggleRow, setToggleRow] = useState<ClearanceTemplate | null>(null);
    const [confirmBusy, setConfirmBusy] = useState(false);

    const captureFormTrigger = useDialogTriggerFocus(dialogOpen);
    const captureToggleTrigger = useDialogTriggerFocus(toggleRow !== null);

    const query = search.trim().toLowerCase();
    const filtered = useMemo(() => {
        if (query === "") {
            return templates.data;
        }
        return templates.data.filter((row) => row.title.toLowerCase().includes(query));
    }, [templates.data, query]);

    const countLabel =
        query === ""
            ? `${templates.data.length} ${templates.data.length === 1 ? "template" : "templates"}`
            : `${filtered.length} of ${templates.data.length} ${templates.data.length === 1 ? "template" : "templates"}`;

    const openCreate = () => {
        captureFormTrigger();
        setEditing(null);
        setDialogOpen(true);
    };

    const openEdit = (row: ClearanceTemplate) => {
        captureFormTrigger();
        setEditing(row);
        setDialogOpen(true);
    };

    const requestToggle = (row: ClearanceTemplate) => {
        captureToggleTrigger();
        setToggleRow(row);
    };

    const handleCreate = (input: TemplateCreateInput) => {
        setSaving(true);
        void templates
            .create(input)
            .then((created) => {
                toast.success("Template created");
                setDialogOpen(false);
                onSelect(created.id);
            })
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Save failed"))
            .finally(() => setSaving(false));
    };

    const handleUpdate = (input: TemplateUpdateInput) => {
        if (editing === null) {
            return;
        }
        const id = editing.id;
        setSaving(true);
        void templates
            .update(id, input)
            .then(() => {
                toast.success("Template updated");
                setDialogOpen(false);
            })
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Save failed"))
            .finally(() => setSaving(false));
    };

    const handleConfirmToggle = () => {
        if (toggleRow === null) {
            return;
        }
        const row = toggleRow;
        setBusyId(row.id);
        setConfirmBusy(true);
        void templates
            .setActive(row.id, !row.is_active)
            .then(() => {
                toast.success(row.is_active ? "Template deactivated" : "Template reactivated");
                setToggleRow(null);
            })
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Update failed"))
            .finally(() => {
                setBusyId(null);
                setConfirmBusy(false);
            });
    };

    return (
        <Card className="min-w-0 lg:sticky lg:top-4 lg:flex lg:max-h-[calc(100vh-5rem)] lg:flex-col lg:overflow-hidden">
            <CardHeader className="shrink-0 flex-row items-start justify-between gap-2">
                <div className="min-w-0">
                    <CardTitle>Templates</CardTitle>
                    <p className="text-sm text-muted-foreground" aria-live="polite">
                        {countLabel}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon-lg"
                        aria-label="Refresh templates"
                        disabled={templates.isLoading}
                        onClick={() => void templates.refresh().catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Refresh failed"))}
                        className={ICON_FOCUS_RING}
                    >
                        <RefreshCw className={cn("h-4 w-4", templates.isLoading && "animate-spin")} />
                    </Button>
                    <Button onClick={openCreate} size="sm">
                        <Plus className="h-4 w-4" />
                        New template
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="min-w-0 space-y-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                <div className="flex flex-col gap-3">
                    <div className="relative min-w-0">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(event) => onSearchChange(event.target.value)}
                            placeholder="Search templates…"
                            aria-label="Search templates"
                            className="h-10 pl-9"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="clearance-templates-show-inactive" className="cursor-pointer text-sm">
                            Show inactive
                        </Label>
                        <Switch
                            id="clearance-templates-show-inactive"
                            checked={showInactive}
                            onCheckedChange={setShowInactive}
                            className={ICON_FOCUS_RING}
                        />
                    </div>
                </div>

                {templates.isError && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Could not load templates</AlertTitle>
                        <AlertDescription>{templates.error?.message ?? "Fetch failed"}</AlertDescription>
                    </Alert>
                )}

                {templates.isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading templates…</p>
                ) : filtered.length === 0 ? (
                    templates.data.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No templates yet. Create the first clearance template.
                        </p>
                    ) : (
                        <div className="space-y-3 rounded-xl border border-dashed p-4 text-center">
                            <p className="text-sm font-medium">No templates match the search</p>
                            <p className="text-sm text-muted-foreground">
                                Try a different term, or clear the search to see every template.
                            </p>
                            <Button variant="outline" size="sm" onClick={() => onSearchChange("")}>
                                Clear search
                            </Button>
                        </div>
                    )
                ) : (
                    <ul className="min-w-0 space-y-2">
                        {filtered.map((row) => {
                            const selected = row.id === selectedId;
                            const busy = busyId === row.id;
                            return (
                                <li
                                    key={row.id}
                                    className={cn(
                                        "min-w-0 rounded-xl border p-3 transition-colors",
                                        selected
                                            ? "border-primary bg-primary/10 shadow-sm"
                                            : "hover:bg-muted"
                                    )}
                                >
                                    <div className="flex min-w-0 items-start gap-2">
                                        <button
                                            type="button"
                                            className="min-w-0 flex-1 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                                            onClick={() => onSelect(row.id)}
                                            aria-label={`Select template ${row.title}`}
                                        >
                                            <span className="block truncate font-medium" title={row.title}>
                                                {row.title}
                                            </span>
                                            <span className="mt-1 flex flex-wrap items-center gap-1.5">
                                                {row.is_active ? (
                                                    <Badge variant="default">Active</Badge>
                                                ) : (
                                                    <Badge variant="outline">Inactive</Badge>
                                                )}
                                            </span>
                                            <span className="mt-1 block truncate text-sm text-muted-foreground">
                                                {row.department_id === null
                                                    ? "Global template"
                                                    : `Suggested for ${directory.departmentName(row.department_id)}`}
                                            </span>
                                        </button>
                                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon-lg"
                                                aria-label={`Edit template ${row.title}`}
                                                onClick={() => openEdit(row)}
                                                className={ICON_FOCUS_RING}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon-lg"
                                                aria-label={row.is_active ? `Deactivate template ${row.title}` : `Reactivate template ${row.title}`}
                                                disabled={busy}
                                                onClick={() => requestToggle(row)}
                                                className={ICON_FOCUS_RING}
                                            >
                                                {row.is_active ? (
                                                    <PowerOff className="h-4 w-4" />
                                                ) : (
                                                    <Power className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </CardContent>

            <TemplateDialog
                open={dialogOpen}
                template={editing}
                departments={directory.departments}
                saving={saving}
                onClose={() => setDialogOpen(false)}
                onCreate={handleCreate}
                onUpdate={handleUpdate}
            />

            <TemplateToggleDialog
                open={toggleRow !== null}
                template={toggleRow}
                busy={confirmBusy}
                onClose={() => setToggleRow(null)}
                onConfirm={handleConfirmToggle}
            />
        </Card>
    );
}
