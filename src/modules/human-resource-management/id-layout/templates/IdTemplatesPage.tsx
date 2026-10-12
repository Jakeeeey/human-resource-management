"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { IdCard, Loader2, MoreVertical, RefreshCw, SearchX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { blankIdDoc } from "./idSample";
import { IdCombobox } from "./IdCombobox";
import { createIdTemplate, deleteIdTemplate, isActiveFlag, isDefaultFlag, listIdCompanies, listIdTemplates, patchIdTemplate } from "./idApi";
import type { IdCompanyRow, IdTemplateRow } from "./idApi";

export const ID_PAGE_SIZE = 10;

function companyNameOf(row: IdTemplateRow, companies: readonly IdCompanyRow[]): string {
    if (row.company_name && row.company_name.trim() !== "") return row.company_name;
    if (row.company_id === null) return "No company";
    const found = companies.find((company) => company.company_id === row.company_id);
    return found ? found.company_name : `Company ${row.company_id}`;
}

export function IdTemplatesPage() {
    const router = useRouter();
    const [rows, setRows] = useState<IdTemplateRow[] | null>(null);
    const [companies, setCompanies] = useState<IdCompanyRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [retrying, setRetrying] = useState(false);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [newName, setNewName] = useState("");
    const [newCompany, setNewCompany] = useState<string>("none");
    const [newDefault, setNewDefault] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<IdTemplateRow | null>(null);

    const refresh = async (): Promise<void> => {
        try {
            const [listed, companyRows] = await Promise.all([
                listIdTemplates(),
                listIdCompanies().catch(() => [] as IdCompanyRow[]),
            ]);
            setRows(listed);
            setCompanies(companyRows);
            setError(null);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Failed to load templates.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void refresh();
    }, []);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        const list = rows ?? [];
        if (query === "") return [...list].sort((a, b) => a.name.localeCompare(b.name));
        return list
            .filter((row) => row.name.toLowerCase().includes(query) || companyNameOf(row, companies).toLowerCase().includes(query))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [rows, search, companies]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / ID_PAGE_SIZE));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const visible = filtered.slice((safePage - 1) * ID_PAGE_SIZE, safePage * ID_PAGE_SIZE);

    const handleRetry = async (): Promise<void> => {
        setRetrying(true);
        try {
            await refresh();
        } finally {
            setRetrying(false);
        }
    };

    const handleCreate = async (): Promise<void> => {
        const name = newName.trim();
        if (name === "") {
            setCreateError("Template name is required.");
            return;
        }
        setCreating(true);
        setCreateError(null);
        try {
            const row = await createIdTemplate({
                name,
                company_id: newCompany === "none" ? null : Number(newCompany),
                is_default: newDefault,
                is_active: true,
                design_json: blankIdDoc(),
            });
            toast.success("Template created.");
            setCreateOpen(false);
            setNewName("");
            setNewCompany("none");
            setNewDefault(false);
            router.push(`/hrm/id-layout/${encodeURIComponent(String(row.id))}`);
        } catch (cause) {
            setCreateError(cause instanceof Error ? cause.message : "Could not create the template.");
        } finally {
            setCreating(false);
        }
    };

    const handleToggleActive = async (row: IdTemplateRow): Promise<void> => {
        setBusyId(row.id);
        setActionError(null);
        try {
            await patchIdTemplate(row.id, { is_active: !isActiveFlag(row.is_active) });
            await refresh();
        } catch (cause) {
            setActionError(cause instanceof Error ? cause.message : "Could not update the template.");
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async (): Promise<void> => {
        if (!deleteTarget) return;
        setBusyId(deleteTarget.id);
        try {
            await deleteIdTemplate(deleteTarget.id);
            toast.success("Template deleted.");
            setDeleteTarget(null);
            await refresh();
        } catch (cause) {
            setActionError(cause instanceof Error ? cause.message : "Could not delete the template.");
            setDeleteTarget(null);
        } finally {
            setBusyId(null);
        }
    };

    return (
        <section aria-label="ID templates" className="flex min-h-0 flex-1 flex-col gap-4">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="rounded-2xl bg-primary/10 p-3 text-primary">
                        <IdCard className="size-5" />
                    </span>
                    <div className="min-w-0">
                        <h1 className="text-lg font-semibold tracking-tight">ID Layout</h1>
                        <p className="text-sm text-muted-foreground">Employee ID card templates — open one to edit its front and back.</p>
                    </div>
                </div>
                <Button aria-label="New template" className="min-h-11 md:min-h-0" size="sm" onClick={() => { setCreateError(null); setCreateOpen(true); }}>
                    New template
                </Button>
            </header>

            <div className="flex flex-wrap items-center gap-2">
                <Input
                    aria-label="Search templates"
                    className="h-8 w-full text-xs sm:max-w-xs"
                    placeholder="Search name or company…"
                    value={search}
                    onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(1);
                    }}
                />
                <Button aria-label="Refresh templates" className="min-h-11 md:min-h-0" disabled={loading} size="sm" variant="outline" onClick={() => void handleRetry()}>
                    {loading || retrying ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                    Refresh
                </Button>
                {rows ? (
                    <span className="ms-auto rounded-full border bg-muted px-2.5 py-0.5 text-[11px] tabular-nums text-muted-foreground" data-testid="id-templates-count">
                        {rows.length}
                    </span>
                ) : null}
            </div>

            {loading && rows === null ? (
                <div className="flex flex-col gap-2" role="status" aria-label="Loading templates">
                    {[0, 1].map((index) => (
                        <div className="flex flex-col gap-2 rounded-lg border bg-card p-3" key={index}>
                            <Skeleton className="h-4 w-1/3" />
                            <Skeleton className="h-3 w-2/3" />
                        </div>
                    ))}
                    <span className="sr-only">Loading templates…</span>
                </div>
            ) : null}

            {error ? (
                <div className="rounded-lg border border-destructive/40 bg-card p-4" role="alert">
                    <p className="text-sm text-destructive">{error}</p>
                    <Button className="mt-2 min-h-11 md:min-h-0" disabled={retrying} size="sm" variant="outline" onClick={() => void handleRetry()}>
                        {retrying ? <Loader2 className="size-4 animate-spin" /> : null}
                        Retry
                    </Button>
                </div>
            ) : null}

            {actionError ? (
                <div className="rounded-lg border border-destructive/40 bg-card p-4" role="alert">
                    <p className="text-sm text-destructive">{actionError}</p>
                </div>
            ) : null}

            {!loading && !error && rows && rows.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border bg-card px-4 py-16 text-center">
                    <IdCard aria-hidden="true" className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No ID templates yet.</p>
                    <Button className="min-h-11 md:min-h-0" size="sm" onClick={() => { setCreateError(null); setCreateOpen(true); }}>
                        Create the first template
                    </Button>
                </div>
            ) : null}

            {!loading && !error && rows && rows.length > 0 && filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border bg-card px-4 py-16 text-center">
                    <SearchX aria-hidden="true" className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No templates match the search.</p>
                </div>
            ) : null}

            {visible.length > 0 ? (
                <ul className="flex flex-col gap-2">
                    {visible.map((row) => {
                        const busy = busyId === row.id;
                        const active = isActiveFlag(row.is_active);
                        const isDefault = isDefaultFlag(row.is_default);
                        return (
                            <li className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors duration-150 hover:border-primary/40" key={row.id}>
                                <Link aria-label={`Open in editor: ${row.name}`} className="flex min-w-0 flex-1 flex-wrap items-center gap-3" href={`/hrm/id-layout/${encodeURIComponent(String(row.id))}`}>
                                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                        <span className="truncate text-sm font-medium" title={row.name}>{row.name}</span>
                                        <span className="truncate text-xs text-muted-foreground" title={companyNameOf(row, companies)}>{companyNameOf(row, companies)}</span>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1.5">
                                        {isDefault ? <Badge variant="default">Default</Badge> : null}
                                        <Badge className={cn(!active && "border-border bg-muted text-muted-foreground")} variant={active ? "secondary" : "outline"}>
                                            {active ? "Active" : "Inactive"}
                                        </Badge>
                                    </div>
                                </Link>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button aria-label={`Actions for template ${row.name}`} className="size-8 shrink-0" disabled={busy} size="icon" variant="ghost">
                                            {busy ? <Loader2 className="size-4 animate-spin" /> : <MoreVertical className="size-4" />}
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-[180px]">
                                        <DropdownMenuItem disabled={busy} onSelect={() => router.push(`/hrm/id-layout/${encodeURIComponent(String(row.id))}`)}>
                                            Edit in designer
                                        </DropdownMenuItem>
                                        <DropdownMenuItem disabled={busy} onSelect={() => void handleToggleActive(row)}>
                                            {active ? "Deactivate" : "Activate"}
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" disabled={busy} onSelect={() => setDeleteTarget(row)}>
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </li>
                        );
                    })}
                </ul>
            ) : null}

            {filtered.length > ID_PAGE_SIZE ? (
                <div className="flex items-center justify-between gap-2">
                    <Button aria-label="Previous page" disabled={safePage <= 1} size="sm" variant="outline" onClick={() => setPage(safePage - 1)}>Previous</Button>
                    <span aria-live="polite" className="text-xs tabular-nums text-muted-foreground">Page {safePage} of {totalPages}</span>
                    <Button aria-label="Next page" disabled={safePage >= totalPages} size="sm" variant="outline" onClick={() => setPage(safePage + 1)}>Next</Button>
                </div>
            ) : null}

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>New ID template</DialogTitle>
                        <DialogDescription>Creates a blank front-and-back card. A deactivated default frees its fallback slot.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium" htmlFor="id-new-name">Name</Label>
                            <Input aria-label="Template name" className="h-9 text-sm" id="id-new-name" placeholder="VTC employee ID" value={newName} onChange={(event) => setNewName(event.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium" htmlFor="id-new-company">Linked company</Label>
                            <IdCombobox
                                className="h-9 text-sm"
                                id="id-new-company"
                                options={[{ value: "none", label: "No company" }, ...companies.map((company) => ({ value: String(company.company_id), label: company.company_name }))]}
                                placeholder="No company"
                                value={newCompany}
                                onValueChange={setNewCompany}
                            />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs font-medium" htmlFor="id-new-default">Fallback default</Label>
                            <Switch checked={newDefault} id="id-new-default" size="sm" onCheckedChange={setNewDefault} />
                        </div>
                        {createError ? <p className="text-xs leading-snug text-destructive" role="alert">{createError}</p> : null}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                        <Button disabled={creating} onClick={() => void handleCreate()}>
                            {creating ? <Loader2 className="size-4 animate-spin" /> : null}
                            Create template
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete this template?</DialogTitle>
                        <DialogDescription>
                            {deleteTarget ? `“${deleteTarget.name}” will be removed. Templates referenced by name stay taken until the row is gone.` : "This template will be removed."}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
                        <Button disabled={busyId !== null} variant="destructive" onClick={() => void handleDelete()}>
                            {busyId !== null ? <Loader2 className="size-4 animate-spin" /> : null}
                            Delete template
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
