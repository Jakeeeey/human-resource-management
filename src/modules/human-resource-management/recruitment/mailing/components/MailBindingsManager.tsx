"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

import { mailEventKeySchema, type MailEventKey } from "../types/mail-template.schema";
import { mailSendConditionSchema, type MailSendCondition } from "../types/mail-binding.schema";
import { useMailBindings } from "../hooks/useMailBindings";
import { useMailTemplates } from "../hooks/useMailTemplates";
import type { MailBindingRow } from "../providers/mailBindingService";
import { MailCombobox } from "./MailCombobox";
import { MailingTablePagination } from "./MailingTablePagination";

const MANUAL_ONLY_EVENT_KEYS: readonly MailEventKey[] = ["final_interview.invited"];
const EVENT_KEY_OPTIONS = mailEventKeySchema.options
    .filter((key) => !MANUAL_ONLY_EVENT_KEYS.includes(key))
    .map((key) => ({ value: key, label: key }));
const CONDITION_OPTIONS = mailSendConditionSchema.options.map((key) => ({ value: key, label: key }));

interface MailBindingsManagerProps {
    // Send-now affordance hook point (todo 12 owns the applicant-picker +
    // dispatch — when absent, no Send-now button renders and nothing sends).
    onSendNow?: (binding: MailBindingRow) => void;
}

/**
 * Bindings manager: event-key select (auto events only) + condition select + enabled toggle +
 * unhook. Never defaults to an enabled final_interview.invited binding.
 * @param onSendNow - Optional Send-now hook point (todo 12).
 * @returns The bindings table + create form.
 */
export function MailBindingsManager({ onSendNow }: MailBindingsManagerProps) {
    const { bindings, loading, mutating, error, refresh, createBinding, toggleBinding, unhookBinding } =
        useMailBindings();

    useEffect(() => {
        const handler = () => {
            void refresh();
        };
        window.addEventListener("mailing:refresh", handler);
        return () => window.removeEventListener("mailing:refresh", handler);
    }, [refresh]);
    const { templates } = useMailTemplates();

    const [eventKey, setEventKey] = useState<MailEventKey>("initial_interview.graded");
    const [templateId, setTemplateId] = useState("");
    const [sendCondition, setSendCondition] = useState<MailSendCondition>("always");
    const [isEnabled, setIsEnabled] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const templateOptions = useMemo(
        () =>
            templates.map((row) => ({
                value: String(row.id),
                label: `${row.template_key} — ${row.template_name}`,
            })),
        [templates]
    );

    const templateLabel = useMemo(() => {
        const map = new Map(templates.map((row) => [String(row.id), row.template_name]));
        return (id: string | number) => map.get(String(id)) ?? String(id);
    }, [templates]);

    const handleCreate = async () => {
        if (!templateId) {
            toast.error("Pick a template first.");
            return;
        }
        const result = await createBinding({
            event_key: eventKey,
            template_id: templateId,
            is_enabled: isEnabled,
            send_condition: sendCondition,
        });
        if (!result.ok) {
            toast.error(result.message);
            return;
        }
        toast.success("Binding created.");
        setEventKey("initial_interview.graded");
        setTemplateId("");
        setSendCondition("always");
        setIsEnabled(true);
    };

    const handleToggle = async (row: MailBindingRow, next: boolean) => {
        const result = await toggleBinding(row.id, next);
        if (!result.ok) toast.error(result.message);
        else toast.success(next ? "Binding enabled." : "Binding disabled.");
    };

    const handleUnhook = async (row: MailBindingRow) => {
        const result = await unhookBinding(row.id);
        if (!result.ok) toast.error(result.message);
        else toast.success("Binding unhooked.");
    };

    if (loading) {
        return (
            <div className="grid gap-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-40 w-full" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-lg border border-destructive/40 bg-card p-4" role="alert">
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button variant="outline" size="sm" className="mt-2 w-full sm:w-auto" onClick={() => void refresh()}>
                    Retry
                </Button>
            </div>
        );
    }

    const filteredCount = bindings.length;
    const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
    const safePage = Math.min(page, totalPages);
    const rangeStart = filteredCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const rangeEnd = Math.min(safePage * pageSize, filteredCount);
    const pagedBindings = bindings.slice((safePage - 1) * pageSize, safePage * pageSize);

    return (
        <section aria-label="Bindings" className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
                <h2 className="text-sm font-semibold">New binding</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium text-muted-foreground">Event key</Label>
                        <MailCombobox
                            options={EVENT_KEY_OPTIONS}
                            value={eventKey}
                            onValueChange={(v) => setEventKey(v as MailEventKey)}
                            placeholder="Select event…"
                            disabled={mutating}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium text-muted-foreground">Template</Label>
                        <MailCombobox
                            options={templateOptions}
                            value={templateId}
                            onValueChange={setTemplateId}
                            placeholder="Select template…"
                            disabled={mutating}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium text-muted-foreground">Send condition</Label>
                        <MailCombobox
                            options={CONDITION_OPTIONS}
                            value={sendCondition}
                            onValueChange={(v) => setSendCondition(v as MailSendCondition)}
                            placeholder="Select condition…"
                            disabled={mutating}
                        />
                    </div>
                    <div className="flex items-end gap-2 pb-1">
                        <Switch id="mail-binding-enabled" checked={isEnabled} onCheckedChange={setIsEnabled} disabled={mutating} />
                        <Label htmlFor="mail-binding-enabled" className="text-xs text-muted-foreground">
                            {isEnabled ? "Enabled" : "Disabled"}
                        </Label>
                    </div>
                </div>
                <div>
                    <Button size="sm" className="w-full sm:w-auto" disabled={mutating} onClick={() => void handleCreate()}>
                        Add binding
                    </Button>
                </div>
            </div>
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold">Hooked bindings</h2>
                    <span
                        aria-live="polite"
                        className="rounded-full border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground tabular-nums"
                    >
                        {filteredCount}
                    </span>
                </div>
            </div>
            {pagedBindings.length === 0 ? (
                <div className="flex items-center justify-center rounded-lg border bg-card py-16">
                    <p className="text-sm text-muted-foreground">No bindings yet. Hook a template to an event above.</p>
                </div>
            ) : (
                <ul className="flex flex-col gap-2">
                    {pagedBindings.map((row) => (
                        <li
                            key={String(row.id)}
                            className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 transition-colors duration-150 hover:border-primary/40"
                        >
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="truncate text-sm font-medium tabular-nums" title={row.event_key}>
                                    {row.event_key}
                                </span>
                                <span className="truncate text-xs text-muted-foreground tabular-nums" title={`${templateLabel(row.template_id)} · ${row.send_condition}`}>
                                    template {templateLabel(row.template_id)} · {row.send_condition}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={row.is_enabled}
                                    onCheckedChange={(next) => void handleToggle(row, next)}
                                    disabled={mutating}
                                    aria-label={`Enabled for ${row.event_key}`}
                                />
                                <span className="text-xs text-muted-foreground">
                                    {row.is_enabled ? "Enabled" : "Disabled"}
                                </span>
                            </div>
                            {onSendNow && row.event_key === "final_interview.invited" && (
                                <Button variant="outline" size="sm" className="w-full sm:w-auto" disabled={mutating} onClick={() => onSendNow(row)}>
                                    Send now
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full text-destructive sm:w-auto"
                                disabled={mutating}
                                onClick={() => void handleUnhook(row)}
                            >
                                Unhook
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
            <div className="overflow-hidden rounded-lg border bg-card">
                <MailingTablePagination
                    page={safePage}
                    pageSize={pageSize}
                    totalPages={totalPages}
                    filteredCount={filteredCount}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => {
                        setPageSize(size);
                        setPage(1);
                    }}
                />
            </div>
        </section>
    );
}
