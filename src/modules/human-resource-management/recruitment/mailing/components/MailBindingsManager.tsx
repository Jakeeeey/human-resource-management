"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { mailEventKeySchema, type MailEventKey } from "../types/mail-template.schema";
import { mailSendConditionSchema, type MailSendCondition } from "../types/mail-binding.schema";
import { useMailBindings } from "../hooks/useMailBindings";
import { useMailTemplates } from "../hooks/useMailTemplates";
import type { MailBindingRow } from "../providers/mailBindingService";
import { MailCombobox } from "./MailCombobox";

const EVENT_KEY_OPTIONS = mailEventKeySchema.options.map((key) => ({ value: key, label: key }));
const CONDITION_OPTIONS = mailSendConditionSchema.options.map((key) => ({ value: key, label: key }));

interface MailBindingsManagerProps {
    // Send-now affordance hook point (todo 12 owns the applicant-picker +
    // dispatch — when absent, no Send-now button renders and nothing sends).
    onSendNow?: (binding: MailBindingRow) => void;
}

/**
 * Bindings manager: 3-key select + condition select + enabled toggle +
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
            <div className="grid gap-3">
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => void refresh()}>
                    Retry
                </Button>
            </div>
        );
    }

    return (
        <div className="grid gap-4">
            <div className="grid gap-4 rounded-2xl border border-border/50 bg-card p-5 shadow-sm sm:p-6">
                <div className="text-sm font-semibold">New binding</div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                        <Label>Event key</Label>
                        <MailCombobox
                            options={EVENT_KEY_OPTIONS}
                            value={eventKey}
                            onValueChange={(v) => setEventKey(v as MailEventKey)}
                            placeholder="Select event…"
                            disabled={mutating}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Template</Label>
                        <MailCombobox
                            options={templateOptions}
                            value={templateId}
                            onValueChange={setTemplateId}
                            placeholder="Select template…"
                            disabled={mutating}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Send condition</Label>
                        <MailCombobox
                            options={CONDITION_OPTIONS}
                            value={sendCondition}
                            onValueChange={(v) => setSendCondition(v as MailSendCondition)}
                            placeholder="Select condition…"
                            disabled={mutating}
                        />
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                        <Switch id="mail-binding-enabled" checked={isEnabled} onCheckedChange={setIsEnabled} disabled={mutating} />
                        <Label htmlFor="mail-binding-enabled">Enabled</Label>
                    </div>
                </div>
                <Button className="w-full sm:w-auto sm:justify-self-start" disabled={mutating} onClick={() => void handleCreate()}>
                    Add binding
                </Button>
            </div>
            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <Table className="min-w-[720px]">
                        <TableHeader>
                            <TableRow className="bg-muted/30">
                                <TableHead className="max-w-56">Event</TableHead>
                                <TableHead className="max-w-56">Template</TableHead>
                                <TableHead className="max-w-40">Condition</TableHead>
                                <TableHead className="w-24">Enabled</TableHead>
                                <TableHead className="w-44 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {bindings.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                                        No bindings yet. Hook a template to an event above.
                                    </TableCell>
                                </TableRow>
                            )}
                            {bindings.map((row) => (
                                <TableRow key={String(row.id)}>
                                    <TableCell className="max-w-56 truncate" title={row.event_key}>
                                        {row.event_key}
                                    </TableCell>
                                    <TableCell
                                        className="max-w-56 truncate text-muted-foreground"
                                        title={templateLabel(row.template_id)}
                                    >
                                        {templateLabel(row.template_id)}
                                    </TableCell>
                                    <TableCell className="max-w-40 truncate text-muted-foreground" title={row.send_condition}>
                                        {row.send_condition}
                                    </TableCell>
                                    <TableCell>
                                        <Switch
                                            checked={row.is_enabled}
                                            onCheckedChange={(next) => void handleToggle(row, next)}
                                            disabled={mutating}
                                            aria-label={`Enabled for ${row.event_key}`}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex flex-wrap justify-end gap-2">
                                            {onSendNow && row.event_key === "final_interview.invited" && (
                                                <Button variant="ghost" size="sm" disabled={mutating} onClick={() => onSendNow(row)}>
                                                    Send now
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive"
                                                disabled={mutating}
                                                onClick={() => void handleUnhook(row)}
                                            >
                                                Unhook
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
