"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { useMsBindings } from "./hooks/useMsBindings";
import { useMsCatalog } from "./catalog/useMsCatalog";
import { useMsPagination } from "./hooks/useMsPagination";
import { useMsTemplates } from "./hooks/useMsTemplates";
import { createMsBinding, type MsBindingPatch, type MsBindingRow } from "./providers/msBindings";
import type { MsCatalogRow } from "./catalog/ms-catalog.schema";
import { CatalogTab } from "./catalog/CatalogTab";
import { MsCombobox } from "./components/MsCombobox";
import { MsConfirmDialog } from "./components/MsConfirmDialog";
import { MsPager } from "./components/MsPager";
import {
    classifyTokens,
    extractPayloadKeys,
    normaliseVariablesList,
} from "./utils/ms-variables";

const SEND_CONDITIONS = ["always", "on_pass", "on_fail"] as const;

type SendCondition = (typeof SEND_CONDITIONS)[number];

type BindingFilter = "all" | "attention" | "disabled";

type BindingSort = "event" | "template" | "priority";

const FILTERS: readonly { readonly value: BindingFilter; readonly label: string }[] = [
    { value: "all", label: "All" },
    { value: "attention", label: "Needs attention" },
    { value: "disabled", label: "Disabled" },
];

const SORT_OPTIONS: readonly { readonly value: BindingSort; readonly label: string }[] = [
    { value: "event", label: "Event key A–Z" },
    { value: "template", label: "Template A–Z" },
    { value: "priority", label: "Priority (lowest first)" },
];

const CONDITION_OPTIONS: readonly { readonly value: SendCondition; readonly label: string }[] = [
    { value: "always", label: "always — fire on every dispatch" },
    { value: "on_pass", label: "on_pass — fire when payload.verdict is pass" },
    { value: "on_fail", label: "on_fail — fire when payload.verdict is fail" },
];

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

function humaniseCreateError(message: string, eventKey: string): string {
    if (message.includes("UNKNOWN_EVENT_KEY")) {
        return `Event key “${eventKey}” is not an active catalog key — register it in the catalog above or pick another key.`;
    }
    return message;
}

function BindingRowCard({
    row,
    unmapped,
    unresolvable,
    templateName,
    eventOptions,
    templateOptions,
    onToggle,
    onRemove,
    onPatch,
    busy,
}: {
    readonly row: MsBindingRow;
    readonly unmapped: readonly string[];
    readonly unresolvable: string | null;
    readonly templateName: string;
    readonly eventOptions: readonly { readonly value: string; readonly label: string }[];
    readonly templateOptions: readonly { readonly value: string; readonly label: string }[];
    readonly onToggle: () => void;
    readonly onRemove: () => void;
    readonly onPatch: (patch: MsBindingPatch) => Promise<boolean>;
    readonly busy: boolean;
}) {
    const [editing, setEditing] = useState(false);
    const [eventDraft, setEventDraft] = useState(row.event_key);
    const [templateDraft, setTemplateDraft] = useState(String(row.template_id));
    const [conditionDraft, setConditionDraft] = useState<SendCondition>(
        SEND_CONDITIONS.includes(row.send_condition as SendCondition)
            ? (row.send_condition as SendCondition)
            : SEND_CONDITIONS[0],
    );
    const [recipientDraft, setRecipientDraft] = useState(bindingRecipientPath(row));
    const [priorityDraft, setPriorityDraft] = useState(String(bindingPriority(row)));
    const [editError, setEditError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const openEditor = (): void => {
        setEventDraft(row.event_key);
        setTemplateDraft(String(row.template_id));
        setConditionDraft(
            SEND_CONDITIONS.includes(row.send_condition as SendCondition)
                ? (row.send_condition as SendCondition)
                : SEND_CONDITIONS[0],
        );
        setRecipientDraft(bindingRecipientPath(row));
        setPriorityDraft(String(bindingPriority(row)));
        setEditError(null);
        setEditing(true);
    };

    const handleSaveFields = async (): Promise<void> => {
        if (!eventDraft) {
            setEditError("Event key is required — register one in the catalog above.");
            return;
        }
        if (!templateDraft.trim()) {
            setEditError("Template is required — pick one from the template list.");
            return;
        }
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
        const patch: MsBindingPatch = {};
        if (eventDraft !== row.event_key) patch.event_key = eventDraft;
        if (templateDraft.trim() !== String(row.template_id)) {
            patch.template_id = templateDraft.trim();
        }
        if (conditionDraft !== row.send_condition) patch.send_condition = conditionDraft;
        if (recipientDraft.trim() !== bindingRecipientPath(row)) {
            patch.recipient_path = recipientDraft.trim();
        }
        if (Number(priorityDraft.trim()) !== bindingPriority(row)) {
            patch.priority = Number(priorityDraft.trim());
        }
        if (Object.keys(patch).length === 0) {
            setEditing(false);
            return;
        }
        setSaving(true);
        try {
            const ok = await onPatch(patch);
            if (ok) setEditing(false);
            else setEditError("Save was rejected — the list banner holds the reason.");
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
                    <span className="truncate text-sm font-medium tabular-nums" title={row.event_key}>
                        {row.event_key}
                    </span>
                    <span
                        className="truncate text-xs text-muted-foreground tabular-nums"
                        title={`${templateName} · ${row.send_condition} · ${bindingRecipientPath(row)} · priority ${bindingPriority(row)}`}
                    >
                        {templateName} · {row.send_condition}
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
                    aria-label={`${editing ? "Close field editor for" : "Fields for"} binding ${String(row.id)}`}
                    className="min-h-11 md:min-h-0"
                    disabled={busy}
                    size="sm"
                    variant="outline"
                    onClick={() => (editing ? setEditing(false) : openEditor())}
                >
                    {editing ? "Close" : "Fields"}
                </Button>
                <Button
                    aria-label={`${isEnabled(row.is_enabled) ? "Disable" : "Enable"} binding ${String(row.id)}`}
                    className="min-h-11 md:min-h-0"
                    disabled={busy}
                    size="sm"
                    variant="outline"
                    onClick={onToggle}
                >
                    {isEnabled(row.is_enabled) ? "Disable" : "Enable"}
                </Button>
                <Button
                    aria-label={`Unhook binding ${String(row.id)}`}
                    className="min-h-11 md:min-h-0"
                    disabled={busy}
                    size="sm"
                    variant="outline"
                    onClick={onRemove}
                >
                    Unhook
                </Button>
            </div>
            {unresolvable !== null ? (
                <p className="text-xs text-destructive" data-testid="binding-unresolved" role="alert">
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
                            <Label className="text-xs font-medium text-muted-foreground" htmlFor={`binding-event-${String(row.id)}`}>
                                Event key
                            </Label>
                            <MsCombobox
                                emptyText="No active event keys."
                                id={`binding-event-${String(row.id)}`}
                                options={eventOptions}
                                placeholder="Select an event key"
                                searchPlaceholder="Search event keys…"
                                value={eventDraft}
                                onValueChange={setEventDraft}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs font-medium text-muted-foreground" htmlFor={`binding-template-${String(row.id)}`}>
                                Template
                            </Label>
                            <MsCombobox
                                emptyText="No templates found."
                                id={`binding-template-${String(row.id)}`}
                                options={templateOptions}
                                placeholder="Select a template"
                                searchPlaceholder="Search templates…"
                                value={templateDraft}
                                onValueChange={setTemplateDraft}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs font-medium text-muted-foreground" htmlFor={`binding-condition-${String(row.id)}`}>
                                Send condition
                            </Label>
                            <Select value={conditionDraft} onValueChange={(next) => setConditionDraft(next as SendCondition)}>
                                <SelectTrigger className="h-8 w-full text-xs" id={`binding-condition-${String(row.id)}`} size="sm">
                                    <SelectValue placeholder="Condition" />
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                    {CONDITION_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
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
                                Priority (lower runs first)
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
                            className="min-h-11 md:min-h-0"
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
 * registered key binds, replacing the old 3-key enum. The template picker is
 * sourced from the loaded templates — no recall-based ids. recipient_path +
 * priority editors ride the same flat write path. Each row reconciles the
 * template's compiled variables against the bound event's payload_schema
 * (§7.7) — unmapped tokens are reported, never auto-repaired. Create
 * requires the full flat row; PATCH is_enabled:false is the soft unhook;
 * DELETE is the hard unhook (confirm-first, row is gone).
 */
export function BindingsPage() {
    const { data, isLoading, error, refetch, update, remove } = useMsBindings();
    const catalog = useMsCatalog(true);
    const templates = useMsTemplates();

    const [eventKey, setEventKey] = useState("");
    const [templateId, setTemplateId] = useState("");
    const [sendCondition, setSendCondition] = useState<SendCondition>(SEND_CONDITIONS[0]);
    const [enabled, setEnabled] = useState(true);
    const [recipientPath, setRecipientPath] = useState(DEFAULT_RECIPIENT_PATH);
    const [priority, setPriority] = useState(String(DEFAULT_PRIORITY));
    const [formError, setFormError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [unhookId, setUnhookId] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<BindingFilter>("all");
    const [sort, setSort] = useState<BindingSort>("event");

    const eventOptions = useMemo(() => {
        return (catalog.data ?? [])
            .filter(catalogRowIsActive)
            .map((row) => ({
                value: row.event_key,
                label: `${row.event_key} — ${row.label}${row.module ? ` · ${row.module}` : ""}`,
            }))
            .sort((a, b) => a.value.localeCompare(b.value));
    }, [catalog.data]);
    const resolvedEventKey = eventKey !== "" ? eventKey : (eventOptions[0]?.value ?? "");

    const templateOptions = useMemo(() => {
        return (templates.data ?? []).map((row) => ({
            value: String(row.id ?? row.template_key),
            label: `${row.template_name} (${row.template_key})`,
        }));
    }, [templates.data]);

    const catalogByKey = useMemo(() => {
        const map = new Map<string, MsCatalogRow>();
        for (const row of catalog.data ?? []) map.set(row.event_key, row);
        return map;
    }, [catalog.data]);

    const templateNameByRef = useMemo(() => {
        const byId = new Map<string, string>();
        const byKey = new Map<string, string>();
        for (const row of templates.data ?? []) {
            if (row.id !== undefined && row.id !== null) {
                byId.set(String(row.id), row.template_name);
            }
            byKey.set(row.template_key, row.template_name);
        }
        return { byId, byKey };
    }, [templates.data]);

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

    const bindingCounts = useMemo(() => {
        const counts = new Map<string, number>();
        for (const row of data ?? []) {
            counts.set(row.event_key, (counts.get(row.event_key) ?? 0) + 1);
        }
        return counts;
    }, [data]);

    const resolveTemplateName = (ref: string | number): string => {
        const key = String(ref);
        return (
            templateNameByRef.byId.get(key) ??
            templateNameByRef.byKey.get(key) ??
            `template ${key}`
        );
    };

    const analysed = useMemo(() => {
        return (data ?? []).map((row) => {
            const catalogRow = catalogByKey.get(row.event_key);
            if (!catalogRow) {
                return { row, unmapped: [] as string[], unresolvable: `Event key ${row.event_key} is not in the catalog.` as string | null };
            }
            const ref = String(row.template_id);
            const variables = templateVariables.byId.get(ref) ?? templateVariables.byKey.get(ref);
            if (!variables) {
                return { row, unmapped: [] as string[], unresolvable: `Template ${ref} is not loaded — variables unknown.` as string | null };
            }
            const provided = extractPayloadKeys(catalogRow.payload_schema, catalogRow.payload_example);
            return {
                row,
                unmapped: classifyTokens(variables, provided).unmapped,
                unresolvable: null as string | null,
            };
        });
    }, [data, catalogByKey, templateVariables]);

    const attentionCount = useMemo(() => {
        return analysed.filter((item) => item.unmapped.length > 0 || item.unresolvable !== null).length;
    }, [analysed]);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        const rows = analysed.filter((item) => {
            if (filter === "disabled" && isEnabled(item.row.is_enabled)) return false;
            if (filter === "attention" && item.unmapped.length === 0 && item.unresolvable === null) {
                return false;
            }
            if (!query) return true;
            const templateName = resolveTemplateName(item.row.template_id).toLowerCase();
            return (
                item.row.event_key.toLowerCase().includes(query) ||
                templateName.includes(query) ||
                String(item.row.template_id).toLowerCase().includes(query)
            );
        });
        return [...rows].sort((a, b) => {
            if (sort === "priority") return bindingPriority(a.row) - bindingPriority(b.row);
            if (sort === "template") {
                return resolveTemplateName(a.row.template_id).localeCompare(
                    resolveTemplateName(b.row.template_id),
                );
            }
            return a.row.event_key.localeCompare(b.row.event_key);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [analysed, filter, search, sort, templateNameByRef]);

    const { page, totalPages, pageItems, setPage, resetPage } = useMsPagination(filtered.length);
    const visible = pageItems(filtered);

    const handleCreate = async (): Promise<void> => {
        setFormError(null);
        if (resolvedEventKey === "") {
            setFormError("Event key is required — register one in the catalog above.");
            return;
        }
        if (!templateId.trim()) {
            setFormError("Template is required — pick one from the template list.");
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
        setCreating(true);
        try {
            await createMsBinding({
                event_key: resolvedEventKey,
                template_id: templateId.trim(),
                is_enabled: enabled,
                send_condition: sendCondition,
                ...(trimmedRecipient !== DEFAULT_RECIPIENT_PATH
                    ? { recipient_path: trimmedRecipient }
                    : {}),
                ...(parsedPriority !== DEFAULT_PRIORITY ? { priority: parsedPriority } : {}),
            });
            await refetch();
            setTemplateId("");
            setRecipientPath(DEFAULT_RECIPIENT_PATH);
            setPriority(String(DEFAULT_PRIORITY));
        } catch (cause) {
            const message = cause instanceof Error ? cause.message : String(cause);
            setFormError(humaniseCreateError(message, resolvedEventKey));
        } finally {
            setCreating(false);
        }
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

    const handleUnhookConfirm = async (): Promise<void> => {
        if (unhookId === null) return;
        setBusyId(unhookId);
        try {
            await remove(unhookId);
        } finally {
            setBusyId(null);
            setUnhookId(null);
        }
    };

    return (
        <section aria-label="Bindings" className="flex min-h-0 flex-1 flex-col gap-4">
            <CatalogTab bindingCounts={bindingCounts} />

            <div className="flex flex-col gap-3 rounded-lg border bg-card p-4" data-testid="bindings-form">
                <h2 className="text-sm font-semibold">Hook a binding</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium text-muted-foreground" htmlFor="binding-event">
                            Event key <span className="text-destructive">*</span>
                        </Label>
                        {catalog.isLoading && !catalog.data ? (
                            <Skeleton className="h-8 w-full" data-testid="bindings-catalog-loading" />
                        ) : (
                            <MsCombobox
                                disabled={eventOptions.length === 0}
                                emptyText="No active event keys."
                                id="binding-event"
                                options={eventOptions}
                                placeholder={eventOptions.length === 0 ? "No active event keys" : "Select an event key"}
                                searchPlaceholder="Search event keys…"
                                value={resolvedEventKey}
                                onValueChange={setEventKey}
                            />
                        )}
                        {catalog.error ? (
                            <p className="text-[11px] leading-snug text-destructive" role="alert">
                                Catalog failed to load: {catalog.error}
                            </p>
                        ) : null}
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium text-muted-foreground" htmlFor="binding-template">
                            Template <span className="text-destructive">*</span>
                        </Label>
                        <MsCombobox
                            disabled={templates.isLoading}
                            emptyText="No templates found."
                            id="binding-template"
                            options={templateOptions}
                            placeholder={templates.isLoading ? "Loading templates…" : "Select a template"}
                            searchPlaceholder="Search templates…"
                            value={templateId}
                            onValueChange={setTemplateId}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium text-muted-foreground" htmlFor="binding-condition">
                            Send condition
                        </Label>
                        <Select value={sendCondition} onValueChange={(next) => setSendCondition(next as SendCondition)}>
                            <SelectTrigger className="h-8 w-full text-xs" id="binding-condition" size="sm">
                                <SelectValue placeholder="Condition" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                                {CONDITION_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-[11px] leading-snug text-muted-foreground">
                            Matched against payload.verdict — always ignores the verdict.
                        </p>
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
                            Priority (lower runs first)
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
                    <p className="text-xs text-destructive" role="alert">
                        {formError}
                    </p>
                ) : null}
                <div>
                    <Button
                        className="min-h-11 md:min-h-0"
                        disabled={creating}
                        size="sm"
                        onClick={() => void handleCreate()}
                    >
                        {creating ? "Hooking…" : "Hook binding"}
                    </Button>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold">Hooked bindings</h2>
                    {data ? (
                        <span
                            className="rounded-full border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground tabular-nums"
                            data-testid="bindings-count"
                        >
                            {data.length}
                        </span>
                    ) : null}
                </div>
                <Button
                    aria-label="Refresh bindings"
                    className="min-h-11 md:min-h-0"
                    disabled={isLoading}
                    size="sm"
                    variant="outline"
                    onClick={() => void refetch()}
                >
                    Refresh
                </Button>
            </div>

            {data && data.length > 0 ? (
                <p className="text-xs text-muted-foreground tabular-nums" data-testid="bindings-summary" role="status">
                    {data.length} binding{data.length === 1 ? "" : "s"}
                    {attentionCount > 0 ? ` · ${attentionCount} need${attentionCount === 1 ? "s" : ""} attention` : " · all reconciled"}
                </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
                <Input
                    aria-label="Search bindings"
                    className="h-8 max-w-xs text-xs"
                    placeholder="Search event key or template…"
                    value={search}
                    onChange={(event) => {
                        setSearch(event.target.value);
                        resetPage();
                    }}
                />
                <div className="flex items-center gap-1" role="group" aria-label="Bindings filter">
                    {FILTERS.map((option) => (
                        <button
                            aria-pressed={filter === option.value}
                            className={cn(
                                "min-h-11 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-150 md:min-h-0",
                                filter === option.value
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                            )}
                            key={option.value}
                            type="button"
                            onClick={() => {
                                setFilter(option.value);
                                resetPage();
                            }}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                <Select
                    value={sort}
                    onValueChange={(next) => {
                        setSort(next as BindingSort);
                        resetPage();
                    }}
                >
                    <SelectTrigger aria-label="Sort bindings" className="h-8 max-w-[220px] text-xs" size="sm">
                        <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                        {SORT_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {isLoading && !data ? (
                <div className="flex flex-col gap-2" data-testid="bindings-loading" role="status" aria-label="Loading bindings">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <span className="sr-only">Loading bindings…</span>
                </div>
            ) : null}

            {error ? (
                <div
                    className="rounded-lg border border-destructive/40 bg-card p-4"
                    data-testid="bindings-error"
                    role="alert"
                >
                    <p className="text-sm text-destructive">{error}</p>
                    <Button className="mt-2 min-h-11 md:min-h-0" size="sm" variant="outline" onClick={() => void refetch()}>
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

            {!isLoading && !error && data && data.length > 0 && filtered.length === 0 ? (
                <div
                    className="flex flex-col items-center gap-2 rounded-lg border bg-card py-16 text-center"
                    data-testid="bindings-no-match"
                >
                    <p className="text-sm text-muted-foreground">No bindings match this view.</p>
                    <p className="text-xs text-muted-foreground">Try a different search or filter.</p>
                </div>
            ) : null}

            {visible.length > 0 ? (
                <ul className="flex flex-col gap-2" data-testid="bindings-list">
                    {visible.map((item) => (
                        <BindingRowCard
                            busy={busyId === String(item.row.id)}
                            eventOptions={eventOptions}
                            key={String(item.row.id)}
                            row={item.row}
                            templateName={resolveTemplateName(item.row.template_id)}
                            templateOptions={templateOptions}
                            unmapped={item.unmapped}
                            unresolvable={item.unresolvable}
                            onPatch={(patch) => handlePatchFields(item.row.id, patch)}
                            onRemove={() => setUnhookId(String(item.row.id))}
                            onToggle={() => void handleToggle(item.row.id, item.row.is_enabled)}
                        />
                    ))}
                </ul>
            ) : null}
            <MsPager page={page} totalPages={totalPages} onPage={setPage} />
            <MsConfirmDialog
                confirmLabel="Unhook binding"
                description="The row is deleted and the event stops resolving to this template. Re-hooking needs the full form again."
                open={unhookId !== null}
                title="Unhook this binding?"
                busy={busyId !== null}
                busyLabel="Unhooking…"
                onConfirm={() => void handleUnhookConfirm()}
                onOpenChange={(open) => {
                    if (!open) setUnhookId(null);
                }}
            />
        </section>
    );
}
