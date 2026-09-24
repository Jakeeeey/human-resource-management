"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { useMsCatalog } from "../hooks/useMsCatalog";
import {
    createMsCatalog,
    patchMsCatalog,
    retireMsCatalog,
} from "../providers/msCatalog";
import type { MsCatalogRow } from "../types/ms-catalog.schema";
import { extractPayloadKeys } from "../utils/ms-variables";

type ActiveFilter = "all" | "active" | "retired";

const FILTERS: readonly { readonly value: ActiveFilter; readonly label: string }[] = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "retired", label: "Retired" },
];

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
    onChanged,
}: {
    readonly row: MsCatalogRow;
    readonly onChanged: () => void;
}) {
    const [editing, setEditing] = useState(false);
    const [schemaDraft, setSchemaDraft] = useState("");
    const [exampleDraft, setExampleDraft] = useState("");
    const [schemaError, setSchemaError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [busy, setBusy] = useState(false);
    const active = rowIsActive(row);
    const providedKeys = useMemo(
        () => extractPayloadKeys(row.payload_schema, row.payload_example),
        [row.payload_schema, row.payload_example],
    );

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

    const handleRetire = async (): Promise<void> => {
        if (!window.confirm(`Retire ${row.event_key}? Bindings for it stop validating.`)) return;
        setBusy(true);
        try {
            await retireMsCatalog(row.event_key);
            toast.success(`${row.event_key} retired.`);
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
                    <span className="truncate text-sm font-medium tabular-nums">
                        {row.event_key}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                        {row.label}
                        {row.module ? ` · ${row.module}` : ""}
                        {` · ${providedKeys.length} payload key${providedKeys.length === 1 ? "" : "s"}`}
                    </span>
                </div>
                <Badge variant={active ? "default" : "outline"}>
                    {active ? "Active" : "Retired"}
                </Badge>
                <Button
                    aria-label={`${editing ? "Close schema editor for" : "Edit payload schema for"} ${row.event_key}`}
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
                        disabled={busy}
                        size="sm"
                        variant="outline"
                        onClick={() => void handleRetire()}
                    >
                        Retire
                    </Button>
                ) : (
                    <Button
                        aria-label={`Reactivate ${row.event_key}`}
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
                        >
                            {key}
                        </span>
                    ))}
                </div>
            ) : null}
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
                                className="min-h-[96px] font-mono text-xs"
                                id={`schema-${row.event_key}`}
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
                                className="min-h-[96px] font-mono text-xs"
                                id={`example-${row.event_key}`}
                                spellCheck={false}
                                value={exampleDraft}
                                onChange={(event) => setExampleDraft(event.target.value)}
                            />
                        </div>
                    </div>
                    {schemaError ? (
                        <p className="text-xs text-destructive" role="alert">
                            {schemaError}
                        </p>
                    ) : null}
                    <div>
                        <Button
                            aria-label={`Save payload contract for ${row.event_key}`}
                            disabled={saving}
                            size="sm"
                            onClick={() => void handleSaveSchema()}
                        >
                            {saving ? "Saving…" : "Save contract"}
                        </Button>
                    </div>
                </div>
            ) : null}
        </li>
    );
}

/**
 * Catalog panel (P6-T1): the studio-managed registry of fireable event keys.
 * List / register / retire keys and edit each key's payload_schema +
 * payload_example — the contract the variable picker and the reconciliation
 * surface read. Keys are data (D4); the row survives a retire, inactive.
 */
export function CatalogTab() {
    const { data, isLoading, error, refetch } = useMsCatalog();
    const [filter, setFilter] = useState<ActiveFilter>("all");
    const [eventKey, setEventKey] = useState("");
    const [label, setLabel] = useState("");
    const [moduleName, setModuleName] = useState("");
    const [schemaDraft, setSchemaDraft] = useState("{}");
    const [exampleDraft, setExampleDraft] = useState("{}");
    const [formError, setFormError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    const rows = useMemo(() => {
        if (!data) return null;
        if (filter === "all") return data;
        return data.filter((row) =>
            filter === "active" ? rowIsActive(row) : !rowIsActive(row),
        );
    }, [data, filter]);

    const handleCreate = async (): Promise<void> => {
        setFormError(null);
        if (eventKey.trim().length === 0) {
            setFormError("Event key is required.");
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
                event_key: eventKey.trim(),
                label: label.trim(),
                ...(moduleName.trim().length > 0 ? { module: moduleName.trim() } : {}),
                payload_schema: schemaDraft.trim(),
                payload_example: exampleDraft.trim(),
            });
            toast.success(`Event key ${eventKey.trim()} registered.`);
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
        <section aria-label="Event catalog" className="flex min-h-0 flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-lg border bg-card p-4" data-testid="catalog-form">
                <h2 className="text-sm font-semibold">Register an event key</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium text-muted-foreground" htmlFor="catalog-event-key">
                            Event key
                        </Label>
                        <Input
                            className="h-8 font-mono text-xs"
                            id="catalog-event-key"
                            placeholder="leave.approved"
                            spellCheck={false}
                            value={eventKey}
                            onChange={(event) => setEventKey(event.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium text-muted-foreground" htmlFor="catalog-label">
                            Label
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
                            className="min-h-[72px] font-mono text-xs"
                            id="catalog-schema"
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
                            className="min-h-[72px] font-mono text-xs"
                            id="catalog-example"
                            spellCheck={false}
                            value={exampleDraft}
                            onChange={(event) => setExampleDraft(event.target.value)}
                        />
                    </div>
                </div>
                {formError ? (
                    <p className="text-xs text-destructive" role="alert">
                        {formError}
                    </p>
                ) : null}
                <div>
                    <Button aria-label="Register event key" disabled={creating} size="sm" onClick={() => void handleCreate()}>
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
                                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-150",
                                    filter === option.value
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                                )}
                                key={option.value}
                                type="button"
                                onClick={() => setFilter(option.value)}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                    <Button
                        aria-label="Refresh catalog"
                        disabled={isLoading}
                        size="sm"
                        variant="outline"
                        onClick={() => void refetch()}
                    >
                        Refresh
                    </Button>
                </div>
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
                    <p className="text-sm text-muted-foreground">{error}</p>
                    <Button className="mt-2" size="sm" variant="outline" onClick={() => void refetch()}>
                        Retry
                    </Button>
                </div>
            ) : null}

            {!isLoading && !error && rows && rows.length === 0 ? (
                <div
                    className="flex items-center justify-center rounded-lg border bg-card py-16"
                    data-testid="catalog-empty"
                >
                    <p className="text-sm text-muted-foreground">No event keys registered yet.</p>
                </div>
            ) : null}

            {rows && rows.length > 0 ? (
                <ul className="flex flex-col gap-2" data-testid="catalog-list">
                    {rows.map((row) => (
                        <CatalogRowCard key={row.event_key} row={row} onChanged={() => void refetch()} />
                    ))}
                </ul>
            ) : null}
        </section>
    );
}
