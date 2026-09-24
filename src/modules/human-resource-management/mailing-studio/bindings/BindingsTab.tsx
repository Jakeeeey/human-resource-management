"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

import { useMsBindings } from "../hooks/useMsBindings";
import { useMsCatalog } from "../hooks/useMsCatalog";
import { useMsTemplates } from "../hooks/useMsTemplates";
import type { MsBindingPatch, MsBindingRow } from "../providers/msBindings";
import type { MsCatalogRow } from "../types/ms-catalog.schema";
import { CatalogTab } from "../components/CatalogTab";
import {
    classifyTokens,
    extractPayloadKeys,
    normaliseVariablesList,
} from "../utils/ms-variables";

const SEND_CONDITIONS = ["always", "on_pass", "on_fail"] as const;

const DEFAULT_RECIPIENT_PATH = "$.payload.to";
const DEFAULT_PRIORITY = 100;

function isEnabled(value: unknown): boolean {
    return value === true || value === 1 || value === "1" || value === "true";
}

function catalogRowIsActive(row: MsCatalogRow): boolean {
    const value: unknown = row.is_active;
    return value === true || value === 1 || value === "1" || value === "true";
}

function bindingRecipientPath(row: MsBindingRow): string {
    return typeof row.recipient_path === "string" && row.recipient_path.length > 0
        ? row.recipient_path
        : DEFAULT_RECIPIENT_PATH;
}

function bindingPriority(row: MsBindingRow): number {
    const raw = typeof row.priority === "string" ? Number(row.priority) : row.priority;
    return typeof raw === "number" && Number.isInteger(raw) && raw >= 0
        ? raw
        : DEFAULT_PRIORITY;
}

function validateRecipientPath(raw: string): string | null {
    if (raw.trim().length === 0) return "Recipient path is required.";
    if (!raw.trim().startsWith("$.")) return "Recipient path must start with $.";
    return null;
}

function validatePriority(raw: string): string | null {
    if (raw.trim().length === 0) return "Priority is required.";
    const parsed = Number(raw.trim());
    if (!Number.isInteger(parsed) || parsed < 0) {
        return "Priority must be a non-negative integer.";
    }
    return null;
}

function BindingRowCard({
    row,
    unmapped,
    unresolvable,
    onToggle,
    onRemove,
    onPatch,
    busy,
}: {
    readonly row: MsBindingRow;
    readonly unmapped: readonly string[];
    readonly unresolvable: string | null;
    readonly onToggle: () => void;
    readonly onRemove: () => void;
    readonly onPatch: (patch: MsBindingPatch) => Promise<boolean>;
    readonly busy: boolean;
}) {
    const [editing, setEditing] = useState(false);
    const [recipientDraft, setRecipientDraft] = useState(bindingRecipientPath(row));
    const [priorityDraft, setPriorityDraft] = useState(String(bindingPriority(row)));
    const [editError, setEditError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const openEditor = (): void => {
        setRecipientDraft(bindingRecipientPath(row));
        setPriorityDraft(String(bindingPriority(row)));
        setEditError(null);
        setEditing(true);
    };

    const handleSaveFields = async (): Promise<void> => {
        const recipientProblem = validateRecipientPath(recipientDraft);
        if (recipientProblem !== null) {
            setEditError(recipientProblem);
            return;
        }
        const priorityProblem = validatePriority(priorityDraft);
        if (priorityProblem !== null) {
            setEditError(priorityProblem);
            return;
        }
        setSaving(true);
        try {
            const ok = await onPatch({
                recipient_path: recipientDraft.trim(),
                priority: Number(priorityDraft.trim()),
            });
            if (ok) setEditing(false);
        } finally {
            setSaving(false);
        }
    };

    return (
        <li
            className="flex flex-col gap-2 rounded-lg border bg-card p-3"
            data-testid="binding-row"
        >
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium tabular-nums">
                        {row.event_key}
                    </span>
                    <span className="truncate text-xs text-muted-foreground tabular-nums">
                        template {String(row.template_id)} · {row.send_condition}
                        {` · ${bindingRecipientPath(row)} · priority ${bindingPriority(row)}`}
                    </span>
                </div>
                <Badge variant={isEnabled(row.is_enabled) ? "default" : "outline"}>
                    {isEnabled(row.is_enabled) ? "Enabled" : "Disabled"}
                </Badge>
                {unmapped.length > 0 ? (
                    <Badge variant="outline" data-testid="binding-unmapped-badge">
                        Unmapped {unmapped.length}
                    </Badge>
                ) : null}
                <Button
                    aria-label={`${editing ? "Close field editor for" : "Edit fields for"} binding ${String(row.id)}`}
                    disabled={busy}
                    size="sm"
                    variant="outline"
                    onClick={() => (editing ? setEditing(false) : openEditor())}
                >
                    {editing ? "Close" : "Fields"}
                </Button>
                <Button
                    aria-label={`${isEnabled(row.is_enabled) ? "Disable" : "Enable"} binding ${String(row.id)}`}
                    disabled={busy}
                    size="sm"
                    variant="outline"
                    onClick={onToggle}
                >
                    {isEnabled(row.is_enabled) ? "Disable" : "Enable"}
                </Button>
                <Button
                    aria-label={`Unhook binding ${String(row.id)}`}
                    disabled={busy}
                    size="sm"
                    variant="outline"
                    onClick={onRemove}
                >
                    Unhook
                </Button>
            </div>
            {unresolvable !== null ? (
                <p className="text-xs text-muted-foreground" data-testid="binding-unresolved">
                    {unresolvable}
                </p>
            ) : unmapped.length > 0 ? (
                <p className="text-xs text-destructive" data-testid="binding-unmapped" role="alert">
                    Unmapped variables: {unmapped.join(", ")} — the template uses
                    {unmapped.length === 1 ? " this key" : " these keys"} but the event does
                    not provide {unmapped.length === 1 ? "it" : "them"}. Fix the token or
                    the event schema; nothing is auto-repaired.
                </p>
            ) : null}
            {editing ? (
                <div className="flex flex-col gap-3 border-t pt-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs font-medium text-muted-foreground" htmlFor={`binding-recipient-${String(row.id)}`}>
                                Recipient path
                            </Label>
                            <Input
                                className="h-8 font-mono text-xs"
                                id={`binding-recipient-${String(row.id)}`}
                                spellCheck={false}
                                value={recipientDraft}
                                onChange={(event) => setRecipientDraft(event.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs font-medium text-muted-foreground" htmlFor={`binding-priority-${String(row.id)}`}>
                                Priority
                            </Label>
                            <Input
                                className="h-8 text-xs tabular-nums"
                                id={`binding-priority-${String(row.id)}`}
                                inputMode="numeric"
                                value={priorityDraft}
                                onChange={(event) => setPriorityDraft(event.target.value)}
                            />
                        </div>
                    </div>
                    {editError ? (
                        <p className="text-xs text-destructive" role="alert">
                            {editError}
                        </p>
                    ) : null}
                    <div>
                        <Button
                            aria-label={`Save fields for binding ${String(row.id)}`}
                            disabled={saving}
                            size="sm"
                            onClick={() => void handleSaveFields()}
                        >
                            {saving ? "Saving…" : "Save fields"}
                        </Button>
                    </div>
                </div>
            ) : null}
        </li>
    );
}

/**
 * Bindings tab — hook event keys to templates via the real bindings routes.
 * The event-key picker is sourced from the event_catalog (D4): any active
 * registered key binds, replacing the old 3-key enum. recipient_path +
 * priority editors ride the same flat write path. Each row reconciles the
 * template's compiled variables against the bound event's payload_schema
 * (§7.7) — unmapped tokens are reported, never auto-repaired. Create
 * requires the full flat row; PATCH is_enabled:false is the soft unhook;
 * DELETE is the hard unhook (confirm-first, row is gone).
 */
export function BindingsTab() {
    const { data, isLoading, error, refetch, create, update, remove } = useMsBindings();
    const catalog = useMsCatalog(true);
    const templates = useMsTemplates();

    const [eventKey, setEventKey] = useState("");
    const [templateId, setTemplateId] = useState("");
    const [sendCondition, setSendCondition] = useState<(typeof SEND_CONDITIONS)[number]>(
        SEND_CONDITIONS[0],
    );
    const [enabled, setEnabled] = useState(true);
    const [recipientPath, setRecipientPath] = useState(DEFAULT_RECIPIENT_PATH);
    const [priority, setPriority] = useState(String(DEFAULT_PRIORITY));
    const [formError, setFormError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    const activeKeys = useMemo(() => {
        if (!catalog.data) return null;
        return catalog.data.filter(catalogRowIsActive).map((row) => row.event_key).sort();
    }, [catalog.data]);
    const resolvedEventKey = eventKey !== "" ? eventKey : (activeKeys?.[0] ?? "");

    const catalogByKey = useMemo(() => {
        const map = new Map<string, MsCatalogRow>();
        for (const row of catalog.data ?? []) map.set(row.event_key, row);
        return map;
    }, [catalog.data]);

    const templateVariables = useMemo(() => {
        const byId = new Map<string, string[]>();
        const byKey = new Map<string, string[]>();
        for (const row of templates.data ?? []) {
            const variables = normaliseVariablesList(row.variables);
            if (row.id !== undefined && row.id !== null) {
                byId.set(String(row.id), variables);
            }
            byKey.set(row.template_key, variables);
        }
        return { byId, byKey };
    }, [templates.data]);

    const reconcile = (row: MsBindingRow): { unmapped: string[]; unresolvable: string | null } => {
        const catalogRow = catalogByKey.get(row.event_key);
        if (!catalogRow) {
            return { unmapped: [], unresolvable: `Event key ${row.event_key} is not in the catalog.` };
        }
        const ref = String(row.template_id);
        const variables = templateVariables.byId.get(ref) ?? templateVariables.byKey.get(ref);
        if (!variables) {
            return { unmapped: [], unresolvable: `Template ${ref} is not loaded — variables unknown.` };
        }
        const provided = extractPayloadKeys(catalogRow.payload_schema, catalogRow.payload_example);
        return { unmapped: classifyTokens(variables, provided).unmapped, unresolvable: null };
    };

    const handleCreate = async (): Promise<void> => {
        setFormError(null);
        if (resolvedEventKey === "") {
            setFormError("Event key is required — register one in the catalog above.");
            return;
        }
        if (!templateId.trim()) {
            setFormError("Template id is required.");
            return;
        }
        const recipientProblem = validateRecipientPath(recipientPath);
        if (recipientProblem !== null) {
            setFormError(recipientProblem);
            return;
        }
        const priorityProblem = validatePriority(priority);
        if (priorityProblem !== null) {
            setFormError(priorityProblem);
            return;
        }
        const trimmedRecipient = recipientPath.trim();
        const parsedPriority = Number(priority.trim());
        await create({
            event_key: resolvedEventKey,
            template_id: templateId.trim(),
            is_enabled: enabled,
            send_condition: sendCondition,
            ...(trimmedRecipient !== DEFAULT_RECIPIENT_PATH
                ? { recipient_path: trimmedRecipient }
                : {}),
            ...(parsedPriority !== DEFAULT_PRIORITY ? { priority: parsedPriority } : {}),
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

    const handlePatchFields = async (
        id: string | number,
        patch: MsBindingPatch,
    ): Promise<boolean> => {
        const key = String(id);
        setBusyId(key);
        try {
            const row = await update(id, patch);
            return row !== null;
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
            <CatalogTab />

            <div className="flex flex-col gap-3 rounded-lg border bg-card p-4" data-testid="bindings-form">
                <h2 className="text-sm font-semibold">Hook a binding</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium text-muted-foreground" htmlFor="binding-event">
                            Event key
                        </Label>
                        {catalog.isLoading && !catalog.data ? (
                            <Skeleton className="h-8 w-full" data-testid="bindings-catalog-loading" />
                        ) : (
                            <NativeSelect
                                id="binding-event"
                                value={resolvedEventKey}
                                disabled={!activeKeys || activeKeys.length === 0}
                                onChange={(event) => setEventKey(event.target.value)}
                            >
                                {(!activeKeys || activeKeys.length === 0) && (
                                    <NativeSelectOption value="">
                                        No active event keys
                                    </NativeSelectOption>
                                )}
                                {(activeKeys ?? []).map((key) => (
                                    <NativeSelectOption key={key} value={key}>
                                        {key}
                                    </NativeSelectOption>
                                ))}
                            </NativeSelect>
                        )}
                        {catalog.error ? (
                            <p className="text-[11px] leading-snug text-destructive" role="alert">
                                Catalog failed to load: {catalog.error}
                            </p>
                        ) : null}
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
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium text-muted-foreground" htmlFor="binding-recipient">
                            Recipient path
                        </Label>
                        <Input
                            className="h-8 font-mono text-xs"
                            id="binding-recipient"
                            spellCheck={false}
                            value={recipientPath}
                            onChange={(event) => setRecipientPath(event.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium text-muted-foreground" htmlFor="binding-priority">
                            Priority
                        </Label>
                        <Input
                            className="h-8 text-xs tabular-nums"
                            id="binding-priority"
                            inputMode="numeric"
                            value={priority}
                            onChange={(event) => setPriority(event.target.value)}
                        />
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
                    {data.map((row) => {
                        const { unmapped, unresolvable } = reconcile(row);
                        return (
                            <BindingRowCard
                                busy={busyId === String(row.id)}
                                key={String(row.id)}
                                row={row}
                                unmapped={unmapped}
                                unresolvable={unresolvable}
                                onPatch={(patch) => handlePatchFields(row.id, patch)}
                                onRemove={() => void handleRemove(row.id)}
                                onToggle={() => void handleToggle(row.id, row.is_enabled)}
                            />
                        );
                    })}
                </ul>
            ) : null}
        </section>
    );
}
