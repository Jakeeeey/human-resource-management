"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";

import { useMsBindings } from "../hooks/useMsBindings";

const EVENT_KEYS = [
    "initial_interview.graded",
    "final_interview.graded",
    "final_interview.invited",
] as const;

const SEND_CONDITIONS = ["always", "on_pass", "on_fail"] as const;

function isEnabled(value: unknown): boolean {
    return value === true || value === 1 || value === "1" || value === "true";
}

/**
 * Bindings tab — hook event keys to templates via the real bindings routes.
 * Create requires the full flat row; PATCH is_enabled:false is the soft
 * unhook; DELETE is the hard unhook (confirm-first, row is gone).
 */
export function BindingsTab() {
    const { data, isLoading, error, refetch, create, update, remove } = useMsBindings();

    const [eventKey, setEventKey] = useState<(typeof EVENT_KEYS)[number]>(EVENT_KEYS[0]);
    const [templateId, setTemplateId] = useState("");
    const [sendCondition, setSendCondition] = useState<(typeof SEND_CONDITIONS)[number]>(
        SEND_CONDITIONS[0],
    );
    const [enabled, setEnabled] = useState(true);
    const [formError, setFormError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    const handleCreate = async (): Promise<void> => {
        setFormError(null);
        if (!templateId.trim()) {
            setFormError("Template id is required.");
            return;
        }
        await create({
            event_key: eventKey,
            template_id: templateId.trim(),
            is_enabled: enabled,
            send_condition: sendCondition,
        });
    };

    const handleToggle = async (id: string | number, current: unknown): Promise<void> => {
        const key = String(id);
        setBusyId(key);
        try {
            await update(id, { is_enabled: !isEnabled(current) });
        } finally {
            setBusyId(null);
        }
    };

    const handleRemove = async (id: string | number): Promise<void> => {
        if (!window.confirm("Unhook this binding? The row will be deleted.")) return;
        const key = String(id);
        setBusyId(key);
        try {
            await remove(id);
        } finally {
            setBusyId(null);
        }
    };

    return (
        <section aria-label="Bindings" className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-lg border bg-card p-4" data-testid="bindings-form">
                <h2 className="text-sm font-semibold">Hook a binding</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium text-muted-foreground" htmlFor="binding-event">
                            Event key
                        </Label>
                        <NativeSelect
                            id="binding-event"
                            value={eventKey}
                            onChange={(event) =>
                                setEventKey(event.target.value as (typeof EVENT_KEYS)[number])
                            }
                        >
                            {EVENT_KEYS.map((key) => (
                                <NativeSelectOption key={key} value={key}>
                                    {key}
                                </NativeSelectOption>
                            ))}
                        </NativeSelect>
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium text-muted-foreground" htmlFor="binding-template">
                            Template id
                        </Label>
                        <Input
                            className="h-8 text-xs"
                            id="binding-template"
                            placeholder="Template id or key"
                            value={templateId}
                            onChange={(event) => setTemplateId(event.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium text-muted-foreground" htmlFor="binding-condition">
                            Send condition
                        </Label>
                        <NativeSelect
                            id="binding-condition"
                            value={sendCondition}
                            onChange={(event) =>
                                setSendCondition(event.target.value as (typeof SEND_CONDITIONS)[number])
                            }
                        >
                            {SEND_CONDITIONS.map((condition) => (
                                <NativeSelectOption key={condition} value={condition}>
                                    {condition}
                                </NativeSelectOption>
                            ))}
                        </NativeSelect>
                    </div>
                    <div className="flex items-end gap-2 pb-1">
                        <Switch
                            aria-label="Binding enabled"
                            checked={enabled}
                            onCheckedChange={setEnabled}
                        />
                        <span className="text-xs text-muted-foreground">
                            {enabled ? "Enabled" : "Disabled"}
                        </span>
                    </div>
                </div>
                {formError ? (
                    <p className="text-xs text-muted-foreground" role="alert">
                        {formError}
                    </p>
                ) : null}
                <div>
                    <Button aria-label="Create binding" size="sm" onClick={() => void handleCreate()}>
                        Hook binding
                    </Button>
                </div>
            </div>

            <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Hooked bindings</h2>
                <Button
                    aria-label="Refresh bindings"
                    disabled={isLoading}
                    size="sm"
                    variant="outline"
                    onClick={() => void refetch()}
                >
                    Refresh
                </Button>
            </div>

            {isLoading && !data ? (
                <div
                    className="flex items-center justify-center py-16"
                    data-testid="bindings-loading"
                    role="status"
                >
                    <span className="text-sm text-muted-foreground">Loading bindings…</span>
                </div>
            ) : null}

            {error ? (
                <div
                    className="rounded-lg border border-destructive/40 bg-card p-4"
                    data-testid="bindings-error"
                    role="alert"
                >
                    <p className="text-sm text-muted-foreground">{error}</p>
                    <Button className="mt-2" size="sm" variant="outline" onClick={() => void refetch()}>
                        Retry
                    </Button>
                </div>
            ) : null}

            {!isLoading && !error && data && data.length === 0 ? (
                <div
                    className="flex items-center justify-center rounded-lg border bg-card py-16"
                    data-testid="bindings-empty"
                >
                    <p className="text-sm text-muted-foreground">No bindings hooked yet.</p>
                </div>
            ) : null}

            {data && data.length > 0 ? (
                <ul className="flex flex-col gap-2" data-testid="bindings-list">
                    {data.map((row) => (
                        <li
                            className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3"
                            data-testid="binding-row"
                            key={String(row.id)}
                        >
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="truncate text-sm font-medium tabular-nums">
                                    {row.event_key}
                                </span>
                                <span className="truncate text-xs text-muted-foreground tabular-nums">
                                    template {String(row.template_id)} · {row.send_condition}
                                </span>
                            </div>
                            <Badge variant={isEnabled(row.is_enabled) ? "default" : "outline"}>
                                {isEnabled(row.is_enabled) ? "Enabled" : "Disabled"}
                            </Badge>
                            <Button
                                aria-label={`${isEnabled(row.is_enabled) ? "Disable" : "Enable"} binding ${String(row.id)}`}
                                disabled={busyId === String(row.id)}
                                size="sm"
                                variant="outline"
                                onClick={() => void handleToggle(row.id, row.is_enabled)}
                            >
                                {isEnabled(row.is_enabled) ? "Disable" : "Enable"}
                            </Button>
                            <Button
                                aria-label={`Unhook binding ${String(row.id)}`}
                                disabled={busyId === String(row.id)}
                                size="sm"
                                variant="outline"
                                onClick={() => void handleRemove(row.id)}
                            >
                                Unhook
                            </Button>
                        </li>
                    ))}
                </ul>
            ) : null}
        </section>
    );
}
