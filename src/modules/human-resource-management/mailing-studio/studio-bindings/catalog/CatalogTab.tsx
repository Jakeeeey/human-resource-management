"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { useMsCatalog } from "./useMsCatalog";
import { useMsPagination } from "../hooks/useMsPagination";
import {
    createMsCatalog,
    patchMsCatalog,
    retireMsCatalog,
} from "./msCatalog";
import { MS_EVENT_KEY_PATTERN } from "./ms-catalog.schema";
import type { MsCatalogRow } from "./ms-catalog.schema";
import { extractPayloadKeys } from "../utils/ms-variables";
import { MsConfirmDialog } from "../components/MsConfirmDialog";
import { MsPager } from "../components/MsPager";

type ActiveFilter = "all" | "active" | "retired";

type CatalogSort = "key" | "module" | "keys";

const FILTERS: readonly { readonly value: ActiveFilter; readonly label: string }[] = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "retired", label: "Retired" },
];

const SORT_OPTIONS: readonly { readonly value: CatalogSort; readonly label: string }[] = [
    { value: "key", label: "Key A–Z" },
    { value: "module", label: "Module A–Z" },
    { value: "keys", label: "Most payload keys" },
];

const EMPTY_COPY: Record<ActiveFilter, { readonly title: string; readonly hint: string }> = {
    all: { title: "No event keys registered yet.", hint: "Register the first key above." },
    active: { title: "No active event keys.", hint: "Register a key above or reactivate a retired one." },
    retired: { title: "No retired keys.", hint: "Retired keys stay here for audit." },
};

const KEY_SHAPE_HINT = "Lowercase letters, numbers, dots and underscores only (e.g. leave.approved).";

function rowIsActive(row: MsCatalogRow): boolean {
    const value: unknown = row.is_active;
    return value === true || value === 1 || value === "1" || value === "true";
}

function toEditableJson(value: unknown): string {
    if (typeof value === "string") return value;
    if (value === null || value === undefined) return "{}";
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return "{}";
    }
}

function validateJsonDocument(raw: string): string | null {
    if (raw.trim().length === 0) return "JSON document must not be empty";
    try {
        JSON.parse(raw);
    } catch {
        return "Must be valid JSON";
    }
    return null;
}

function CatalogRowCard({
    row,
    bindingCount,
    onChanged,
}: {
    readonly row: MsCatalogRow;
    readonly bindingCount: number;
    readonly onChanged: () => void;
}) {
    const [editing, setEditing] = useState(false);
    const [schemaDraft, setSchemaDraft] = useState("");
    const [exampleDraft, setExampleDraft] = useState("");
    const [schemaError, setSchemaError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [busy, setBusy] = useState(false);
    const [confirmRetire, setConfirmRetire] = useState(false);
    const active = rowIsActive(row);
    const providedKeys = useMemo(
        () => extractPayloadKeys(row.payload_schema, row.payload_example),
        [row.payload_schema, row.payload_example],
    );
    const draftKeyCount = useMemo(() => {
        if (!editing) return 0;
        return extractPayloadKeys(schemaDraft, exampleDraft).length;
    }, [editing, schemaDraft, exampleDraft]);

    const openEditor = (): void => {
        setSchemaDraft(toEditableJson(row.payload_schema));
        setExampleDraft(toEditableJson(row.payload_example));
        setSchemaError(null);
        setEditing(true);
    };

    const handleSaveSchema = async (): Promise<void> => {
        const schemaProblem = validateJsonDocument(schemaDraft);
        const exampleProblem = validateJsonDocument(exampleDraft);
        if (schemaProblem !== null || exampleProblem !== null) {
            setSchemaError(schemaProblem ?? exampleProblem ?? "Must be valid JSON");
            return;
        }
        setSaving(true);
        try {
            await patchMsCatalog(row.event_key, {
                payload_schema: schemaDraft.trim(),
                payload_example: exampleDraft.trim(),
            });
            toast.success(`Payload contract saved for ${row.event_key}.`);
            setEditing(false);
            onChanged();
        } catch (cause) {
            setSchemaError(cause instanceof Error ? cause.message : String(cause));
        } finally {
            setSaving(false);
        }
    };

    const handleRetireConfirm = async (): Promise<void> => {
        setBusy(true);
        try {
            await retireMsCatalog(row.event_key);
            toast.success(`${row.event_key} retired.`);
            setConfirmRetire(false);
            onChanged();
        } catch (cause) {
            toast.error(cause instanceof Error ? cause.message : String(cause));
        } finally {
            setBusy(false);
        }
    };

    const handleReactivate = async (): Promise<void> => {
        setBusy(true);
        try {
            await patchMsCatalog(row.event_key, { is_active: true });
            toast.success(`${row.event_key} reactivated.`);
            onChanged();
        } catch (cause) {
            toast.error(cause instanceof Error ? cause.message : String(cause));
        } finally {
            setBusy(false);
        }
    };

    return (
        <li
            className="flex flex-col gap-3 rounded-lg border bg-card p-3"
            data-testid="catalog-row"
        >
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium tabular-nums" title={row.event_key}>
                        {row.event_key}
                    </span>
                    <span className="truncate text-xs text-muted-foreground" title={`${row.label}${row.module ? ` · ${row.module}` : ""} · ${providedKeys.length} payload keys`}>
                        {row.label}
                        {row.module ? ` · ${row.module}` : ""}
                        {` · ${providedKeys.length} payload key${providedKeys.length === 1 ? "" : "s"}`}
                        {bindingCount > 0 ? ` · used by ${bindingCount} binding${bindingCount === 1 ? "" : "s"}` : ""}
                    </span>
                </div>
                <Badge variant={active ? "default" : "outline"}>
                    {active ? "Active" : "Retired"}
                </Badge>
                <Button
                    aria-label={`${editing ? "Close schema editor for" : "Schema for"} ${row.event_key}`}
                    className="min-h-11 md:min-h-0"
                    disabled={busy}
                    size="sm"
                    variant="outline"
                    onClick={() => (editing ? setEditing(false) : openEditor())}
                >
                    {editing ? "Close" : "Schema"}
                </Button>
                {active ? (
                    <Button
                        aria-label={`Retire ${row.event_key}`}
                        className="min-h-11 md:min-h-0"
                        disabled={busy}
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmRetire(true)}
                    >
                        Retire
                    </Button>
                ) : (
                    <Button
                        aria-label={`Reactivate ${row.event_key}`}
                        className="min-h-11 md:min-h-0"
                        disabled={busy}
                        size="sm"
                        variant="outline"
                        onClick={() => void handleReactivate()}
                    >
                        Reactivate
                    </Button>
                )}
            </div>
            {providedKeys.length > 0 ? (
                <div className="flex flex-wrap gap-1" data-testid="catalog-keys">
                    {providedKeys.map((key) => (
                        <span
                            className="rounded-full border bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                            key={key}
                            title={key}
                        >
                            {key}
                        </span>
                    ))}
                </div>
            ) : (
                <p className="text-[11px] leading-snug text-muted-foreground">
                    No payload keys yet — edit the schema above to declare the variable
                    names templates bound to this event may use.
                </p>
            )}
            {editing ? (
                <div className="flex flex-col gap-3 border-t pt-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <Label
                                className="text-xs font-medium text-muted-foreground"
                                htmlFor={`schema-${row.event_key}`}
                            >
                                payload_schema (JSON)
                            </Label>
                            <Textarea
                                className="min-h-[140px] resize-none font-mono text-xs"
                                id={`schema-${row.event_key}`}
                                rows={4}
                                spellCheck={false}
                                value={schemaDraft}
                                onChange={(event) => setSchemaDraft(event.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label
                                className="text-xs font-medium text-muted-foreground"
                                htmlFor={`example-${row.event_key}`}
                            >
                                payload_example (JSON)
                            </Label>
                            <Textarea
                                className="min-h-[140px] resize-none font-mono text-xs"
                                id={`example-${row.event_key}`}
                                rows={4}
                                spellCheck={false}
                                value={exampleDraft}
                                onChange={(event) => setExampleDraft(event.target.value)}
                            />
                        </div>
                    </div>
                    <p className="text-[11px] leading-snug text-muted-foreground">
                        JSON objects — top-level keys are the variable names templates may
                        use{draftKeyCount > 0 ? ` (currently ${draftKeyCount})` : ""}.
                    </p>
                    {schemaError ? (
                        <p className="text-xs text-destructive" role="alert">
                            {schemaError}
                        </p>
                    ) : null}
                    <div>
                        <Button
                            className="min-h-11 md:min-h-0"
                            disabled={saving}
                            size="sm"
                            onClick={() => void handleSaveSchema()}
                        >
                            {saving ? "Saving…" : "Save contract"}
                        </Button>
                    </div>
                </div>
            ) : null}
            <MsConfirmDialog
                confirmLabel="Retire key"
                description={`Bindings for ${row.event_key} stop validating${bindingCount > 0 ? ` (${bindingCount} hooked binding${bindingCount === 1 ? "" : "s"})` : ""}. The row survives, inactive, for audit.`}
                open={confirmRetire}
                title={`Retire ${row.event_key}?`}
                busy={busy}
                busyLabel="Retiring…"
                onConfirm={() => void handleRetireConfirm()}
                onOpenChange={setConfirmRetire}
            />
        </li>
    );
}

/**
 * Catalog panel (P6-T1): the studio-managed registry of fireable event keys.
 * List / register / retire keys and edit each key's payload_schema +
 * payload_example — the contract the variable picker and the reconciliation
 * surface read. Keys are data (D4); the row survives a retire, inactive.
 * Search + sort + pagination per QA §11.
 */
export function CatalogTab({ bindingCounts }: { readonly bindingCounts?: ReadonlyMap<string, number> }) {
    const { data, isLoading, error, refetch } = useMsCatalog();
    const [filter, setFilter] = useState<ActiveFilter>("all");
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState<CatalogSort>("key");
    const [eventKey, setEventKey] = useState("");
    const [label, setLabel] = useState("");
    const [moduleName, setModuleName] = useState("");
    const [schemaDraft, setSchemaDraft] = useState("{}");
    const [exampleDraft, setExampleDraft] = useState("{}");
    const [formError, setFormError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    const draftKeyCount = useMemo(() => {
        return extractPayloadKeys(schemaDraft, exampleDraft).length;
    }, [schemaDraft, exampleDraft]);

    const rows = useMemo(() => {
        const query = search.trim().toLowerCase();
        const kept = (data ?? []).filter((row) => {
            if (filter === "active" && !rowIsActive(row)) return false;
            if (filter === "retired" && rowIsActive(row)) return false;
            if (!query) return true;
            return (
                row.event_key.toLowerCase().includes(query) ||
                row.label.toLowerCase().includes(query) ||
                (row.module ?? "").toLowerCase().includes(query)
            );
        });
        return [...kept].sort((a, b) => {
            if (sort === "module") {
                return (a.module ?? "").localeCompare(b.module ?? "") || a.event_key.localeCompare(b.event_key);
            }
            if (sort === "keys") {
                const aKeys = extractPayloadKeys(a.payload_schema, a.payload_example).length;
                const bKeys = extractPayloadKeys(b.payload_schema, b.payload_example).length;
                return bKeys - aKeys || a.event_key.localeCompare(b.event_key);
            }
            return a.event_key.localeCompare(b.event_key);
        });
    }, [data, filter, search, sort]);

    const { page, totalPages, pageItems, setPage, resetPage } = useMsPagination(rows.length);
    const visible = pageItems(rows);

    const handleCreate = async (): Promise<void> => {
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
        const schemaProblem = validateJsonDocument(schemaDraft);
        if (schemaProblem !== null) {
            setFormError(`payload_schema: ${schemaProblem}`);
            return;
        }
        const exampleProblem = validateJsonDocument(exampleDraft);
        if (exampleProblem !== null) {
            setFormError(`payload_example: ${exampleProblem}`);
            return;
        }
        setCreating(true);
        try {
            await createMsCatalog({
                event_key: key,
                label: label.trim(),
                ...(moduleName.trim().length > 0 ? { module: moduleName.trim() } : {}),
                payload_schema: schemaDraft.trim(),
                payload_example: exampleDraft.trim(),
            });
            toast.success(`Event key ${key} registered.`);
            setEventKey("");
            setLabel("");
            setModuleName("");
            setSchemaDraft("{}");
            setExampleDraft("{}");
            await refetch();
        } catch (cause) {
            setFormError(cause instanceof Error ? cause.message : String(cause));
        } finally {
            setCreating(false);
        }
    };

    return (
        <section aria-label="Event catalog" className="flex shrink-0 flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-lg border bg-card p-4" data-testid="catalog-form">
                <h2 className="text-sm font-semibold">Register an event key</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium text-muted-foreground" htmlFor="catalog-event-key">
                            Event key <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            className="h-8 font-mono text-xs"
                            id="catalog-event-key"
                            placeholder="leave.approved"
                            spellCheck={false}
                            value={eventKey}
                            onChange={(event) => setEventKey(event.target.value)}
                        />
                        <p className="text-[11px] leading-snug text-muted-foreground">{KEY_SHAPE_HINT}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium text-muted-foreground" htmlFor="catalog-label">
                            Label <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            className="h-8 text-xs"
                            id="catalog-label"
                            placeholder="Leave approved"
                            value={label}
                            onChange={(event) => setLabel(event.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium text-muted-foreground" htmlFor="catalog-module">
                            Module
                        </Label>
                        <Input
                            className="h-8 text-xs"
                            id="catalog-module"
                            placeholder="leave"
                            value={moduleName}
                            onChange={(event) => setModuleName(event.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <span className="text-xs font-medium text-muted-foreground" id="catalog-contract-hint">
                            Contract
                        </span>
                        <p aria-labelledby="catalog-contract-hint" className="text-[11px] leading-relaxed text-muted-foreground">
                            Schema keys are the only variable names templates bound to this
                            event may use.
                        </p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium text-muted-foreground" htmlFor="catalog-schema">
                            payload_schema (JSON)
                        </Label>
                        <Textarea
                            className="min-h-[140px] resize-none font-mono text-xs"
                            id="catalog-schema"
                            rows={4}
                            spellCheck={false}
                            value={schemaDraft}
                            onChange={(event) => setSchemaDraft(event.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium text-muted-foreground" htmlFor="catalog-example">
                            payload_example (JSON)
                        </Label>
                        <Textarea
                            className="min-h-[140px] resize-none font-mono text-xs"
                            id="catalog-example"
                            rows={4}
                            spellCheck={false}
                            value={exampleDraft}
                            onChange={(event) => setExampleDraft(event.target.value)}
                        />
                    </div>
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">
                    JSON objects — top-level keys are the variable names templates may use
                    {draftKeyCount > 0 ? ` (currently ${draftKeyCount})` : ""}.
                </p>
                {formError ? (
                    <p className="text-xs text-destructive" role="alert">
                        {formError}
                    </p>
                ) : null}
                <div>
                    <Button className="min-h-11 md:min-h-0" disabled={creating} size="sm" onClick={() => void handleCreate()}>
                        {creating ? "Registering…" : "Register key"}
                    </Button>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold">Registered keys</h2>
                    {rows ? (
                        <span
                            className="rounded-full border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground tabular-nums"
                            data-testid="catalog-count"
                        >
                            {rows.length}
                        </span>
                    ) : null}
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1" role="group" aria-label="Catalog filter">
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
                    <Button
                        aria-label="Refresh catalog"
                        className="min-h-11 md:min-h-0"
                        disabled={isLoading}
                        size="sm"
                        variant="outline"
                        onClick={() => void refetch()}
                    >
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <Input
                    aria-label="Search catalog"
                    className="h-8 max-w-xs text-xs"
                    placeholder="Search key, label, or module…"
                    value={search}
                    onChange={(event) => {
                        setSearch(event.target.value);
                        resetPage();
                    }}
                />
                <Select
                    value={sort}
                    onValueChange={(next) => {
                        setSort(next as CatalogSort);
                        resetPage();
                    }}
                >
                    <SelectTrigger aria-label="Sort catalog" className="h-8 max-w-[220px] text-xs" size="sm">
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
                <div className="flex flex-col gap-2" data-testid="catalog-loading" role="status" aria-label="Loading catalog">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <span className="sr-only">Loading catalog…</span>
                </div>
            ) : null}

            {error ? (
                <div
                    className="rounded-lg border border-destructive/40 bg-card p-4"
                    data-testid="catalog-error"
                    role="alert"
                >
                    <p className="text-sm text-destructive">{error}</p>
                    <Button className="mt-2 min-h-11 md:min-h-0" size="sm" variant="outline" onClick={() => void refetch()}>
                        Retry
                    </Button>
                </div>
            ) : null}

            {!isLoading && !error && rows.length === 0 ? (
                <div
                    className="flex flex-col items-center gap-2 rounded-lg border bg-card py-16 text-center"
                    data-testid="catalog-empty"
                >
                    <p className="text-sm text-muted-foreground">{EMPTY_COPY[filter].title}</p>
                    <p className="text-xs text-muted-foreground">{EMPTY_COPY[filter].hint}</p>
                </div>
            ) : null}

            {visible.length > 0 ? (
                <ul className="flex flex-col gap-2" data-testid="catalog-list">
                    {visible.map((row) => (
                        <CatalogRowCard
                            bindingCount={bindingCounts?.get(row.event_key) ?? 0}
                            key={row.event_key}
                            row={row}
                            onChanged={() => void refetch()}
                        />
                    ))}
                </ul>
            ) : null}
            <MsPager page={page} totalPages={totalPages} onPage={setPage} />
        </section>
    );
}
