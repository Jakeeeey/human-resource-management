"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Link2,
    Loader2,
    MoreVertical,
    RefreshCw,
    SearchX,
    TriangleAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { MsCombobox } from "./components/MsCombobox";
import { MsConfirmDialog } from "./components/MsConfirmDialog";
import { MsPager } from "./components/MsPager";
import {
    classifyTokens,
    extractPayloadKeys,
    normaliseVariablesList,
} from "./utils/ms-variables";

type BindingFilter = "all" | "attention" | "disabled";

type BindingSort = "event" | "template";

type BindingDialogMode = "create" | "edit";

const FILTERS: readonly { readonly value: BindingFilter; readonly label: string }[] = [
    { value: "all", label: "All" },
    { value: "attention", label: "Needs attention" },
    { value: "disabled", label: "Disabled" },
];

const SORT_OPTIONS: readonly { readonly value: BindingSort; readonly label: string }[] = [
    { value: "event", label: "Event key A–Z" },
    { value: "template", label: "Template A–Z" },
];

function isEnabled(value: unknown): boolean {
    return value === true || value === 1 || value === "1" || value === "true";
}

function catalogRowIsActive(row: MsCatalogRow): boolean {
    const value: unknown = row.is_active;
    return value === true || value === 1 || value === "1" || value === "true";
}

function stripMachineCode(message: string): string {
    const stripped = message.replace(/^[A-Z][A-Z0-9_]+:\s*/, "").trim();
    return stripped === "" ? message.trim() : stripped;
}

function humaniseBindingError(message: string, eventKey = ""): string {
    if (message.includes("UNKNOWN_EVENT_KEY")) {
        return eventKey === ""
            ? "This event key is not an active catalog key — configure it in the event registry or pick another key."
            : `Event key “${eventKey}” is not an active catalog key — configure it in the event registry or pick another key.`;
    }
    const stripped = stripMachineCode(message);
    if (stripped !== "") return stripped;
    return "Something went wrong — please try again.";
}

function MsBindingDialog({
    open,
    onOpenChange,
    mode,
    binding,
    eventOptions,
    templateOptions,
    catalogLoading,
    catalogError,
    templatesLoading,
    submitting,
    onSubmit,
}: {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly mode: BindingDialogMode;
    readonly binding: MsBindingRow | null;
    readonly eventOptions: readonly { readonly value: string; readonly label: string }[];
    readonly templateOptions: readonly { readonly value: string; readonly label: string }[];
    readonly catalogLoading: boolean;
    readonly catalogError: string | null;
    readonly templatesLoading: boolean;
    readonly submitting: boolean;
    readonly onSubmit: (draft: { eventKeyId: string; templateId: string; enabled: boolean }) => Promise<string | null>;
}) {
    const initialEvent = binding ? String(binding.event_key_id) : (eventOptions[0]?.value ?? "");
    const initialTemplate = binding ? String(binding.template_id) : "";
    const initialEnabled = binding ? isEnabled(binding.is_enabled) : true;

    const [eventDraft, setEventDraft] = useState(initialEvent);
    const [templateDraft, setTemplateDraft] = useState(initialTemplate);
    const [enabledDraft, setEnabledDraft] = useState(initialEnabled);
    const [localError, setLocalError] = useState<string | null>(null);

    const title = mode === "create" ? "Hook binding" : "Edit binding";
    const description =
        mode === "create"
            ? "Hook a registered event key to a template so the studio knows what to send."
            : "Change which event key or template this binding points at.";
    const submitLabel = mode === "create" ? "Hook binding" : "Save fields";
    const eventId = binding ? `binding-event-${String(binding.id)}` : "binding-event";
    const templateId = binding ? `binding-template-${String(binding.id)}` : "binding-template";

    const handleSubmit = (event: React.FormEvent): void => {
        event.preventDefault();
        if (!eventDraft) {
            setLocalError(humaniseBindingError("Event key is required — configure one in the event registry."));
            return;
        }
        if (!templateDraft.trim()) {
            setLocalError(humaniseBindingError("Template is required — pick one from the template list."));
            return;
        }
        setLocalError(null);
        void onSubmit({ eventKeyId: eventDraft, templateId: templateDraft.trim(), enabled: enabledDraft }).then(
            (failure) => {
                if (failure !== null) setLocalError(humaniseBindingError(failure, eventDraft));
            },
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] w-[95vw] flex-col overflow-hidden rounded-2xl p-0 sm:max-w-[500px]">
                <DialogHeader className="px-6 pt-6">
                    <DialogTitle className="line-clamp-1">{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <form data-testid="bindings-form" onSubmit={handleSubmit}>
                    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs font-medium text-muted-foreground" htmlFor={eventId}>
                                Event key <span className="text-destructive">*</span>
                            </Label>
                            {catalogLoading && eventOptions.length === 0 ? (
                                <Skeleton className="h-8 w-full" />
                            ) : (
                                <MsCombobox
                                    disabled={eventOptions.length === 0}
                                    emptyText="No active event keys."
                                    id={eventId}
                                    options={eventOptions}
                                    placeholder={eventOptions.length === 0 ? "No active event keys" : "Select an event key"}
                                    searchPlaceholder="Search event keys…"
                                    value={eventDraft}
                                    onValueChange={setEventDraft}
                                />
                            )}
                            {catalogError ? (
                                <p className="text-[11px] leading-snug text-destructive" role="alert">
                                    Event catalog failed to load: {humaniseBindingError(catalogError)}
                                </p>
                            ) : null}
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs font-medium text-muted-foreground" htmlFor={templateId}>
                                Template <span className="text-destructive">*</span>
                            </Label>
                            <MsCombobox
                                disabled={templatesLoading}
                                emptyText="No templates found."
                                id={templateId}
                                options={templateOptions}
                                placeholder={templatesLoading ? "Loading templates…" : "Select a template"}
                                searchPlaceholder="Search templates…"
                                value={templateDraft}
                                onValueChange={setTemplateDraft}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                aria-label="Binding enabled"
                                checked={enabledDraft}
                                onCheckedChange={setEnabledDraft}
                            />
                            <span className="text-xs text-muted-foreground">
                                {enabledDraft ? "Enabled" : "Disabled"}
                            </span>
                        </div>
                        {localError ? (
                            <p className="text-xs text-destructive" role="alert">
                                {localError}
                            </p>
                        ) : null}
                    </div>
                    <DialogFooter className="border-t bg-muted/20 px-6 py-4">
                        <DialogClose asChild>
                            <Button className="min-h-11 md:min-h-0" size="sm" type="button" variant="outline">
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button className="min-h-11 md:min-h-0" disabled={submitting} size="sm" type="submit">
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            {submitLabel}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function BindingRowCard({
    row,
    eventKeyText,
    unmapped,
    unresolvable,
    templateName,
    onToggle,
    onRemove,
    onEdit,
    busy,
}: {
    readonly row: MsBindingRow;
    readonly eventKeyText: string;
    readonly unmapped: readonly string[];
    readonly unresolvable: string | null;
    readonly templateName: string;
    readonly onToggle: () => void;
    readonly onRemove: () => void;
    readonly onEdit: () => void;
    readonly busy: boolean;
}) {
    const enabled = isEnabled(row.is_enabled);

    return (
        <li
            className="flex flex-col gap-2 rounded-lg border bg-card p-3"
            data-testid="binding-row"
        >
            <div className="flex items-start gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-mono text-sm font-medium" title={eventKeyText}>
                        {eventKeyText}
                    </span>
                    <span
                        className="truncate font-mono text-xs text-muted-foreground"
                        title={templateName}
                    >
                        {templateName}
                    </span>
                </div>
                <Badge
                    className={
                        enabled
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : "border-muted-foreground/30 bg-muted text-muted-foreground"
                    }
                    variant="outline"
                >
                    {enabled ? "Enabled" : "Disabled"}
                </Badge>
                {unmapped.length > 0 ? (
                    <Badge variant="outline" data-testid="binding-unmapped-badge">
                        Unmapped {unmapped.length}
                    </Badge>
                ) : null}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            aria-label={`Actions for binding ${String(row.id)}`}
                            className="h-8 w-8 shrink-0"
                            disabled={busy}
                            size="icon"
                            variant="ghost"
                        >
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[180px]">
                        <DropdownMenuItem disabled={busy} onSelect={onEdit}>
                            Edit fields
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={busy} onSelect={onToggle}>
                            {enabled ? "Disable" : "Enable"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                            disabled={busy}
                            onSelect={onRemove}
                        >
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Unhook
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            {unresolvable !== null ? (
                <div
                    className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive"
                    data-testid="binding-unresolved"
                    role="alert"
                >
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{unresolvable}</span>
                </div>
            ) : unmapped.length > 0 ? (
                <div
                    className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive"
                    data-testid="binding-unmapped"
                    role="alert"
                >
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                        Unmapped variables: {unmapped.join(", ")} — the template uses
                        {unmapped.length === 1 ? " this key" : " these keys"} but the event does
                        not provide {unmapped.length === 1 ? "it" : "them"}. Fix the token or
                        the event schema; nothing is auto-repaired.
                    </span>
                </div>
            ) : null}
        </li>
    );
}

export function BindingsPage() {
    const { data, isLoading, error, refetch, update, remove } = useMsBindings();
    const catalog = useMsCatalog(true);
    const templates = useMsTemplates();
    const router = useRouter();

    const [createOpen, setCreateOpen] = useState(false);
    const [editingRow, setEditingRow] = useState<MsBindingRow | null>(null);
    const [creating, setCreating] = useState(false);
    const [retrying, setRetrying] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [unhookId, setUnhookId] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<BindingFilter>("all");
    const [sort, setSort] = useState<BindingSort>("event");

    const eventOptions = useMemo(() => {
        return (catalog.data ?? [])
            .filter(catalogRowIsActive)
            .map((row) => ({
                value: String(row.id),
                label: `${row.event_key} — ${row.label}${row.module ? ` · ${row.module}` : ""}`,
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [catalog.data]);

    const templateOptions = useMemo(() => {
        return (templates.data ?? []).map((row) => ({
            value: String(row.id ?? row.template_key),
            label: `${row.template_name} (${row.template_key})`,
        }));
    }, [templates.data]);

    const catalogById = useMemo(() => {
        const map = new Map<string, MsCatalogRow>();
        for (const row of catalog.data ?? []) map.set(String(row.id), row);
        return map;
    }, [catalog.data]);

    const resolveBindingKey = useCallback(
        (eventKeyId: string | number): string => {
            return catalogById.get(String(eventKeyId))?.event_key ?? "Unknown event";
        },
        [catalogById],
    );

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

    const resolveTemplateName = useCallback(
        (ref: string | number): string => {
            const key = String(ref);
            return (
                templateNameByRef.byId.get(key) ??
                templateNameByRef.byKey.get(key) ??
                "Unnamed template"
            );
        },
        [templateNameByRef],
    );

    const analysed = useMemo(() => {
        return (data ?? []).map((row) => {
            const catalogRow = catalogById.get(String(row.event_key_id));
            if (!catalogRow) {
                return { row, unmapped: [] as string[], unresolvable: "This binding points at an event that is not in the catalog." as string | null };
            }
            const ref = String(row.template_id);
            const variables = templateVariables.byId.get(ref) ?? templateVariables.byKey.get(ref);
            if (!variables) {
                return { row, unmapped: [] as string[], unresolvable: "This binding points at a template that is not loaded — variables unknown." as string | null };
            }
            const provided = extractPayloadKeys(catalogRow.payload_schema, catalogRow.payload_example);
            return {
                row,
                unmapped: classifyTokens(variables, provided).unmapped,
                unresolvable: null as string | null,
            };
        });
    }, [data, catalogById, templateVariables]);

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
                resolveBindingKey(item.row.event_key_id).toLowerCase().includes(query) ||
                templateName.includes(query) ||
                String(item.row.template_id).toLowerCase().includes(query)
            );
        });
        return [...rows].sort((a, b) => {
            if (sort === "template") {
                return resolveTemplateName(a.row.template_id).localeCompare(
                    resolveTemplateName(b.row.template_id),
                );
            }
            return resolveBindingKey(a.row.event_key_id).localeCompare(
                resolveBindingKey(b.row.event_key_id),
            );
        });
    }, [analysed, filter, search, sort, resolveTemplateName, resolveBindingKey]);

    const { page, totalPages, pageItems, setPage, resetPage } = useMsPagination(filtered.length);
    const visible = pageItems(filtered);

    const handleCreateSubmit = async (draft: { eventKeyId: string; templateId: string; enabled: boolean }): Promise<string | null> => {
        setCreating(true);
        try {
            await createMsBinding({
                event_key_id: draft.eventKeyId,
                template_id: draft.templateId,
                is_enabled: draft.enabled,
            });
            await refetch();
            setCreateOpen(false);
            return null;
        } catch (cause) {
            const message = cause instanceof Error ? cause.message : String(cause);
            return message;
        } finally {
            setCreating(false);
        }
    };

    const handleEditSubmit = async (draft: { eventKeyId: string; templateId: string; enabled: boolean }): Promise<string | null> => {
        if (!editingRow) return "No binding is selected for editing — close and try again.";
        const patch: MsBindingPatch = {};
        if (draft.eventKeyId !== String(editingRow.event_key_id)) patch.event_key_id = draft.eventKeyId;
        if (draft.templateId !== String(editingRow.template_id)) {
            patch.template_id = draft.templateId;
        }
        if (draft.enabled !== isEnabled(editingRow.is_enabled)) patch.is_enabled = draft.enabled;
        if (Object.keys(patch).length === 0) {
            setEditingRow(null);
            return null;
        }
        const key = String(editingRow.id);
        setBusyId(key);
        try {
            const row = await update(editingRow.id, patch);
            if (row === null) return "Save was rejected — the list banner holds the reason.";
            setEditingRow(null);
            return null;
        } finally {
            setBusyId(null);
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

    const handleRetry = async (): Promise<void> => {
        setRetrying(true);
        try {
            await refetch();
        } finally {
            setRetrying(false);
        }
    };

    return (
        <section aria-label="Bindings" className="flex min-h-0 flex-1 flex-col gap-4">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="p-3 bg-primary/10 rounded-2xl text-primary">
                        <Link2 className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                        <h1 className="text-lg font-semibold tracking-tight">Bindings</h1>
                        <p className="text-sm text-muted-foreground">Hook a registered event key to a template so the studio knows what to send.</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        className="min-h-11 md:min-h-0"
                        data-testid="bindings-registry-link"
                        size="sm"
                        variant="outline"
                        onClick={() => router.push("/hrm/mailing-studio/studio-event-registry")}
                    >
                        Configure event keys
                    </Button>
                    <Button className="min-h-11 md:min-h-0" size="sm" onClick={() => setCreateOpen(true)}>
                        Hook binding
                    </Button>
                </div>
            </header>

            <div className="flex flex-wrap items-center gap-2">
                <Input
                    aria-label="Search bindings"
                    className="h-8 w-full text-xs sm:max-w-xs"
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
                <Button
                    aria-label="Refresh bindings"
                    className="min-h-11 md:min-h-0"
                    disabled={isLoading}
                    size="sm"
                    variant="outline"
                    onClick={() => void refetch()}
                >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Refresh
                </Button>
                {data ? (
                    <span
                        className="ms-auto rounded-full border bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground tabular-nums"
                        data-testid="bindings-count"
                    >
                        {data.length} {data.length === 1 ? "binding" : "bindings"}
                    </span>
                ) : null}
            </div>

            {data && data.length > 0 ? (
                <p className="text-xs text-muted-foreground tabular-nums" data-testid="bindings-summary" role="status">
                    {data.length} binding{data.length === 1 ? "" : "s"}
                    {attentionCount > 0 ? ` · ${attentionCount} need${attentionCount === 1 ? "s" : ""} attention` : " · all reconciled"}
                </p>
            ) : null}

            {isLoading && !data ? (
                <div className="flex flex-col gap-2" data-testid="bindings-loading" role="status" aria-label="Loading bindings">
                    <div className="rounded-lg border bg-card p-3">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="mt-2 h-3 w-1/3" />
                    </div>
                    <div className="rounded-lg border bg-card p-3">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="mt-2 h-3 w-1/4" />
                    </div>
                    <span className="sr-only">Loading bindings…</span>
                </div>
            ) : null}

            {error ? (
                <div
                    className="rounded-lg border border-destructive/40 bg-card p-4"
                    data-testid="bindings-error"
                    role="alert"
                >
                    <p className="text-sm text-destructive">{humaniseBindingError(error)}</p>
                    <Button className="mt-2 min-h-11 md:min-h-0" disabled={retrying} size="sm" variant="outline" onClick={() => void handleRetry()}>
                        {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Retry
                    </Button>
                </div>
            ) : null}

            {!isLoading && !error && data && data.length === 0 ? (
                <div
                    className="flex flex-col items-center gap-2 rounded-lg border bg-card py-16 text-center"
                    data-testid="bindings-empty"
                >
                    <Link2 className="h-6 w-6 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No bindings hooked yet.</p>
                </div>
            ) : null}

            {!isLoading && !error && data && data.length > 0 && filtered.length === 0 ? (
                <div
                    className="flex flex-col items-center gap-2 rounded-lg border bg-card py-16 text-center"
                    data-testid="bindings-no-match"
                >
                    <SearchX className="h-6 w-6 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No bindings match this view.</p>
                    <p className="text-xs text-muted-foreground">Try a different search or filter.</p>
                </div>
            ) : null}

            {visible.length > 0 ? (
                <ul className="flex flex-col gap-2" data-testid="bindings-list">
                    {visible.map((item) => (
                        <BindingRowCard
                            busy={busyId === String(item.row.id)}
                            eventKeyText={resolveBindingKey(item.row.event_key_id)}
                            key={String(item.row.id)}
                            row={item.row}
                            templateName={resolveTemplateName(item.row.template_id)}
                            unmapped={item.unmapped}
                            unresolvable={item.unresolvable}
                            onEdit={() => setEditingRow(item.row)}
                            onRemove={() => setUnhookId(String(item.row.id))}
                            onToggle={() => void handleToggle(item.row.id, item.row.is_enabled)}
                        />
                    ))}
                </ul>
            ) : null}
            <MsPager page={page} totalPages={totalPages} onPage={setPage} />
            {createOpen ? (
                <MsBindingDialog
                    binding={null}
                    catalogError={catalog.error}
                    catalogLoading={catalog.isLoading}
                    eventOptions={eventOptions}
                    mode="create"
                    open
                    submitting={creating}
                    templateOptions={templateOptions}
                    templatesLoading={templates.isLoading}
                    onOpenChange={setCreateOpen}
                    onSubmit={handleCreateSubmit}
                />
            ) : null}
            {editingRow ? (
                <MsBindingDialog
                    binding={editingRow}
                    catalogError={catalog.error}
                    catalogLoading={catalog.isLoading}
                    eventOptions={eventOptions}
                    key={String(editingRow.id)}
                    mode="edit"
                    open
                    submitting={busyId === String(editingRow.id)}
                    templateOptions={templateOptions}
                    templatesLoading={templates.isLoading}
                    onOpenChange={(next) => {
                        if (!next) setEditingRow(null);
                    }}
                    onSubmit={handleEditSubmit}
                />
            ) : null}
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
