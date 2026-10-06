"use client";

import { useState } from "react";
import { Loader2, Users, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
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

import type { MsCampaignRow } from "../types";
import { campaignOptionIsActive, type CampaignGroupOption, type CampaignTemplateOption } from "../providers/campaignsClient";
import { CampaignGroupPickerDialog } from "./CampaignGroupPickerDialog";

export interface CampaignFormValues {
    campaign_key: string;
    campaign_name: string;
    template_id: number | null;
    group_ids: number[];
}

interface CampaignFormDialogProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly mode: "create" | "edit";
    readonly initial: MsCampaignRow | null;
    readonly templates: readonly CampaignTemplateOption[];
    readonly groups: readonly CampaignGroupOption[];
    readonly lookupsLoading: boolean;
    readonly busy: boolean;
    readonly onSubmit: (values: CampaignFormValues) => Promise<boolean>;
}

function coerceGroupIds(value: unknown): number[] {
    if (!Array.isArray(value)) return [];
    const ids: number[] = [];
    for (const entry of value) {
        if (typeof entry === "number" && Number.isInteger(entry) && entry > 0 && !ids.includes(entry)) ids.push(entry);
    }
    return ids;
}

export function CampaignFormDialog({
    open,
    onOpenChange,
    mode,
    initial,
    templates,
    groups,
    lookupsLoading,
    busy,
    onSubmit,
}: CampaignFormDialogProps) {
    const [campaignKey, setCampaignKey] = useState(initial?.campaign_key ?? "");
    const [campaignName, setCampaignName] = useState(initial?.campaign_name ?? "");
    const [templateId, setTemplateId] = useState(
        initial?.template_id === null || initial?.template_id === undefined ? "" : String(initial.template_id)
    );
    const [selectedGroups, setSelectedGroups] = useState<number[]>(() => coerceGroupIds(initial?.group_ids));
    const [pickerOpen, setPickerOpen] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const toggleGroup = (id: number): void => {
        setSelectedGroups((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]));
    };

    const selectGroups = (ids: readonly number[]): void => {
        setSelectedGroups((prev) => [...prev, ...ids.filter((id) => !prev.includes(id))]);
    };

    const handleSubmit = async (): Promise<void> => {
        setFormError(null);
        const name = campaignName.trim();
        if (name === "") {
            setFormError("Campaign name is required.");
            return;
        }
        if (mode === "create" && campaignKey.trim() === "") {
            setFormError("Campaign key is required.");
            return;
        }
        if (templateId === "") {
            setFormError("Pick a template — a campaign cannot be queued without one.");
            return;
        }
        const templateIdNumber = Number(templateId);
        if (!Number.isInteger(templateIdNumber) || templateIdNumber <= 0) {
            setFormError("Pick a template — a campaign cannot be queued without one.");
            return;
        }
        const template = templates.find((row) => row.id === templateIdNumber) ?? null;
        if (!template || !campaignOptionIsActive(template.is_active)) {
            setFormError("Pick an active template — inactive templates cannot be queued.");
            return;
        }
        if (selectedGroups.length === 0) {
            setFormError("Pick at least one group — a campaign with no audience cannot be queued.");
            return;
        }
        const ok = await onSubmit({
            campaign_key: campaignKey.trim(),
            campaign_name: name,
            template_id: templateIdNumber,
            group_ids: [...selectedGroups],
        });
        if (ok) onOpenChange(false);
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="flex max-h-[85vh] w-[95vw] flex-col overflow-hidden rounded-2xl p-0 sm:max-w-[560px]">
                    <DialogHeader className="px-6 pt-6 text-left">
                        <DialogTitle>{mode === "create" ? "New campaign" : "Edit draft"}</DialogTitle>
                        <DialogDescription>
                            {mode === "create"
                                ? "Drafts can be reviewed and edited until they are queued."
                                : "Only drafts can be edited — the key stays fixed."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs font-medium text-muted-foreground" htmlFor="campaign-name">
                                Campaign name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                className="h-9 text-sm"
                                disabled={busy}
                                id="campaign-name"
                                placeholder="October payslip blast"
                                value={campaignName}
                                onChange={(event) => setCampaignName(event.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs font-medium text-muted-foreground" htmlFor="campaign-key">
                                Campaign key <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                className="h-9 font-mono text-sm"
                                disabled={busy || mode === "edit"}
                                id="campaign-key"
                                placeholder="oct-payslip-2026"
                                value={campaignKey}
                                onChange={(event) => setCampaignKey(event.target.value)}
                            />
                            {mode === "edit" ? (
                                <p className="text-[11px] leading-snug text-muted-foreground">
                                    The key is set at creation and cannot be changed afterwards.
                                </p>
                            ) : null}
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs font-medium text-muted-foreground" htmlFor="campaign-template">
                                Template <span className="text-destructive">*</span>
                            </Label>
                            <Select disabled={busy || lookupsLoading} value={templateId} onValueChange={setTemplateId}>
                                <SelectTrigger className="h-9 text-sm" id="campaign-template">
                                    <SelectValue placeholder={lookupsLoading ? "Loading templates…" : "Pick an active template"} />
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                    {templates
                                        .filter((row) => campaignOptionIsActive(row.is_active))
                                        .map((row) => (
                                            <SelectItem key={row.id} value={String(row.id)}>
                                                {row.template_name}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between gap-2">
                                <Label className="text-xs font-medium text-muted-foreground">
                                    Audience groups <span className="text-destructive">*</span>
                                </Label>
                                <span className="text-[11px] tabular-nums text-muted-foreground" role="status">
                                    {selectedGroups.length} of {groups.length} selected
                                </span>
                            </div>
                            <Button
                                className="min-h-11 justify-start gap-2 md:min-h-0"
                                disabled={busy || lookupsLoading}
                                size="sm"
                                variant="outline"
                                onClick={() => setPickerOpen(true)}
                            >
                                <Users className="h-4 w-4 shrink-0" />
                                {selectedGroups.length > 0 ? "Edit audience…" : "Select groups…"}
                            </Button>
                            {lookupsLoading ? (
                                <p className="text-xs text-muted-foreground">Loading groups…</p>
                            ) : selectedGroups.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No groups selected yet.</p>
                            ) : (
                                <div className="flex flex-wrap gap-1.5">
                                    {selectedGroups.map((id) => {
                                        const group = groups.find((row) => row.id === id) ?? null;
                                        const name = group?.group_name ?? "Unknown group";
                                        const active = group ? campaignOptionIsActive(group.is_active) : true;
                                        return (
                                            <span
                                                className="inline-flex max-w-full items-center gap-1 rounded-full border bg-muted/60 py-0.5 pl-2.5 pr-1 text-xs"
                                                key={id}
                                            >
                                                <span className="min-w-0 truncate" title={group?.group_key ?? name}>
                                                    {name}
                                                </span>
                                                {!active ? (
                                                    <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-px text-[10px] font-medium text-amber-700 dark:text-amber-400">
                                                        Inactive
                                                    </span>
                                                ) : null}
                                                <button
                                                    aria-label={`Remove ${name}`}
                                                    className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                                    disabled={busy}
                                                    type="button"
                                                    onClick={() => toggleGroup(id)}
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </span>
                                        );
                                    })}
                                </div>
                            )}
                            {selectedGroups.length > 0 ? (
                                <button
                                    className="self-start text-xs text-muted-foreground underline-offset-4 hover:underline"
                                    disabled={busy}
                                    type="button"
                                    onClick={() => setSelectedGroups([])}
                                >
                                    Clear all
                                </button>
                            ) : null}
                        </div>
                        {formError ? (
                            <p className="text-sm text-destructive" role="alert">
                                {formError}
                            </p>
                        ) : null}
                    </div>
                    <DialogFooter className="flex-row justify-end gap-2 border-t bg-muted/20 px-6 py-4">
                        <Button className="min-h-11 md:min-h-0" disabled={busy} size="sm" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button className="min-h-11 md:min-h-0" disabled={busy} size="sm" onClick={() => void handleSubmit()}>
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            {mode === "create" ? "Create draft" : "Save changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <CampaignGroupPickerDialog
                disabled={busy}
                groups={groups}
                key={pickerOpen ? "audience-open" : "audience-closed"}
                onClear={() => setSelectedGroups([])}
                onOpenChange={setPickerOpen}
                onSelectAll={selectGroups}
                onToggle={toggleGroup}
                open={pickerOpen}
                selectedIds={selectedGroups}
            />
        </>
    );
}
