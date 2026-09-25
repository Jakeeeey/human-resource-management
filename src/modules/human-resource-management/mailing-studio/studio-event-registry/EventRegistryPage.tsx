"use client";

import { useMemo, useState } from "react";
import {
    Archive,
    Inbox,
    ListTree,
    ListX,
    Loader2,
    MoreVertical,
    Pencil,
    RefreshCw,
    RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { useMsCatalog } from "./hooks/useMsCatalog";
import { useMsPagination } from "./hooks/useMsPagination";
import {
    patchMsCatalog,
    retireMsCatalog,
} from "./providers/msCatalog";
import type { MsCatalogRow } from "./types/ms-catalog.schema";
import { parseVariablesFromDocuments } from "./utils/ms-event-variables";
import { MsConfirmDialog } from "./components/MsConfirmDialog";
import { MsPager } from "./components/MsPager";
import { RegistryDialog, humaniseRegistryError } from "./components/RegistryDialog";

type ActiveFilter = "all" | "active" | "retired";

type RegistrySort = "key" | "module" | "keys";

const FILTERS: readonly { readonly value: ActiveFilter; readonly label: string }[] = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "retired", label: "Retired" },
];

const SORT_OPTIONS: readonly { readonly value: RegistrySort; readonly label: string }[] = [
    { value: "key", label: "Key A–Z" },
    { value: "module", label: "Module A–Z" },
    { value: "keys", label: "Most payload keys" },
];

const EMPTY_COPY: Record<ActiveFilter, { readonly title: string; readonly hint: string }> = {
    all: { title: "No event keys registered yet.", hint: "Use “Register event key” to add the first key." },
    active: { title: "No active event keys.", hint: "Register a key or reactivate a retired one." },
    retired: { title: "No retired keys.", hint: "Retired keys stay here for audit." },
};

function rowIsActive(row: MsCatalogRow): boolean {
    const value: unknown = row.is_active;
    return value === true || value === 1 || value === "1" || value === "true";
}

function RegistryRowCard({
    row,
    onChanged,
    onEdit,
}: {
    readonly row: MsCatalogRow;
    readonly onChanged: () => void;
    readonly onEdit: (row: MsCatalogRow) => void;
}) {
    const [busy, setBusy] = useState(false);
    const [confirmRetire, setConfirmRetire] = useState(false);
    const active = rowIsActive(row);
    const variables = useMemo(
        () => parseVariablesFromDocuments(row.payload_schema, row.payload_example),
        [row.payload_schema, row.payload_example],
    );
    const subtitle = `${row.label}${row.module ? ` · ${row.module}` : ""} · ${variables.length} variable${variables.length === 1 ? "" : "s"}`;

    const handleRetireConfirm = async (): Promise<void> => {
        setBusy(true);
        try {
            await retireMsCatalog(row.event_key);
            toast.success(`${row.event_key} retired.`);
            setConfirmRetire(false);
            onChanged();
        } catch (cause) {
            const raw = cause instanceof Error ? cause.message : String(cause);
            toast.error(humaniseRegistryError(raw, row.event_key));
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
            const raw = cause instanceof Error ? cause.message : String(cause);
            toast.error(humaniseRegistryError(raw, row.event_key));
        } finally {
            setBusy(false);
        }
    };

    return (
        <li
            className="flex flex-col gap-2 rounded-lg border bg-card p-3"
            data-testid="registry-row"
        >
            <div className="flex items-start gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-mono text-sm font-medium" title={row.event_key}>
                        {row.event_key}
                    </span>
                    <span className="truncate text-xs text-muted-foreground" title={subtitle}>
                        {subtitle}
                    </span>
                </div>
                <Badge
                    className={active
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "border-border bg-muted text-muted-foreground"}
                    variant="outline"
                >
                    {active ? "Active" : "Retired"}
                </Badge>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            aria-label={`Actions for ${row.event_key}`}
                            className="h-8 w-8"
                            disabled={busy}
                            size="icon"
                            variant="ghost"
                        >
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[180px]">
                        <DropdownMenuItem onSelect={() => onEdit(row)}>
                            <Pencil className="h-4 w-4" />
                            Edit variables
                        </DropdownMenuItem>
                        {active ? (
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() => setConfirmRetire(true)}
                            >
                                <Archive className="h-4 w-4" />
                                Retire
                            </DropdownMenuItem>
                        ) : (
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() => void handleReactivate()}
                            >
                                <RotateCcw className="h-4 w-4" />
                                Reactivate
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            {row.description ? (
                <p className="truncate text-xs text-muted-foreground" title={row.description}>
                    {row.description}
                </p>
            ) : null}
            {variables.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5" data-testid="registry-keys">
                    {variables.map((variable) => {
                        const example = variable.example.trim();
                        const detail = example.length > 0
                            ? `${variable.name} · ${variable.type} · e.g. ${example}`
                            : `${variable.name} · ${variable.type}`;
                        return (
                            <li
                                className="flex min-w-0 max-w-full items-center gap-1.5 rounded-full border bg-muted px-2.5 py-0.5 text-[11px]"
                                key={variable.name}
                                title={detail}
                            >
                                <span className="truncate font-mono font-medium text-foreground" title={variable.name}>
                                    {variable.name}
                                </span>
                                <span className="shrink-0 rounded border border-border bg-background px-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                                    {variable.type}
                                </span>
                                {example.length > 0 ? (
                                    <span className="max-w-32 min-w-0 truncate italic text-muted-foreground" title={example}>
                                        {example}
                                    </span>
                                ) : null}
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p className="flex items-center gap-1.5 text-[11px] leading-snug text-muted-foreground" data-testid="registry-keys">
                    <ListX className="h-3.5 w-3.5 shrink-0" />
                    No payload variables yet — edit the variables to declare the names templates bound to this event may use.
                </p>
            )}
            <MsConfirmDialog
                confirmLabel="Retire key"
                description={`Bindings for ${row.event_key} stop validating. The row survives, inactive, for audit.`}
                open={confirmRetire}
                title={`Retire ${row.event_key}?`}
                busy={busy}
                busyLabel="Retiring"
                onConfirm={() => void handleRetireConfirm()}
                onOpenChange={setConfirmRetire}
            />
        </li>
    );
}

export function EventRegistryPage() {
    const { data, isLoading, error, refetch } = useMsCatalog();
    const [filter, setFilter] = useState<ActiveFilter>("all");
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState<RegistrySort>("key");
    const [createOpen, setCreateOpen] = useState(false);
    const [editingRow, setEditingRow] = useState<MsCatalogRow | null>(null);
    const [retrying, setRetrying] = useState(false);

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
                const aKeys = parseVariablesFromDocuments(a.payload_schema, a.payload_example).length;
                const bKeys = parseVariablesFromDocuments(b.payload_schema, b.payload_example).length;
                return bKeys - aKeys || a.event_key.localeCompare(b.event_key);
            }
            return a.event_key.localeCompare(b.event_key);
        });
    }, [data, filter, search, sort]);

    const { page, totalPages, pageItems, setPage, resetPage } = useMsPagination(rows.length);
    const visible = pageItems(rows);

    const editingVariables = useMemo(
        () => (editingRow
            ? parseVariablesFromDocuments(editingRow.payload_schema, editingRow.payload_example)
            : []),
        [editingRow],
    );

    const handleRetry = async (): Promise<void> => {
        setRetrying(true);
        try {
            await refetch();
        } finally {
            setRetrying(false);
        }
    };

    return (
        <section aria-label="Event registry" className="flex min-h-0 flex-1 flex-col gap-4">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="p-3 bg-primary/10 rounded-2xl text-primary">
                        <ListTree className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                        <h1 className="text-lg font-semibold tracking-tight">Event registry</h1>
                        <p className="text-sm text-muted-foreground">Register the events the studio can send, and the payload variables their templates may use.</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button className="min-h-11 md:min-h-0" size="sm" onClick={() => setCreateOpen(true)}>
                        Register event key
                    </Button>
                </div>
            </header>

            <div className="flex flex-wrap items-center gap-2">
                <Input
                    aria-label="Search registry"
                    className="h-8 w-full text-xs sm:max-w-xs"
                    placeholder="Search key, label, or module…"
                    value={search}
                    onChange={(event) => {
                        setSearch(event.target.value);
                        resetPage();
                    }}
                />
                <div className="flex items-center gap-1" role="group" aria-label="Registry filter">
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
                        setSort(next as RegistrySort);
                        resetPage();
                    }}
                >
                    <SelectTrigger aria-label="Sort registry" className="h-8 max-w-[220px] text-xs" size="sm">
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
                    aria-label="Refresh registry"
                    className="min-h-11 md:min-h-0"
                    disabled={isLoading}
                    size="sm"
                    variant="outline"
                    onClick={() => void refetch()}
                >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Refresh
                </Button>
                <span
                    className="ms-auto rounded-full border bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground tabular-nums"
                    data-testid="registry-count"
                >
                    {rows.length} key{rows.length === 1 ? "" : "s"}
                </span>
            </div>

            {isLoading && !data ? (
                <div className="flex flex-col gap-2" data-testid="registry-loading" role="status" aria-label="Loading registry">
                    {[0, 1].map((index) => (
                        <div className="flex flex-col gap-2 rounded-lg border bg-card p-3" key={index}>
                            <div className="flex items-start gap-3">
                                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                    <Skeleton className="h-4 w-1/3" />
                                    <Skeleton className="h-3 w-2/3" />
                                </div>
                                <Skeleton className="h-5 w-14 rounded-full" />
                                <Skeleton className="h-8 w-8 rounded-md" />
                            </div>
                            <div className="flex gap-1.5">
                                <Skeleton className="h-5 w-24 rounded-full" />
                                <Skeleton className="h-5 w-20 rounded-full" />
                            </div>
                        </div>
                    ))}
                    <span className="sr-only">Loading registry…</span>
                </div>
            ) : null}

            {error ? (
                <div
                    className="rounded-lg border border-destructive/40 bg-card p-4"
                    data-testid="registry-error"
                    role="alert"
                >
                    <p className="text-sm text-destructive">{humaniseRegistryError(error)}</p>
                    <Button className="mt-2 min-h-11 md:min-h-0" disabled={retrying} size="sm" variant="outline" onClick={() => void handleRetry()}>
                        {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Retry
                    </Button>
                </div>
            ) : null}

            {!isLoading && !error && rows.length === 0 ? (
                <div
                    className="flex flex-col items-center gap-2 rounded-lg border bg-card px-4 py-16 text-center"
                    data-testid="registry-empty"
                >
                    <Inbox className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{EMPTY_COPY[filter].title}</p>
                    <p className="text-xs text-muted-foreground">{EMPTY_COPY[filter].hint}</p>
                </div>
            ) : null}

            {visible.length > 0 ? (
                <ul className="flex flex-col gap-2" data-testid="registry-list">
                    {visible.map((row) => (
                        <RegistryRowCard
                            key={row.event_key}
                            row={row}
                            onChanged={() => void refetch()}
                            onEdit={setEditingRow}
                        />
                    ))}
                </ul>
            ) : null}
            <MsPager page={page} totalPages={totalPages} onPage={setPage} />
            <RegistryDialog
                mode="create"
                open={createOpen}
                onOpenChange={setCreateOpen}
                row={null}
                initialVariables={[]}
                onSaved={() => void refetch()}
            />
            {editingRow ? (
                <RegistryDialog
                    mode="edit"
                    open={editingRow !== null}
                    onOpenChange={(next) => {
                        if (!next) setEditingRow(null);
                    }}
                    row={editingRow}
                    initialVariables={editingVariables}
                    onSaved={() => void refetch()}
                />
            ) : null}
        </section>
    );
}
